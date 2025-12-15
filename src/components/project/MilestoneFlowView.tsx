import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { ChevronRight, ChevronDown, User } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { TaskDetailDialog } from "./TaskDetailDialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

interface Task {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  due_date: string | null;
  estimated_hours: number | null;
  assigned_to_user_id: string | null;
  profiles?: {
    full_name: string | null;
    email: string;
  };
}

interface TaskWithDependencies extends Task {
  dependencies: Task[];
}

interface MilestoneFlowViewProps {
  milestoneId: string;
}

const statusLabels: Record<string, string> = {
  to_do: "Da Fare",
  doing: "In Corso",
  review: "In Revisione",
  done: "Completato",
  waiting_for_review: "In Attesa",
};

const statusColors: Record<string, string> = {
  to_do: "bg-muted text-muted-foreground",
  doing: "bg-primary text-primary-foreground",
  review: "bg-warning text-warning-foreground",
  done: "bg-success text-success-foreground",
  waiting_for_review: "bg-warning text-warning-foreground",
};

const priorityColors: Record<string, string> = {
  must_have: "bg-destructive text-destructive-foreground",
  should_have: "bg-warning text-warning-foreground",
  could_have: "bg-muted text-muted-foreground",
  wont_have: "bg-muted text-muted-foreground",
};

export function MilestoneFlowView({ milestoneId }: MilestoneFlowViewProps) {
  const [tasks, setTasks] = useState<TaskWithDependencies[]>([]);
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);

  useEffect(() => {
    fetchTasksWithDependencies();
  }, [milestoneId]);

  const fetchTasksWithDependencies = async () => {
    setLoading(true);
    try {
      // Fetch all tasks for this milestone with assigned user info
      const { data: milestoneTasks, error: tasksError } = await supabase
        .from("tasks")
        .select("*")
        .eq("milestone_id", milestoneId)
        .order("position");

      if (tasksError) throw tasksError;

      // Fetch profiles for assigned users
      const userIds = milestoneTasks
        ?.map(t => t.assigned_to_user_id)
        .filter(Boolean) || [];
      
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", userIds);

      const profilesMap = new Map(profiles?.map(p => [p.id, p]) || []);

      // For each task, fetch its dependencies
      const tasksWithDeps: TaskWithDependencies[] = [];
      
      for (const task of milestoneTasks || []) {
        const { data: deps, error: depsError } = await supabase
          .from("task_dependencies")
          .select("depends_on_task_id")
          .eq("task_id", task.id);

        let dependencies: Task[] = [];
        
        if (!depsError && deps && deps.length > 0) {
          const depIds = deps.map(d => d.depends_on_task_id);
          const { data: depTasks } = await supabase
            .from("tasks")
            .select("*")
            .in("id", depIds);

          dependencies = depTasks?.map(dt => ({
            ...dt,
            profiles: dt.assigned_to_user_id ? profilesMap.get(dt.assigned_to_user_id) : undefined,
          })) || [];
        }

        tasksWithDeps.push({
          ...task,
          profiles: task.assigned_to_user_id ? profilesMap.get(task.assigned_to_user_id) : undefined,
          dependencies,
        });
      }

      setTasks(tasksWithDeps);
    } catch (error) {
      console.error("Error fetching tasks:", error);
    } finally {
      setLoading(false);
    }
  };

  const toggleTaskExpansion = (taskId: string) => {
    setExpandedTasks((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(taskId)) {
        newSet.delete(taskId);
      } else {
        newSet.add(taskId);
      }
      return newSet;
    });
  };

  const handleTaskClick = (task: Task) => {
    setSelectedTask(task);
    setDetailDialogOpen(true);
  };

  if (loading) {
    return (
      <div className="py-8 text-center text-muted-foreground">
        Caricamento task...
      </div>
    );
  }

  if (tasks.length === 0) {
    return (
      <div className="py-8 text-center text-muted-foreground">
        Nessuna task collegata a questo milestone
      </div>
    );
  }

  const renderTaskRow = (task: Task | TaskWithDependencies, isNested = false) => {
    const isExpanded = expandedTasks.has(task.id);
    const dependencies = 'dependencies' in task ? task.dependencies : [];
    const hasDependencies = dependencies.length > 0;

    return (
      <div key={task.id} className={isNested ? "ml-10 border-l-2 border-border pl-4" : ""}>
        <Collapsible
          open={isExpanded}
          onOpenChange={() => toggleTaskExpansion(task.id)}
        >
          <div
            className="flex items-center gap-3 p-3 hover:bg-accent/50 rounded-md transition-colors group"
          >
            {/* Expand/Collapse Icon */}
            {hasDependencies && (
              <CollapsibleTrigger asChild>
                <button
                  className="flex-shrink-0 p-1 hover:bg-accent rounded"
                  onClick={(e) => e.stopPropagation()}
                >
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </button>
              </CollapsibleTrigger>
            )}
            {!hasDependencies && <div className="w-6" />}

            {/* Status Badge */}
            <Badge className={`${statusColors[task.status]} flex-shrink-0`} variant="secondary">
              {statusLabels[task.status]}
            </Badge>

            {/* Task Title (clickable) */}
            <div
              className="flex-1 min-w-0 cursor-pointer"
              onClick={() => handleTaskClick(task)}
            >
              <h4 className="font-medium text-sm truncate">
                {task.title}
              </h4>
              {task.description && (
                <p className="text-xs text-muted-foreground truncate">
                  {task.description}
                </p>
              )}
            </div>

            {/* Assignee Avatar */}
            {task.profiles && (
              <div className="flex items-center gap-2 flex-shrink-0">
                <Avatar className="h-6 w-6">
                  <AvatarFallback className="text-xs">
                    {task.profiles.full_name?.charAt(0) || task.profiles.email.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className="text-xs text-muted-foreground hidden sm:inline">
                  {task.profiles.full_name || task.profiles.email}
                </span>
              </div>
            )}
            {!task.profiles && (
              <div className="flex items-center gap-2 flex-shrink-0 text-muted-foreground">
                <User className="h-4 w-4" />
                <span className="text-xs hidden sm:inline">Non assegnato</span>
              </div>
            )}

            {/* Priority Badge */}
            <Badge className={`${priorityColors[task.priority]} flex-shrink-0`} variant="outline">
              {task.priority.replace("_", " ").toUpperCase()}
            </Badge>

            {/* Due Date */}
            {task.due_date && (
              <div className="text-xs text-muted-foreground flex-shrink-0 hidden md:block">
                {new Date(task.due_date).toLocaleDateString("it-IT")}
              </div>
            )}
          </div>

          {/* Nested Dependencies */}
          {hasDependencies && (
            <CollapsibleContent>
              <div className="mt-1">
                {dependencies.map((dep) => renderTaskRow(dep, true))}
              </div>
            </CollapsibleContent>
          )}
        </Collapsible>
      </div>
    );
  };

  return (
    <div className="space-y-2">
      <div className="space-y-1">
        {tasks.map((task) => renderTaskRow(task, false))}
      </div>

      {/* Task Detail Dialog */}
      <TaskDetailDialog
        task={selectedTask}
        open={detailDialogOpen}
        onOpenChange={setDetailDialogOpen}
        onDelete={fetchTasksWithDependencies}
      />
    </div>
  );
}
