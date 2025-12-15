-- Update RLS policies to allow admin override for task status changes

-- Drop existing policies
DROP POLICY IF EXISTS "Assigned user can submit for review" ON public.tasks;
DROP POLICY IF EXISTS "Project managers can manage tasks" ON public.tasks;

-- Policy 1: Assigned user OR management roles can update task status
CREATE POLICY "Users can update assigned tasks or admins can override"
ON public.tasks
FOR UPDATE
USING (
  -- User is the assignee
  assigned_to_user_id = auth.uid() OR
  -- OR user is Super Admin, Admin, or PM
  has_role(auth.uid(), 'super_admin'::app_role) OR
  has_role(auth.uid(), 'admin'::app_role) OR
  is_project_manager(auth.uid(), project_id)
)
WITH CHECK (
  -- Allow any status change if admin or PM
  (has_role(auth.uid(), 'super_admin'::app_role) OR
   has_role(auth.uid(), 'admin'::app_role) OR
   is_project_manager(auth.uid(), project_id)) OR
  -- OR if assigned user, allow only specific status transitions
  (assigned_to_user_id = auth.uid() AND status IN ('to_do', 'doing', 'waiting_for_review'))
);

-- Add helpful comment
COMMENT ON POLICY "Users can update assigned tasks or admins can override" ON public.tasks IS 
'Allows assigned users to update their tasks and submit for review. Admin/PM roles can override and manage any task status.';