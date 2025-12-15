-- Drop existing problematic RLS policies on tasks table
DROP POLICY IF EXISTS "Project members can create tasks" ON public.tasks;
DROP POLICY IF EXISTS "Project owners and assignees can update tasks" ON public.tasks;
DROP POLICY IF EXISTS "Project owners can delete tasks" ON public.tasks;
DROP POLICY IF EXISTS "Users can view tasks of their projects" ON public.tasks;

-- Create simplified non-recursive RLS policies for tasks table
-- INSERT: Only check direct project ownership
CREATE POLICY "Users can create tasks in owned projects"
ON public.tasks
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.projects
    WHERE projects.id = tasks.project_id
    AND projects.owner_id = auth.uid()
  )
  OR has_role(auth.uid(), 'admin'::app_role)
);

-- SELECT: Only check direct project ownership (no task_assignments lookup)
CREATE POLICY "Users can view tasks in owned projects"
ON public.tasks
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.projects
    WHERE projects.id = tasks.project_id
    AND projects.owner_id = auth.uid()
  )
);

-- UPDATE: Check project ownership OR if user is the task creator
-- Avoid task_assignments lookup to prevent recursion
CREATE POLICY "Project owners can update tasks"
ON public.tasks
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.projects
    WHERE projects.id = tasks.project_id
    AND projects.owner_id = auth.uid()
  )
  OR created_by = auth.uid()
  OR has_role(auth.uid(), 'admin'::app_role)
);

-- DELETE: Only project owners can delete
CREATE POLICY "Project owners can delete tasks"
ON public.tasks
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.projects
    WHERE projects.id = tasks.project_id
    AND projects.owner_id = auth.uid()
  )
  OR has_role(auth.uid(), 'admin'::app_role)
);