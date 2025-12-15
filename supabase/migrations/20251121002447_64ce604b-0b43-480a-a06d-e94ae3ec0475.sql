-- Create audit log table for tracking user deletions and other critical actions
CREATE TABLE public.audit_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  performed_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  performed_by_role app_role NOT NULL,
  action_type TEXT NOT NULL,
  target_user_id UUID,
  target_user_email TEXT,
  details JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on audit_log
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- Only Super_Admin and Admin can view audit logs
CREATE POLICY "Super_Admin and Admin can view audit logs"
ON public.audit_log
FOR SELECT
USING (
  has_role(auth.uid(), 'super_admin'::app_role) OR 
  has_role(auth.uid(), 'admin'::app_role)
);

-- System can insert audit logs (via edge functions with service role)
CREATE POLICY "Service role can insert audit logs"
ON public.audit_log
FOR INSERT
WITH CHECK (true);

-- Create index for faster queries
CREATE INDEX idx_audit_log_performed_by ON public.audit_log(performed_by);
CREATE INDEX idx_audit_log_target_user ON public.audit_log(target_user_id);
CREATE INDEX idx_audit_log_created_at ON public.audit_log(created_at DESC);