-- Create enum for milestone state
CREATE TYPE public.milestone_state AS ENUM ('planned', 'in_progress', 'completed', 'at_risk');

-- Create enum for strategic priority
CREATE TYPE public.milestone_priority AS ENUM ('low', 'medium', 'high');

-- Create milestones table
CREATE TABLE public.milestones (
  id UUID NOT NULL DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  due_date DATE NOT NULL,
  state milestone_state NOT NULL DEFAULT 'planned',
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  strategic_priority milestone_priority NOT NULL DEFAULT 'medium',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.milestones ENABLE ROW LEVEL SECURITY;

-- Create policies for milestones
CREATE POLICY "Project owners can manage milestones"
ON public.milestones
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.projects
    WHERE projects.id = milestones.project_id
    AND projects.owner_id = auth.uid()
  )
);

CREATE POLICY "Users can view milestones of their projects"
ON public.milestones
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.projects
    WHERE projects.id = milestones.project_id
    AND (
      projects.owner_id = auth.uid()
      OR EXISTS (
        SELECT 1
        FROM tasks
        JOIN task_assignments ON tasks.id = task_assignments.task_id
        WHERE tasks.project_id = projects.id
        AND task_assignments.user_id = auth.uid()
      )
    )
  )
);

-- Create trigger for updated_at
CREATE TRIGGER update_milestones_updated_at
  BEFORE UPDATE ON public.milestones
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();