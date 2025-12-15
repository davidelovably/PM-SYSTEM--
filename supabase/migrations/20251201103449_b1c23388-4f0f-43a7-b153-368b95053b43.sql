-- Add visibility_scope column to impact_areas table
ALTER TABLE public.impact_areas 
ADD COLUMN visibility_scope TEXT NOT NULL DEFAULT 'shared'
CHECK (visibility_scope IN ('shared', 'internal_only'));

-- Update existing RLS policy for project members to filter by visibility
DROP POLICY IF EXISTS "Project members can view impact areas" ON public.impact_areas;

CREATE POLICY "Project members can view impact areas" 
ON public.impact_areas
FOR SELECT
USING (
  has_role(auth.uid(), 'super_admin'::app_role) 
  OR has_role(auth.uid(), 'admin'::app_role) 
  OR is_project_member(auth.uid(), project_id)
);

-- Add new policy specifically for client role to see only shared areas
CREATE POLICY "Clients can view only shared impact areas" 
ON public.impact_areas
FOR SELECT
USING (
  has_role(auth.uid(), 'client'::app_role) 
  AND is_project_member(auth.uid(), project_id)
  AND visibility_scope = 'shared'
);

-- Update RLS policy on impact_metrics to inherit visibility from parent area
DROP POLICY IF EXISTS "Project members can view impact metrics" ON public.impact_metrics;

CREATE POLICY "Project members can view impact metrics" 
ON public.impact_metrics
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM impact_areas
    WHERE impact_areas.id = impact_metrics.area_id
    AND (
      has_role(auth.uid(), 'super_admin'::app_role) 
      OR has_role(auth.uid(), 'admin'::app_role) 
      OR (
        is_project_member(auth.uid(), impact_areas.project_id)
        AND (
          NOT has_role(auth.uid(), 'client'::app_role)
          OR impact_areas.visibility_scope = 'shared'
        )
      )
    )
  )
);

-- Update RLS policy on metric_entries to inherit visibility from parent metric/area
DROP POLICY IF EXISTS "Collaborators can view all project metric entries" ON public.metric_entries;
DROP POLICY IF EXISTS "Clients can view only published metric entries" ON public.metric_entries;

CREATE POLICY "Non-client project members can view all metric entries" 
ON public.metric_entries
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM impact_metrics
    JOIN impact_areas ON impact_areas.id = impact_metrics.area_id
    WHERE impact_metrics.id = metric_entries.metric_id
    AND (
      has_role(auth.uid(), 'super_admin'::app_role) 
      OR has_role(auth.uid(), 'admin'::app_role) 
      OR (
        is_project_member(auth.uid(), impact_areas.project_id)
        AND NOT has_role(auth.uid(), 'client'::app_role)
      )
    )
  )
);

CREATE POLICY "Clients can view only published entries in shared areas" 
ON public.metric_entries
FOR SELECT
USING (
  is_published = true
  AND EXISTS (
    SELECT 1
    FROM impact_metrics
    JOIN impact_areas ON impact_areas.id = impact_metrics.area_id
    WHERE impact_metrics.id = metric_entries.metric_id
    AND has_role(auth.uid(), 'client'::app_role)
    AND is_project_member(auth.uid(), impact_areas.project_id)
    AND impact_areas.visibility_scope = 'shared'
  )
);