import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock, Calendar, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface Task {
  id: string;
  title: string;
  description?: string;
  priority: string;
  due_date?: string;
  estimated_hours?: number;
  assigned_to_user_id?: string | null;
}

interface KanbanCardProps {
  task: Task;
  isDragging?: boolean;
  onClick?: () => void;
}

const priorityColors = {
  must_have: "bg-destructive text-destructive-foreground",
  should_have: "bg-warning text-warning-foreground",
  could_have: "bg-accent text-accent-foreground",
  wont_have: "bg-muted text-muted-foreground",
};

const priorityLabels = {
  must_have: "Must Have",
  should_have: "Should Have",
  could_have: "Could Have",
  wont_have: "Won't Have",
};

export function KanbanCard({ task, isDragging = false, onClick }: KanbanCardProps) {
  const [assigneeName, setAssigneeName] = useState<string>("");

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: task.id });

  useEffect(() => {
    const fetchAssignee = async () => {
      if (!task.assigned_to_user_id) return;

      const { data } = await supabase
        .from("profiles")
        .select("full_name, email")
        .eq("id", task.assigned_to_user_id)
        .single();

      if (data) {
        setAssigneeName(data.full_name || data.email);
      }
    };

    fetchAssignee();
  }, [task.assigned_to_user_id]);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <Card
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={(e) => {
        // Only trigger onClick if not dragging
        if (!isDragging && onClick) {
          e.stopPropagation();
          onClick();
        }
      }}
      className="cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow"
    >
      <CardHeader className="pb-2 space-y-2">
        <Badge className={`text-xs w-fit ${priorityColors[task.priority as keyof typeof priorityColors]}`}>
          {priorityLabels[task.priority as keyof typeof priorityLabels]}
        </Badge>
        <CardTitle className="text-sm font-semibold leading-tight line-clamp-2 break-words">
          {task.title}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0 space-y-3">
        {task.description && (
          <p className="text-xs text-muted-foreground line-clamp-2 break-words">
            {task.description}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          {task.due_date && (
            <div className="flex items-center gap-1 shrink-0">
              <Calendar className="h-3 w-3 shrink-0" />
              <span className="truncate">{new Date(task.due_date).toLocaleDateString("it-IT")}</span>
            </div>
          )}
          {task.estimated_hours && (
            <div className="flex items-center gap-1 shrink-0">
              <Clock className="h-3 w-3 shrink-0" />
              <span>{task.estimated_hours}h</span>
            </div>
          )}
        </div>
        {assigneeName && (
          <div className="flex items-center gap-2 mt-2 pt-2 border-t">
            <Avatar className="h-5 w-5">
              <AvatarFallback className="text-[10px] bg-primary/10">
                {assigneeName.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <span className="text-xs text-muted-foreground truncate">{assigneeName}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
