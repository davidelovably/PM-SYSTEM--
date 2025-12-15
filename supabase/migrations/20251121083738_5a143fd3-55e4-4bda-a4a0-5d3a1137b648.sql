-- Create security definer function to check if user is assigned to a task
CREATE OR REPLACE FUNCTION public.is_task_assignee(_user_id uuid, _task_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.task_assignments
    WHERE task_id = _task_id
    AND user_id = _user_id
  )
$$;

-- Drop existing problematic RLS policies on tasks
DROP POLICY IF EXISTS "Users can update tasks based on role" ON public.tasks;
DROP POLICY IF EXISTS "Users can view tasks based on role and assignment" ON public.tasks;

-- Create new RLS policies without recursion
CREATE POLICY "Users can update tasks based on role"
ON public.tasks
FOR UPDATE
USING (
  public.has_role(auth.uid(), 'super_admin'::app_role) OR 
  public.has_role(auth.uid(), 'admin'::app_role) OR 
  public.is_project_manager(auth.uid(), project_id) OR
  public.is_task_assignee(auth.uid(), id)
);

CREATE POLICY "Users can view tasks based on role and assignment"
ON public.tasks
FOR SELECT
USING (
  public.has_role(auth.uid(), 'super_admin'::app_role) OR 
  public.has_role(auth.uid(), 'admin'::app_role) OR 
  public.is_project_manager(auth.uid(), project_id) OR
  public.is_task_assignee(auth.uid(), id)
);