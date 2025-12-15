// Deno edge runtime

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

    const token = authHeader.replace('Bearer ', '');
    const verifyResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { 'Authorization': `Bearer ${token}`, 'apikey': supabaseKey }
    });

    if (!verifyResponse.ok) throw new Error('Unauthorized');
    const user = await verifyResponse.json();

    const { projectId, period = 'last_7_days', startDate: customStartDate, endDate: customEndDate } = await req.json();

    if (!projectId || typeof projectId !== 'string') {
      return new Response(JSON.stringify({ error: 'Project ID richiesto' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const now = new Date();
    let startDate: Date;
    let endDate: Date = now;
    let reportPeriod: string;
    let periodLabel: string;

    if (period === 'custom' && customStartDate && customEndDate) {
      startDate = new Date(customStartDate);
      endDate = new Date(customEndDate);
      reportPeriod = 'OnDemand';
      periodLabel = `Dal ${startDate.toLocaleDateString('it-IT')} al ${endDate.toLocaleDateString('it-IT')}`;
    } else if (period === 'last_7_days') {
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      reportPeriod = 'Weekly';
      periodLabel = 'Ultima settimana (7 giorni)';
    } else if (period === 'last_30_days') {
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      reportPeriod = 'Monthly';
      periodLabel = 'Ultimo mese (30 giorni)';
    } else {
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      reportPeriod = 'OnDemand';
      periodLabel = 'Periodo personalizzato';
    }

    console.log(`Generating report for project ${projectId}, period: ${periodLabel}`);

    const projectResponse = await fetch(`${supabaseUrl}/rest/v1/projects?id=eq.${projectId}&select=title,description,status,priority,start_date,end_date,budget`, { headers: { 'Authorization': `Bearer ${supabaseKey}`, 'apikey': supabaseKey, 'Accept': 'application/vnd.pgrst.object+json' } });
    if (!projectResponse.ok) throw new Error('Progetto non trovato');
    const project = await projectResponse.json();

    const tasksResponse = await fetch(`${supabaseUrl}/rest/v1/tasks?project_id=eq.${projectId}&select=id,title,status,priority,due_date,estimated_hours,actual_hours,created_at,updated_at`, { headers: { 'Authorization': `Bearer ${supabaseKey}`, 'apikey': supabaseKey } });
    const allTasks = tasksResponse.ok ? await tasksResponse.json() : [];

    const milestonesResponse = await fetch(`${supabaseUrl}/rest/v1/milestones?project_id=eq.${projectId}&select=id,title,state,due_date,strategic_priority`, { headers: { 'Authorization': `Bearer ${supabaseKey}`, 'apikey': supabaseKey } });
    const milestones = milestonesResponse.ok ? await milestonesResponse.json() : [];

    const risksResponse = await fetch(`${supabaseUrl}/rest/v1/risks?project_id=eq.${projectId}&select=id,title,status,probability,impact,created_at,mitigation_plan`, { headers: { 'Authorization': `Bearer ${supabaseKey}`, 'apikey': supabaseKey } });
    const risks = risksResponse.ok ? await risksResponse.json() : [];

    const impactResponse = await fetch(`${supabaseUrl}/rest/v1/impact_areas?project_id=eq.${projectId}&select=id,name,investment_budget,visibility_scope,impact_metrics(id,name,unit,baseline_value,target_value,metric_entries(value,date,is_published))`, { headers: { 'Authorization': `Bearer ${supabaseKey}`, 'apikey': supabaseKey } });
    const impactAreas = impactResponse.ok ? await impactResponse.json() : [];

    const tasksInPeriod = allTasks.filter((t: any) => new Date(t.updated_at || t.created_at) >= startDate && new Date(t.updated_at || t.created_at) <= endDate);
    const tasksCreatedInPeriod = allTasks.filter((t: any) => new Date(t.created_at) >= startDate && new Date(t.created_at) <= endDate);
    const completedInPeriod = tasksInPeriod.filter((t: any) => t.status === 'done');
    const totalEstimatedHours = allTasks.reduce((sum: number, t: any) => sum + (t.estimated_hours || 0), 0);
    const totalActualHours = allTasks.reduce((sum: number, t: any) => sum + (t.actual_hours || 0), 0);

    const taskStats = { total: allTasks.length, completed: allTasks.filter((t: any) => t.status === 'done').length, in_progress: allTasks.filter((t: any) => t.status === 'doing').length, to_do: allTasks.filter((t: any) => t.status === 'to_do').length, waiting_review: allTasks.filter((t: any) => t.status === 'waiting_for_review').length, completed_in_period: completedInPeriod.length, created_in_period: tasksCreatedInPeriod.length, overdue: allTasks.filter((t: any) => t.due_date && new Date(t.due_date) < now && t.status !== 'done').length, estimated_hours: totalEstimatedHours, actual_hours: totalActualHours, efficiency_ratio: totalEstimatedHours > 0 ? ((totalActualHours / totalEstimatedHours) * 100).toFixed(1) : null };

    const upcomingMilestones = milestones.filter((m: any) => new Date(m.due_date) >= now && new Date(m.due_date) <= new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000));
    const milestoneStats = { total: milestones.length, completed: milestones.filter((m: any) => m.state === 'completed').length, in_progress: milestones.filter((m: any) => m.state === 'in_progress').length, at_risk: milestones.filter((m: any) => m.state === 'at_risk').length, planned: milestones.filter((m: any) => m.state === 'planned').length, upcoming: upcomingMilestones.length, overdue: milestones.filter((m: any) => new Date(m.due_date) < now && m.state !== 'completed').length };

    const criticalRisks = risks.filter((r: any) => r.status === 'open' && (r.probability === 'high' || r.probability === 'very_high') && (r.impact === 'high' || r.impact === 'very_high'));
    const riskStats = { total: risks.length, open: risks.filter((r: any) => r.status === 'open').length, mitigated: risks.filter((r: any) => r.status === 'mitigated').length, critical: criticalRisks.length, high_impact: risks.filter((r: any) => r.status === 'open' && (r.impact === 'high' || r.impact === 'very_high')).length, new_in_period: risks.filter((r: any) => new Date(r.created_at) >= startDate && new Date(r.created_at) <= endDate).length };

    let totalInvestment = 0; let totalRevenue = 0;
    const roiMetrics = impactAreas.map((area: any) => {
      totalInvestment += area.investment_budget || 0;
      return { area_name: area.name, investment: area.investment_budget, visibility: area.visibility_scope, metrics: (area.impact_metrics || []).map((metric: any) => {
        const publishedEntries = (metric.metric_entries || []).filter((e: any) => e.is_published);
        const latestEntry = publishedEntries.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
        const currentValue = latestEntry?.value || 0; const baseline = metric.baseline_value || 0; const delta = currentValue - baseline;
        if (metric.unit === 'currency') totalRevenue += currentValue;
        return { name: metric.name, unit: metric.unit, baseline, current: currentValue, target: metric.target_value || 0, delta, roi: area.investment_budget && metric.unit === 'currency' ? ((delta / area.investment_budget) * 100).toFixed(1) : null, cost_per_unit: area.investment_budget && delta > 0 && metric.unit !== 'currency' ? (area.investment_budget / delta).toFixed(2) : null };
      })};
    });

    const financialSummary = { total_investment: totalInvestment, total_revenue: totalRevenue, overall_roi: totalInvestment > 0 ? (((totalRevenue - totalInvestment) / totalInvestment) * 100).toFixed(1) : null, project_budget: project.budget };
    const keyMetricsSnapshot = { tasks: taskStats, milestones: milestoneStats, risks: riskStats, roi: roiMetrics, financial: financialSummary, period_start: startDate.toISOString(), period_end: endDate.toISOString(), period_label: periodLabel };

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY non configurato');

    const systemPrompt = `Sei un Senior Project Manager esperto nella redazione di Executive Summary professionali.

CONTESTO VISIVO IMPORTANTE:
Il report che scrivi verrà visualizzato SOTTO una serie di GRAFICI INTERATTIVI generati automaticamente dal sistema:
- Grafico a Torta "Distribuzione Task" (mostra To Do, In Corso, Completati, In Revisione)
- Grafico a Barre "Stato Milestone" (Completate, In Corso, A Rischio, Pianificate)
- Grafico a Barre "Analisi Rischi" (Aperti, Critici, Nuovi nel periodo)
- Pannello "Business Impact & ROI" con metriche per area operativa

Il tuo compito è scrivere la NARRAZIONE ANALITICA che INTERPRETA e COMMENTA quei grafici, NON riprodurli testualmente.

REGOLE DI FORMATTAZIONE OBBLIGATORIE:
1. USA SEMPRE intestazioni Markdown: ## per sezioni principali, ### per sottosezioni
2. USA elenchi puntati (-) per ogni punto chiave, MAI muri di testo
3. USA **grassetto** per tutti i numeri e percentuali chiave
4. Massimo 500 parole totali
5. Tono: formale, analitico, orientato alle decisioni

STRUTTURA RICHIESTA:

## Sintesi Esecutiva
[2-3 frasi che riassumono lo stato complessivo del progetto]

## Analisi Operativa
### Performance Task
- Riferisciti al grafico "Distribuzione Task" per commentare la distribuzione
- Evidenzia colli di bottiglia e trend

### Avanzamento Milestone
- Riferisciti al grafico "Stato Milestone" per l'analisi della roadmap
- Segnala milestone critiche o a rischio scadenza

## Analisi Finanziaria & ROI
- Riferisciti al pannello "Business Impact" per commentare le performance economiche
- Calcola e commenta ROI, trend di crescita, efficienza investimenti

## Rischi Critici
- Riferisciti al grafico "Analisi Rischi" per evidenziare i rischi aperti
- Elenca solo i rischi ad alto impatto con breve piano di mitigazione

## Raccomandazioni Strategiche
- 3-5 azioni concrete e prioritizzate
- Ogni raccomandazione deve essere specifica e misurabile`;

    const userPrompt = `Executive Summary per "${project.title}". PERIODO: ${periodLabel}. PROGETTO: Stato ${project.status}, Budget €${project.budget || 'N/A'}. TASK: ${taskStats.total} totali, ${taskStats.completed} completati, ${taskStats.overdue} in ritardo, ${taskStats.completed_in_period} nel periodo. Ore stimate: ${taskStats.estimated_hours}h, effettive: ${taskStats.actual_hours}h. MILESTONE: ${milestoneStats.total} totali, ${milestoneStats.completed} completate, ${milestoneStats.at_risk} a rischio, ${milestoneStats.upcoming} imminenti. RISCHI: ${riskStats.total} totali, ${riskStats.open} aperti, ${riskStats.critical} critici. BUSINESS IMPACT: Investimento €${financialSummary.total_investment}, Revenue €${financialSummary.total_revenue}, ROI ${financialSummary.overall_roi || 'N/A'}%. ${roiMetrics.map((a: any) => `${a.area_name}: ${a.metrics.map((m: any) => `${m.name}=${m.current} (delta ${m.delta})${m.roi ? ` ROI ${m.roi}%` : ''}`).join(', ')}`).join('. ')}`;

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', { method: 'POST', headers: { 'Authorization': `Bearer ${LOVABLE_API_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ model: 'google/gemini-2.5-flash', messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }] }) });
    if (!aiResponse.ok) { console.error('AI Error:', aiResponse.status, await aiResponse.text()); throw new Error('Errore nella generazione AI'); }
    const aiData = await aiResponse.json();
    const contentSummary = aiData.choices?.[0]?.message?.content || 'Errore generazione';

    const saveResponse = await fetch(`${supabaseUrl}/rest/v1/project_reports`, { method: 'POST', headers: { 'Authorization': `Bearer ${supabaseKey}`, 'apikey': supabaseKey, 'Content-Type': 'application/json', 'Prefer': 'return=representation' }, body: JSON.stringify({ project_id: projectId, report_period: reportPeriod, content_summary: contentSummary, key_metrics_snapshot: keyMetricsSnapshot, status: 'Draft', created_by: user.id }) });
    if (!saveResponse.ok) { console.error('Save Error:', saveResponse.status, await saveResponse.text()); throw new Error('Errore salvataggio'); }
    const savedReport = await saveResponse.json();

    return new Response(JSON.stringify({ success: true, report: Array.isArray(savedReport) ? savedReport[0] : savedReport }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Errore interno' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
