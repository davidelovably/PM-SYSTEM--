-- Drop existing permissive policies on project_stakeholders
DROP POLICY IF EXISTS "Project owners can manage stakeholders" ON public.project_stakeholders;
DROP POLICY IF EXISTS "Users can view stakeholders of their projects" ON public.project_stakeholders;

-- Create restrictive policies: only Super_Admin and Admin can view/manage stakeholders
CREATE POLICY "Super_Admin and Admin can manage stakeholders"
ON public.project_stakeholders
FOR ALL
USING (
  has_role(auth.uid(), 'super_admin'::app_role) OR 
  has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Super_Admin and Admin can view stakeholders"
ON public.project_stakeholders
FOR SELECT
USING (
  has_role(auth.uid(), 'super_admin'::app_role) OR 
  has_role(auth.uid(), 'admin'::app_role)
);