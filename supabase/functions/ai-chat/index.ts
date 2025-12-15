// Deno edge runtime

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface ProjectContext {
  project: any;
  structure: {
    milestones: any[];
    tasks: any[];
    activeTasks: any[];
    doneTasks: any[];
    overdueTasks: any[];
  };
  team: any[];
  metrics: {
    areas: any[];
    latestEntries: any[];
    totalBudget: number;
  };
  risks: {
    all: any[];
    open: any[];
    critical: any[];
  };
  documents: any[];
  requirements: any[];
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Verify user from JWT
    const token = authHeader.replace('Bearer ', '');
    const verifyResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'apikey': supabaseKey
      }
    });

    if (!verifyResponse.ok) {
      throw new Error('Unauthorized');
    }

    const user = await verifyResponse.json();

    const { message, projectId, conversationHistory = [] } = await req.json();

    // Validate inputs
    const MAX_MESSAGE_LENGTH = 10000;
    
    if (!message || typeof message !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Messaggio richiesto' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (message.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: 'Messaggio non può essere vuoto' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (message.length > MAX_MESSAGE_LENGTH) {
      return new Response(
        JSON.stringify({ error: `Messaggio troppo lungo. Massimo ${MAX_MESSAGE_LENGTH} caratteri.` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    // Get user profile for personalization
    const profileResponse = await fetch(
      `${supabaseUrl}/rest/v1/profiles?id=eq.${user.id}&select=full_name,email`,
      {
        headers: {
          'Authorization': `Bearer ${supabaseKey}`,
          'apikey': supabaseKey,
          'Accept': 'application/vnd.pgrst.object+json'
        }
      }
    );

    const profile = profileResponse.ok ? await profileResponse.json() : null;
    const userName = profile?.full_name || profile?.email?.split('@')[0] || 'Utente';

    // BUILD COMPLETE PROJECT KNOWLEDGE BASE
    let projectContext: ProjectContext | null = null;
    
    if (projectId) {
      console.log("Building complete project knowledge base for:", projectId);
      
      // Parallel fetch all project data for maximum efficiency
      const [
        projectRes,
        tasksRes,
        milestonesRes,
        membersRes,
        risksRes,
        impactAreasRes,
        metricEntriesRes,
        documentsRes,
        requirementsRes
      ] = await Promise.all([
        // Project details
        fetch(`${supabaseUrl}/rest/v1/projects?id=eq.${projectId}&select=id,title,description,status,priority,budget,start_date,end_date`, {
          headers: { 'Authorization': `Bearer ${supabaseKey}`, 'apikey': supabaseKey, 'Accept': 'application/vnd.pgrst.object+json' }
        }),
        // Tasks with complete metadata
        fetch(`${supabaseUrl}/rest/v1/tasks?project_id=eq.${projectId}&select=id,title,description,status,priority,due_date,estimated_hours,actual_hours,assigned_to_user_id,milestone_id,created_at,updated_at,assignee:profiles!tasks_assigned_to_user_id_fkey(id,full_name,email),milestone:milestones(id,title,due_date)&order=due_date.asc.nullslast`, {
          headers: { 'Authorization': `Bearer ${supabaseKey}`, 'apikey': supabaseKey }
        }),
        // Milestones
        fetch(`${supabaseUrl}/rest/v1/milestones?project_id=eq.${projectId}&select=id,title,description,due_date,state,strategic_priority&order=due_date.asc`, {
          headers: { 'Authorization': `Bearer ${supabaseKey}`, 'apikey': supabaseKey }
        }),
        // Team members with roles and profiles
        fetch(`${supabaseUrl}/rest/v1/project_members?project_id=eq.${projectId}&select=id,user_id,role_in_project,profile:profiles(id,full_name,email)`, {
          headers: { 'Authorization': `Bearer ${supabaseKey}`, 'apikey': supabaseKey }
        }),
        // All risks
        fetch(`${supabaseUrl}/rest/v1/risks?project_id=eq.${projectId}&select=id,title,description,probability,impact,status,mitigation_plan,owner_id&order=created_at.desc`, {
          headers: { 'Authorization': `Bearer ${supabaseKey}`, 'apikey': supabaseKey }
        }),
        // Impact areas with budget
        fetch(`${supabaseUrl}/rest/v1/impact_areas?project_id=eq.${projectId}&select=id,name,description,investment_budget,investment_period,visibility_scope,metrics:impact_metrics(id,name,unit,baseline_value,target_value)`, {
          headers: { 'Authorization': `Bearer ${supabaseKey}`, 'apikey': supabaseKey }
        }),
        // Latest metric entries (last 30 days)
        fetch(`${supabaseUrl}/rest/v1/metric_entries?select=id,metric_id,date,value,is_published,metric:impact_metrics(id,name,unit,area:impact_areas(id,name,project_id))&order=date.desc&limit=100`, {
          headers: { 'Authorization': `Bearer ${supabaseKey}`, 'apikey': supabaseKey }
        }),
        // Project documents (metadata only)
        fetch(`${supabaseUrl}/rest/v1/project_files?project_id=eq.${projectId}&select=id,file_name,file_type,file_size,notes,is_private,uploaded_at,uploader:profiles!project_files_uploaded_by_fkey(full_name)&order=uploaded_at.desc`, {
          headers: { 'Authorization': `Bearer ${supabaseKey}`, 'apikey': supabaseKey }
        }),
        // Requirements documents
        fetch(`${supabaseUrl}/rest/v1/project_requirements?project_id=eq.${projectId}&select=id,input_script_raw,status,created_at&order=created_at.desc`, {
          headers: { 'Authorization': `Bearer ${supabaseKey}`, 'apikey': supabaseKey }
        })
      ]);

      // Parse all responses
      const project = projectRes.ok ? await projectRes.json() : null;
      const tasks = tasksRes.ok ? await tasksRes.json() : [];
      const milestones = milestonesRes.ok ? await milestonesRes.json() : [];
      const members = membersRes.ok ? await membersRes.json() : [];
      const risks = risksRes.ok ? await risksRes.json() : [];
      const impactAreas = impactAreasRes.ok ? await impactAreasRes.json() : [];
      const allMetricEntries = metricEntriesRes.ok ? await metricEntriesRes.json() : [];
      const documents = documentsRes.ok ? await documentsRes.json() : [];
      const requirements = requirementsRes.ok ? await requirementsRes.json() : [];

      // Filter metric entries for this project
      const projectMetricEntries = allMetricEntries.filter((e: any) => 
        e.metric?.area?.project_id === projectId
      );

      // Calculate totals
      const totalBudget = impactAreas.reduce((sum: number, area: any) => 
        sum + (area.investment_budget || 0), 0
      );

      const activeTasks = tasks.filter((t: any) => t.status !== 'done');
      const doneTasks = tasks.filter((t: any) => t.status === 'done');
      const overdueTasks = tasks.filter((t: any) => 
        t.due_date && new Date(t.due_date) < new Date() && t.status !== 'done'
      );
      const openRisks = risks.filter((r: any) => r.status === 'open' || r.status === 'identified');
      const criticalRisks = risks.filter((r: any) => 
        (r.impact === 'high' || r.impact === 'very_high') && 
        (r.status === 'open' || r.status === 'identified')
      );

      projectContext = {
        project,
        structure: {
          milestones,
          tasks,
          activeTasks,
          doneTasks,
          overdueTasks
        },
        team: members,
        metrics: {
          areas: impactAreas,
          latestEntries: projectMetricEntries.slice(0, 50),
          totalBudget
        },
        risks: {
          all: risks,
          open: openRisks,
          critical: criticalRisks
        },
        documents,
        requirements
      };

      console.log(`Knowledge base built: ${tasks.length} tasks, ${milestones.length} milestones, ${members.length} team members, ${risks.length} risks, ${impactAreas.length} impact areas, ${documents.length} documents`);
    }

    // Build context-aware system prompt with COMPLETE knowledge base
    const currentDate = new Date().toISOString().split('T')[0];
    
    let systemPrompt = `Sei il PROJECT MANAGER AI del progetto "${projectContext?.project?.title || 'corrente'}". 
Conosci OGNI DETTAGLIO del progetto in tempo reale e fornisci consulenza gestionale di alto livello.

🚫 IMPORTANTE: Sei un CONSULENTE ANALITICO READ-ONLY. NON puoi creare, modificare o eliminare dati.
Se l'utente chiede di creare/modificare/eliminare Task, Milestone o altri elementi, rispondi gentilmente che non hai questa capacità e indirizza l'utente alla sezione appropriata dell'interfaccia (es. "Kanban Board" per task, "Timeline" per milestone, "Requisiti AI" per generare strutture).

📊 LE TUE SPECIALIZZAZIONI:
1. Analisi stato progetto - Task, rischi, milestone, budget
2. Analisi workflow - Task bloccate, dipendenze, critical path
3. Analisi carico di lavoro - Workload team, velocità, capacità
4. Analisi predittiva - Rischi di ritardo, milestone a rischio
5. Analisi requisiti - Obiettivi, scope, deliverable
6. Analisi finanziaria - Budget, ROI, metriche di impatto
7. Consulenza documentale - Rispondere su documenti caricati

📅 Data corrente: ${currentDate}
👤 Stai parlando con: ${userName}`;

    // INJECT COMPLETE PROJECT KNOWLEDGE BASE
    if (projectContext) {
      const { project, structure, team, metrics, risks, documents, requirements } = projectContext;
      
      systemPrompt += `

═══════════════════════════════════════════════════════════════
📁 KNOWLEDGE BASE PROGETTO: "${project?.title}"
═══════════════════════════════════════════════════════════════

📋 INFORMAZIONI PROGETTO:
- Titolo: ${project?.title}
- Descrizione: ${project?.description || 'N/A'}
- Stato: ${project?.status}
- Priorità: ${project?.priority}
- Budget Totale: €${project?.budget?.toLocaleString() || 'N/A'}
- Date: ${project?.start_date || 'N/A'} → ${project?.end_date || 'N/A'}

═══════════════════════════════════════════════════════════════
📊 STATO OPERATIVO (REAL-TIME)
═══════════════════════════════════════════════════════════════
- Task Totali: ${structure.tasks.length}
- Task Attive: ${structure.activeTasks.length} (To Do/Doing/Review)
- Task Completate: ${structure.doneTasks.length}
- Task SCADUTE: ${structure.overdueTasks.length} ⚠️
- Avanzamento: ${structure.tasks.length > 0 ? Math.round((structure.doneTasks.length / structure.tasks.length) * 100) : 0}%

MILESTONE (${structure.milestones.length}):
${structure.milestones.map((m: any) => {
  const tasks = structure.tasks.filter((t: any) => t.milestone_id === m.id);
  const done = tasks.filter((t: any) => t.status === 'done').length;
  return `• ${m.title} | Stato: ${m.state} | Scadenza: ${m.due_date} | Task: ${done}/${tasks.length} completate`;
}).join('\n')}

═══════════════════════════════════════════════════════════════
👥 TEAM PROGETTO (${team.length} membri)
═══════════════════════════════════════════════════════════════
${team.map((m: any) => {
  const memberTasks = structure.tasks.filter((t: any) => t.assigned_to_user_id === m.user_id);
  const activeMemberTasks = memberTasks.filter((t: any) => t.status !== 'done').length;
  const doneMemberTasks = memberTasks.filter((t: any) => t.status === 'done').length;
  return `• ${m.profile?.full_name || m.profile?.email || 'N/A'} | Ruolo: ${m.role_in_project} | Task attive: ${activeMemberTasks} | Completate: ${doneMemberTasks}`;
}).join('\n')}

═══════════════════════════════════════════════════════════════
⚠️ RISCHI (${risks.open.length} aperti, ${risks.critical.length} critici)
═══════════════════════════════════════════════════════════════
${risks.open.length > 0 ? risks.open.slice(0, 10).map((r: any) => 
  `• [${r.impact?.toUpperCase()}/${r.probability}] ${r.title} - ${r.status}`
).join('\n') : 'Nessun rischio aperto.'}

═══════════════════════════════════════════════════════════════
💰 METRICHE DI BUSINESS IMPACT
═══════════════════════════════════════════════════════════════
Budget Investimenti Totale: €${metrics.totalBudget.toLocaleString()}

AREE DI IMPATTO (${metrics.areas.length}):
${metrics.areas.map((area: any) => {
  const areaMetrics = area.metrics || [];
  return `📈 ${area.name}${area.investment_budget ? ` (Budget: €${area.investment_budget.toLocaleString()})` : ''}
   ${areaMetrics.map((metric: any) => {
     const latestEntry = metrics.latestEntries.find((e: any) => e.metric_id === metric.id);
     const baselineStr = metric.baseline_value !== null ? `Baseline: ${metric.baseline_value}` : '';
     const targetStr = metric.target_value !== null ? `Target: ${metric.target_value}` : '';
     const currentStr = latestEntry ? `Attuale: ${latestEntry.value}` : '';
     return `   - ${metric.name} (${metric.unit}) | ${[baselineStr, currentStr, targetStr].filter(Boolean).join(' | ')}`;
   }).join('\n')}`;
}).join('\n\n')}

═══════════════════════════════════════════════════════════════
📄 DOCUMENTI PROGETTO (${documents.length} file)
═══════════════════════════════════════════════════════════════
${documents.length > 0 ? documents.slice(0, 15).map((d: any) => 
  `• ${d.file_name} (${d.file_type || 'N/A'})${d.notes ? ` - Note: ${d.notes.substring(0, 50)}...` : ''} - Caricato: ${d.uploaded_at?.split('T')[0]}`
).join('\n') : 'Nessun documento caricato.'}

═══════════════════════════════════════════════════════════════
📝 REQUISITI E OBIETTIVI (${requirements.length} documenti)
═══════════════════════════════════════════════════════════════
${requirements.length > 0 ? requirements.slice(0, 5).map((r: any) => 
  `• Requisito ${r.id.substring(0, 8)} | Stato: ${r.status} | Preview: "${r.input_script_raw?.substring(0, 100)}..."`
).join('\n') : 'Nessun requisito caricato.'}

═══════════════════════════════════════════════════════════════
📋 DETTAGLIO TASK COMPLETO (per query specifiche)
═══════════════════════════════════════════════════════════════
${JSON.stringify(structure.tasks.slice(0, 50), null, 2)}
`;
    }

    systemPrompt += `

🎯 ISTRUZIONI DI RISPOSTA:
- Quando l'utente chiede "come sta andando?" o stato generale: Cita dati SPECIFICI (task scadute, % completamento, rischi critici, budget)
- Quando chiede "chi se ne occupa?" o team: Consulta la lista membri e le assegnazioni
- Quando chiede di metriche/ROI: Usa i dati delle aree di impatto
- Quando chiede di documenti: Elenca i file disponibili e le note
- Rispondi SEMPRE in italiano, in modo conciso e data-driven
- Usa elenchi puntati per chiarezza
- Evidenzia numeri importanti`;

    // Define tools for AI (READ-ONLY ANALYTICS)
    const tools = [
      {
        type: "function",
        function: {
          name: "analyze_project_status",
          description: "Analizza lo stato completo di un progetto recuperando dati aggiornati su task, rischi e milestone",
          parameters: {
            type: "object",
            properties: {
              project_id: { type: "string", description: "ID del progetto da analizzare" }
            },
            required: ["project_id"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "analyze_workflow_blockers",
          description: "Identifica task bloccate da dipendenze non completate e analizza il critical path",
          parameters: {
            type: "object",
            properties: {
              project_id: { type: "string", description: "ID del progetto da analizzare" }
            },
            required: ["project_id"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "analyze_user_workload",
          description: "Analizza il carico di lavoro e la velocità di completamento di ogni membro del team",
          parameters: {
            type: "object",
            properties: {
              project_id: { type: "string", description: "ID del progetto da analizzare" }
            },
            required: ["project_id"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "analyze_milestone_risks",
          description: "Analizza i rischi di ritardo per i milestone basandosi sullo stato delle task",
          parameters: {
            type: "object",
            properties: {
              project_id: { type: "string", description: "ID del progetto da analizzare" }
            },
            required: ["project_id"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "analyze_requirements",
          description: "Recupera e analizza i documenti dei requisiti del progetto",
          parameters: {
            type: "object",
            properties: {
              project_id: { type: "string", description: "ID del progetto da analizzare" }
            },
            required: ["project_id"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "analyze_business_impact",
          description: "Analizza le metriche di business impact, ROI e budget del progetto",
          parameters: {
            type: "object",
            properties: {
              project_id: { type: "string", description: "ID del progetto da analizzare" }
            },
            required: ["project_id"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "suggest_task_estimate",
          description: "Suggerisce le ore stimate per una task basandosi su titolo, descrizione e dati storici",
          parameters: {
            type: "object",
            properties: {
              title: { type: "string", description: "Titolo della task" },
              description: { type: "string", description: "Descrizione della task" },
              project_id: { type: "string", description: "ID del progetto per contesto storico" }
            },
            required: ["title", "description"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "suggest_risk_estimate",
          description: "Suggerisce probabilità e impatto per un rischio",
          parameters: {
            type: "object",
            properties: {
              title: { type: "string", description: "Titolo del rischio" },
              description: { type: "string", description: "Descrizione del rischio" },
              project_id: { type: "string", description: "ID del progetto per contesto storico" }
            },
            required: ["title", "description"]
          }
        }
      }
    ];

    // Prepare messages for API
    const messages: Message[] = [
      { role: "assistant", content: systemPrompt },
      ...conversationHistory,
      { role: "user", content: message }
    ];

    console.log("Sending request to Lovable AI with complete project knowledge base");

    let response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: messages,
        temperature: 0.7,
        tools: tools,
        tool_choice: "auto"
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Lovable AI error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'Payment required. Please add credits to your workspace.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      throw new Error(`Lovable AI request failed: ${response.status}`);
    }

    let data = await response.json();
    let aiMessage = data.choices[0].message;

    // Handle tool calls
    if (aiMessage.tool_calls) {
      console.log("AI requested tool calls:", aiMessage.tool_calls.map((tc: any) => tc.function.name));

      const toolResults = [];
      
      for (const toolCall of aiMessage.tool_calls) {
        const functionName = toolCall.function.name;
        const args = JSON.parse(toolCall.function.arguments);

        let functionResult;

        if (functionName === "analyze_project_status") {
          const pid = args.project_id || projectId;
          
          const [tasksRes, risksRes, milestonesRes] = await Promise.all([
            fetch(`${supabaseUrl}/rest/v1/tasks?project_id=eq.${pid}&select=status,due_date,priority`, {
              headers: { 'Authorization': `Bearer ${supabaseKey}`, 'apikey': supabaseKey }
            }),
            fetch(`${supabaseUrl}/rest/v1/risks?project_id=eq.${pid}&status=in.(open,identified)&select=title,impact,probability,status`, {
              headers: { 'Authorization': `Bearer ${supabaseKey}`, 'apikey': supabaseKey }
            }),
            fetch(`${supabaseUrl}/rest/v1/milestones?project_id=eq.${pid}&select=title,due_date,state`, {
              headers: { 'Authorization': `Bearer ${supabaseKey}`, 'apikey': supabaseKey }
            })
          ]);

          const tasks = await tasksRes.json();
          const risks = await risksRes.json();
          const milestones = await milestonesRes.json();

          const totalTasks = tasks?.length || 0;
          const doneTasks = tasks?.filter((t: any) => t.status === 'done').length || 0;
          const overdueTasks = tasks?.filter((t: any) => 
            t.due_date && new Date(t.due_date) < new Date() && t.status !== 'done'
          ).length || 0;
          const highRisks = risks?.filter((r: any) => r.impact === 'high' || r.impact === 'very_high').length || 0;
          const overdueMilestones = milestones?.filter((m: any) =>
            m.due_date && new Date(m.due_date) < new Date() && m.state !== 'completed'
          ).length || 0;
          const atRiskMilestones = milestones?.filter((m: any) => m.state === 'at_risk').length || 0;

          functionResult = {
            total_tasks: totalTasks,
            done_tasks: doneTasks,
            completion_percentage: totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0,
            overdue_tasks: overdueTasks,
            high_risks: highRisks,
            total_risks: risks?.length || 0,
            overdue_milestones: overdueMilestones,
            at_risk_milestones: atRiskMilestones,
            total_milestones: milestones?.length || 0
          };

        } else if (functionName === "analyze_workflow_blockers") {
          const pid = args.project_id || projectId;

          const [tasksRes, depsRes] = await Promise.all([
            fetch(`${supabaseUrl}/rest/v1/tasks?project_id=eq.${pid}&select=id,title,status,milestone_id,due_date`, {
              headers: { 'Authorization': `Bearer ${supabaseKey}`, 'apikey': supabaseKey }
            }),
            fetch(`${supabaseUrl}/rest/v1/task_dependencies?select=task_id,depends_on_task_id`, {
              headers: { 'Authorization': `Bearer ${supabaseKey}`, 'apikey': supabaseKey }
            })
          ]);

          const tasks = await tasksRes.json();
          const dependencies = await depsRes.json();

          const blockedTasks = [];
          for (const task of tasks || []) {
            if (task.status === 'to_do' || task.status === 'doing') {
              const deps = dependencies?.filter((d: any) => d.task_id === task.id) || [];
              if (deps.length > 0) {
                const blockingTasks = deps.map((d: any) => 
                  tasks?.find((t: any) => t.id === d.depends_on_task_id)
                ).filter((t: any) => t && t.status !== 'done');

                if (blockingTasks.length > 0) {
                  blockedTasks.push({
                    task_id: task.id,
                    task_title: task.title,
                    blocked_by: blockingTasks.map((t: any) => ({ id: t.id, title: t.title, status: t.status }))
                  });
                }
              }
            }
          }

          functionResult = {
            blocked_tasks_count: blockedTasks.length,
            blocked_tasks: blockedTasks,
            total_dependencies: dependencies?.length || 0
          };

        } else if (functionName === "analyze_user_workload") {
          const pid = args.project_id || projectId;

          const [tasksRes, profilesRes] = await Promise.all([
            fetch(`${supabaseUrl}/rest/v1/tasks?project_id=eq.${pid}&select=id,title,status,assigned_to_user_id,created_at,updated_at,estimated_hours`, {
              headers: { 'Authorization': `Bearer ${supabaseKey}`, 'apikey': supabaseKey }
            }),
            fetch(`${supabaseUrl}/rest/v1/profiles?select=id,full_name,email`, {
              headers: { 'Authorization': `Bearer ${supabaseKey}`, 'apikey': supabaseKey }
            })
          ]);

          const tasks = await tasksRes.json();
          const profiles = await profilesRes.json();

          const userWorkload: any = {};
          for (const task of tasks || []) {
            if (task.assigned_to_user_id) {
              if (!userWorkload[task.assigned_to_user_id]) {
                const profile = profiles?.find((p: any) => p.id === task.assigned_to_user_id);
                userWorkload[task.assigned_to_user_id] = {
                  user_name: profile?.full_name || profile?.email || 'Unknown',
                  to_do: 0, doing: 0, done: 0, total_hours: 0, completed_last_week: 0
                };
              }
              
              if (task.status === 'to_do') userWorkload[task.assigned_to_user_id].to_do++;
              if (task.status === 'doing') userWorkload[task.assigned_to_user_id].doing++;
              if (task.status === 'done') {
                userWorkload[task.assigned_to_user_id].done++;
                const weekAgo = new Date();
                weekAgo.setDate(weekAgo.getDate() - 7);
                if (new Date(task.updated_at) > weekAgo) {
                  userWorkload[task.assigned_to_user_id].completed_last_week++;
                }
              }
              
              if (task.estimated_hours) {
                userWorkload[task.assigned_to_user_id].total_hours += task.estimated_hours;
              }
            }
          }

          functionResult = {
            users: Object.values(userWorkload),
            total_users: Object.keys(userWorkload).length
          };

        } else if (functionName === "analyze_milestone_risks") {
          const pid = args.project_id || projectId;

          const [milestonesRes, tasksRes] = await Promise.all([
            fetch(`${supabaseUrl}/rest/v1/milestones?project_id=eq.${pid}&select=id,title,due_date,state`, {
              headers: { 'Authorization': `Bearer ${supabaseKey}`, 'apikey': supabaseKey }
            }),
            fetch(`${supabaseUrl}/rest/v1/tasks?project_id=eq.${pid}&select=id,title,status,milestone_id,due_date`, {
              headers: { 'Authorization': `Bearer ${supabaseKey}`, 'apikey': supabaseKey }
            })
          ]);

          const milestones = await milestonesRes.json();
          const tasks = await tasksRes.json();

          const milestoneRisks = [];
          for (const milestone of milestones || []) {
            const milestoneTasks = tasks?.filter((t: any) => t.milestone_id === milestone.id) || [];
            const totalTasks = milestoneTasks.length;
            const completedTasks = milestoneTasks.filter((t: any) => t.status === 'done').length;
            const inProgressTasks = milestoneTasks.filter((t: any) => t.status === 'doing').length;
            const overdueTasks = milestoneTasks.filter((t: any) => 
              t.due_date && new Date(t.due_date) < new Date() && t.status !== 'done'
            ).length;

            const daysUntilDue = milestone.due_date 
              ? Math.ceil((new Date(milestone.due_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
              : null;

            const completionRate = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

            let riskLevel = 'low';
            if (daysUntilDue !== null && daysUntilDue < 7 && completionRate < 80) {
              riskLevel = 'high';
            } else if (overdueTasks > 0 || (daysUntilDue !== null && daysUntilDue < 14 && completionRate < 60)) {
              riskLevel = 'medium';
            }

            milestoneRisks.push({
              milestone_id: milestone.id,
              milestone_title: milestone.title,
              due_date: milestone.due_date,
              days_until_due: daysUntilDue,
              total_tasks: totalTasks,
              completed_tasks: completedTasks,
              in_progress_tasks: inProgressTasks,
              overdue_tasks: overdueTasks,
              completion_rate: Math.round(completionRate),
              risk_level: riskLevel
            });
          }

          functionResult = {
            milestones: milestoneRisks,
            high_risk_count: milestoneRisks.filter((m: any) => m.risk_level === 'high').length
          };

        } else if (functionName === "analyze_requirements") {
          const pid = args.project_id || projectId;

          const reqResponse = await fetch(
            `${supabaseUrl}/rest/v1/project_requirements?project_id=eq.${pid}&select=id,input_script_raw,status,created_at,ai_tasks_json`,
            { headers: { 'Authorization': `Bearer ${supabaseKey}`, 'apikey': supabaseKey } }
          );
          const requirements = await reqResponse.json();

          const processedRequirements = requirements?.map((req: any) => ({
            id: req.id,
            status: req.status,
            created_at: req.created_at,
            script_length: req.input_script_raw?.length || 0,
            script_preview: req.input_script_raw?.substring(0, 300) || '',
            has_ai_structure: !!req.ai_tasks_json,
            milestones_count: req.ai_tasks_json?.length || 0
          })) || [];

          functionResult = {
            requirements_count: requirements?.length || 0,
            requirements: processedRequirements
          };

        } else if (functionName === "analyze_business_impact") {
          const pid = args.project_id || projectId;

          const [areasRes, entriesRes] = await Promise.all([
            fetch(`${supabaseUrl}/rest/v1/impact_areas?project_id=eq.${pid}&select=id,name,description,investment_budget,investment_period,metrics:impact_metrics(id,name,unit,baseline_value,target_value)`, {
              headers: { 'Authorization': `Bearer ${supabaseKey}`, 'apikey': supabaseKey }
            }),
            fetch(`${supabaseUrl}/rest/v1/metric_entries?select=id,metric_id,date,value,is_published,metric:impact_metrics(id,name,area:impact_areas(project_id))&order=date.desc&limit=200`, {
              headers: { 'Authorization': `Bearer ${supabaseKey}`, 'apikey': supabaseKey }
            })
          ]);

          const areas = await areasRes.json();
          const allEntries = await entriesRes.json();
          
          const projectEntries = allEntries.filter((e: any) => e.metric?.area?.project_id === pid);
          const totalBudget = areas.reduce((sum: number, a: any) => sum + (a.investment_budget || 0), 0);

          // Calculate ROI for each area
          const areaAnalysis = areas.map((area: any) => {
            const areaMetrics = area.metrics || [];
            const metricsWithData = areaMetrics.map((metric: any) => {
              const latestEntry = projectEntries.find((e: any) => e.metric_id === metric.id);
              const delta = latestEntry && metric.baseline_value != null 
                ? latestEntry.value - metric.baseline_value 
                : null;
              const roi = delta !== null && area.investment_budget > 0 && metric.unit === 'currency'
                ? ((delta / area.investment_budget) * 100).toFixed(1)
                : null;
              
              return {
                name: metric.name,
                unit: metric.unit,
                baseline: metric.baseline_value,
                target: metric.target_value,
                current: latestEntry?.value || null,
                delta: delta,
                roi_percentage: roi
              };
            });

            return {
              area_name: area.name,
              investment_budget: area.investment_budget,
              metrics: metricsWithData
            };
          });

          functionResult = {
            total_investment_budget: totalBudget,
            areas_count: areas.length,
            areas: areaAnalysis
          };

        } else if (functionName === "suggest_task_estimate") {
          const { title, description, project_id } = args;
          const pid = project_id || projectId;

          const tasksRes = await fetch(
            `${supabaseUrl}/rest/v1/tasks?project_id=eq.${pid}&select=title,description,estimated_hours,actual_hours&estimated_hours=not.is.null&limit=50`,
            { headers: { 'Authorization': `Bearer ${supabaseKey}`, 'apikey': supabaseKey } }
          );
          const historicalTasks = await tasksRes.json();

          let avgHours = 8;
          if (historicalTasks && historicalTasks.length > 0) {
            const validHours = historicalTasks
              .map((t: any) => t.actual_hours || t.estimated_hours)
              .filter((h: number) => h > 0);
            if (validHours.length > 0) {
              avgHours = Math.round(validHours.reduce((a: number, b: number) => a + b, 0) / validHours.length);
            }
          }

          functionResult = {
            estimated_hours: avgHours,
            confidence: historicalTasks?.length > 5 ? 'high' : 'medium',
            historical_data_points: historicalTasks?.length || 0,
            reasoning: `Basato su ${historicalTasks?.length || 0} task simili. Media stimata: ${avgHours} ore.`
          };

        } else if (functionName === "suggest_risk_estimate") {
          const { title, description, project_id } = args;
          const pid = project_id || projectId;

          const risksRes = await fetch(
            `${supabaseUrl}/rest/v1/risks?project_id=eq.${pid}&select=title,description,probability,impact&limit=50`,
            { headers: { 'Authorization': `Bearer ${supabaseKey}`, 'apikey': supabaseKey } }
          );
          const historicalRisks = await risksRes.json();

          let suggestedProbability = 'medium';
          let suggestedImpact = 'medium';

          const combinedText = `${(title || '').toLowerCase()} ${(description || '').toLowerCase()}`;

          if (combinedText.includes('probabil') || combinedText.includes('frequent') || combinedText.includes('sempre')) {
            suggestedProbability = 'high';
          } else if (combinedText.includes('raro') || combinedText.includes('improbabil')) {
            suggestedProbability = 'low';
          }

          if (combinedText.includes('critico') || combinedText.includes('grave') || combinedText.includes('blocca')) {
            suggestedImpact = 'high';
          } else if (combinedText.includes('minore') || combinedText.includes('piccolo')) {
            suggestedImpact = 'low';
          }

          functionResult = {
            probability: suggestedProbability,
            impact: suggestedImpact,
            confidence: historicalRisks?.length > 5 ? 'high' : 'medium',
            historical_data_points: historicalRisks?.length || 0,
            reasoning: `Basato su analisi del testo e ${historicalRisks?.length || 0} rischi storici.`
          };
        }

        toolResults.push({
          tool_call_id: toolCall.id,
          role: "tool",
          name: functionName,
          content: JSON.stringify(functionResult)
        });
      }

      // Send tool results back to AI
      messages.push(aiMessage);
      // @ts-ignore
      messages.push(...toolResults);

      response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${LOVABLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          messages: messages,
          temperature: 0.7,
        }),
      });

      if (!response.ok) {
        throw new Error(`Lovable AI request failed: ${response.status}`);
      }

      data = await response.json();
      aiMessage = data.choices[0].message;
    }

    const aiResponse = aiMessage.content;
    console.log("AI response generated successfully with complete knowledge base");

    return new Response(
      JSON.stringify({ response: aiResponse }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in ai-chat function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
