-- Fix RLS for task_attachments: Allow assigned users to insert attachments
DROP POLICY IF EXISTS "Task members can manage attachments" ON public.task_attachments;

-- Policy for INSERT: Allow assigned users, project managers, admins
CREATE POLICY "Assigned users can insert attachments"
ON public.task_attachments
FOR INSERT
TO authenticated
WITH CHECK (
  uploaded_by = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.tasks t
    WHERE t.id = task_attachments.task_id
    AND (
      -- User is assigned to the task
      t.assigned_to_user_id = auth.uid()
      -- OR user is project manager/admin
      OR public.has_role(auth.uid(), 'super_admin'::app_role)
      OR public.has_role(auth.uid(), 'admin'::app_role)
      OR public.is_project_manager(auth.uid(), t.project_id)
      -- OR user is in task_assignments
      OR public.is_task_assignee(auth.uid(), t.id)
    )
  )
);

-- Policy for UPDATE/DELETE: Allow owner, project managers, admins
CREATE POLICY "Users can manage their attachments"
ON public.task_attachments
FOR ALL
USING (
  uploaded_by = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.tasks t
    WHERE t.id = task_attachments.task_id
    AND (
      public.has_role(auth.uid(), 'super_admin'::app_role)
      OR public.has_role(auth.uid(), 'admin'::app_role)
      OR public.is_project_manager(auth.uid(), t.project_id)
    )
  )
);