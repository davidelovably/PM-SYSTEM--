-- Drop existing RLS policy for project members viewing metric entries
DROP POLICY IF EXISTS "Project members can view metric entries" ON public.metric_entries;

-- Create separate policies for different roles viewing metric entries

-- Super_Admin and Admin can view all metric entries
CREATE POLICY "Admins can view all metric entries"
ON public.metric_entries
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.impact_metrics
    JOIN public.impact_areas ON impact_areas.id = impact_metrics.area_id
    WHERE impact_metrics.id = metric_entries.metric_id
    AND (
      has_role(auth.uid(), 'super_admin'::app_role) 
      OR has_role(auth.uid(), 'admin'::app_role)
    )
  )
);

-- Project Managers can view all entries for their projects
CREATE POLICY "Project managers can view all project metric entries"
ON public.metric_entries
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.impact_metrics
    JOIN public.impact_areas ON impact_areas.id = impact_metrics.area_id
    WHERE impact_metrics.id = metric_entries.metric_id
    AND is_project_manager(auth.uid(), impact_areas.project_id)
    AND NOT has_role(auth.uid(), 'client'::app_role)
  )
);

-- Collaborators can view all entries for their projects
CREATE POLICY "Collaborators can view all project metric entries"
ON public.metric_entries
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.impact_metrics
    JOIN public.impact_areas ON impact_areas.id = impact_metrics.area_id
    WHERE impact_metrics.id = metric_entries.metric_id
    AND is_project_member(auth.uid(), impact_areas.project_id)
    AND NOT has_role(auth.uid(), 'client'::app_role)
  )
);

-- Clients can view ONLY published entries for their projects
CREATE POLICY "Clients can view only published metric entries"
ON public.metric_entries
FOR SELECT
USING (
  metric_entries.is_published = true
  AND EXISTS (
    SELECT 1 FROM public.impact_metrics
    JOIN public.impact_areas ON impact_areas.id = impact_metrics.area_id
    WHERE impact_metrics.id = metric_entries.metric_id
    AND is_project_member(auth.uid(), impact_areas.project_id)
    AND has_role(auth.uid(), 'client'::app_role)
  )
);