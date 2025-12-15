-- Fix RLS policy on tasks table to support both assignment methods
-- The current policy only checks task_assignments table, but the app uses assigned_to_user_id field

DROP POLICY IF EXISTS "Users can view tasks based on role and assignment" ON public.tasks;

CREATE POLICY "Users can view tasks based on role and assignment"
ON public.tasks
FOR SELECT
USING (
  -- Super Admin, Admin can view all tasks
  public.has_role(auth.uid(), 'super_admin'::app_role) OR 
  public.has_role(auth.uid(), 'admin'::app_role) OR 
  -- Project Manager can view all tasks in their projects
  public.is_project_manager(auth.uid(), project_id) OR
  -- User assigned via task_assignments table
  public.is_task_assignee(auth.uid(), id) OR
  -- User assigned via assigned_to_user_id field (primary method used by frontend)
  assigned_to_user_id = auth.uid()
);