import { useEffect, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useUserRole } from "@/hooks/useUserRole";
import { Navigate } from "react-router-dom";
import { z } from "zod";

const inviteUserSchema = z.object({
  email: z.string().email("Email non valida").max(255, "Email troppo lunga"),
  password: z.string().min(8, "Password deve essere almeno 8 caratteri"),
  fullName: z.string().trim().min(1, "Nome richiesto").max(100, "Nome troppo lungo"),
  role: z.enum(["admin", "project_manager", "collaborator", "client"]),
});
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { UserPlus, Shield, Users, Briefcase, Trash2 } from "lucide-react";

interface UserWithRole {
  id: string;
  email: string;
  full_name: string | null;
  role: string | null;
}

const roleLabels = {
  super_admin: "Super Admin",
  admin: "Admin",
  project_manager: "Project Manager",
  collaborator: "Collaboratore",
  client: "Cliente",
};

const roleIcons = {
  super_admin: Shield,
  admin: Shield,
  project_manager: Briefcase,
  collaborator: Users,
  client: Users,
};

const roleColors = {
  super_admin: "bg-primary text-primary-foreground",
  admin: "bg-destructive text-destructive-foreground",
  project_manager: "bg-warning text-warning-foreground",
  collaborator: "bg-accent text-accent-foreground",
  client: "bg-muted text-muted-foreground",
};

export default function UserManagement() {
  const { toast } = useToast();
  const { isAdmin, isSuperAdmin, loading: roleLoading } = useUserRole();
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [invitePassword, setInvitePassword] = useState("");
  const [inviteFullName, setInviteFullName] = useState("");
  const [inviteRole, setInviteRole] = useState<string>("collaborator");

  useEffect(() => {
    if (!roleLoading && (isAdmin || isSuperAdmin)) {
      fetchUsers();
    }
  }, [isAdmin, isSuperAdmin, roleLoading]);

  const fetchUsers = async () => {
    try {
      const { data: profilesData, error: profilesError } = await supabase
        .from("profiles")
        .select("id, email, full_name");

      if (profilesError) throw profilesError;

      const { data: rolesData } = await supabase
        .from("user_roles")
        .select("user_id, role");

      const usersWithRoles = profilesData.map((profile) => {
        const userRole = rolesData?.find((r) => r.user_id === profile.id);
        return {
          ...profile,
          role: userRole?.role || null,
        };
      });

      setUsers(usersWithRoles);
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

  const handleInviteUser = async (e: React.FormEvent) => {
    e.preventDefault();

    // Security: Never allow super_admin assignment via invite
    if (inviteRole === "super_admin") {
      toast({
        title: "Errore di Sicurezza",
        description: "Il ruolo Super Admin non può essere assegnato tramite invito.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const validation = inviteUserSchema.safeParse({
        email: inviteEmail,
        password: invitePassword,
        fullName: inviteFullName,
        role: inviteRole,
      });

      if (!validation.success) {
        throw new Error(validation.error.errors[0].message);
      }
      // Get current session token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error("Sessione non valida");
      }

      // Call edge function to create user without disrupting current session
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/invite-user`,
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: validation.data.email,
            password: validation.data.password,
            full_name: validation.data.fullName,
            role: validation.data.role,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Errore durante la creazione dell'utente");
      }

      toast({
        title: "Utente invitato",
        description: `${inviteEmail} è stato aggiunto con successo.`,
      });

      setInviteOpen(false);
      setInviteEmail("");
      setInvitePassword("");
      setInviteFullName("");
      setInviteRole("collaborator");
      
      // Refresh user list without affecting current session
      await fetchUsers();
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

  const handleRoleChange = async (userId: string, newRole: string) => {
    // Security: Never allow super_admin assignment
    if (newRole === "super_admin") {
      toast({
        title: "Errore di Sicurezza",
        description: "Il ruolo Super Admin non può essere assegnato o modificato.",
        variant: "destructive",
      });
      return;
    }

    try {
      // Delete existing role
      await supabase.from("user_roles").delete().eq("user_id", userId);

      // Insert new role (super_admin blocked above)
      const { error } = await supabase.from("user_roles").insert([{
        user_id: userId,
        role: newRole as "admin" | "project_manager" | "collaborator",
      }]);

      if (error) throw error;

      toast({
        title: "Ruolo aggiornato",
        description: "Il ruolo dell'utente è stato modificato con successo.",
      });

      fetchUsers();
    } catch (error: any) {
      toast({
        title: "Errore",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleDeleteUser = async (userId: string, userEmail: string) => {
    try {
      const { data, error } = await supabase.functions.invoke("delete-user", {
        body: { user_id: userId },
      });

      if (error) throw error;

      toast({
        title: "Utente eliminato",
        description: `L'utente ${userEmail} è stato eliminato con successo.`,
      });

      fetchUsers();
    } catch (error: any) {
      toast({
        title: "Errore",
        description: error.message || "Impossibile eliminare l'utente",
        variant: "destructive",
      });
    }
  };

  // Determine if current user can delete target user based on hierarchical roles
  const canDeleteUser = (targetUserRole: string): boolean => {
    if (isSuperAdmin) {
      return true; // Super_Admin can delete everyone
    }
    if (isAdmin) {
      // Admin can only delete Project_Manager and Collaborator
      return targetUserRole === "project_manager" || targetUserRole === "collaborator";
    }
    return false; // Project_Manager and Collaborator cannot delete anyone
  };

  if (roleLoading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center min-h-screen">
          Caricamento...
        </div>
      </MainLayout>
    );
  }

  if (!isAdmin && !isSuperAdmin) {
    return <Navigate to="/" replace />;
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">
              Amministrazione Utenti
            </h1>
            <p className="text-muted-foreground mt-1">
              Gestisci gli utenti e i loro ruoli nel sistema
            </p>
          </div>
          <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
            <DialogTrigger asChild>
              <Button>
                <UserPlus className="mr-2 h-4 w-4" />
                Invita Utente
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Invita Nuovo Utente</DialogTitle>
                <DialogDescription>
                  Crea un nuovo account utente e assegna un ruolo
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleInviteUser} className="space-y-4">
                <div>
                  <Label htmlFor="fullname">Nome Completo</Label>
                  <Input
                    id="fullname"
                    value={inviteFullName}
                    onChange={(e) => setInviteFullName(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="password">Password Temporanea</Label>
                  <Input
                    id="password"
                    type="password"
                    value={invitePassword}
                    onChange={(e) => setInvitePassword(e.target.value)}
                    required
                    minLength={6}
                  />
                </div>
                <div>
                  <Label htmlFor="role">Ruolo</Label>
                  <Select value={inviteRole} onValueChange={setInviteRole}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="project_manager">
                        Project Manager
                      </SelectItem>
                      <SelectItem value="collaborator">Collaboratore</SelectItem>
                      <SelectItem value="client">Cliente</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setInviteOpen(false)}
                  >
                    Annulla
                  </Button>
                  <Button type="submit">Invita</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Utenti del Sistema</CardTitle>
            <CardDescription>
              Visualizza e gestisci tutti gli utenti registrati
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">Caricamento utenti...</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Ruolo</TableHead>
                      <TableHead className="text-right w-[180px]">Azioni</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => {
                    const RoleIcon =
                      roleIcons[user.role as keyof typeof roleIcons] || Users;
                    return (
                      <TableRow key={user.id}>
                        <TableCell className="font-medium">
                          {user.full_name || "N/A"}
                        </TableCell>
                        <TableCell>{user.email}</TableCell>
                        <TableCell>
                          {user.role ? (
                            <Badge
                              className={
                                roleColors[user.role as keyof typeof roleColors]
                              }
                            >
                              <RoleIcon className="mr-1 h-3 w-3" />
                              {roleLabels[user.role as keyof typeof roleLabels]}
                            </Badge>
                          ) : (
                            <Badge variant="outline">Nessun ruolo</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            {user.role === "super_admin" && !isSuperAdmin ? (
                              <Badge className={roleColors.super_admin}>
                                <Shield className="mr-1 h-3 w-3" />
                                Protetto
                              </Badge>
                            ) : (
                              <Select
                                value={user.role || ""}
                                onValueChange={(value) =>
                                  handleRoleChange(user.id, value)
                                }
                                disabled={
                                  // Super Admin roles are permanently protected
                                  user.role === 'super_admin' ||
                                  // Prevent admins from changing other admin roles (only super_admin can)
                                  (!isSuperAdmin && user.role === 'admin')
                                }
                              >
                                <SelectTrigger className="w-[140px]">
                                  <SelectValue placeholder="Cambia ruolo..." />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="admin">Admin</SelectItem>
                                  <SelectItem value="project_manager">
                                    Project Manager
                                  </SelectItem>
                                  <SelectItem value="collaborator">
                                    Collaboratore
                                  </SelectItem>
                                  <SelectItem value="client">
                                    Cliente
                                  </SelectItem>
                                </SelectContent>
                              </Select>
                            )}

                            {canDeleteUser(user.role || "") && (
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Conferma eliminazione</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Sei sicuro di voler eliminare l'utente <strong>{user.full_name || user.email}</strong>?
                                      <br />
                                      <br />
                                      Questa azione è <strong>irreversibile</strong> e rimuoverà l'utente da tutti i progetti e ruoli assegnati.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Annulla</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => handleDeleteUser(user.id, user.email)}
                                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    >
                                      Elimina
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
