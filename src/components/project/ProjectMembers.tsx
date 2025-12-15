import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2 } from "lucide-react";
import { useUserRole } from "@/hooks/useUserRole";
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

interface ProjectMembersProps {
  projectId: string;
}

interface ProjectMember {
  id: string;
  user_id: string;
  role_in_project: string;
  profiles: {
    full_name: string | null;
    email: string;
  };
}

interface User {
  id: string;
  email: string;
  full_name: string | null;
}

export function ProjectMembers({ projectId }: ProjectMembersProps) {
  const { toast } = useToast();
  const { isAdmin, isSuperAdmin, isProjectManager, isClient } = useUserRole();
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [selectedRole, setSelectedRole] = useState<string>("collaborator");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const canManageMembers = (isAdmin || isSuperAdmin || isProjectManager) && !isClient;

  useEffect(() => {
    fetchMembers();
    if (canManageMembers) {
      fetchAllUsers();
    }
  }, [projectId, canManageMembers]);

  const fetchMembers = async () => {
    const { data, error } = await supabase
      .from("project_members")
      .select(`
        id,
        user_id,
        role_in_project,
        profiles (
          full_name,
          email
        )
      `)
      .eq("project_id", projectId);

    if (error) {
      toast({
        title: "Errore",
        description: "Impossibile caricare i membri del progetto.",
        variant: "destructive",
      });
      return;
    }

    setMembers(data as ProjectMember[]);
  };

  const fetchAllUsers = async () => {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, email, full_name");

    if (error) {
      toast({
        title: "Errore",
        description: "Impossibile caricare la lista utenti.",
        variant: "destructive",
      });
      return;
    }

    // Filter out users already in the project
    const memberUserIds = members.map(m => m.user_id);
    const availableUsers = (data as User[]).filter(u => !memberUserIds.includes(u.id));
    
    setAllUsers(availableUsers);
  };

  const handleAddMember = async () => {
    if (!selectedUserId) {
      toast({
        title: "Errore",
        description: "Seleziona un utente da aggiungere.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from("project_members")
        .insert([{
          project_id: projectId,
          user_id: selectedUserId,
          role_in_project: selectedRole as "project_manager" | "collaborator",
        }]);

      if (error) throw error;

      // Call edge function to send notification email
      try {
        await supabase.functions.invoke("notify-project-member", {
          body: {
            userId: selectedUserId,
            projectId: projectId,
            action: "added",
          },
        });
      } catch (emailError) {
        console.error("Email notification failed:", emailError);
        // Don't fail the whole operation if email fails
      }

      toast({
        title: "Membro aggiunto",
        description: "L'utente è stato aggiunto al progetto con successo.",
      });

      setOpen(false);
      setSelectedUserId("");
      setSelectedRole("collaborator");
      fetchMembers();
      fetchAllUsers();
    } catch (error: any) {
      toast({
        title: "Errore",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveMember = async (memberId: string, userId: string) => {
    try {
      const { error } = await supabase
        .from("project_members")
        .delete()
        .eq("id", memberId);

      if (error) throw error;

      // Call edge function to send notification email
      try {
        await supabase.functions.invoke("notify-project-member", {
          body: {
            userId: userId,
            projectId: projectId,
            action: "removed",
          },
        });
      } catch (emailError) {
        console.error("Email notification failed:", emailError);
      }

      toast({
        title: "Membro rimosso",
        description: "L'utente è stato rimosso dal progetto.",
      });

      fetchMembers();
      fetchAllUsers();
    } catch (error: any) {
      toast({
        title: "Errore",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case "project_manager":
        return "default";
      case "collaborator":
        return "secondary";
      default:
        return "outline";
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case "project_manager":
        return "Project Manager";
      case "collaborator":
        return "Collaboratore";
      default:
        return role;
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Membri del Progetto</h3>
        {canManageMembers && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="mr-2 h-4 w-4" />
                Aggiungi Membro
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Aggiungi Membro al Progetto</DialogTitle>
                <DialogDescription>
                  Seleziona un utente e assegna il suo ruolo nel progetto.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Utente</label>
                  <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleziona un utente..." />
                    </SelectTrigger>
                    <SelectContent>
                      {allUsers.map((user) => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.full_name || user.email}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium">Ruolo nel Progetto</label>
                  <Select value={selectedRole} onValueChange={setSelectedRole}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="project_manager">Project Manager</SelectItem>
                      <SelectItem value="collaborator">Collaboratore</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setOpen(false)}
                  >
                    Annulla
                  </Button>
                  <Button onClick={handleAddMember} disabled={loading}>
                    {loading ? "Aggiunta in corso..." : "Aggiungi"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nome</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Ruolo</TableHead>
            {canManageMembers && <TableHead className="text-right">Azioni</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {members.length === 0 ? (
            <TableRow>
              <TableCell colSpan={canManageMembers ? 4 : 3} className="text-center text-muted-foreground">
                Nessun membro nel progetto
              </TableCell>
            </TableRow>
          ) : (
            members.map((member) => (
              <TableRow key={member.id}>
                <TableCell className="font-medium">
                  {member.profiles.full_name || "N/A"}
                </TableCell>
                <TableCell>{member.profiles.email}</TableCell>
                <TableCell>
                  <Badge variant={getRoleBadgeVariant(member.role_in_project)}>
                    {getRoleLabel(member.role_in_project)}
                  </Badge>
                </TableCell>
                {canManageMembers && (
                  <TableCell className="text-right">
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Rimuovi Membro</AlertDialogTitle>
                          <AlertDialogDescription>
                            Sei sicuro di voler rimuovere questo utente dal progetto?
                            Perderà l'accesso a tutti i task e i dati del progetto.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Annulla</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleRemoveMember(member.id, member.user_id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Rimuovi
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </TableCell>
                )}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
