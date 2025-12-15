-- Create message_type enum
CREATE TYPE public.inbox_message_type AS ENUM ('notification', 'direct_message', 'file_share');

-- Create inbox_messages table
CREATE TABLE public.inbox_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  sender_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  recipient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  content TEXT NOT NULL,
  message_type inbox_message_type NOT NULL DEFAULT 'notification',
  related_entity_id UUID,
  related_entity_type TEXT,
  attachment_file_id UUID REFERENCES public.project_files(id) ON DELETE SET NULL,
  is_read BOOLEAN NOT NULL DEFAULT FALSE
);

-- Enable RLS
ALTER TABLE public.inbox_messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Users can view their own messages
CREATE POLICY "Users can view own messages"
ON public.inbox_messages
FOR SELECT
USING (recipient_id = auth.uid());

-- Users can update their own messages (mark as read)
CREATE POLICY "Users can update own messages"
ON public.inbox_messages
FOR UPDATE
USING (recipient_id = auth.uid());

-- Users can send messages to others (insert)
CREATE POLICY "Authenticated users can send messages"
ON public.inbox_messages
FOR INSERT
WITH CHECK (
  auth.uid() IS NOT NULL AND 
  (sender_id = auth.uid() OR sender_id IS NULL)
);

-- Users can delete their own received messages
CREATE POLICY "Users can delete own messages"
ON public.inbox_messages
FOR DELETE
USING (recipient_id = auth.uid());

-- Create indexes for performance
CREATE INDEX idx_inbox_messages_recipient ON public.inbox_messages(recipient_id);
CREATE INDEX idx_inbox_messages_sender ON public.inbox_messages(sender_id);
CREATE INDEX idx_inbox_messages_is_read ON public.inbox_messages(recipient_id, is_read);
CREATE INDEX idx_inbox_messages_created_at ON public.inbox_messages(created_at DESC);

-- Trigger function to create inbox message on task assignment
CREATE OR REPLACE FUNCTION public.notify_task_assignment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  task_title TEXT;
  project_title TEXT;
  sender_name TEXT;
BEGIN
  -- Only trigger when assigned_to_user_id is set or changed
  IF NEW.assigned_to_user_id IS NOT NULL AND 
     (OLD.assigned_to_user_id IS NULL OR OLD.assigned_to_user_id != NEW.assigned_to_user_id) THEN
    
    -- Get task and project info
    SELECT t.title, p.title INTO task_title, project_title
    FROM tasks t
    JOIN projects p ON p.id = t.project_id
    WHERE t.id = NEW.id;
    
    -- Get sender name
    SELECT COALESCE(full_name, email) INTO sender_name
    FROM profiles
    WHERE id = auth.uid();
    
    -- Create inbox message for assignee
    INSERT INTO inbox_messages (
      sender_id,
      recipient_id,
      subject,
      content,
      message_type,
      related_entity_id,
      related_entity_type
    ) VALUES (
      auth.uid(),
      NEW.assigned_to_user_id,
      'Nuovo Task Assegnato: ' || task_title,
      'Ti è stato assegnato un nuovo task "' || task_title || '" nel progetto "' || project_title || '". Verifica i dettagli e inizia a lavorarci.',
      'notification',
      NEW.id,
      'task'
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for task assignment
CREATE TRIGGER on_task_assignment
  AFTER INSERT OR UPDATE OF assigned_to_user_id ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_task_assignment();

-- Trigger function to notify PM on review request (extends existing trigger)
CREATE OR REPLACE FUNCTION public.notify_pm_on_review_request()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  pm_user_id UUID;
  task_title TEXT;
  project_title TEXT;
  assignee_name TEXT;
BEGIN
  -- Only trigger when status changes to waiting_for_review
  IF NEW.status = 'waiting_for_review' AND (OLD.status IS NULL OR OLD.status != 'waiting_for_review') THEN
    
    -- Get task and project info
    SELECT t.title, p.title INTO task_title, project_title
    FROM tasks t
    JOIN projects p ON p.id = t.project_id
    WHERE t.id = NEW.id;
    
    -- Get assignee name
    SELECT COALESCE(full_name, email) INTO assignee_name
    FROM profiles
    WHERE id = NEW.assigned_to_user_id;
    
    -- Find all PMs for this project
    FOR pm_user_id IN 
      SELECT user_id FROM project_members 
      WHERE project_id = NEW.project_id AND role_in_project = 'project_manager'
    LOOP
      -- Create inbox message
      INSERT INTO inbox_messages (
        sender_id,
        recipient_id,
        subject,
        content,
        message_type,
        related_entity_id,
        related_entity_type
      ) VALUES (
        NEW.assigned_to_user_id,
        pm_user_id,
        'Richiesta Revisione: ' || task_title,
        COALESCE(assignee_name, 'Un collaboratore') || ' ha completato il task "' || task_title || '" nel progetto "' || project_title || '" e richiede la tua revisione.',
        'notification',
        NEW.id,
        'task'
      );
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for review request
CREATE TRIGGER on_task_review_request
  AFTER UPDATE OF status ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_pm_on_review_request();

-- Trigger function to notify assignee on review outcome
CREATE OR REPLACE FUNCTION public.notify_review_outcome()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  task_title TEXT;
  project_title TEXT;
  reviewer_name TEXT;
  outcome_subject TEXT;
  outcome_content TEXT;
BEGIN
  -- Only trigger when status changes from waiting_for_review
  IF OLD.status = 'waiting_for_review' AND NEW.status IN ('done', 'doing') AND NEW.assigned_to_user_id IS NOT NULL THEN
    
    -- Get task and project info
    SELECT t.title, p.title INTO task_title, project_title
    FROM tasks t
    JOIN projects p ON p.id = t.project_id
    WHERE t.id = NEW.id;
    
    -- Get reviewer name
    SELECT COALESCE(full_name, email) INTO reviewer_name
    FROM profiles
    WHERE id = auth.uid();
    
    IF NEW.status = 'done' THEN
      outcome_subject := 'Task Approvato: ' || task_title;
      outcome_content := 'Il tuo task "' || task_title || '" nel progetto "' || project_title || '" è stato approvato da ' || COALESCE(reviewer_name, 'un revisore') || '. Ottimo lavoro!';
    ELSE
      outcome_subject := 'Task Rifiutato: ' || task_title;
      outcome_content := 'Il tuo task "' || task_title || '" nel progetto "' || project_title || '" richiede modifiche. Verifica i commenti lasciati da ' || COALESCE(reviewer_name, 'un revisore') || ' e riprova.';
    END IF;
    
    -- Create inbox message for assignee
    INSERT INTO inbox_messages (
      sender_id,
      recipient_id,
      subject,
      content,
      message_type,
      related_entity_id,
      related_entity_type
    ) VALUES (
      auth.uid(),
      NEW.assigned_to_user_id,
      outcome_subject,
      outcome_content,
      'notification',
      NEW.id,
      'task'
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for review outcome
CREATE TRIGGER on_task_review_outcome
  AFTER UPDATE OF status ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_review_outcome();