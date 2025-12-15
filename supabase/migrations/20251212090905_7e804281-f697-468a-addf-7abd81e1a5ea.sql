-- Drop the existing overly permissive SELECT policy on profiles
DROP POLICY IF EXISTS "Users can view relevant profiles" ON public.profiles;

-- Create a more restrictive SELECT policy
-- Users can only view:
-- 1. Their own profile
-- 2. Super_Admin and Admin can view all profiles (for user management)
CREATE POLICY "Users can view own profile or admins can view all"
ON public.profiles
FOR SELECT
USING (
  auth.uid() = id
  OR has_role(auth.uid(), 'super_admin'::app_role)
  OR has_role(auth.uid(), 'admin'::app_role)
);