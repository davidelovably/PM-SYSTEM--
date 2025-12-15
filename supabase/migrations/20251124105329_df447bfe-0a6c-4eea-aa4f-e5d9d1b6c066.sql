-- Modify existing INSERT policy to allow task attachments uploads
-- Drop the existing policy
DROP POLICY IF EXISTS "Users can upload files to their projects" ON storage.objects;

-- Recreate with support for task-attachments folder
CREATE POLICY "Users can upload files to their projects"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'project-files'
  AND (
    -- Case 1: Regular project files (project-id/file)
    (
      (storage.foldername(name))[1] != 'task-attachments'
      AND EXISTS (
        SELECT 1 FROM public.projects
        WHERE projects.id::text = (storage.foldername(name))[1]
        AND (
          public.has_role(auth.uid(), 'super_admin'::app_role)
          OR public.has_role(auth.uid(), 'admin'::app_role)
          OR public.is_project_manager(auth.uid(), projects.id)
        )
      )
    )
    OR
    -- Case 2: Task attachments (task-attachments/project-id/file)
    (
      (storage.foldername(name))[1] = 'task-attachments'
      AND EXISTS (
        SELECT 1 FROM public.projects p
        WHERE p.id::text = (storage.foldername(name))[2]
        AND (
          public.has_role(auth.uid(), 'super_admin'::app_role)
          OR public.has_role(auth.uid(), 'admin'::app_role)
          OR public.is_project_manager(auth.uid(), p.id)
          OR public.is_project_member(auth.uid(), p.id)
        )
      )
    )
  )
);

-- Add policy for viewing task attachments
DROP POLICY IF EXISTS "Users can view task attachments" ON storage.objects;

CREATE POLICY "Users can view task attachments"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'project-files'
  AND (storage.foldername(name))[1] = 'task-attachments'
  AND EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id::text = (storage.foldername(name))[2]
    AND public.is_project_member(auth.uid(), p.id)
  )
);