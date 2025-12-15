-- Ensure that when a milestone is deleted, tasks' milestone_id is set to NULL instead of blocking deletion
-- First, drop existing foreign key constraint if it exists
ALTER TABLE public.tasks DROP CONSTRAINT IF EXISTS tasks_milestone_id_fkey;

-- Recreate the foreign key with ON DELETE SET NULL
ALTER TABLE public.tasks 
ADD CONSTRAINT tasks_milestone_id_fkey 
FOREIGN KEY (milestone_id) 
REFERENCES public.milestones(id) 
ON DELETE SET NULL;