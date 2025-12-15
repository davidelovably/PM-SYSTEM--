-- Create enum for report periods
CREATE TYPE report_period AS ENUM ('Weekly', 'Monthly', 'OnDemand');

-- Create enum for report status
CREATE TYPE report_status AS ENUM ('Draft', 'Finalized');

-- Create project_reports table
CREATE TABLE project_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  report_period report_period NOT NULL DEFAULT 'OnDemand',
  content_summary TEXT NOT NULL,
  key_metrics_snapshot JSONB,
  status report_status NOT NULL DEFAULT 'Draft',
  created_by UUID NOT NULL REFERENCES profiles(id)
);

-- Enable RLS
ALTER TABLE project_reports ENABLE ROW LEVEL SECURITY;

-- RLS Policies for project_reports
-- Super_Admin, Admin, and Project_Manager can read all reports
CREATE POLICY "Admins and PMs can view all reports"
  ON project_reports
  FOR SELECT
  USING (
    has_role(auth.uid(), 'super_admin'::app_role) OR
    has_role(auth.uid(), 'admin'::app_role) OR
    is_project_manager(auth.uid(), project_id)
  );

-- Clients can only view finalized reports for their projects
CREATE POLICY "Clients can view finalized reports"
  ON project_reports
  FOR SELECT
  USING (
    has_role(auth.uid(), 'client'::app_role) AND
    is_project_member(auth.uid(), project_id) AND
    status = 'Finalized'
  );

-- Only Super_Admin, Admin, and Project_Manager can create reports
CREATE POLICY "Admins and PMs can create reports"
  ON project_reports
  FOR INSERT
  WITH CHECK (
    (has_role(auth.uid(), 'super_admin'::app_role) OR
     has_role(auth.uid(), 'admin'::app_role) OR
     is_project_manager(auth.uid(), project_id)) AND
    created_by = auth.uid() AND
    NOT has_role(auth.uid(), 'client'::app_role)
  );

-- Only Super_Admin, Admin, and Project_Manager can update reports
CREATE POLICY "Admins and PMs can update reports"
  ON project_reports
  FOR UPDATE
  USING (
    (has_role(auth.uid(), 'super_admin'::app_role) OR
     has_role(auth.uid(), 'admin'::app_role) OR
     is_project_manager(auth.uid(), project_id)) AND
    NOT has_role(auth.uid(), 'client'::app_role)
  );

-- Only Super_Admin, Admin, and Project_Manager can delete reports
CREATE POLICY "Admins and PMs can delete reports"
  ON project_reports
  FOR DELETE
  USING (
    (has_role(auth.uid(), 'super_admin'::app_role) OR
     has_role(auth.uid(), 'admin'::app_role) OR
     is_project_manager(auth.uid(), project_id)) AND
    NOT has_role(auth.uid(), 'client'::app_role)
  );

-- Trigger for updated_at
CREATE TRIGGER update_project_reports_updated_at
  BEFORE UPDATE ON project_reports
  FOR EACH ROW
  EXECUTE FUNCTION handle_updated_at();