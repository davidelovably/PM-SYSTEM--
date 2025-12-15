-- Drop existing INSERT policy that requires specific roles
DROP POLICY IF EXISTS "Project managers and admins can create projects" ON public.projects;

-- Create new INSERT policy allowing users to create projects where they are the owner
CREATE POLICY "Users can create projects where they are owner"
ON public.projects
FOR INSERT
TO authenticated
WITH CHECK (owner_id = auth.uid());