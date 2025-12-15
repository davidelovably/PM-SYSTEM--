-- Fix 1: Restrict profiles visibility to relevant users only
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;

CREATE POLICY "Users can view relevant profiles"
ON public.profiles FOR SELECT
TO authenticated
USING (
  -- Own profile
  auth.uid() = id OR
  -- Admin/Super Admin can view all
  has_role(auth.uid(), 'super_admin'::app_role) OR
  has_role(auth.uid(), 'admin'::app_role) OR
  -- Users in shared projects can view each other
  EXISTS (
    SELECT 1 FROM public.project_members pm1
    JOIN public.project_members pm2 ON pm1.project_id = pm2.project_id
    WHERE pm1.user_id = auth.uid() AND pm2.user_id = profiles.id
  )
);

-- Fix 2: Assign default 'collaborator' role on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Create profile
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email)
  );
  
  -- Assign default 'collaborator' role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'collaborator');
  
  RETURN NEW;
END;
$$;

-- Fix 3: Enforce is_private flag in storage policies
DROP POLICY IF EXISTS "Users can view files from their projects" ON storage.objects;

CREATE POLICY "Users can view files respecting privacy"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'project-files' AND
  EXISTS (
    SELECT 1 FROM public.project_files pf
    JOIN public.projects p ON pf.project_id = p.id
    WHERE pf.storage_path = name
    AND is_project_member(auth.uid(), p.id)
    AND (
      -- Non-private files: all project members can access
      pf.is_private = false OR
      -- Private files: only admins/PMs can access
      has_role(auth.uid(), 'super_admin'::app_role) OR
      has_role(auth.uid(), 'admin'::app_role) OR
      is_project_manager(auth.uid(), p.id)
    )
  )
);

-- Fix 4: Add NULL checks to security definer functions
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE 
    WHEN _user_id IS NULL OR _role IS NULL THEN false
    ELSE EXISTS (
      SELECT 1
      FROM public.user_roles
      WHERE user_id = _user_id AND role = _role
    )
  END
$$;

CREATE OR REPLACE FUNCTION public.is_project_member(_user_id uuid, _project_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE 
    WHEN _user_id IS NULL OR _project_id IS NULL THEN false
    ELSE EXISTS (
      SELECT 1
      FROM public.project_members
      WHERE project_id = _project_id AND user_id = _user_id
    )
  END
$$;

CREATE OR REPLACE FUNCTION public.is_project_manager(_user_id uuid, _project_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE 
    WHEN _user_id IS NULL OR _project_id IS NULL THEN false
    ELSE EXISTS (
      SELECT 1
      FROM public.project_members
      WHERE project_id = _project_id
      AND user_id = _user_id
      AND role_in_project = 'project_manager'
    )
  END
$$;

CREATE OR REPLACE FUNCTION public.is_task_assignee(_user_id uuid, _task_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE 
    WHEN _user_id IS NULL OR _task_id IS NULL THEN false
    ELSE EXISTS (
      SELECT 1
      FROM public.task_assignments
      WHERE task_id = _task_id AND user_id = _user_id
    )
  END
$$;