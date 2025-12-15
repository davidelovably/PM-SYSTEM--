-- Add waiting_for_review status to task_status enum
ALTER TYPE task_status ADD VALUE IF NOT EXISTS 'waiting_for_review';

-- Update notifications table to support task completion workflow
ALTER TABLE public.notifications 
  ADD COLUMN IF NOT EXISTS sender_id uuid REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS task_id uuid REFERENCES public.tasks(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS previous_task_status task_status;

-- Create index for faster notification queries
CREATE INDEX IF NOT EXISTS idx_notifications_recipient_read ON public.notifications(user_id, read);
CREATE INDEX IF NOT EXISTS idx_notifications_task_id ON public.notifications(task_id);

-- Drop existing RLS policies on tasks table
DROP POLICY IF EXISTS "Users can create tasks in owned projects" ON public.tasks;
DROP POLICY IF EXISTS "Users can view tasks in owned projects" ON public.tasks;
DROP POLICY IF EXISTS "Project owners can update tasks" ON public.tasks;
DROP POLICY IF EXISTS "Project owners and managers can delete tasks" ON public.tasks;

-- New RLS policies for tasks based on RBAC and project membership

-- SELECT: Super_Admin/Admin see all, PM sees project tasks, Collaborator sees assigned tasks
CREATE POLICY "Users can view tasks based on role and assignment"
ON public.tasks
FOR SELECT
USING (
  has_role(auth.uid(), 'super_admin'::app_role) OR
  has_role(auth.uid(), 'admin'::app_role) OR
  EXISTS (
    SELECT 1 FROM public.project_members
    WHERE project_members.project_id = tasks.project_id
    AND project_members.user_id = auth.uid()
    AND project_members.role_in_project = 'project_manager'::app_role
  ) OR
  EXISTS (
    SELECT 1 FROM public.task_assignments
    WHERE task_assignments.task_id = tasks.id
    AND task_assignments.user_id = auth.uid()
  )
);

-- INSERT: Super_Admin/Admin/PM can create tasks
CREATE POLICY "Project managers can create tasks"
ON public.tasks
FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'super_admin'::app_role) OR
  has_role(auth.uid(), 'admin'::app_role) OR
  EXISTS (
    SELECT 1 FROM public.project_members
    WHERE project_members.project_id = tasks.project_id
    AND project_members.user_id = auth.uid()
    AND project_members.role_in_project = 'project_manager'::app_role
  )
);

-- UPDATE: Super_Admin/Admin/PM can update all fields, Collaborator can only update status
CREATE POLICY "Users can update tasks based on role"
ON public.tasks
FOR UPDATE
USING (
  has_role(auth.uid(), 'super_admin'::app_role) OR
  has_role(auth.uid(), 'admin'::app_role) OR
  EXISTS (
    SELECT 1 FROM public.project_members
    WHERE project_members.project_id = tasks.project_id
    AND project_members.user_id = auth.uid()
    AND project_members.role_in_project = 'project_manager'::app_role
  ) OR
  EXISTS (
    SELECT 1 FROM public.task_assignments
    WHERE task_assignments.task_id = tasks.id
    AND task_assignments.user_id = auth.uid()
  )
);

-- DELETE: Only Super_Admin/Admin/PM can delete
CREATE POLICY "Project managers can delete tasks"
ON public.tasks
FOR DELETE
USING (
  has_role(auth.uid(), 'super_admin'::app_role) OR
  has_role(auth.uid(), 'admin'::app_role) OR
  EXISTS (
    SELECT 1 FROM public.project_members
    WHERE project_members.project_id = tasks.project_id
    AND project_members.user_id = auth.uid()
    AND project_members.role_in_project = 'project_manager'::app_role
  )
);

-- Update RLS policies for projects table
DROP POLICY IF EXISTS "Users can view own projects" ON public.projects;
DROP POLICY IF EXISTS "Project owners and admins can update projects" ON public.projects;
DROP POLICY IF EXISTS "Admins and Project Managers can delete projects" ON public.projects;

CREATE POLICY "Users can view projects based on membership"
ON public.projects
FOR SELECT
USING (
  has_role(auth.uid(), 'super_admin'::app_role) OR
  has_role(auth.uid(), 'admin'::app_role) OR
  owner_id = auth.uid() OR
  EXISTS (
    SELECT 1 FROM public.project_members
    WHERE project_members.project_id = projects.id
    AND project_members.user_id = auth.uid()
  )
);

CREATE POLICY "Project managers can update projects"
ON public.projects
FOR UPDATE
USING (
  has_role(auth.uid(), 'super_admin'::app_role) OR
  has_role(auth.uid(), 'admin'::app_role) OR
  EXISTS (
    SELECT 1 FROM public.project_members
    WHERE project_members.project_id = projects.id
    AND project_members.user_id = auth.uid()
    AND project_members.role_in_project = 'project_manager'::app_role
  )
);

CREATE POLICY "Project managers can delete projects"
ON public.projects
FOR DELETE
USING (
  has_role(auth.uid(), 'super_admin'::app_role) OR
  has_role(auth.uid(), 'admin'::app_role) OR
  EXISTS (
    SELECT 1 FROM public.project_members
    WHERE project_members.project_id = projects.id
    AND project_members.user_id = auth.uid()
    AND project_members.role_in_project = 'project_manager'::app_role
  )
);

-- Update RLS policies for milestones
DROP POLICY IF EXISTS "Users can view milestones of their projects" ON public.milestones;
DROP POLICY IF EXISTS "Project owners can manage milestones" ON public.milestones;

CREATE POLICY "Users can view milestones based on membership"
ON public.milestones
FOR SELECT
USING (
  has_role(auth.uid(), 'super_admin'::app_role) OR
  has_role(auth.uid(), 'admin'::app_role) OR
  EXISTS (
    SELECT 1 FROM public.project_members
    WHERE project_members.project_id = milestones.project_id
    AND project_members.user_id = auth.uid()
  )
);

CREATE POLICY "Project managers can manage milestones"
ON public.milestones
FOR ALL
USING (
  has_role(auth.uid(), 'super_admin'::app_role) OR
  has_role(auth.uid(), 'admin'::app_role) OR
  EXISTS (
    SELECT 1 FROM public.project_members
    WHERE project_members.project_id = milestones.project_id
    AND project_members.user_id = auth.uid()
    AND project_members.role_in_project = 'project_manager'::app_role
  )
);

-- Create function to notify PM when task status changes to waiting_for_review
CREATE OR REPLACE FUNCTION public.notify_pm_on_task_completion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  pm_user_id uuid;
BEGIN
  -- Only create notification if status changed to waiting_for_review
  IF NEW.status = 'waiting_for_review' AND (OLD.status IS NULL OR OLD.status != 'waiting_for_review') THEN
    -- Find the project manager for this task's project
    SELECT user_id INTO pm_user_id
    FROM public.project_members
    WHERE project_id = NEW.project_id
    AND role_in_project = 'project_manager'
    LIMIT 1;
    
    -- Create notification if PM found
    IF pm_user_id IS NOT NULL THEN
      INSERT INTO public.notifications (
        user_id,
        sender_id,
        task_id,
        type,
        status,
        previous_task_status,
        title,
        message
      ) VALUES (
        pm_user_id,
        auth.uid(),
        NEW.id,
        'task_completion_request',
        'pending',
        OLD.status,
        'Richiesta Completamento Task',
        'Un task richiede la tua approvazione: ' || NEW.title
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for task completion notifications
DROP TRIGGER IF EXISTS on_task_status_change ON public.tasks;
CREATE TRIGGER on_task_status_change
  AFTER INSERT OR UPDATE OF status ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_pm_on_task_completion();

-- Update notification RLS policies
DROP POLICY IF EXISTS "System can create notifications" ON public.notifications;

CREATE POLICY "System and users can create notifications"
ON public.notifications
FOR INSERT
WITH CHECK (
  true
);