import { useEffect, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";

const projectSchema = z.object({
  title: z.string().trim().min(1, "Titolo obbligatorio").max(200, "Titolo troppo lungo"),
  description: z.string().max(2000, "Descrizione troppo lunga").optional(),
  priority: z.enum(["low", "medium", "high", "critical"]),
  status: z.enum(["planning", "active", "on_hold", "completed", "cancelled"]),
  budget: z.string().refine((val) => val === "" || !isNaN(parseFloat(val)) && parseFloat(val) >= 0, {
    message: "Budget deve essere un numero positivo"
  }).optional(),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
});

export default function Projects() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [projects, setProjects] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    priority: "medium",
    status: "planning",
    budget: "",
    start_date: "",
    end_date: "",
  });

  useEffect(() => {
    fetchProjects();
  }, [user]);

  const fetchProjects = async () => {
    if (!user) return;

    const { data } = await supabase
      .from("projects")
      .select("*")
      .order("created_at", { ascending: false });

    setProjects(data || []);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      const validation = projectSchema.safeParse(formData);
      if (!validation.success) {
        toast({
          title: "Errore di validazione",
          description: validation.error.errors[0].message,
          variant: "destructive",
        });
        return;
      }

      const { error } = await supabase.from("projects").insert([
        {
          title: validation.data.title,
          description: validation.data.description || "",
          priority: validation.data.priority,
          status: validation.data.status,
          budget: validation.data.budget ? parseFloat(validation.data.budget) : null,
          start_date: validation.data.start_date || null,
          end_date: validation.data.end_date || null,
          owner_id: user.id,
        },
      ]);

      if (error) throw error;

      toast({
        title: "Progetto creato",
        description: "Il progetto è stato creato con successo",
      });

      setOpen(false);
      setFormData({
        title: "",
        description: "",
        priority: "medium",
        status: "planning",
        budget: "",
        start_date: "",
        end_date: "",
      });
      fetchProjects();
    } catch (error) {
      console.error("Error creating project:", error);
      toast({
        title: "Errore",
        description: "Impossibile creare il progetto",
        variant: "destructive",
      });
    }
  };

  const statusColors = {
    planning: "bg-muted text-muted-foreground",
    active: "bg-success text-success-foreground",
    on_hold: "bg-warning text-warning-foreground",
    completed: "bg-primary text-primary-foreground",
    cancelled: "bg-destructive text-destructive-foreground",
  };

  const priorityColors = {
    low: "text-muted-foreground",
    medium: "text-primary",
    high: "text-warning",
    critical: "text-destructive",
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Progetti</h1>
            <p className="text-muted-foreground mt-1">
              Gestisci tutti i tuoi progetti
            </p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="lg">
                <Plus className="mr-2 h-5 w-5" />
                Nuovo Progetto
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Crea Nuovo Progetto</DialogTitle>
                <DialogDescription>
                  Inserisci i dettagli del nuovo progetto
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
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
                  <div className="col-span-2">
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
                  <div>
                    <Label htmlFor="priority">Priorità</Label>
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
                        <SelectItem value="low">Bassa</SelectItem>
                        <SelectItem value="medium">Media</SelectItem>
                        <SelectItem value="high">Alta</SelectItem>
                        <SelectItem value="critical">Critica</SelectItem>
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
                        <SelectItem value="planning">Pianificazione</SelectItem>
                        <SelectItem value="active">Attivo</SelectItem>
                        <SelectItem value="on_hold">In Pausa</SelectItem>
                        <SelectItem value="completed">Completato</SelectItem>
                        <SelectItem value="cancelled">Annullato</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="start_date">Data Inizio</Label>
                    <Input
                      id="start_date"
                      type="date"
                      value={formData.start_date}
                      onChange={(e) =>
                        setFormData({ ...formData, start_date: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <Label htmlFor="end_date">Data Fine</Label>
                    <Input
                      id="end_date"
                      type="date"
                      value={formData.end_date}
                      onChange={(e) =>
                        setFormData({ ...formData, end_date: e.target.value })
                      }
                    />
                  </div>
                  <div className="col-span-2">
                    <Label htmlFor="budget">Budget (€)</Label>
                    <Input
                      id="budget"
                      type="number"
                      step="0.01"
                      value={formData.budget}
                      onChange={(e) =>
                        setFormData({ ...formData, budget: e.target.value })
                      }
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-3">
                  <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                    Annulla
                  </Button>
                  <Button type="submit">Crea Progetto</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {projects.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <p className="text-muted-foreground mb-4">
                Non hai ancora progetti. Creane uno nuovo per iniziare!
              </p>
              <Button onClick={() => setOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Crea il tuo primo progetto
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {projects.map((project) => (
              <Link key={project.id} to={`/projects/${project.id}`}>
                <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <CardTitle className="text-lg">{project.title}</CardTitle>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[project.status as keyof typeof statusColors]}`}>
                        {project.status}
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                      {project.description || "Nessuna descrizione"}
                    </p>
                    <div className="flex items-center justify-between text-sm">
                      <span className={`font-medium ${priorityColors[project.priority as keyof typeof priorityColors]}`}>
                        {project.priority === 'low' && 'Priorità Bassa'}
                        {project.priority === 'medium' && 'Priorità Media'}
                        {project.priority === 'high' && 'Priorità Alta'}
                        {project.priority === 'critical' && 'Priorità Critica'}
                      </span>
                      {project.budget && (
                        <span className="text-muted-foreground">
                          €{parseFloat(project.budget).toLocaleString()}
                        </span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </MainLayout>
  );
}
