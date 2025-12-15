import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Plus, Trash2, ChevronDown } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { KanbanBoard } from "@/components/project/KanbanBoard";
import { MilestonesList } from "@/components/project/MilestonesList";
import { ProjectTimeline } from "@/components/project/ProjectTimeline";
import { ProjectMembers } from "@/components/project/ProjectMembers";
import { RisksTab } from "@/components/project/RisksTab";
import { RequirementsTab } from "@/components/project/RequirementsTab";
import { DocumentationTab } from "@/components/project/DocumentationTab";
import { BusinessImpactTab } from "@/components/project/BusinessImpactTab";
import { ReportsTab } from "@/components/project/ReportsTab";
import { ChecklistsTab } from "@/components/project/ChecklistsTab";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";

export default function ProjectDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isAdmin, isSuperAdmin, isProjectManager, isClient } = useUserRole();
  const { toast } = useToast();
  const [project, setProject] = useState<any>(null);
  const [tasks, setTasks] = useState<any[]>([]);
  const [milestones, setMilestones] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("kanban");
  const [projectMembers, setProjectMembers] = useState<Array<{ id: string; full_name: string | null; email: string }>>([]);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    priority: "should_have",
    status: "to_do",
    due_date: "",
    estimated_hours: "",
    dependencies: [] as string[],
    milestone_id: null as string | null,
    assigned_to_user_id: "" as string,
  });

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '');
      if (hash && ['kanban', 'overview', 'milestones', 'risks', 'members', 'documentation', 'impact', 'requirements', 'reports', 'checklists'].includes(hash)) {
        setActiveTab(hash);
      }
    };

    // Initialize from current hash and listen for future changes
    handleHashChange();
    window.addEventListener('hashchange', handleHashChange);

    return () => {
      window.removeEventListener('hashchange', handleHashChange);
    };
  }, []);

  useEffect(() => {
    if (id) {
      fetchProject();
      fetchTasks();
      fetchMilestones();
    }
  }, [id]);

  useEffect(() => {
    if (open && id) {
      fetchProjectMembers();
    }
  }, [open, id]);

  const fetchProjectMembers = async () => {
    if (!id) return;

    const { data, error } = await supabase
      .from("project_members")
      .select("user_id, profiles(id, full_name, email)")
      .eq("project_id", id);

    if (error) {
      console.error("Error fetching project members:", error);
      return;
    }

    const members = data?.map((member: any) => ({
      id: member.profiles.id,
      full_name: member.profiles.full_name,
      email: member.profiles.email,
    })) || [];

    setProjectMembers(members);
  };

  const fetchProject = async () => {
    const { data } = await supabase
      .from("projects")
      .select("*")
      .eq("id", id)
      .single();

    setProject(data);
  };

  const fetchTasks = async () => {
    if (!user) return;

    // Fetch tasks - RLS policy handles access control
    const { data } = await supabase
      .from("tasks")
      .select("*, assigned_to_user_id")
      .eq("project_id", id)
      .order("position");
    setTasks(data || []);
  };

  const handleDeleteProject = async () => {
    try {
      const { error } = await supabase
        .from("projects")
        .delete()
        .eq("id", id);

      if (error) throw error;

      toast({
        title: "Progetto eliminato",
        description: "Il progetto e tutti i dati correlati sono stati eliminati con successo.",
      });

      navigate("/projects");
    } catch (error: any) {
      toast({
        title: "Errore",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const fetchMilestones = async () => {
    const { data } = await supabase
      .from("milestones")
      .select("*")
      .eq("project_id", id)
      .order("due_date");

    setMilestones(data || []);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      const { data: newTask, error: taskError } = await supabase
        .from("tasks")
        .insert([
          {
            title: formData.title,
            description: formData.description,
            priority: formData.priority as "must_have" | "should_have" | "could_have" | "wont_have",
            status: formData.status as "to_do" | "doing" | "review" | "done",
            due_date: formData.due_date || null,
            estimated_hours: formData.estimated_hours ? parseFloat(formData.estimated_hours) : null,
            project_id: id,
            created_by: user.id,
            milestone_id: formData.milestone_id,
            assigned_to_user_id: formData.assigned_to_user_id || null,
          },
        ])
        .select()
        .single();

      if (taskError) throw taskError;

      // Insert dependencies if any
      if (formData.dependencies.length > 0 && newTask) {
        const dependencyInserts = formData.dependencies.map((depId) => ({
          task_id: newTask.id,
          depends_on_task_id: depId,
        }));

        const { error: depError } = await supabase
          .from("task_dependencies")
          .insert(dependencyInserts);

        if (depError) throw depError;
      }

      toast({
        title: "Task creato",
        description: "Il task è stato creato con successo",
      });

      setOpen(false);
      setFormData({
        title: "",
        description: "",
        priority: "should_have",
        status: "to_do",
        due_date: "",
        estimated_hours: "",
        dependencies: [],
        milestone_id: null,
        assigned_to_user_id: "",
      });
      fetchTasks();
    } catch (error: any) {
      toast({
        title: "Errore",
        description: error.message,
        variant: "destructive",
      });
    }
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
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4 flex-1">
            <Link to="/projects">
              <Button variant="outline" size="icon">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-foreground">{project.title}</h1>
              {project.description && (
                <Collapsible>
                  <CollapsibleTrigger className="flex items-center gap-2 text-muted-foreground mt-1 hover:text-foreground transition-colors">
                    <span className="line-clamp-1 text-left">{project.description}</span>
                    <ChevronDown className="h-4 w-4 flex-shrink-0" />
                  </CollapsibleTrigger>
                  <CollapsibleContent className="text-muted-foreground mt-2">
                    {project.description}
                  </CollapsibleContent>
                </Collapsible>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {(isAdmin || isSuperAdmin || isProjectManager) && !isClient && (
              <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="mr-2 h-4 w-4" />
                    Nuovo Task
                  </Button>
                </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Crea Nuovo Task</DialogTitle>
                <DialogDescription>
                  Inserisci i dettagli del nuovo task
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="title">Titolo *</Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) =>
                      setFormData({ ...formData, title: e.target.value })
                    }
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="description">Descrizione</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({ ...formData, description: e.target.value })
                    }
                    rows={3}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="priority">Priorità MoSCoW</Label>
                    <Select
                      value={formData.priority}
                      onValueChange={(value) =>
                        setFormData({ ...formData, priority: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="must_have">Must Have</SelectItem>
                        <SelectItem value="should_have">Should Have</SelectItem>
                        <SelectItem value="could_have">Could Have</SelectItem>
                        <SelectItem value="wont_have">Won't Have</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="status">Stato</Label>
                    <Select
                      value={formData.status}
                      onValueChange={(value) =>
                        setFormData({ ...formData, status: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="to_do">To Do</SelectItem>
                        <SelectItem value="doing">Doing</SelectItem>
                        <SelectItem value="review">Review</SelectItem>
                        <SelectItem value="done">Done</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="due_date">Scadenza</Label>
                    <Input
                      id="due_date"
                      type="date"
                      value={formData.due_date}
                      onChange={(e) =>
                        setFormData({ ...formData, due_date: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <Label htmlFor="estimated_hours">Ore Stimate</Label>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={async () => {
                          if (!formData.title) {
                            toast({
                              title: "Attenzione",
                              description: "Inserisci almeno il titolo per ottenere una stima AI",
                              variant: "destructive",
                            });
                            return;
                          }
                          
                          const { data, error } = await supabase.functions.invoke('ai-chat', {
                            body: {
                              message: `Suggerisci le ore stimate per questa task: Titolo: "${formData.title}", Descrizione: "${formData.description}"`,
                              projectId: id,
                            },
                          });

                          if (!error && data?.response) {
                            const match = data.response.match(/(\d+(?:\.\d+)?)/);
                            if (match) {
                              setFormData({ ...formData, estimated_hours: match[1] });
                              toast({
                                title: "Stima AI",
                                description: data.response,
                              });
                            }
                          }
                        }}
                        className="h-8"
                      >
                        🤖 Suggerisci Stima AI
                      </Button>
                    </div>
                    <Input
                      id="estimated_hours"
                      type="number"
                      step="0.5"
                      value={formData.estimated_hours}
                      onChange={(e) =>
                        setFormData({ ...formData, estimated_hours: e.target.value })
                      }
                    />
                  </div>
                </div>
                
                <div>
                  <Label>Assegna a</Label>
                  <Select
                    value={formData.assigned_to_user_id}
                    onValueChange={(value) =>
                      setFormData({ ...formData, assigned_to_user_id: value === "unassigned" ? "" : value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleziona un membro del team..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unassigned">Non assegnato</SelectItem>
                      {projectMembers.map((member) => (
                        <SelectItem key={member.id} value={member.id}>
                          {member.full_name || member.email}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label>Milestone di Riferimento (Opzionale)</Label>
                  <Select
                    value={formData.milestone_id || "none"}
                    onValueChange={(value) =>
                      setFormData({ ...formData, milestone_id: value === "none" ? null : value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleziona un milestone..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nessun milestone</SelectItem>
                      {milestones.map((milestone) => (
                        <SelectItem key={milestone.id} value={milestone.id}>
                          {milestone.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label>Dipende da Task</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        className="w-full justify-start text-left font-normal"
                      >
                        {formData.dependencies.length > 0
                          ? `${formData.dependencies.length} task selezionati`
                          : "Seleziona task prerequisiti..."}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-full p-0" align="start">
                      <Command>
                        <CommandInput placeholder="Cerca task..." />
                        <CommandList>
                          <CommandEmpty>Nessun task trovato.</CommandEmpty>
                          <CommandGroup>
                            {tasks.map((task) => (
                              <CommandItem
                                key={task.id}
                                onSelect={() => {
                                  setFormData({
                                    ...formData,
                                    dependencies: formData.dependencies.includes(task.id)
                                      ? formData.dependencies.filter((id) => id !== task.id)
                                      : [...formData.dependencies, task.id],
                                  });
                                }}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    formData.dependencies.includes(task.id)
                                      ? "opacity-100"
                                      : "opacity-0"
                                  )}
                                />
                                {task.title}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  {formData.dependencies.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {formData.dependencies.map((depId) => {
                        const depTask = tasks.find((t) => t.id === depId);
                        return (
                          <Badge
                            key={depId}
                            variant="secondary"
                            className="gap-1"
                          >
                            {depTask?.title}
                            <X
                              className="h-3 w-3 cursor-pointer"
                              onClick={() =>
                                setFormData({
                                  ...formData,
                                  dependencies: formData.dependencies.filter(
                                    (id) => id !== depId
                                  ),
                                })
                              }
                            />
                          </Badge>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="flex justify-end gap-3">
                  <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                    Annulla
                  </Button>
                  <Button type="submit">Crea Task</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
            )}
          
          {(isAdmin || isSuperAdmin || isProjectManager) && !isClient && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="icon">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Elimina Progetto</AlertDialogTitle>
                  <AlertDialogDescription>
                    Sei sicuro di voler eliminare questo progetto? Questa azione eliminerà
                    permanentemente il progetto e tutti i task, milestone, rischi e dati
                    correlati. Questa operazione non può essere annullata.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Annulla</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDeleteProject}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Elimina
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList>
            <TabsTrigger value="kanban">Board Kanban</TabsTrigger>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="milestones">Milestones</TabsTrigger>
            <TabsTrigger value="checklists">Checklists</TabsTrigger>
            <TabsTrigger value="risks">Rischi</TabsTrigger>
            <TabsTrigger value="members">Membri</TabsTrigger>
            <TabsTrigger value="documentation">Documentazione</TabsTrigger>
            <TabsTrigger value="impact">Business Impact</TabsTrigger>
            <TabsTrigger value="reports">Reportistica</TabsTrigger>
            {(isAdmin || isSuperAdmin || isProjectManager) && !isClient && (
              <TabsTrigger value="requirements">Requisiti & AI</TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="kanban" className="mt-6">
            <div className="space-y-6">
              {/* Archive Access Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Link to={`/projects/${id}/review`}>
                  <Card className="cursor-pointer hover:shadow-lg transition-shadow border-warning/30 bg-warning/5">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg">In Revisione</CardTitle>
                        <Badge variant="outline" className="text-lg px-3 py-1 bg-warning/10">
                          {tasks.filter(t => t.status === 'waiting_for_review').length}
                        </Badge>
                      </div>
                      <CardDescription>
                        Task in attesa di approvazione
                      </CardDescription>
                    </CardHeader>
                  </Card>
                </Link>

                <Link to={`/projects/${id}/done`}>
                  <Card className="cursor-pointer hover:shadow-lg transition-shadow border-success/30 bg-success/5">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg">Completati</CardTitle>
                        <Badge variant="outline" className="text-lg px-3 py-1 bg-success/10">
                          {tasks.filter(t => t.status === 'done').length}
                        </Badge>
                      </div>
                      <CardDescription>
                        Task completati e archiviati
                      </CardDescription>
                    </CardHeader>
                  </Card>
                </Link>
              </div>

              {/* Active Kanban Board */}
              <KanbanBoard tasks={tasks.filter(t => t.status === 'to_do' || t.status === 'doing' || t.status === 'waiting_for_review')} onUpdate={fetchTasks} />
            </div>
          </TabsContent>

          <TabsContent value="overview" className="mt-6">
            <div className="grid gap-6 md:grid-cols-3">
              <Card>
                <CardHeader>
                  <CardTitle>Informazioni Progetto</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div>
                    <span className="text-sm text-muted-foreground">Stato:</span>
                    <p className="font-medium">{project.status}</p>
                  </div>
                  <div>
                    <span className="text-sm text-muted-foreground">Priorità:</span>
                    <p className="font-medium">{project.priority}</p>
                  </div>
                  {project.budget && (
                    <div>
                      <span className="text-sm text-muted-foreground">Budget:</span>
                      <p className="font-medium">€{parseFloat(project.budget).toLocaleString()}</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Timeline</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {project.start_date && (
                    <div>
                      <span className="text-sm text-muted-foreground">Data Inizio:</span>
                      <p className="font-medium">{new Date(project.start_date).toLocaleDateString('it-IT')}</p>
                    </div>
                  )}
                  {project.end_date && (
                    <div>
                      <span className="text-sm text-muted-foreground">Data Fine:</span>
                      <p className="font-medium">{new Date(project.end_date).toLocaleDateString('it-IT')}</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Statistiche Task</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div>
                    <span className="text-sm text-muted-foreground">Totale:</span>
                    <p className="font-medium">{tasks.length}</p>
                  </div>
                  <div>
                    <span className="text-sm text-muted-foreground">Completati:</span>
                    <p className="font-medium text-success">
                      {tasks.filter(t => t.status === 'done').length}
                    </p>
                  </div>
                  <div>
                    <span className="text-sm text-muted-foreground">In Corso:</span>
                    <p className="font-medium text-warning">
                      {tasks.filter(t => t.status === 'doing').length}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="milestones" className="mt-6 space-y-6">
            <ProjectTimeline projectId={id!} />
          </TabsContent>

          <TabsContent value="checklists" className="mt-6">
            <ChecklistsTab projectId={id!} />
          </TabsContent>

          <TabsContent value="risks" className="mt-6">
            <RisksTab projectId={id!} />
          </TabsContent>

          <TabsContent value="members" className="mt-6">
            <ProjectMembers projectId={id!} />
          </TabsContent>

          <TabsContent value="documentation" className="mt-6">
            <DocumentationTab projectId={id!} />
          </TabsContent>

          <TabsContent value="impact" className="mt-6">
            <BusinessImpactTab projectId={id!} />
          </TabsContent>

          <TabsContent value="reports" className="mt-6">
            <ReportsTab projectId={id!} />
          </TabsContent>

          {(isAdmin || isSuperAdmin || isProjectManager) && (
            <TabsContent value="requirements" className="mt-6">
              <RequirementsTab 
                projectId={id!}
                onTasksCreated={() => {
                  fetchTasks();
                  setActiveTab('kanban');
                  if (window.location.hash !== '#kanban') {
                    window.location.hash = '#kanban';
                  }
                }}
              />
            </TabsContent>
          )}
        </Tabs>
      </div>
    </MainLayout>
  );
}
