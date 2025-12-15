import { useEffect, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { FolderKanban, CheckCircle2, Clock, AlertTriangle } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState({
    totalProjects: 0,
    activeProjects: 0,
    totalTasks: 0,
    completedTasks: 0,
  });
  const [recentProjects, setRecentProjects] = useState<any[]>([]);

  useEffect(() => {
    fetchStats();
    fetchRecentProjects();
  }, [user]);

  const fetchStats = async () => {
    if (!user) return;

    const { data: projects } = await supabase
      .from("projects")
      .select("id, status")
      .or(`owner_id.eq.${user.id}`);

    const { data: tasks } = await supabase
      .from("tasks")
      .select("id, status, project_id")
      .in("project_id", projects?.map(p => p.id) || []);

    setStats({
      totalProjects: projects?.length || 0,
      activeProjects: projects?.filter(p => p.status === 'active').length || 0,
      totalTasks: tasks?.length || 0,
      completedTasks: tasks?.filter(t => t.status === 'done').length || 0,
    });
  };

  const fetchRecentProjects = async () => {
    if (!user) return;

    const { data } = await supabase
      .from("projects")
      .select("*")
      .eq("owner_id", user.id)
      .order("created_at", { ascending: false })
      .limit(5);

    setRecentProjects(data || []);
  };

  const statusColors = {
    planning: "bg-muted text-muted-foreground",
    active: "bg-success text-success-foreground",
    on_hold: "bg-warning text-warning-foreground",
    completed: "bg-primary text-primary-foreground",
    cancelled: "bg-destructive text-destructive-foreground",
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
            <p className="text-muted-foreground mt-1">
              Benvenuto nel tuo sistema di Project Management
            </p>
          </div>
          <Link to="/projects">
            <Button size="lg">
              <FolderKanban className="mr-2 h-5 w-5" />
              Nuovo Progetto
            </Button>
          </Link>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Progetti Totali</CardTitle>
              <FolderKanban className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalProjects}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {stats.activeProjects} attivi
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Task Totali</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalTasks}</div>
              <p className="text-xs text-muted-foreground mt-1">
                In tutti i progetti
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Task Completati</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-success" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-success">{stats.completedTasks}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {stats.totalTasks > 0 ? Math.round((stats.completedTasks / stats.totalTasks) * 100) : 0}% completamento
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Progetti Attivi</CardTitle>
              <AlertTriangle className="h-4 w-4 text-warning" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-warning">{stats.activeProjects}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Richiedono attenzione
              </p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Progetti Recenti</CardTitle>
          </CardHeader>
          <CardContent>
            {recentProjects.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <FolderKanban className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Nessun progetto ancora. Inizia creandone uno nuovo!</p>
              </div>
            ) : (
              <div className="space-y-3">
                {recentProjects.map((project) => (
                  <Link key={project.id} to={`/projects/${project.id}`}>
                    <div className="flex items-center justify-between p-4 border border-border rounded-lg hover:bg-accent/50 transition-colors">
                      <div>
                        <h3 className="font-semibold text-foreground">{project.title}</h3>
                        <p className="text-sm text-muted-foreground mt-1">
                          {project.description || "Nessuna descrizione"}
                        </p>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusColors[project.status as keyof typeof statusColors]}`}>
                        {project.status}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
