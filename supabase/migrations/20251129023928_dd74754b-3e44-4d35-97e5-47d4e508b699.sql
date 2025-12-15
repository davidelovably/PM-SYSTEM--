-- Create enum for metric unit types
CREATE TYPE public.metric_unit AS ENUM ('number', 'currency', 'percentage');

-- Create impact_areas table
CREATE TABLE public.impact_areas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create impact_metrics table
CREATE TABLE public.impact_metrics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  area_id UUID NOT NULL REFERENCES public.impact_areas(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  unit public.metric_unit NOT NULL DEFAULT 'number',
  frequency TEXT,
  baseline_value NUMERIC,
  target_value NUMERIC,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create metric_entries table
CREATE TABLE public.metric_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  metric_id UUID NOT NULL REFERENCES public.impact_metrics(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  value NUMERIC NOT NULL,
  is_published BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.impact_areas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.impact_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.metric_entries ENABLE ROW LEVEL SECURITY;

-- RLS Policies for impact_areas
CREATE POLICY "Project members can view impact areas"
ON public.impact_areas
FOR SELECT
USING (
  has_role(auth.uid(), 'super_admin'::app_role) 
  OR has_role(auth.uid(), 'admin'::app_role) 
  OR is_project_member(auth.uid(), project_id)
);

CREATE POLICY "Project managers can manage impact areas"
ON public.impact_areas
FOR ALL
USING (
  (has_role(auth.uid(), 'super_admin'::app_role) 
   OR has_role(auth.uid(), 'admin'::app_role) 
   OR is_project_manager(auth.uid(), project_id))
  AND NOT has_role(auth.uid(), 'client'::app_role)
);

-- RLS Policies for impact_metrics
CREATE POLICY "Project members can view impact metrics"
ON public.impact_metrics
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.impact_areas
    WHERE impact_areas.id = impact_metrics.area_id
    AND (
      has_role(auth.uid(), 'super_admin'::app_role) 
      OR has_role(auth.uid(), 'admin'::app_role) 
      OR is_project_member(auth.uid(), impact_areas.project_id)
    )
  )
);

CREATE POLICY "Project managers can manage impact metrics"
ON public.impact_metrics
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.impact_areas
    WHERE impact_areas.id = impact_metrics.area_id
    AND (
      has_role(auth.uid(), 'super_admin'::app_role) 
      OR has_role(auth.uid(), 'admin'::app_role) 
      OR is_project_manager(auth.uid(), impact_areas.project_id)
    )
    AND NOT has_role(auth.uid(), 'client'::app_role)
  )
);

-- RLS Policies for metric_entries
CREATE POLICY "Project members can view metric entries"
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
      OR is_project_member(auth.uid(), impact_areas.project_id)
    )
  )
);

CREATE POLICY "Project managers can manage metric entries"
ON public.metric_entries
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.impact_metrics
    JOIN public.impact_areas ON impact_areas.id = impact_metrics.area_id
    WHERE impact_metrics.id = metric_entries.metric_id
    AND (
      has_role(auth.uid(), 'super_admin'::app_role) 
      OR has_role(auth.uid(), 'admin'::app_role) 
      OR is_project_manager(auth.uid(), impact_areas.project_id)
    )
    AND NOT has_role(auth.uid(), 'client'::app_role)
  )
);

-- Add triggers for updated_at
CREATE TRIGGER update_impact_areas_updated_at
BEFORE UPDATE ON public.impact_areas
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_impact_metrics_updated_at
BEFORE UPDATE ON public.impact_metrics
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_metric_entries_updated_at
BEFORE UPDATE ON public.metric_entries
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();