import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { 
  Plus, 
  Trash2, 
  CheckSquare, 
  ChevronDown, 
  ChevronRight,
  Send,
  Flag,
  ListChecks
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { it } from "date-fns/locale";

interface Milestone {
  id: string;
  title: string;
}

interface ChecklistItem {
  id: string;
  checklist_id: string;
  content: string;
  position: number;
  is_completed: boolean;
  completed_by: string | null;
  completed_at: string | null;
  created_at: string;
  completed_by_profile?: {
    full_name: string | null;
    email: string;
  };
}

interface Checklist {
  id: string;
  title: string;
  project_id: string;
  milestone_id: string | null;
  created_by: string;
  created_at: string;
  milestone?: {
    title: string;
  };
  items?: ChecklistItem[];
}

interface ChecklistsTabProps {
  projectId: string;
}

export function ChecklistsTab({ projectId }: ChecklistsTabProps) {
  const { user } = useAuth();
  const { isSuperAdmin, isAdmin, isProjectManager, isClient } = useUserRole();
  const canManage = (isSuperAdmin || isAdmin || isProjectManager) && !isClient;

  const [checklists, setChecklists] = useState<Checklist[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newChecklistTitle, setNewChecklistTitle] = useState("");
  const [selectedMilestone, setSelectedMilestone] = useState<string>("none");
  const [expandedChecklists, setExpandedChecklists] = useState<Set<string>>(new Set());
  const [newItemContent, setNewItemContent] = useState<Record<string, string>>({});
  const [deleteChecklistId, setDeleteChecklistId] = useState<string | null>(null);
  const [clientMembers, setClientMembers] = useState<{ user_id: string; full_name: string | null; email: string }[]>([]);
  const [notifyDialogOpen, setNotifyDialogOpen] = useState(false);
  const [notifyChecklistId, setNotifyChecklistId] = useState<string | null>(null);
  const [selectedClient, setSelectedClient] = useState<string>("");

  useEffect(() => {
    fetchData();
  }, [projectId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch checklists
      const { data: checklistsData, error: checklistsError } = await supabase
        .from("checklists")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });

      if (checklistsError) throw checklistsError;

      // Fetch milestones for the select dropdown
      const { data: milestonesData } = await supabase
        .from("milestones")
        .select("id, title")
        .eq("project_id", projectId)
        .order("due_date", { ascending: true });

      setMilestones(milestonesData || []);

      // Fetch items for each checklist
      if (checklistsData && checklistsData.length > 0) {
        const checklistIds = checklistsData.map(c => c.id);
        const { data: itemsData } = await supabase
          .from("checklist_items")
          .select("*")
          .in("checklist_id", checklistIds)
          .order("position", { ascending: true });

        // Fetch milestone titles
        const milestoneIds = checklistsData
          .filter(c => c.milestone_id)
          .map(c => c.milestone_id) as string[];
        
        const milestoneMap = new Map<string, string>();
        if (milestoneIds.length > 0) {
          const { data: milestoneData } = await supabase
            .from("milestones")
            .select("id, title")
            .in("id", milestoneIds);
          milestoneData?.forEach(m => milestoneMap.set(m.id, m.title));
        }

        // Fetch completed_by profiles
        const completedByIds = [...new Set(
          (itemsData || []).filter(i => i.completed_by).map(i => i.completed_by)
        )] as string[];
        
        const profileMap = new Map<string, { full_name: string | null; email: string }>();
        if (completedByIds.length > 0) {
          const { data: profilesData } = await supabase
            .from("profiles")
            .select("id, full_name, email")
            .in("id", completedByIds);
          profilesData?.forEach(p => profileMap.set(p.id, { full_name: p.full_name, email: p.email }));
        }

        const checklistsWithItems = checklistsData.map(checklist => ({
          ...checklist,
          milestone: checklist.milestone_id ? { title: milestoneMap.get(checklist.milestone_id) || "" } : undefined,
          items: (itemsData || [])
            .filter(item => item.checklist_id === checklist.id)
            .map(item => ({
              ...item,
              completed_by_profile: item.completed_by ? profileMap.get(item.completed_by) : undefined
            }))
        }));

        setChecklists(checklistsWithItems);
        // Auto-expand first checklist
        if (checklistsWithItems.length > 0) {
          setExpandedChecklists(new Set([checklistsWithItems[0].id]));
        }
      } else {
        setChecklists([]);
      }

      // Fetch client members for notification
      const { data: membersData } = await supabase
        .from("project_members")
        .select("user_id")
        .eq("project_id", projectId);

      if (membersData) {
        const userIds = membersData.map(m => m.user_id);
        const { data: rolesData } = await supabase
          .from("user_roles")
          .select("user_id, role")
          .in("user_id", userIds)
          .eq("role", "client");

        const clientIds = rolesData?.map(r => r.user_id) || [];
        if (clientIds.length > 0) {
          const { data: profilesData } = await supabase
            .from("profiles")
            .select("id, full_name, email")
            .in("id", clientIds);
          setClientMembers(
            profilesData?.map(p => ({ user_id: p.id, full_name: p.full_name, email: p.email })) || []
          );
        }
      }
    } catch (error) {
      console.error("Error fetching checklists:", error);
      toast.error("Errore nel caricamento delle checklist");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateChecklist = async () => {
    if (!newChecklistTitle.trim() || !user) return;

    try {
      const { error } = await supabase.from("checklists").insert({
        title: newChecklistTitle.trim(),
        project_id: projectId,
        milestone_id: selectedMilestone === "none" ? null : selectedMilestone,
        created_by: user.id,
      });

      if (error) throw error;

      toast.success("Checklist creata");
      setCreateDialogOpen(false);
      setNewChecklistTitle("");
      setSelectedMilestone("none");
      fetchData();
    } catch (error) {
      console.error("Error creating checklist:", error);
      toast.error("Errore nella creazione della checklist");
    }
  };

  const handleDeleteChecklist = async () => {
    if (!deleteChecklistId) return;

    try {
      const { error } = await supabase
        .from("checklists")
        .delete()
        .eq("id", deleteChecklistId);

      if (error) throw error;

      toast.success("Checklist eliminata");
      fetchData();
    } catch (error) {
      console.error("Error deleting checklist:", error);
      toast.error("Errore nell'eliminazione");
    } finally {
      setDeleteChecklistId(null);
    }
  };

  const handleAddItem = async (checklistId: string) => {
    const content = newItemContent[checklistId]?.trim();
    if (!content) return;

    try {
      const checklist = checklists.find(c => c.id === checklistId);
      const maxPosition = Math.max(0, ...(checklist?.items?.map(i => i.position) || [0]));

      const { error } = await supabase.from("checklist_items").insert({
        checklist_id: checklistId,
        content,
        position: maxPosition + 1,
      });

      if (error) throw error;

      setNewItemContent(prev => ({ ...prev, [checklistId]: "" }));
      fetchData();
    } catch (error) {
      console.error("Error adding item:", error);
      toast.error("Errore nell'aggiunta della voce");
    }
  };

  const handleToggleItem = async (item: ChecklistItem) => {
    if (isClient) return; // Clients can't toggle

    try {
      const { error } = await supabase
        .from("checklist_items")
        .update({
          is_completed: !item.is_completed,
          completed_by: !item.is_completed ? user?.id : null,
          completed_at: !item.is_completed ? new Date().toISOString() : null,
        })
        .eq("id", item.id);

      if (error) throw error;

      fetchData();
    } catch (error) {
      console.error("Error toggling item:", error);
      toast.error("Errore nell'aggiornamento");
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    try {
      const { error } = await supabase
        .from("checklist_items")
        .delete()
        .eq("id", itemId);

      if (error) throw error;
      fetchData();
    } catch (error) {
      console.error("Error deleting item:", error);
      toast.error("Errore nell'eliminazione della voce");
    }
  };

  const handleNotifyClient = async () => {
    if (!notifyChecklistId || !selectedClient || !user) return;

    try {
      const checklist = checklists.find(c => c.id === notifyChecklistId);
      if (!checklist) return;

      const { error } = await supabase.from("inbox_messages").insert({
        sender_id: user.id,
        recipient_id: selectedClient,
        subject: `Checklist Aggiornata: ${checklist.title}`,
        content: `Ti preghiamo di visionare la checklist di controllo "${checklist.title}" aggiornata. Accedi al progetto per verificare lo stato di avanzamento.`,
        message_type: "notification",
        related_entity_id: projectId,
        related_entity_type: "project",
      });

      if (error) throw error;

      toast.success("Notifica inviata al cliente");
      setNotifyDialogOpen(false);
      setNotifyChecklistId(null);
      setSelectedClient("");
    } catch (error) {
      console.error("Error sending notification:", error);
      toast.error("Errore nell'invio della notifica");
    }
  };

  const toggleExpanded = (checklistId: string) => {
    setExpandedChecklists(prev => {
      const next = new Set(prev);
      if (next.has(checklistId)) {
        next.delete(checklistId);
      } else {
        next.add(checklistId);
      }
      return next;
    });
  };

  const getProgress = (items: ChecklistItem[] | undefined) => {
    if (!items || items.length === 0) return { completed: 0, total: 0, percentage: 0 };
    const completed = items.filter(i => i.is_completed).length;
    return {
      completed,
      total: items.length,
      percentage: Math.round((completed / items.length) * 100),
    };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Checklist di Progetto</h3>
          <p className="text-sm text-muted-foreground">
            Gestisci liste di controllo per standardizzare i processi
          </p>
        </div>
        {canManage && (
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Nuova Checklist
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Crea Nuova Checklist</DialogTitle>
                <DialogDescription>
                  Crea una lista di controllo per il progetto
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Titolo Checklist</Label>
                  <Input
                    value={newChecklistTitle}
                    onChange={(e) => setNewChecklistTitle(e.target.value)}
                    placeholder="Es. Controlli Pre-Lancio"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Collega a Milestone (opzionale)</Label>
                  <Select value={selectedMilestone} onValueChange={setSelectedMilestone}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleziona milestone..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nessuna (Checklist generale)</SelectItem>
                      {milestones.map((milestone) => (
                        <SelectItem key={milestone.id} value={milestone.id}>
                          {milestone.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  onClick={handleCreateChecklist}
                  disabled={!newChecklistTitle.trim()}
                  className="w-full"
                >
                  Crea Checklist
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {checklists.length === 0 ? (
        <Card>
          <CardContent className="pt-6 text-center text-muted-foreground">
            <ListChecks className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Nessuna checklist creata</p>
            {canManage && (
              <p className="text-sm mt-2">Crea la prima checklist per iniziare</p>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {checklists.map((checklist) => {
            const progress = getProgress(checklist.items);
            const isExpanded = expandedChecklists.has(checklist.id);

            return (
              <Card key={checklist.id}>
                <Collapsible open={isExpanded} onOpenChange={() => toggleExpanded(checklist.id)}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <CollapsibleTrigger className="flex items-center gap-2 hover:opacity-80 cursor-pointer">
                        {isExpanded ? (
                          <ChevronDown className="h-5 w-5 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-5 w-5 text-muted-foreground" />
                        )}
                        <div className="text-left">
                          <CardTitle className="text-base flex items-center gap-2">
                            <CheckSquare className="h-4 w-4" />
                            {checklist.title}
                          </CardTitle>
                          <CardDescription className="mt-1">
                            {checklist.milestone && (
                              <Badge variant="outline" className="mr-2">
                                <Flag className="h-3 w-3 mr-1" />
                                {checklist.milestone.title}
                              </Badge>
                            )}
                            {progress.completed}/{progress.total} completati
                          </CardDescription>
                        </div>
                      </CollapsibleTrigger>
                      <div className="flex items-center gap-2">
                        {canManage && clientMembers.length > 0 && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setNotifyChecklistId(checklist.id);
                              setNotifyDialogOpen(true);
                            }}
                          >
                            <Send className="h-4 w-4 mr-1" />
                            Notifica Cliente
                          </Button>
                        )}
                        {canManage && (
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => setDeleteChecklistId(checklist.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                      </div>
                    </div>
                    <Progress value={progress.percentage} className="h-2 mt-3" />
                  </CardHeader>

                  <CollapsibleContent>
                    <CardContent className="pt-0">
                      <div className="space-y-2">
                        {checklist.items?.map((item) => (
                          <div
                            key={item.id}
                            className={`flex items-start gap-3 p-3 rounded-lg border ${
                              item.is_completed ? "bg-success/5 border-success/20" : "bg-muted/30"
                            }`}
                          >
                            <Checkbox
                              checked={item.is_completed}
                              onCheckedChange={() => handleToggleItem(item)}
                              disabled={isClient}
                              className="mt-0.5"
                            />
                            <div className="flex-1">
                              <p className={`text-sm ${item.is_completed ? "line-through text-muted-foreground" : ""}`}>
                                {item.content}
                              </p>
                              {item.is_completed && item.completed_by_profile && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  Completato da {item.completed_by_profile.full_name || item.completed_by_profile.email}
                                  {item.completed_at && ` il ${format(new Date(item.completed_at), "dd/MM/yyyy HH:mm", { locale: it })}`}
                                </p>
                              )}
                            </div>
                            {canManage && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => handleDeleteItem(item.id)}
                              >
                                <Trash2 className="h-4 w-4 text-muted-foreground" />
                              </Button>
                            )}
                          </div>
                        ))}

                        {canManage && (
                          <div className="flex items-center gap-2 mt-4">
                            <Input
                              value={newItemContent[checklist.id] || ""}
                              onChange={(e) => setNewItemContent(prev => ({
                                ...prev,
                                [checklist.id]: e.target.value
                              }))}
                              placeholder="Aggiungi nuova voce..."
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  handleAddItem(checklist.id);
                                }
                              }}
                            />
                            <Button
                              onClick={() => handleAddItem(checklist.id)}
                              disabled={!newItemContent[checklist.id]?.trim()}
                            >
                              <Plus className="h-4 w-4" />
                            </Button>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </CollapsibleContent>
                </Collapsible>
              </Card>
            );
          })}
        </div>
      )}

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteChecklistId} onOpenChange={() => setDeleteChecklistId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Elimina Checklist</AlertDialogTitle>
            <AlertDialogDescription>
              Sei sicuro di voler eliminare questa checklist? Tutte le voci saranno eliminate. L'azione è irreversibile.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteChecklist}>Elimina</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Notify Client Dialog */}
      <Dialog open={notifyDialogOpen} onOpenChange={setNotifyDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Notifica Cliente</DialogTitle>
            <DialogDescription>
              Invia una notifica al cliente per informarlo della checklist aggiornata
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Seleziona Cliente</Label>
              <Select value={selectedClient} onValueChange={setSelectedClient}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleziona un cliente..." />
                </SelectTrigger>
                <SelectContent>
                  {clientMembers.map((client) => (
                    <SelectItem key={client.user_id} value={client.user_id}>
                      {client.full_name || client.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              onClick={handleNotifyClient}
              disabled={!selectedClient}
              className="w-full"
            >
              <Send className="h-4 w-4 mr-2" />
              Invia Notifica
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
