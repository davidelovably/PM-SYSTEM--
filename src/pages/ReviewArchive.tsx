import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft, CheckCircle, Eye } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TaskDetailDialog } from "@/components/project/TaskDetailDialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

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

export default function ReviewArchive() {
  const { id } = useParams();
  const [project, setProject] = useState<any>(null);
  const [tasks, setTasks] = useState<any[]>([]);
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);

  useEffect(() => {
    if (id) {
      fetchProject();
      fetchTasks();
    }
  }, [id]);

  const fetchProject = async () => {
    const { data } = await supabase
      .from("projects")
      .select("*")
      .eq("id", id)
      .single();

    setProject(data);
  };

  const fetchTasks = async () => {
    const { data } = await supabase
      .from("tasks")
      .select("*")
      .eq("project_id", id)
      .eq("status", "waiting_for_review")
      .order("updated_at", { ascending: false });

    setTasks(data || []);
  };

  const handleTaskClick = (task: any) => {
    setSelectedTask(task);
    setDetailDialogOpen(true);
  };

  if (!project) {
    return (
      <MainLayout>
        <div>Caricamento...</div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link to={`/projects/${id}`}>
            <Button variant="outline" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-foreground">Task in Revisione</h1>
            <p className="text-muted-foreground mt-1">
              {project.title} - {tasks.length} task in attesa di approvazione
            </p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Task in Revisione</CardTitle>
            <CardDescription>
              Approva i task completati o respingili per ulteriori modifiche
            </CardDescription>
          </CardHeader>
          <CardContent>
            {tasks.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <CheckCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Nessun task in revisione al momento</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Titolo</TableHead>
                    <TableHead>Priorità</TableHead>
                    <TableHead>Scadenza</TableHead>
                    <TableHead>Ore Stimate</TableHead>
                    <TableHead className="text-right">Azioni</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tasks.map((task) => (
                    <TableRow key={task.id} className="cursor-pointer hover:bg-muted/50" onClick={() => handleTaskClick(task)}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{task.title}</p>
                          {task.description && (
                            <p className="text-sm text-muted-foreground line-clamp-1">
                              {task.description}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={
                            priorityColors[task.priority as keyof typeof priorityColors]
                          }
                        >
                          {priorityLabels[task.priority as keyof typeof priorityLabels]}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {task.due_date
                          ? new Date(task.due_date).toLocaleDateString("it-IT")
                          : "-"}
                      </TableCell>
                      <TableCell>
                        {task.estimated_hours ? `${task.estimated_hours}h` : "-"}
                      </TableCell>
                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleTaskClick(task)}
                        >
                          <Eye className="mr-2 h-4 w-4" />
                          Visualizza Dettagli
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <TaskDetailDialog
        task={selectedTask}
        open={detailDialogOpen}
        onOpenChange={setDetailDialogOpen}
        onDelete={fetchTasks}
      />
    </MainLayout>
  );
}
