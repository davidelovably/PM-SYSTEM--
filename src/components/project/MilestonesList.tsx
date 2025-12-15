import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Plus, Pencil, Trash2, ChevronDown, ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { MilestoneFlowView } from "./MilestoneFlowView";
import { Badge } from "@/components/ui/badge";
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

interface Milestone {
  id: string;
  title: string;
  description: string | null;
  due_date: string;
  state: "planned" | "in_progress" | "completed" | "at_risk";
  strategic_priority: "low" | "medium" | "high";
  created_at: string;
}

interface MilestonesListProps {
  projectId: string;
}

const stateLabels = {
  planned: "Pianificato",
  in_progress: "In Corso",
  completed: "Completato",
  at_risk: "A Rischio",
};

const priorityLabels = {
  low: "Bassa",
  medium: "Media",
  high: "Alta",
};

const stateColors = {
  planned: "bg-muted text-muted-foreground",
  in_progress: "bg-primary text-primary-foreground",
  completed: "bg-success text-success-foreground",
  at_risk: "bg-destructive text-destructive-foreground",
};

const priorityColors = {
  low: "bg-muted text-muted-foreground",
  medium: "bg-warning text-warning-foreground",
  high: "bg-destructive text-destructive-foreground",
};

export function MilestonesList({ projectId }: MilestonesListProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [open, setOpen] = useState(false);
  const [editingMilestone, setEditingMilestone] = useState<Milestone | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [milestoneToDelete, setMilestoneToDelete] = useState<string | null>(null);
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
    const { data, error } = await supabase
      .from("milestones")
      .select("*")
      .eq("project_id", projectId)
      .order("due_date");

    if (!error && data) {
      setMilestones(data);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      if (editingMilestone) {
        // Update existing milestone
        const { error } = await supabase
          .from("milestones")
          .update({
            title: formData.title,
            description: formData.description || null,
            due_date: formData.due_date,
            state: formData.state as "planned" | "in_progress" | "completed" | "at_risk",
            strategic_priority: formData.strategic_priority as "low" | "medium" | "high",
          })
          .eq("id", editingMilestone.id);

        if (error) throw error;

        toast({
          title: "Milestone aggiornato",
          description: "Il milestone è stato aggiornato con successo",
        });
      } else {
        // Create new milestone
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
      }

      setOpen(false);
      setEditingMilestone(null);
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

  const handleEdit = (milestone: Milestone) => {
    setEditingMilestone(milestone);
    setFormData({
      title: milestone.title,
      description: milestone.description || "",
      due_date: milestone.due_date,
      state: milestone.state,
      strategic_priority: milestone.strategic_priority,
    });
    setOpen(true);
  };

  const handleDeleteClick = (milestoneId: string) => {
    setMilestoneToDelete(milestoneId);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!milestoneToDelete) return;

    try {
      const { error } = await supabase
        .from("milestones")
        .delete()
        .eq("id", milestoneToDelete);

      if (error) throw error;

      toast({
        title: "Milestone eliminato",
        description: "Il milestone è stato eliminato con successo",
      });

      fetchMilestones();
    } catch (error: any) {
      toast({
        title: "Errore",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setDeleteDialogOpen(false);
      setMilestoneToDelete(null);
    }
  };

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-foreground">Milestones del Progetto</h2>
        <Dialog open={open} onOpenChange={(isOpen) => {
          setOpen(isOpen);
          if (!isOpen) {
            setEditingMilestone(null);
            setFormData({
              title: "",
              description: "",
              due_date: "",
              state: "planned",
              strategic_priority: "medium",
            });
          }
        }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Nuovo Milestone
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingMilestone ? "Modifica Milestone" : "Crea Nuovo Milestone"}
              </DialogTitle>
              <DialogDescription>
                {editingMilestone
                  ? "Modifica i dettagli del milestone"
                  : "Inserisci i dettagli del nuovo milestone strategico"}
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
              <div>
                <Label htmlFor="due_date">Data Scadenza *</Label>
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
              <div className="grid grid-cols-2 gap-4">
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
              </div>

              <div className="flex justify-end gap-3">
                <Button type="button" variant="outline" onClick={() => {
                  setOpen(false);
                  setEditingMilestone(null);
                }}>
                  Annulla
                </Button>
                <Button type="submit">
                  {editingMilestone ? "Salva Modifiche" : "Crea Milestone"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {milestones.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-muted-foreground text-center">
              Nessun milestone ancora. Crea il tuo primo milestone per tracciare i progressi strategici del progetto.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {milestones.map((milestone) => (
            <Collapsible
              key={milestone.id}
              open={expandedMilestones.has(milestone.id)}
              onOpenChange={() => toggleMilestoneExpansion(milestone.id)}
            >
              <Card className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 flex-1">
                      <CollapsibleTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          {expandedMilestones.has(milestone.id) ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </Button>
                      </CollapsibleTrigger>
                      <div className="flex-1">
                        <CardTitle className="text-lg">{milestone.title}</CardTitle>
                        <div className="flex items-center gap-2 mt-2">
                          <Badge className={priorityColors[milestone.strategic_priority]}>
                            {priorityLabels[milestone.strategic_priority]}
                          </Badge>
                          <Badge className={stateColors[milestone.state]}>
                            {stateLabels[milestone.state]}
                          </Badge>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleEdit(milestone)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => handleDeleteClick(milestone.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {milestone.description && (
                    <p className="text-sm text-muted-foreground">
                      {milestone.description}
                    </p>
                  )}
                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-muted-foreground">Scadenza:</span>
                    <span className="font-medium">
                      {new Date(milestone.due_date).toLocaleDateString("it-IT")}
                    </span>
                  </div>
                </CardContent>

                {/* Expandable Flow View */}
                <CollapsibleContent>
                  <div className="border-t bg-accent/50">
                    <MilestoneFlowView milestoneId={milestone.id} />
                  </div>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          ))}
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Conferma Eliminazione</AlertDialogTitle>
            <AlertDialogDescription>
              Sei sicuro di voler eliminare questo milestone? Questa azione non può essere annullata.
              I task collegati non verranno eliminati, ma perderanno il riferimento al milestone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
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
