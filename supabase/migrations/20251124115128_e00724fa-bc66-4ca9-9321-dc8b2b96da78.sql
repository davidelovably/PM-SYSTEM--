-- Drop existing policy
DROP POLICY IF EXISTS "Users can view task comments" ON comments;

-- Create updated policy that includes assigned_to_user_id check
CREATE POLICY "Users can view task comments" 
ON comments 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1
    FROM tasks
    WHERE tasks.id = comments.task_id
    AND (
      has_role(auth.uid(), 'super_admin'::app_role) 
      OR has_role(auth.uid(), 'admin'::app_role) 
      OR is_project_manager(auth.uid(), tasks.project_id) 
      OR tasks.assigned_to_user_id = auth.uid()
      OR EXISTS (
        SELECT 1
        FROM task_assignments
        WHERE task_assignments.task_id = tasks.id 
        AND task_assignments.user_id = auth.uid()
      )
    )
  )
);