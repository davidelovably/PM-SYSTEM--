-- Create storage bucket for project files
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'project-files',
  'project-files',
  false,
  52428800, -- 50MB limit
  ARRAY[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'text/plain',
    'application/zip',
    'application/x-rar-compressed'
  ]
);

-- Create project_files table for file metadata
CREATE TABLE public.project_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_size INTEGER,
  file_type TEXT,
  storage_path TEXT NOT NULL,
  is_private BOOLEAN NOT NULL DEFAULT false,
  uploaded_by UUID NOT NULL REFERENCES auth.users(id),
  uploaded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  transferred_from_task_id UUID REFERENCES public.tasks(id),
  notes TEXT
);

-- Enable RLS
ALTER TABLE public.project_files ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Project managers can manage all files
CREATE POLICY "Project managers can manage project files"
ON public.project_files
FOR ALL
USING (
  has_role(auth.uid(), 'super_admin'::app_role) OR
  has_role(auth.uid(), 'admin'::app_role) OR
  is_project_manager(auth.uid(), project_id)
);

-- RLS Policy: Project members can view non-private files
CREATE POLICY "Project members can view non-private files"
ON public.project_files
FOR SELECT
USING (
  NOT is_private AND
  is_project_member(auth.uid(), project_id)
);

-- RLS Policy: Admins and PMs can view all files
CREATE POLICY "Admins and PMs can view all files"
ON public.project_files
FOR SELECT
USING (
  has_role(auth.uid(), 'super_admin'::app_role) OR
  has_role(auth.uid(), 'admin'::app_role) OR
  is_project_manager(auth.uid(), project_id)
);

-- Create indexes for performance
CREATE INDEX idx_project_files_project ON public.project_files(project_id);
CREATE INDEX idx_project_files_uploaded_by ON public.project_files(uploaded_by);
CREATE INDEX idx_project_files_is_private ON public.project_files(is_private);

-- Storage policies for project-files bucket
CREATE POLICY "Users can upload files to their projects"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'project-files' AND
  EXISTS (
    SELECT 1 FROM public.projects
    WHERE id::text = (storage.foldername(name))[1]
    AND (
      has_role(auth.uid(), 'super_admin'::app_role) OR
      has_role(auth.uid(), 'admin'::app_role) OR
      is_project_manager(auth.uid(), id)
    )
  )
);

CREATE POLICY "Users can view files from their projects"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'project-files' AND
  EXISTS (
    SELECT 1 FROM public.projects
    WHERE id::text = (storage.foldername(name))[1]
    AND is_project_member(auth.uid(), id)
  )
);

CREATE POLICY "Project managers can delete files"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'project-files' AND
  EXISTS (
    SELECT 1 FROM public.projects
    WHERE id::text = (storage.foldername(name))[1]
    AND (
      has_role(auth.uid(), 'super_admin'::app_role) OR
      has_role(auth.uid(), 'admin'::app_role) OR
      is_project_manager(auth.uid(), id)
    )
  )
);

-- Add transferred_at column to task_attachments to track transfers
ALTER TABLE public.task_attachments ADD COLUMN IF NOT EXISTS transferred_to_docs BOOLEAN DEFAULT false;
ALTER TABLE public.task_attachments ADD COLUMN IF NOT EXISTS transferred_at TIMESTAMP WITH TIME ZONE;