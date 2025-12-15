-- Create project_members table for project membership tracking
CREATE TABLE IF NOT EXISTS public.project_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role_in_project app_role NOT NULL CHECK (role_in_project IN ('project_manager', 'collaborator')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  UNIQUE(project_id, user_id)
);

-- Enable RLS on project_members
ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;

-- Allow users to view project members if they are project owner or member
CREATE POLICY "Users can view project members"
ON public.project_members
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.projects
    WHERE projects.id = project_members.project_id
    AND projects.owner_id = auth.uid()
  )
  OR user_id = auth.uid()
  OR has_role(auth.uid(), 'super_admin')
  OR has_role(auth.uid(), 'admin')
);

-- Only project owners, admins and super_admins can manage project members
CREATE POLICY "Project owners and admins can manage members"
ON public.project_members
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.projects
    WHERE projects.id = project_members.project_id
    AND projects.owner_id = auth.uid()
  )
  OR has_role(auth.uid(), 'super_admin')
  OR has_role(auth.uid(), 'admin')
);

-- Update RLS policy on user_roles to protect super_admin role
DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;

CREATE POLICY "Admins and super_admins can manage roles"
ON public.user_roles
FOR ALL
USING (
  CASE 
    WHEN role = 'super_admin' THEN has_role(auth.uid(), 'super_admin')
    ELSE has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin')
  END
);

-- Create trigger to automatically add project owner as project_manager in project_members
CREATE OR REPLACE FUNCTION public.handle_new_project()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.project_members (project_id, user_id, role_in_project)
  VALUES (NEW.id, NEW.owner_id, 'project_manager');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_project_created
  AFTER INSERT ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_project();