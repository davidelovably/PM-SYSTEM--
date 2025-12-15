-- Ensure cascading deletes for impact_areas
-- This ensures when an area is deleted, all metrics and entries are removed automatically

-- Update foreign key on impact_metrics to cascade deletes
ALTER TABLE public.impact_metrics
DROP CONSTRAINT IF EXISTS impact_metrics_area_id_fkey,
ADD CONSTRAINT impact_metrics_area_id_fkey 
  FOREIGN KEY (area_id) 
  REFERENCES public.impact_areas(id) 
  ON DELETE CASCADE;

-- Update foreign key on metric_entries to cascade deletes
ALTER TABLE public.metric_entries
DROP CONSTRAINT IF EXISTS metric_entries_metric_id_fkey,
ADD CONSTRAINT metric_entries_metric_id_fkey 
  FOREIGN KEY (metric_id) 
  REFERENCES public.impact_metrics(id) 
  ON DELETE CASCADE;

COMMENT ON CONSTRAINT impact_metrics_area_id_fkey ON public.impact_metrics IS 'Cascade delete metrics when area is deleted';
COMMENT ON CONSTRAINT metric_entries_metric_id_fkey ON public.metric_entries IS 'Cascade delete entries when metric is deleted';