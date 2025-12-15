-- Drop the problematic recursive policy
DROP POLICY IF EXISTS "Users can view milestones of their projects" ON public.milestones;

-- Create a simpler, non-recursive policy for viewing milestones
-- Users can view milestones if they own the project
CREATE POLICY "Users can view milestones of their projects"
ON public.milestones
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.projects
    WHERE projects.id = milestones.project_id
      AND projects.owner_id = auth.uid()
  )
);