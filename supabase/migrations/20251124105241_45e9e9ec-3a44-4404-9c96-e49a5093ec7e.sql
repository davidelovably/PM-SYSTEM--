-- Fix RLS for comments: Allow all project members to comment on tasks they can view
DROP POLICY IF EXISTS "Users can create task comments" ON public.comments;

CREATE POLICY "Users can create task comments"
ON public.comments
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.tasks t
    WHERE t.id = comments.task_id
    AND t.project_id IS NOT NULL
    AND (
      public.has_role(auth.uid(), 'super_admin'::app_role)
      OR public.has_role(auth.uid(), 'admin'::app_role)
      OR (t.project_id IS NOT NULL AND public.is_project_manager(auth.uid(), t.project_id))
      OR (t.assigned_to_user_id IS NOT NULL AND t.assigned_to_user_id = auth.uid())
      OR (t.project_id IS NOT NULL AND public.is_project_member(auth.uid(), t.project_id))
    )
  )
);