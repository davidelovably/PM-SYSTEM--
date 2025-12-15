-- Phase 2: Update RLS policies to block Client role from write operations

-- Update RLS policies on projects table
DROP POLICY IF EXISTS "Users can view projects based on membership" ON public.projects;
CREATE POLICY "Users can view projects based on membership"
ON public.projects
FOR SELECT
USING (
  has_role(auth.uid(), 'super_admin'::app_role) OR 
  has_role(auth.uid(), 'admin'::app_role) OR 
  (owner_id = auth.uid()) OR 
  is_project_member(auth.uid(), id)
);

DROP POLICY IF EXISTS "Users can create projects where they are owner" ON public.projects;
CREATE POLICY "Users can create projects where they are owner"
ON public.projects
FOR INSERT
WITH CHECK (
  (owner_id = auth.uid()) AND 
  NOT has_role(auth.uid(), 'client'::app_role)
);

DROP POLICY IF EXISTS "Project managers can update projects" ON public.projects;
CREATE POLICY "Project managers can update projects"
ON public.projects
FOR UPDATE
USING (
  (has_role(auth.uid(), 'super_admin'::app_role) OR 
   has_role(auth.uid(), 'admin'::app_role) OR 
   is_project_manager(auth.uid(), id)) AND
  NOT has_role(auth.uid(), 'client'::app_role)
);

DROP POLICY IF EXISTS "Project managers can delete projects" ON public.projects;
CREATE POLICY "Project managers can delete projects"
ON public.projects
FOR DELETE
USING (
  (has_role(auth.uid(), 'super_admin'::app_role) OR 
   has_role(auth.uid(), 'admin'::app_role) OR 
   is_project_manager(auth.uid(), id)) AND
  NOT has_role(auth.uid(), 'client'::app_role)
);

-- Update RLS policies on tasks table
DROP POLICY IF EXISTS "Project managers can create tasks" ON public.tasks;
CREATE POLICY "Project managers can create tasks"
ON public.tasks
FOR INSERT
WITH CHECK (
  (has_role(auth.uid(), 'super_admin'::app_role) OR 
   has_role(auth.uid(), 'admin'::app_role) OR 
   is_project_manager(auth.uid(), project_id)) AND
  NOT has_role(auth.uid(), 'client'::app_role)
);

DROP POLICY IF EXISTS "Users can update assigned tasks or admins can override" ON public.tasks;
CREATE POLICY "Users can update assigned tasks or admins can override"
ON public.tasks
FOR UPDATE
USING (
  ((assigned_to_user_id = auth.uid()) OR 
   has_role(auth.uid(), 'super_admin'::app_role) OR 
   has_role(auth.uid(), 'admin'::app_role) OR 
   is_project_manager(auth.uid(), project_id)) AND
  NOT has_role(auth.uid(), 'client'::app_role)
)
WITH CHECK (
  (has_role(auth.uid(), 'super_admin'::app_role) OR 
   has_role(auth.uid(), 'admin'::app_role) OR 
   is_project_manager(auth.uid(), project_id) OR 
   ((assigned_to_user_id = auth.uid()) AND (status = ANY (ARRAY['to_do'::task_status, 'doing'::task_status, 'waiting_for_review'::task_status])))) AND
  NOT has_role(auth.uid(), 'client'::app_role)
);

DROP POLICY IF EXISTS "Project managers can delete tasks" ON public.tasks;
CREATE POLICY "Project managers can delete tasks"
ON public.tasks
FOR DELETE
USING (
  (has_role(auth.uid(), 'super_admin'::app_role) OR 
   has_role(auth.uid(), 'admin'::app_role) OR 
   is_project_manager(auth.uid(), project_id)) AND
  NOT has_role(auth.uid(), 'client'::app_role)
);

-- Update RLS policies on milestones table
DROP POLICY IF EXISTS "Users can view milestones based on membership" ON public.milestones;
CREATE POLICY "Users can view milestones based on membership"
ON public.milestones
FOR SELECT
USING (
  has_role(auth.uid(), 'super_admin'::app_role) OR 
  has_role(auth.uid(), 'admin'::app_role) OR 
  is_project_member(auth.uid(), project_id)
);

DROP POLICY IF EXISTS "Project managers can manage milestones" ON public.milestones;
CREATE POLICY "Project managers can manage milestones"
ON public.milestones
FOR ALL
USING (
  (has_role(auth.uid(), 'super_admin'::app_role) OR 
   has_role(auth.uid(), 'admin'::app_role) OR 
   is_project_manager(auth.uid(), project_id)) AND
  NOT has_role(auth.uid(), 'client'::app_role)
);

-- Update RLS policies on comments table
DROP POLICY IF EXISTS "Users can create task comments" ON public.comments;
CREATE POLICY "Users can create task comments"
ON public.comments
FOR INSERT
WITH CHECK (
  (user_id = auth.uid()) AND 
  NOT has_role(auth.uid(), 'client'::app_role) AND
  (EXISTS (SELECT 1 FROM tasks t 
    WHERE t.id = comments.task_id AND t.project_id IS NOT NULL AND 
    (has_role(auth.uid(), 'super_admin'::app_role) OR 
     has_role(auth.uid(), 'admin'::app_role) OR 
     is_project_manager(auth.uid(), t.project_id) OR 
     (t.assigned_to_user_id IS NOT NULL AND t.assigned_to_user_id = auth.uid()) OR 
     is_project_member(auth.uid(), t.project_id))))
);

DROP POLICY IF EXISTS "Users can update own comments" ON public.comments;
CREATE POLICY "Users can update own comments"
ON public.comments
FOR UPDATE
USING (
  (user_id = auth.uid()) AND 
  NOT has_role(auth.uid(), 'client'::app_role)
);

DROP POLICY IF EXISTS "Users can delete comments" ON public.comments;
CREATE POLICY "Users can delete comments"
ON public.comments
FOR DELETE
USING (
  ((user_id = auth.uid()) OR 
   (EXISTS (SELECT 1 FROM tasks WHERE tasks.id = comments.task_id AND is_project_manager(auth.uid(), tasks.project_id)))) AND
  NOT has_role(auth.uid(), 'client'::app_role)
);

-- Update RLS policies on project_files table
DROP POLICY IF EXISTS "Project members can view non-private files" ON public.project_files;
CREATE POLICY "Project members can view non-private files"
ON public.project_files
FOR SELECT
USING (
  (NOT is_private) AND 
  is_project_member(auth.uid(), project_id)
);

DROP POLICY IF EXISTS "Project managers can manage project files" ON public.project_files;
CREATE POLICY "Project managers can manage project files"
ON public.project_files
FOR ALL
USING (
  (has_role(auth.uid(), 'super_admin'::app_role) OR 
   has_role(auth.uid(), 'admin'::app_role) OR 
   is_project_manager(auth.uid(), project_id)) AND
  NOT has_role(auth.uid(), 'client'::app_role)
);

-- Update RLS policies on risks table
DROP POLICY IF EXISTS "Project members can view risks" ON public.risks;
CREATE POLICY "Project members can view risks"
ON public.risks
FOR SELECT
USING (
  has_role(auth.uid(), 'super_admin'::app_role) OR 
  has_role(auth.uid(), 'admin'::app_role) OR 
  is_project_member(auth.uid(), project_id)
);

DROP POLICY IF EXISTS "Project managers can manage risks" ON public.risks;
CREATE POLICY "Project managers can manage risks"
ON public.risks
FOR ALL
USING (
  (is_project_manager(auth.uid(), project_id)) AND
  NOT has_role(auth.uid(), 'client'::app_role)
);

DROP POLICY IF EXISTS "Super_Admin and Admin can manage all risks" ON public.risks;
CREATE POLICY "Super_Admin and Admin can manage all risks"
ON public.risks
FOR ALL
USING (
  (has_role(auth.uid(), 'super_admin'::app_role) OR 
   has_role(auth.uid(), 'admin'::app_role)) AND
  NOT has_role(auth.uid(), 'client'::app_role)
);

-- Update RLS policies on project_requirements table
DROP POLICY IF EXISTS "Project managers can manage requirements for their projects" ON public.project_requirements;
CREATE POLICY "Project managers can manage requirements for their projects"
ON public.project_requirements
FOR ALL
USING (
  is_project_manager(auth.uid(), project_id) AND
  NOT has_role(auth.uid(), 'client'::app_role)
);

DROP POLICY IF EXISTS "Super_Admin and Admin can manage all requirements" ON public.project_requirements;
CREATE POLICY "Super_Admin and Admin can manage all requirements"
ON public.project_requirements
FOR ALL
USING (
  (has_role(auth.uid(), 'super_admin'::app_role) OR 
   has_role(auth.uid(), 'admin'::app_role)) AND
  NOT has_role(auth.uid(), 'client'::app_role)
);

-- Update RLS policies on project_members table
DROP POLICY IF EXISTS "Users can view project members" ON public.project_members;
CREATE POLICY "Users can view project members"
ON public.project_members
FOR SELECT
USING (
  has_role(auth.uid(), 'super_admin'::app_role) OR 
  has_role(auth.uid(), 'admin'::app_role) OR 
  (user_id = auth.uid()) OR 
  is_project_member(auth.uid(), project_id)
);

DROP POLICY IF EXISTS "Project managers and admins can manage members" ON public.project_members;
CREATE POLICY "Project managers and admins can manage members"
ON public.project_members
FOR ALL
USING (
  (has_role(auth.uid(), 'super_admin'::app_role) OR 
   has_role(auth.uid(), 'admin'::app_role) OR 
   is_project_manager(auth.uid(), project_id)) AND
  NOT has_role(auth.uid(), 'client'::app_role)
);