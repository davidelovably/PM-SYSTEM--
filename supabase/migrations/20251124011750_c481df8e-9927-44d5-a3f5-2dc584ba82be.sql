-- Add assigned_to field to tasks table
ALTER TABLE public.tasks
ADD COLUMN assigned_to_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Create index for performance
CREATE INDEX idx_tasks_assigned_to ON public.tasks(assigned_to_user_id);

-- Update RLS policies for task assignment workflow

-- Drop existing update policy
DROP POLICY IF EXISTS "Users can update tasks based on role" ON public.tasks;

-- Create new granular update policies
-- 1. Assigned user can update task status to waiting_for_review
CREATE POLICY "Assigned user can submit for review"
ON public.tasks
FOR UPDATE
USING (assigned_to_user_id = auth.uid() AND status IN ('to_do', 'doing'))
WITH CHECK (
  assigned_to_user_id = auth.uid() AND
  status IN ('waiting_for_review', 'to_do', 'doing')
);

-- 2. Project managers can update any task field and approve/reject
CREATE POLICY "Project managers can manage tasks"
ON public.tasks
FOR UPDATE
USING (
  has_role(auth.uid(), 'super_admin'::app_role) OR
  has_role(auth.uid(), 'admin'::app_role) OR
  is_project_manager(auth.uid(), project_id)
);

-- Add comment explaining the workflow
COMMENT ON COLUMN public.tasks.assigned_to_user_id IS 'User assigned to complete this task. Only this user can submit the task for review (status = waiting_for_review).';
