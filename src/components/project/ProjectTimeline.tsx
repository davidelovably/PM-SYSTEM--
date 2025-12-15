import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, Flag, ChevronDown, ChevronRight, Plus, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { MilestoneDetailDialog } from "./MilestoneDetailDialog";
import { MilestoneFlowView } from "./MilestoneFlowView";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
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
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";

interface Milestone {
  id: string;
  title: string;
  description: string | null;
  due_date: string;
  state: "planned" | "in_progress" | "completed" | "at_risk";
  strategic_priority: "low" | "medium" | "high";
  created_at: string;
}

interface ProjectTimelineProps {
  projectId: string;
}

const stateConfig = {
  planned: {
    label: "Pianificato",
    color: "bg-muted text-muted-foreground border-muted",
    dotColor: "bg-muted-foreground",
  },
  in_progress: {
    label: "In Corso",
    color: "bg-primary/10 text-primary border-primary/30",
    dotColor: "bg-primary",
  },
  completed: {
    label: "Completato",
    color: "bg-success/10 text-success border-success/30",
    dotColor: "bg-success",
  },
  at_risk: {
    label: "A Rischio",
    color: "bg-destructive/10 text-destructive border-destructive/30",
    dotColor: "bg-destructive",
  },
};

const priorityConfig = {
  low: { label: "Bassa", icon: "text-muted-foreground" },
  medium: { label: "Media", icon: "text-warning" },
  high: { label: "Alta", icon: "text-destructive" },
};

export function ProjectTimeline({ projectId }: ProjectTimelineProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const { isAdmin, isSuperAdmin, isProjectManager, isClient } = useUserRole();
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMilestone, setSelectedMilestone] = useState<Milestone | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [milestoneToDelete, setMilestoneToDelete] = useState<Milestone | null>(null);
  const [expandedMilestones, setExpandedMilestones] = useState<Set<string>>(new Set());
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    due_date: "",
    state: "planned",
    strategic_priority: "medium",
  });

  useEffect(() => {
    fetchMilestones();
  }, [projectId]);

  const fetchMilestones = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("milestones")
      .select("*")
      .eq("project_id", projectId)
      .order("due_date");

    if (!error && data) {
      setMilestones(data);
    }
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-muted-foreground">Caricamento timeline...</div>
      </div>
    );
  }

  const toggleMilestoneExpansion = (milestoneId: string) => {
    setExpandedMilestones((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(milestoneId)) {
        newSet.delete(milestoneId);
      } else {
        newSet.add(milestoneId);
      }
      return newSet;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      const { error } = await supabase.from("milestones").insert([
        {
          title: formData.title,
          description: formData.description || null,
          due_date: formData.due_date,
          state: formData.state as "planned" | "in_progress" | "completed" | "at_risk",
          strategic_priority: formData.strategic_priority as "low" | "medium" | "high",
          project_id: projectId,
          owner_id: user.id,
        },
      ]);

      if (error) throw error;

      toast({
        title: "Milestone creato",
        description: "Il milestone è stato creato con successo",
      });

      setCreateDialogOpen(false);
      setFormData({
        title: "",
        description: "",
        due_date: "",
        state: "planned",
        strategic_priority: "medium",
      });
      fetchMilestones();
    } catch (error: any) {
      toast({
        title: "Errore",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleDeleteMilestone = async () => {
    if (!milestoneToDelete) return;

    try {
      const { error } = await supabase
        .from("milestones")
        .delete()
        .eq("id", milestoneToDelete.id);

      if (error) throw error;

      toast({
        title: "Milestone eliminato",
        description: "Il milestone è stato eliminato con successo. Le task associate sono state scollegate.",
      });

      setDeleteDialogOpen(false);
      setMilestoneToDelete(null);
      fetchMilestones();
    } catch (error: any) {
      toast({
        title: "Errore",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  if (milestones.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12 gap-4">
          <Calendar className="h-12 w-12 text-muted-foreground" />
          <p className="text-muted-foreground text-center">
            Nessun milestone ancora. Crea il tuo primo milestone per visualizzare la roadmap del progetto.
          </p>
          {(isAdmin || isSuperAdmin || isProjectManager) && !isClient && (
            <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Nuovo Milestone
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Crea Nuovo Milestone</DialogTitle>
                  <DialogDescription>
                    Inserisci i dettagli del nuovo milestone
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
                      <Label htmlFor="due_date">Scadenza *</Label>
                      <Input
                        id="due_date"
                        type="date"
                        value={formData.due_date}
                        onChange={(e) =>
                          setFormData({ ...formData, due_date: e.target.value })
                        }
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="state">Stato</Label>
                      <Select
                        value={formData.state}
                        onValueChange={(value) =>
                          setFormData({ ...formData, state: value })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="planned">Pianificato</SelectItem>
                          <SelectItem value="in_progress">In Corso</SelectItem>
                          <SelectItem value="completed">Completato</SelectItem>
                          <SelectItem value="at_risk">A Rischio</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="priority">Priorità Strategica</Label>
                    <Select
                      value={formData.strategic_priority}
                      onValueChange={(value) =>
                        setFormData({ ...formData, strategic_priority: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Bassa</SelectItem>
                        <SelectItem value="medium">Media</SelectItem>
                        <SelectItem value="high">Alta</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setCreateDialogOpen(false)}
                    >
                      Annulla
                    </Button>
                    <Button type="submit">Crea Milestone</Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="w-full space-y-4 relative z-0">
      {/* Header with title and Create Button */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-foreground">Milestones</h2>
        {(isAdmin || isSuperAdmin || isProjectManager) && !isClient && (
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Nuovo Milestone
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Crea Nuovo Milestone</DialogTitle>
                <DialogDescription>
                  Inserisci i dettagli del nuovo milestone
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
                    <Label htmlFor="due_date">Scadenza *</Label>
                    <Input
                      id="due_date"
                      type="date"
                      value={formData.due_date}
                      onChange={(e) =>
                        setFormData({ ...formData, due_date: e.target.value })
                      }
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="state">Stato</Label>
                    <Select
                      value={formData.state}
                      onValueChange={(value) =>
                        setFormData({ ...formData, state: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="planned">Pianificato</SelectItem>
                        <SelectItem value="in_progress">In Corso</SelectItem>
                        <SelectItem value="completed">Completato</SelectItem>
                        <SelectItem value="at_risk">A Rischio</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label htmlFor="priority">Priorità Strategica</Label>
                  <Select
                    value={formData.strategic_priority}
                    onValueChange={(value) =>
                      setFormData({ ...formData, strategic_priority: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Bassa</SelectItem>
                      <SelectItem value="medium">Media</SelectItem>
                      <SelectItem value="high">Alta</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setCreateDialogOpen(false)}
                  >
                    Annulla
                  </Button>
                  <Button type="submit">Crea Milestone</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>
      
      <div className="relative">
        {/* Horizontal scrollable container */}
        <div className="overflow-x-auto pb-4">
          <div className="flex items-start gap-0 min-w-max px-4">
            {milestones.map((milestone, index) => {
              const config = stateConfig[milestone.state];
              const priority = priorityConfig[milestone.strategic_priority];
              const isExpanded = expandedMilestones.has(milestone.id);
              
              return (
                <div key={milestone.id} className="flex items-center">
                  {/* Milestone Card */}
                  <div className="flex flex-col items-center">
                    {/* Date on top */}
                    <div className="mb-2 text-sm text-muted-foreground font-medium whitespace-nowrap">
                      {format(new Date(milestone.due_date), "d MMM yyyy", { locale: it })}
                    </div>
                    
                    {/* Dot */}
                    <div className={`w-4 h-4 rounded-full ${config.dotColor} shadow-md z-10`} />
                    
                    {/* Card */}
                    <Card
                      className={`mt-4 w-64 transition-all hover:shadow-lg border-2 ${config.color}`}
                    >
                      <CardContent className="p-4 space-y-3">
                        {/* Title with priority flag and expand button */}
                        <div className="flex items-start gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 flex-shrink-0"
                            onClick={() => toggleMilestoneExpansion(milestone.id)}
                          >
                            {isExpanded ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </Button>
                          <Flag className={`h-4 w-4 mt-0.5 flex-shrink-0 ${priority.icon}`} />
                          <h3 
                            className="font-semibold text-sm line-clamp-2 flex-1 cursor-pointer"
                            onClick={() => {
                              setSelectedMilestone(milestone);
                              setDetailDialogOpen(true);
                            }}
                          >
                            {milestone.title}
                          </h3>
                          {/* Delete Button - visible only to Admin/PM */}
                          {(isAdmin || isSuperAdmin || isProjectManager) && !isClient && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 flex-shrink-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={(e) => {
                                e.stopPropagation();
                                setMilestoneToDelete(milestone);
                                setDeleteDialogOpen(true);
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>

                        {/* Description */}
                        {milestone.description && (
                          <p className="text-xs text-muted-foreground line-clamp-2">
                            {milestone.description}
                          </p>
                        )}

                        {/* State Badge */}
                        <Badge variant="outline" className={`${config.color} text-xs`}>
                          {config.label}
                        </Badge>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Connecting Line */}
                  {index < milestones.length - 1 && (
                    <div className="h-0.5 w-16 bg-border mt-[-180px]" />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Scroll hint */}
        {milestones.length > 3 && (
          <div className="text-center text-xs text-muted-foreground mt-2">
            ← Scorri orizzontalmente per vedere tutti i milestone →
          </div>
        )}
      </div>

      {/* Expandable Flow Views */}
      {milestones.map((milestone) => (
        expandedMilestones.has(milestone.id) && (
          <Card key={`flow-${milestone.id}`} className="bg-accent/30">
            <CardContent className="p-6">
              <div className="mb-4">
                <h3 className="font-semibold text-lg text-foreground">
                  Task e Dipendenze: {milestone.title}
                </h3>
              </div>
              <MilestoneFlowView milestoneId={milestone.id} />
            </CardContent>
          </Card>
        )
      ))}

      {/* Milestone Detail Dialog */}
      <MilestoneDetailDialog
        milestone={selectedMilestone}
        open={detailDialogOpen}
        onOpenChange={setDetailDialogOpen}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sei sicuro di voler eliminare questo milestone?</AlertDialogTitle>
            <AlertDialogDescription>
              Il milestone "{milestoneToDelete?.title}" verrà eliminato definitivamente.
              Le task associate verranno scollegate ma non eliminate.
              Questa azione non può essere annullata.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteMilestone}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Elimina
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
