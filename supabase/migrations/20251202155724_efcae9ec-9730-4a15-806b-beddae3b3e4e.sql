-- Create checklists table
CREATE TABLE public.checklists (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  milestone_id UUID REFERENCES public.milestones(id) ON DELETE SET NULL,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create checklist_items table
CREATE TABLE public.checklist_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  checklist_id UUID NOT NULL REFERENCES public.checklists(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  is_completed BOOLEAN NOT NULL DEFAULT FALSE,
  completed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.checklists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checklist_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies for checklists
-- Project members can view checklists
CREATE POLICY "Project members can view checklists"
ON public.checklists
FOR SELECT
USING (
  has_role(auth.uid(), 'super_admin'::app_role) OR 
  has_role(auth.uid(), 'admin'::app_role) OR 
  is_project_member(auth.uid(), project_id)
);

-- Only PM/Admin can create checklists
CREATE POLICY "Admins and PMs can create checklists"
ON public.checklists
FOR INSERT
WITH CHECK (
  (has_role(auth.uid(), 'super_admin'::app_role) OR 
   has_role(auth.uid(), 'admin'::app_role) OR 
   is_project_manager(auth.uid(), project_id)) AND
  NOT has_role(auth.uid(), 'client'::app_role) AND
  created_by = auth.uid()
);

-- Only PM/Admin can update checklists
CREATE POLICY "Admins and PMs can update checklists"
ON public.checklists
FOR UPDATE
USING (
  (has_role(auth.uid(), 'super_admin'::app_role) OR 
   has_role(auth.uid(), 'admin'::app_role) OR 
   is_project_manager(auth.uid(), project_id)) AND
  NOT has_role(auth.uid(), 'client'::app_role)
);

-- Only PM/Admin can delete checklists
CREATE POLICY "Admins and PMs can delete checklists"
ON public.checklists
FOR DELETE
USING (
  (has_role(auth.uid(), 'super_admin'::app_role) OR 
   has_role(auth.uid(), 'admin'::app_role) OR 
   is_project_manager(auth.uid(), project_id)) AND
  NOT has_role(auth.uid(), 'client'::app_role)
);

-- RLS Policies for checklist_items
-- View: Anyone who can see the checklist can see items
CREATE POLICY "Users can view checklist items"
ON public.checklist_items
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM checklists c
    WHERE c.id = checklist_items.checklist_id
    AND (has_role(auth.uid(), 'super_admin'::app_role) OR 
         has_role(auth.uid(), 'admin'::app_role) OR 
         is_project_member(auth.uid(), c.project_id))
  )
);

-- Insert: Only PM/Admin can add items
CREATE POLICY "Admins and PMs can create checklist items"
ON public.checklist_items
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM checklists c
    WHERE c.id = checklist_items.checklist_id
    AND (has_role(auth.uid(), 'super_admin'::app_role) OR 
         has_role(auth.uid(), 'admin'::app_role) OR 
         is_project_manager(auth.uid(), c.project_id))
    AND NOT has_role(auth.uid(), 'client'::app_role)
  )
);

-- Update: PM/Admin can update all, Collaborators can only mark completion
CREATE POLICY "Users can update checklist items"
ON public.checklist_items
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM checklists c
    WHERE c.id = checklist_items.checklist_id
    AND (has_role(auth.uid(), 'super_admin'::app_role) OR 
         has_role(auth.uid(), 'admin'::app_role) OR 
         is_project_manager(auth.uid(), c.project_id) OR
         is_project_member(auth.uid(), c.project_id))
    AND NOT has_role(auth.uid(), 'client'::app_role)
  )
);

-- Delete: Only PM/Admin can delete items
CREATE POLICY "Admins and PMs can delete checklist items"
ON public.checklist_items
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM checklists c
    WHERE c.id = checklist_items.checklist_id
    AND (has_role(auth.uid(), 'super_admin'::app_role) OR 
         has_role(auth.uid(), 'admin'::app_role) OR 
         is_project_manager(auth.uid(), c.project_id))
    AND NOT has_role(auth.uid(), 'client'::app_role)
  )
);

-- Indexes for performance
CREATE INDEX idx_checklists_project ON public.checklists(project_id);
CREATE INDEX idx_checklists_milestone ON public.checklists(milestone_id);
CREATE INDEX idx_checklist_items_checklist ON public.checklist_items(checklist_id);

-- Trigger for updated_at on checklists
CREATE TRIGGER update_checklists_updated_at
  BEFORE UPDATE ON public.checklists
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();