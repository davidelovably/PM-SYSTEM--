-- Drop existing outdated RLS policies on risks table
DROP POLICY IF EXISTS "Project owners can manage risks" ON public.risks;
DROP POLICY IF EXISTS "Users can view risks of their projects" ON public.risks;

-- Create new RLS policies aligned with RBAC system
CREATE POLICY "Super_Admin and Admin can manage all risks"
ON public.risks
FOR ALL
USING (
  public.has_role(auth.uid(), 'super_admin'::app_role) OR 
  public.has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Project managers can manage risks"
ON public.risks
FOR ALL
USING (
  public.is_project_manager(auth.uid(), project_id)
);

CREATE POLICY "Project members can view risks"
ON public.risks
FOR SELECT
USING (
  public.has_role(auth.uid(), 'super_admin'::app_role) OR 
  public.has_role(auth.uid(), 'admin'::app_role) OR
  public.is_project_member(auth.uid(), project_id)
);