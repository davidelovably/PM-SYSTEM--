-- Update RLS policies to allow Project Managers to delete projects and tasks

-- Drop existing DELETE policy on projects
DROP POLICY IF EXISTS "Admins can delete projects" ON public.projects;

-- Create new DELETE policy for projects allowing both Admin and Project Manager
CREATE POLICY "Admins and Project Managers can delete projects"
ON public.projects
FOR DELETE
TO authenticated
USING (
  owner_id = auth.uid()
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'project_manager'::app_role)
);

-- Drop existing DELETE policy on tasks
DROP POLICY IF EXISTS "Project owners can delete tasks" ON public.tasks;

-- Create new DELETE policy for tasks allowing Project Owners, Admin, and Project Manager
CREATE POLICY "Project owners and managers can delete tasks"
ON public.tasks
FOR DELETE
TO authenticated
USING (
  created_by = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.projects
    WHERE projects.id = tasks.project_id
    AND projects.owner_id = auth.uid()
  )
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'project_manager'::app_role)
);

-- Ensure cascade delete is set up for project-related tables
-- This will automatically delete related records when a project is deleted

-- Update foreign keys to cascade on delete (if not already set)
ALTER TABLE public.tasks
DROP CONSTRAINT IF EXISTS tasks_project_id_fkey,
ADD CONSTRAINT tasks_project_id_fkey
  FOREIGN KEY (project_id)
  REFERENCES public.projects(id)
  ON DELETE CASCADE;

ALTER TABLE public.milestones
DROP CONSTRAINT IF EXISTS milestones_project_id_fkey,
ADD CONSTRAINT milestones_project_id_fkey
  FOREIGN KEY (project_id)
  REFERENCES public.projects(id)
  ON DELETE CASCADE;

ALTER TABLE public.expenses
DROP CONSTRAINT IF EXISTS expenses_project_id_fkey,
ADD CONSTRAINT expenses_project_id_fkey
  FOREIGN KEY (project_id)
  REFERENCES public.projects(id)
  ON DELETE CASCADE;

ALTER TABLE public.risks
DROP CONSTRAINT IF EXISTS risks_project_id_fkey,
ADD CONSTRAINT risks_project_id_fkey
  FOREIGN KEY (project_id)
  REFERENCES public.projects(id)
  ON DELETE CASCADE;

ALTER TABLE public.project_stakeholders
DROP CONSTRAINT IF EXISTS project_stakeholders_project_id_fkey,
ADD CONSTRAINT project_stakeholders_project_id_fkey
  FOREIGN KEY (project_id)
  REFERENCES public.projects(id)
  ON DELETE CASCADE;

-- Ensure task-related tables cascade on task delete
ALTER TABLE public.task_assignments
DROP CONSTRAINT IF EXISTS task_assignments_task_id_fkey,
ADD CONSTRAINT task_assignments_task_id_fkey
  FOREIGN KEY (task_id)
  REFERENCES public.tasks(id)
  ON DELETE CASCADE;

ALTER TABLE public.task_attachments
DROP CONSTRAINT IF EXISTS task_attachments_task_id_fkey,
ADD CONSTRAINT task_attachments_task_id_fkey
  FOREIGN KEY (task_id)
  REFERENCES public.tasks(id)
  ON DELETE CASCADE;

ALTER TABLE public.task_checklists
DROP CONSTRAINT IF EXISTS task_checklists_task_id_fkey,
ADD CONSTRAINT task_checklists_task_id_fkey
  FOREIGN KEY (task_id)
  REFERENCES public.tasks(id)
  ON DELETE CASCADE;

ALTER TABLE public.task_dependencies
DROP CONSTRAINT IF EXISTS task_dependencies_task_id_fkey,
ADD CONSTRAINT task_dependencies_task_id_fkey
  FOREIGN KEY (task_id)
  REFERENCES public.tasks(id)
  ON DELETE CASCADE;

ALTER TABLE public.task_dependencies
DROP CONSTRAINT IF EXISTS task_dependencies_depends_on_task_id_fkey,
ADD CONSTRAINT task_dependencies_depends_on_task_id_fkey
  FOREIGN KEY (depends_on_task_id)
  REFERENCES public.tasks(id)
  ON DELETE CASCADE;

ALTER TABLE public.task_labels
DROP CONSTRAINT IF EXISTS task_labels_task_id_fkey,
ADD CONSTRAINT task_labels_task_id_fkey
  FOREIGN KEY (task_id)
  REFERENCES public.tasks(id)
  ON DELETE CASCADE;