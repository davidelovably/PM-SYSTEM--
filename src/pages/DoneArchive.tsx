import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Archive } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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

export default function DoneArchive() {
  const { id } = useParams();
  const [project, setProject] = useState<any>(null);
  const [tasks, setTasks] = useState<any[]>([]);

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
      .eq("status", "done")
      .order("updated_at", { ascending: false });

    setTasks(data || []);
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
            <h1 className="text-3xl font-bold text-foreground">Task Completati</h1>
            <p className="text-muted-foreground mt-1">
              {project.title} - {tasks.length} task completati
            </p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Archivio Task Completati</CardTitle>
            <CardDescription>
              Storico di tutti i task completati per questo progetto
            </CardDescription>
          </CardHeader>
          <CardContent>
            {tasks.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Archive className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Nessun task completato al momento</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Titolo</TableHead>
                    <TableHead>Priorità</TableHead>
                    <TableHead>Scadenza</TableHead>
                    <TableHead>Ore Stimate</TableHead>
                    <TableHead>Ore Effettive</TableHead>
                    <TableHead>Completato il</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tasks.map((task) => (
                    <TableRow key={task.id}>
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
                      <TableCell>
                        {task.actual_hours ? `${task.actual_hours}h` : "-"}
                      </TableCell>
                      <TableCell>
                        {new Date(task.updated_at).toLocaleDateString("it-IT")}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
