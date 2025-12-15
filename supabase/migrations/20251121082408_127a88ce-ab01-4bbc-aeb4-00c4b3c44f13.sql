-- Create enum for requirement status
CREATE TYPE public.requirement_status AS ENUM ('Pending', 'Generated', 'Tasks_Created');

-- Create project_requirements table
CREATE TABLE public.project_requirements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  input_script_raw TEXT NOT NULL,
  ai_tasks_json JSONB,
  status requirement_status NOT NULL DEFAULT 'Pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.project_requirements ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Only Super_Admin, Admin, and Project_Manager can access
CREATE POLICY "Super_Admin and Admin can manage all requirements"
ON public.project_requirements
FOR ALL
USING (
  public.has_role(auth.uid(), 'super_admin'::app_role) OR 
  public.has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Project managers can manage requirements for their projects"
ON public.project_requirements
FOR ALL
USING (
  public.is_project_manager(auth.uid(), project_id)
);

-- Add trigger for updated_at
CREATE TRIGGER update_project_requirements_updated_at
BEFORE UPDATE ON public.project_requirements
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();