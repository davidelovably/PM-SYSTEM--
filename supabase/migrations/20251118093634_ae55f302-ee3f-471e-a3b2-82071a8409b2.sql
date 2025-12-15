-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create enum types
CREATE TYPE public.app_role AS ENUM ('admin', 'project_manager', 'collaborator');
CREATE TYPE public.project_priority AS ENUM ('low', 'medium', 'high', 'critical');
CREATE TYPE public.project_status AS ENUM ('planning', 'active', 'on_hold', 'completed', 'cancelled');
CREATE TYPE public.task_priority AS ENUM ('must_have', 'should_have', 'could_have', 'wont_have');
CREATE TYPE public.task_status AS ENUM ('to_do', 'doing', 'review', 'done');
CREATE TYPE public.risk_probability AS ENUM ('very_low', 'low', 'medium', 'high', 'very_high');
CREATE TYPE public.risk_impact AS ENUM ('very_low', 'low', 'medium', 'high', 'very_high');

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Create user_roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create function to check user role
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Create projects table
CREATE TABLE public.projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT,
  status project_status NOT NULL DEFAULT 'planning',
  priority project_priority NOT NULL DEFAULT 'medium',
  start_date DATE,
  end_date DATE,
  budget DECIMAL(12,2),
  owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

-- Create project_stakeholders table
CREATE TABLE public.project_stakeholders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  role TEXT,
  email TEXT,
  raci_responsible BOOLEAN DEFAULT FALSE,
  raci_accountable BOOLEAN DEFAULT FALSE,
  raci_consulted BOOLEAN DEFAULT FALSE,
  raci_informed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.project_stakeholders ENABLE ROW LEVEL SECURITY;

-- Create tasks table
CREATE TABLE public.tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  status task_status NOT NULL DEFAULT 'to_do',
  priority task_priority NOT NULL DEFAULT 'should_have',
  estimated_hours DECIMAL(6,2),
  actual_hours DECIMAL(6,2),
  due_date DATE,
  position INTEGER NOT NULL DEFAULT 0,
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

-- Create task_assignments table
CREATE TABLE public.task_assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(task_id, user_id)
);

ALTER TABLE public.task_assignments ENABLE ROW LEVEL SECURITY;

-- Create task_dependencies table
CREATE TABLE public.task_dependencies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  depends_on_task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(task_id, depends_on_task_id),
  CHECK (task_id != depends_on_task_id)
);

ALTER TABLE public.task_dependencies ENABLE ROW LEVEL SECURITY;

-- Create task_labels table
CREATE TABLE public.task_labels (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#3b82f6',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.task_labels ENABLE ROW LEVEL SECURITY;

-- Create task_checklists table
CREATE TABLE public.task_checklists (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  completed BOOLEAN NOT NULL DEFAULT FALSE,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.task_checklists ENABLE ROW LEVEL SECURITY;

-- Create task_attachments table
CREATE TABLE public.task_attachments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_size INTEGER,
  uploaded_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.task_attachments ENABLE ROW LEVEL SECURITY;

-- Create risks table
CREATE TABLE public.risks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  probability risk_probability NOT NULL,
  impact risk_impact NOT NULL,
  owner_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  mitigation_plan TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.risks ENABLE ROW LEVEL SECURITY;

-- Create expenses table
CREATE TABLE public.expenses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  description TEXT,
  expense_date DATE NOT NULL,
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

-- Create notifications table
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL,
  read BOOLEAN NOT NULL DEFAULT FALSE,
  link TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies for profiles
CREATE POLICY "Users can view all profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

-- RLS Policies for user_roles
CREATE POLICY "Users can view all roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage roles"
  ON public.user_roles FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for projects
CREATE POLICY "Users can view projects they're involved in"
  ON public.projects FOR SELECT
  TO authenticated
  USING (
    owner_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.tasks
      JOIN public.task_assignments ON tasks.id = task_assignments.task_id
      WHERE tasks.project_id = projects.id AND task_assignments.user_id = auth.uid()
    )
  );

CREATE POLICY "Project managers and admins can create projects"
  ON public.projects FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'project_manager')
  );

CREATE POLICY "Project owners and admins can update projects"
  ON public.projects FOR UPDATE
  TO authenticated
  USING (
    owner_id = auth.uid() OR
    public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Admins can delete projects"
  ON public.projects FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for project_stakeholders
CREATE POLICY "Users can view stakeholders of their projects"
  ON public.project_stakeholders FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = project_stakeholders.project_id
      AND (
        projects.owner_id = auth.uid() OR
        EXISTS (
          SELECT 1 FROM public.tasks
          JOIN public.task_assignments ON tasks.id = task_assignments.task_id
          WHERE tasks.project_id = projects.id AND task_assignments.user_id = auth.uid()
        )
      )
    )
  );

CREATE POLICY "Project owners can manage stakeholders"
  ON public.project_stakeholders FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = project_stakeholders.project_id
      AND projects.owner_id = auth.uid()
    )
  );

-- RLS Policies for tasks
CREATE POLICY "Users can view tasks of their projects"
  ON public.tasks FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = tasks.project_id
      AND (
        projects.owner_id = auth.uid() OR
        EXISTS (
          SELECT 1 FROM public.task_assignments
          WHERE task_assignments.task_id = tasks.id AND task_assignments.user_id = auth.uid()
        )
      )
    )
  );

CREATE POLICY "Project members can create tasks"
  ON public.tasks FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = tasks.project_id
      AND projects.owner_id = auth.uid()
    ) OR
    public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Project owners and assignees can update tasks"
  ON public.tasks FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = tasks.project_id
      AND projects.owner_id = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 FROM public.task_assignments
      WHERE task_assignments.task_id = tasks.id AND task_assignments.user_id = auth.uid()
    ) OR
    public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Project owners can delete tasks"
  ON public.tasks FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = tasks.project_id
      AND projects.owner_id = auth.uid()
    ) OR
    public.has_role(auth.uid(), 'admin')
  );

-- RLS Policies for task_assignments (same pattern as tasks)
CREATE POLICY "Users can view task assignments"
  ON public.task_assignments FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.tasks
      JOIN public.projects ON tasks.project_id = projects.id
      WHERE tasks.id = task_assignments.task_id
      AND projects.owner_id = auth.uid()
    )
  );

CREATE POLICY "Project owners can manage task assignments"
  ON public.task_assignments FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.tasks
      JOIN public.projects ON tasks.project_id = projects.id
      WHERE tasks.id = task_assignments.task_id
      AND projects.owner_id = auth.uid()
    )
  );

-- Similar RLS policies for other task-related tables
CREATE POLICY "Users can view task dependencies"
  ON public.task_dependencies FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.tasks
      JOIN public.projects ON tasks.project_id = projects.id
      WHERE tasks.id = task_dependencies.task_id
      AND (
        projects.owner_id = auth.uid() OR
        EXISTS (
          SELECT 1 FROM public.task_assignments
          WHERE task_assignments.task_id = tasks.id AND task_assignments.user_id = auth.uid()
        )
      )
    )
  );

CREATE POLICY "Project owners can manage task dependencies"
  ON public.task_dependencies FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.tasks
      JOIN public.projects ON tasks.project_id = projects.id
      WHERE tasks.id = task_dependencies.task_id
      AND projects.owner_id = auth.uid()
    )
  );

-- RLS for task_labels
CREATE POLICY "Users can view task labels"
  ON public.task_labels FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.tasks
      JOIN public.projects ON tasks.project_id = projects.id
      WHERE tasks.id = task_labels.task_id
      AND (
        projects.owner_id = auth.uid() OR
        EXISTS (
          SELECT 1 FROM public.task_assignments
          WHERE task_assignments.task_id = tasks.id AND task_assignments.user_id = auth.uid()
        )
      )
    )
  );

CREATE POLICY "Project members can manage task labels"
  ON public.task_labels FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.tasks
      JOIN public.projects ON tasks.project_id = projects.id
      WHERE tasks.id = task_labels.task_id
      AND (
        projects.owner_id = auth.uid() OR
        EXISTS (
          SELECT 1 FROM public.task_assignments
          WHERE task_assignments.task_id = tasks.id AND task_assignments.user_id = auth.uid()
        )
      )
    )
  );

-- RLS for task_checklists
CREATE POLICY "Users can view task checklists"
  ON public.task_checklists FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.tasks
      JOIN public.projects ON tasks.project_id = projects.id
      WHERE tasks.id = task_checklists.task_id
      AND (
        projects.owner_id = auth.uid() OR
        EXISTS (
          SELECT 1 FROM public.task_assignments
          WHERE task_assignments.task_id = tasks.id AND task_assignments.user_id = auth.uid()
        )
      )
    )
  );

CREATE POLICY "Task members can manage checklists"
  ON public.task_checklists FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.tasks
      JOIN public.projects ON tasks.project_id = projects.id
      WHERE tasks.id = task_checklists.task_id
      AND (
        projects.owner_id = auth.uid() OR
        EXISTS (
          SELECT 1 FROM public.task_assignments
          WHERE task_assignments.task_id = tasks.id AND task_assignments.user_id = auth.uid()
        )
      )
    )
  );

-- RLS for task_attachments
CREATE POLICY "Users can view task attachments"
  ON public.task_attachments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.tasks
      JOIN public.projects ON tasks.project_id = projects.id
      WHERE tasks.id = task_attachments.task_id
      AND (
        projects.owner_id = auth.uid() OR
        EXISTS (
          SELECT 1 FROM public.task_assignments
          WHERE task_assignments.task_id = tasks.id AND task_assignments.user_id = auth.uid()
        )
      )
    )
  );

CREATE POLICY "Task members can manage attachments"
  ON public.task_attachments FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.tasks
      JOIN public.projects ON tasks.project_id = projects.id
      WHERE tasks.id = task_attachments.task_id
      AND (
        projects.owner_id = auth.uid() OR
        EXISTS (
          SELECT 1 FROM public.task_assignments
          WHERE task_assignments.task_id = tasks.id AND task_assignments.user_id = auth.uid()
        )
      )
    )
  );

-- RLS for risks
CREATE POLICY "Users can view risks of their projects"
  ON public.risks FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = risks.project_id
      AND (
        projects.owner_id = auth.uid() OR
        EXISTS (
          SELECT 1 FROM public.tasks
          JOIN public.task_assignments ON tasks.id = task_assignments.task_id
          WHERE tasks.project_id = projects.id AND task_assignments.user_id = auth.uid()
        )
      )
    )
  );

CREATE POLICY "Project owners can manage risks"
  ON public.risks FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = risks.project_id
      AND projects.owner_id = auth.uid()
    )
  );

-- RLS for expenses
CREATE POLICY "Users can view expenses of their projects"
  ON public.expenses FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = expenses.project_id
      AND (
        projects.owner_id = auth.uid() OR
        EXISTS (
          SELECT 1 FROM public.tasks
          JOIN public.task_assignments ON tasks.id = task_assignments.task_id
          WHERE tasks.project_id = projects.id AND task_assignments.user_id = auth.uid()
        )
      )
    )
  );

CREATE POLICY "Project owners can manage expenses"
  ON public.expenses FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = expenses.project_id
      AND projects.owner_id = auth.uid()
    )
  );

-- RLS for notifications
CREATE POLICY "Users can view own notifications"
  ON public.notifications FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can update own notifications"
  ON public.notifications FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "System can create notifications"
  ON public.notifications FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Create trigger function for updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add triggers for updated_at
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.risks
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Create function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email)
  );
  RETURN NEW;
END;
$$;

-- Create trigger for new user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();