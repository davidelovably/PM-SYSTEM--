import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { requirementId, selectedMilestones } = await req.json();
    console.log('Creating structure from requirement:', requirementId, 'Selected:', selectedMilestones);

    // Validate inputs
    if (!requirementId || typeof requirementId !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Requirement ID richiesto' }),
        { status: 400, headers: corsHeaders }
      );
    }

    if (!selectedMilestones || !Array.isArray(selectedMilestones)) {
      return new Response(
        JSON.stringify({ error: 'selectedMilestones deve essere un array' }),
        { status: 400, headers: corsHeaders }
      );
    }

    if (selectedMilestones.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Almeno un milestone deve essere selezionato' }),
        { status: 400, headers: corsHeaders }
      );
    }

    // Get user from auth header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    // Client with user auth for RLS
    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    // Service client for audit log
    const supabaseService = createClient(supabaseUrl, supabaseServiceKey);

    // Get current user
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    console.log('User authenticated:', user.id);

    // Fetch the requirement
    const { data: requirement, error: fetchError } = await supabaseClient
      .from('project_requirements')
      .select('*, project_id')
      .eq('id', requirementId)
      .single();

    if (fetchError) {
      console.error('Error fetching requirement:', fetchError);
      throw fetchError;
    }

    if (!requirement.project_id) {
      console.error('Missing project_id in requirement:', requirement);
      throw new Error('Manca ID Progetto - requirement has no project_id');
    }

    if (!requirement.ai_tasks_json) {
      throw new Error('No AI tasks found in requirement');
    }

    console.log('Requirement fetched, project_id:', requirement.project_id, 'creating structure...');

    // Verify user has permission (Super_Admin, Admin, or Project_Manager)
    const { data: userRole } = await supabaseClient
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    const { data: isProjectManager } = await supabaseClient
      .rpc('is_project_manager', { 
        _user_id: user.id, 
        _project_id: requirement.project_id 
      });

    const hasPermission = 
      userRole?.role === 'super_admin' || 
      userRole?.role === 'admin' || 
      isProjectManager;

    if (!hasPermission) {
      throw new Error('Insufficient permissions to create milestones and tasks');
    }

    // Parse AI structure
    const aiMilestones = requirement.ai_tasks_json as any[];
    
    const createdMilestones: any[] = [];
    const createdTasks: any[] = [];

    // Create milestones and tasks in sequence
    for (const selection of selectedMilestones) {
      const milestoneData = aiMilestones[selection.milestoneIndex];
      
      let milestoneId: string;
      let milestoneTitle: string;
      
      // Check if AI provided existing_milestone_id (incremental mode)
      if (milestoneData.existing_milestone_id) {
        // Incremental mode: use existing milestone
        milestoneId = milestoneData.existing_milestone_id;
        
        // Fetch existing milestone title for logging
        const { data: existingMilestone, error: fetchError } = await supabaseClient
          .from('milestones')
          .select('title')
          .eq('id', milestoneId)
          .single();
        
        if (fetchError || !existingMilestone) {
          throw new Error(`Milestone esistente non trovato: ${milestoneId}`);
        }
        
        milestoneTitle = existingMilestone.title;
        console.log(`Using existing milestone: ${milestoneId} - ${milestoneTitle}`);
      } else {
        // Create new milestone
        const { data: newMilestone, error: milestoneError } = await supabaseClient
          .from('milestones')
          .insert({
            title: milestoneData.milestone_title,
            description: milestoneData.description,
            due_date: milestoneData.due_date_suggestion,
            strategic_priority: milestoneData.strategic_priority,
            state: 'planned',
            project_id: requirement.project_id,
            owner_id: user.id,
          })
          .select()
          .single();

        if (milestoneError) {
          console.error('Error creating milestone:', milestoneError);
          throw milestoneError;
        }

        createdMilestones.push(newMilestone);
        milestoneId = newMilestone.id;
        milestoneTitle = newMilestone.title;
        console.log(`Created new milestone: ${milestoneId} - ${milestoneTitle}`);
      }

      // Create tasks for this milestone
      if (selection.taskIndices && selection.taskIndices.length > 0) {
        const tasksToCreate = selection.taskIndices.map((taskIndex: number) => {
          const task = milestoneData.tasks[taskIndex];
          return {
            title: task.title,
            description: task.description,
            priority: task.priority,
            status: 'to_do',
            estimated_hours: task.estimated_hours,
            project_id: requirement.project_id,
            milestone_id: milestoneId,
            created_by: user.id,
          };
        });

        const { data: milestoneTasks, error: tasksError } = await supabaseClient
          .from('tasks')
          .insert(tasksToCreate)
          .select();

        if (tasksError) {
          console.error('Error creating tasks:', tasksError);
          throw tasksError;
        }

        createdTasks.push(...milestoneTasks);
        console.log(`Created ${milestoneTasks.length} tasks for milestone ${milestoneId} (${milestoneTitle})`);
      }
    }

    console.log(`Created ${createdMilestones.length} milestones and ${createdTasks.length} tasks for project ${requirement.project_id}`);

    // Update requirement status
    const { error: updateError } = await supabaseClient
      .from('project_requirements')
      .update({ status: 'Tasks_Created' })
      .eq('id', requirementId);

    if (updateError) {
      console.error('Error updating requirement status:', updateError);
      throw updateError;
    }

    // Create audit log entry (using service role to bypass RLS)
    const { error: auditError } = await supabaseService
      .from('audit_log')
      .insert({
        performed_by: user.id,
        performed_by_role: userRole?.role || 'collaborator',
        action_type: 'ai_structure_created',
        details: {
          requirement_id: requirementId,
          project_id: requirement.project_id,
          milestones_count: createdMilestones.length,
          tasks_count: createdTasks.length,
          milestone_ids: createdMilestones.map(m => m.id),
          milestone_titles: createdMilestones.map(m => m.title),
          task_ids: createdTasks.map(t => t.id)
        }
      });

    if (auditError) {
      console.error('Error creating audit log:', auditError);
      // Don't fail the request if audit log fails
    }

    console.log('Structure creation completed successfully');

    return new Response(
      JSON.stringify({ 
        success: true,
        milestonesCreated: createdMilestones.length,
        tasksCreated: createdTasks.length,
        projectId: requirement.project_id,
        message: `${createdMilestones.length} milestone e ${createdTasks.length} task create con successo`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in create-tasks-from-requirements:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
