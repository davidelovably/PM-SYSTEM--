-- Fix RLS policy on user_roles to allow proper INSERT operations
-- Drop existing policy
DROP POLICY IF EXISTS "Admins and super_admins can manage roles" ON public.user_roles;

-- Create separate policies for different operations
-- Super_Admin can do everything
CREATE POLICY "Super admins have full access to user_roles"
ON public.user_roles
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'));

-- Admins can SELECT all roles
CREATE POLICY "Admins can view all roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Admins can INSERT/UPDATE/DELETE non-super_admin roles
CREATE POLICY "Admins can insert non-super_admin roles"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin') 
  AND role != 'super_admin'
);

CREATE POLICY "Admins can update non-super_admin roles"
ON public.user_roles
FOR UPDATE
TO authenticated
USING (role != 'super_admin')
WITH CHECK (
  public.has_role(auth.uid(), 'admin') 
  AND role != 'super_admin'
);

CREATE POLICY "Admins can delete non-super_admin roles"
ON public.user_roles
FOR DELETE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') 
  AND role != 'super_admin'
);