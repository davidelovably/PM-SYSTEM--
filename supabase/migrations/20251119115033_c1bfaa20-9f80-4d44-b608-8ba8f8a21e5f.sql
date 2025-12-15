-- Fix infinite recursion in RLS policies by simplifying project access

-- Drop the problematic policy that causes recursion
DROP POLICY IF EXISTS "Users can view projects they're involved in" ON public.projects;

-- Create a simpler policy: users can only view their own projects
CREATE POLICY "Users can view own projects"
ON public.projects
FOR SELECT
TO authenticated
USING (owner_id = auth.uid());