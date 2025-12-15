-- Fix infinite recursion in RLS policies by using security definer functions

-- Create security definer function to check project membership
CREATE OR REPLACE FUNCTION public.is_project_member(_user_id uuid, _project_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.project_members
    WHERE project_id = _project_id
    AND user_id = _user_id
  )
$$;

-- Create security definer function to check if user is project manager
CREATE OR REPLACE FUNCTION public.is_project_manager(_user_id uuid, _project_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.project_members
    WHERE project_id = _project_id
    AND user_id = _user_id
    AND role_in_project = 'project_manager'
  )
$$;

-- Drop existing problematic policies on projects
DROP POLICY IF EXISTS "Users can view projects based on membership" ON public.projects;
DROP POLICY IF EXISTS "Project managers can update projects" ON public.projects;
DROP POLICY IF EXISTS "Project managers can delete projects" ON public.projects;
DROP POLICY IF EXISTS "Users can create projects where they are owner" ON public.projects;

-- Create new non-recursive policies for projects
CREATE POLICY "Users can view projects based on membership"
ON public.projects
FOR SELECT
USING (
  has_role(auth.uid(), 'super_admin'::app_role) OR
  has_role(auth.uid(), 'admin'::app_role) OR
  owner_id = auth.uid() OR
  public.is_project_member(auth.uid(), id)
);

CREATE POLICY "Project managers can update projects"
ON public.projects
FOR UPDATE
USING (
  has_role(auth.uid(), 'super_admin'::app_role) OR
  has_role(auth.uid(), 'admin'::app_role) OR
  public.is_project_manager(auth.uid(), id)
);

CREATE POLICY "Project managers can delete projects"
ON public.projects
FOR DELETE
USING (
  has_role(auth.uid(), 'super_admin'::app_role) OR
  has_role(auth.uid(), 'admin'::app_role) OR
  public.is_project_manager(auth.uid(), id)
);

CREATE POLICY "Users can create projects where they are owner"
ON public.projects
FOR INSERT
WITH CHECK (owner_id = auth.uid());

-- Drop existing problematic policies on project_members
DROP POLICY IF EXISTS "Users can view project members" ON public.project_members;
DROP POLICY IF EXISTS "Project owners and admins can manage members" ON public.project_members;

-- Create new non-recursive policies for project_members
CREATE POLICY "Users can view project members"
ON public.project_members
FOR SELECT
USING (
  has_role(auth.uid(), 'super_admin'::app_role) OR
  has_role(auth.uid(), 'admin'::app_role) OR
  user_id = auth.uid() OR
  public.is_project_manager(auth.uid(), project_id)
);

CREATE POLICY "Project managers and admins can manage members"
ON public.project_members
FOR ALL
USING (
  has_role(auth.uid(), 'super_admin'::app_role) OR
  has_role(auth.uid(), 'admin'::app_role) OR
  public.is_project_manager(auth.uid(), project_id)
);

-- Drop existing problematic policies on tasks
DROP POLICY IF EXISTS "Users can view tasks based on role and assignment" ON public.tasks;
DROP POLICY IF EXISTS "Project managers can create tasks" ON public.tasks;
DROP POLICY IF EXISTS "Users can update tasks based on role" ON public.tasks;
DROP POLICY IF EXISTS "Project managers can delete tasks" ON public.tasks;

-- Create new non-recursive policies for tasks
CREATE POLICY "Users can view tasks based on role and assignment"
ON public.tasks
FOR SELECT
USING (
  has_role(auth.uid(), 'super_admin'::app_role) OR
  has_role(auth.uid(), 'admin'::app_role) OR
  public.is_project_manager(auth.uid(), project_id) OR
  EXISTS (
    SELECT 1 FROM public.task_assignments
    WHERE task_assignments.task_id = tasks.id
    AND task_assignments.user_id = auth.uid()
  )
);

CREATE POLICY "Project managers can create tasks"
ON public.tasks
FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'super_admin'::app_role) OR
  has_role(auth.uid(), 'admin'::app_role) OR
  public.is_project_manager(auth.uid(), project_id)
);

CREATE POLICY "Users can update tasks based on role"
ON public.tasks
FOR UPDATE
USING (
  has_role(auth.uid(), 'super_admin'::app_role) OR
  has_role(auth.uid(), 'admin'::app_role) OR
  public.is_project_manager(auth.uid(), project_id) OR
  EXISTS (
    SELECT 1 FROM public.task_assignments
    WHERE task_assignments.task_id = tasks.id
    AND task_assignments.user_id = auth.uid()
  )
);

CREATE POLICY "Project managers can delete tasks"
ON public.tasks
FOR DELETE
USING (
  has_role(auth.uid(), 'super_admin'::app_role) OR
  has_role(auth.uid(), 'admin'::app_role) OR
  public.is_project_manager(auth.uid(), project_id)
);

-- Drop existing problematic policies on milestones
DROP POLICY IF EXISTS "Users can view milestones based on membership" ON public.milestones;
DROP POLICY IF EXISTS "Project managers can manage milestones" ON public.milestones;

-- Create new non-recursive policies for milestones
CREATE POLICY "Users can view milestones based on membership"
ON public.milestones
FOR SELECT
USING (
  has_role(auth.uid(), 'super_admin'::app_role) OR
  has_role(auth.uid(), 'admin'::app_role) OR
  public.is_project_member(auth.uid(), project_id)
);

CREATE POLICY "Project managers can manage milestones"
ON public.milestones
FOR ALL
USING (
  has_role(auth.uid(), 'super_admin'::app_role) OR
  has_role(auth.uid(), 'admin'::app_role) OR
  public.is_project_manager(auth.uid(), project_id)
);