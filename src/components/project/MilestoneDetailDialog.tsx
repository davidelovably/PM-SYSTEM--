import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, Flag, ListTodo, User } from "lucide-react";
import { format } from "date-fns";
import { it } from "date-fns/locale";

interface Milestone {
  id: string;
  title: string;
  description: string | null;
  due_date: string;
  state: "planned" | "in_progress" | "completed" | "at_risk";
  strategic_priority: "low" | "medium" | "high";
}

interface Task {
  id: string;
  title: string;
  status: "to_do" | "doing" | "review" | "done";
  priority: "must_have" | "should_have" | "could_have" | "wont_have";
  created_by: string;
  profiles?: {
    full_name: string | null;
    email: string;
  };
}

interface MilestoneDetailDialogProps {
  milestone: Milestone | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit?: (milestone: Milestone) => void;
  onDelete?: (milestoneId: string) => void;
}

const stateLabels = {
  planned: "Pianificato",
  in_progress: "In Corso",
  completed: "Completato",
  at_risk: "A Rischio",
};

const stateColors = {
  planned: "bg-muted text-muted-foreground",
  in_progress: "bg-primary text-primary-foreground",
  completed: "bg-success text-success-foreground",
  at_risk: "bg-destructive text-destructive-foreground",
};

const priorityLabels = {
  low: "Bassa",
  medium: "Media",
  high: "Alta",
};

const priorityColors = {
  low: "bg-muted text-muted-foreground",
  medium: "bg-warning text-warning-foreground",
  high: "bg-destructive text-destructive-foreground",
};

const taskStatusLabels = {
  to_do: "Da Fare",
  doing: "In Corso",
  review: "In Revisione",
  done: "Completato",
};

const taskPriorityLabels = {
  must_have: "Must Have",
  should_have: "Should Have",
  could_have: "Could Have",
  wont_have: "Won't Have",
};

const taskPriorityColors = {
  must_have: "bg-destructive/10 text-destructive border-destructive/30",
  should_have: "bg-warning/10 text-warning border-warning/30",
  could_have: "bg-primary/10 text-primary border-primary/30",
  wont_have: "bg-muted text-muted-foreground border-muted",
};

export function MilestoneDetailDialog({
  milestone,
  open,
  onOpenChange,
}: MilestoneDetailDialogProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (milestone && open) {
      fetchMilestoneTasks();
    }
  }, [milestone, open]);

  const fetchMilestoneTasks = async () => {
    if (!milestone) return;

    setLoading(true);
    const { data, error } = await supabase
      .from("tasks")
      .select(`
        id,
        title,
        status,
        priority,
        created_by,
        profiles:created_by (
          full_name,
          email
        )
      `)
      .eq("milestone_id", milestone.id)
      .order("created_at", { ascending: false });

    if (!error && data) {
      setTasks(data as Task[]);
    }
    setLoading(false);
  };

  if (!milestone) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Flag className="h-5 w-5" />
            {milestone.title}
          </DialogTitle>
          <DialogDescription>
            Dettagli del milestone e task collegati
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Milestone Info */}
          <div className="space-y-4">
            <div className="flex items-center gap-4 flex-wrap">
              <Badge className={stateColors[milestone.state]}>
                {stateLabels[milestone.state]}
              </Badge>
              <Badge className={priorityColors[milestone.strategic_priority]}>
                Priorità: {priorityLabels[milestone.strategic_priority]}
              </Badge>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Calendar className="h-4 w-4" />
                Scadenza: {format(new Date(milestone.due_date), "d MMMM yyyy", { locale: it })}
              </div>
            </div>

            {milestone.description && (
              <p className="text-sm text-muted-foreground">
                {milestone.description}
              </p>
            )}
          </div>

          {/* Connected Tasks */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <ListTodo className="h-5 w-5" />
              <h3 className="font-semibold">Task Collegati</h3>
              <Badge variant="secondary">{tasks.length}</Badge>
            </div>

            {loading ? (
              <div className="text-center py-8 text-muted-foreground">
                Caricamento task...
              </div>
            ) : tasks.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  Nessun task collegato a questo milestone
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {tasks.map((task) => (
                  <Card key={task.id} className="hover:shadow-md transition-shadow">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-start justify-between gap-2">
                        <span className="flex-1">{task.title}</span>
                        <Badge variant="outline" className="text-xs">
                          {taskStatusLabels[task.status]}
                        </Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div className="flex items-center gap-4 text-sm">
                        <div className="flex items-center gap-1.5">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <span className="text-muted-foreground">
                            {task.profiles?.full_name || task.profiles?.email || "Non assegnato"}
                          </span>
                        </div>
                        <Badge
                          variant="outline"
                          className={`text-xs ${taskPriorityColors[task.priority]}`}
                        >
                          {taskPriorityLabels[task.priority]}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
