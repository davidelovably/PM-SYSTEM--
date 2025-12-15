import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { KanbanCard } from "./KanbanCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Task {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  due_date?: string;
  estimated_hours?: number;
}

interface KanbanColumnProps {
  id: string;
  title: string;
  tasks: Task[];
  onTaskClick?: (task: Task) => void;
}

export function KanbanColumn({ id, title, tasks, onTaskClick }: KanbanColumnProps) {
  const { setNodeRef } = useDroppable({ id });

  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center justify-between">
          {title}
          <span className="text-sm font-normal text-muted-foreground">
            {tasks.length}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1">
        <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          <div ref={setNodeRef} className="space-y-3 min-h-[200px]">
            {tasks.map((task) => (
              <KanbanCard 
                key={task.id} 
                task={task} 
                onClick={() => onTaskClick?.(task)}
              />
            ))}
          </div>
        </SortableContext>
      </CardContent>
    </Card>
  );
}
