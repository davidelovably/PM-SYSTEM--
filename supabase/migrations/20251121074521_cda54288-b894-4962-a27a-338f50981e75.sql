-- Create comments table with sentiment analysis
CREATE TABLE public.comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  sentiment_label TEXT CHECK (sentiment_label IN ('Positive', 'Neutral', 'Negative')) DEFAULT 'Neutral',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;

-- Users can view comments on tasks they have access to
CREATE POLICY "Users can view task comments"
ON public.comments
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.tasks
    WHERE tasks.id = comments.task_id
    AND (
      has_role(auth.uid(), 'super_admin'::app_role)
      OR has_role(auth.uid(), 'admin'::app_role)
      OR is_project_manager(auth.uid(), tasks.project_id)
      OR EXISTS (
        SELECT 1 FROM public.task_assignments
        WHERE task_assignments.task_id = tasks.id
        AND task_assignments.user_id = auth.uid()
      )
    )
  )
);

-- Users can create comments on tasks they have access to
CREATE POLICY "Users can create task comments"
ON public.comments
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.tasks
    WHERE tasks.id = comments.task_id
    AND (
      has_role(auth.uid(), 'super_admin'::app_role)
      OR has_role(auth.uid(), 'admin'::app_role)
      OR is_project_manager(auth.uid(), tasks.project_id)
      OR EXISTS (
        SELECT 1 FROM public.task_assignments
        WHERE task_assignments.task_id = tasks.id
        AND task_assignments.user_id = auth.uid()
      )
    )
  )
  AND user_id = auth.uid()
);

-- Users can update their own comments
CREATE POLICY "Users can update own comments"
ON public.comments
FOR UPDATE
USING (user_id = auth.uid());

-- Users can delete their own comments, or PMs can delete any comment in their projects
CREATE POLICY "Users can delete comments"
ON public.comments
FOR DELETE
USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.tasks
    WHERE tasks.id = comments.task_id
    AND is_project_manager(auth.uid(), tasks.project_id)
  )
);

-- Add trigger for updated_at
CREATE TRIGGER update_comments_updated_at
BEFORE UPDATE ON public.comments
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();