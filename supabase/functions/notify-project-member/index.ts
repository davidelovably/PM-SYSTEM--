import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface NotificationRequest {
  userId: string;
  projectId: string;
  action: "added" | "removed";
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Security: Verify JWT token and extract caller's identity
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      console.error("Missing authorization header");
      return new Response(
        JSON.stringify({ error: "Unauthorized: Missing authorization" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      console.error("Invalid token:", authError);
      return new Response(
        JSON.stringify({ error: "Unauthorized: Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { userId, projectId, action }: NotificationRequest = await req.json();

    // Security: Verify caller is authorized (Super_Admin, Admin, or Project_Manager of this project)
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);

    const hasAdminRole = roles?.some(r => r.role === "super_admin" || r.role === "admin");

    if (!hasAdminRole) {
      // Check if caller is project manager of this specific project
      const { data: membership } = await supabase
        .from("project_members")
        .select("role_in_project")
        .eq("project_id", projectId)
        .eq("user_id", user.id)
        .single();

      if (!membership || membership.role_in_project !== "project_manager") {
        console.error("User not authorized to manage this project");
        return new Response(
          JSON.stringify({ error: "Forbidden: Insufficient permissions" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Fetch user profile
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("email, full_name")
      .eq("id", userId)
      .single();

    if (profileError) {
      console.error("Error fetching profile:", profileError);
      throw profileError;
    }

    // Fetch project details
    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select("title, description")
      .eq("id", projectId)
      .single();

    if (projectError) {
      console.error("Error fetching project:", projectError);
      throw projectError;
    }

    // Create notification in database
    const notificationMessage = action === "added"
      ? `Sei stato aggiunto al progetto: ${project.title}`
      : `Sei stato rimosso dal progetto: ${project.title}`;

    const { error: notificationError } = await supabase
      .from("notifications")
      .insert([{
        user_id: userId,
        type: "project_membership",
        title: action === "added" ? "Aggiunto al Progetto" : "Rimosso dal Progetto",
        message: notificationMessage,
        link: action === "added" ? `/projects/${projectId}` : "/projects",
      }]);

    if (notificationError) {
      console.error("Error creating notification:", notificationError);
    }

    console.log(`Notification sent to ${profile.email} for project ${project.title}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `User ${action} successfully and notification sent` 
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error in notify-project-member function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
