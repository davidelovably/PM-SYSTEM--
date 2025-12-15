-- Add milestone_id column to tasks table
ALTER TABLE public.tasks
ADD COLUMN milestone_id uuid REFERENCES public.milestones(id) ON DELETE SET NULL;

-- Create index for better query performance
CREATE INDEX idx_tasks_milestone_id ON public.tasks(milestone_id);