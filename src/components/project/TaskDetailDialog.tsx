import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar as CalendarIcon, Clock, AlertCircle, Link as LinkIcon, Trash2, Upload, FileText, Download, FolderUp, UserCheck, Link2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { useUserRole } from "@/hooks/useUserRole";
import { TaskComments } from "@/components/project/TaskComments";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { it } from "date-fns/locale";

interface Task {
  id: string;
  title: string;
  description?: string;
  priority: string;
  status: string;
  due_date?: string;
  estimated_hours?: number;
  actual_hours?: number;
  project_id?: string;
  assigned_to_user_id?: string | null;
}

interface TaskAttachment {
  id: string;
  file_name: string;
  file_size: number | null;
  file_url: string;
  uploaded_by: string;
  created_at: string;
  transferred_to_docs: boolean;
}

interface ProjectFile {
  id: string;
  file_name: string;
  file_size: number | null;
  storage_path: string;
  is_private: boolean;
}

interface TaskDetailDialogProps {
  task: Task | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDelete?: () => void;
}

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

const statusLabels = {
  to_do: "To Do",
  doing: "Doing",
  review: "Review",
  done: "Done",
};

export function TaskDetailDialog({ task, open, onOpenChange, onDelete }: TaskDetailDialogProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const { isAdmin, isSuperAdmin, isProjectManager, isClient } = useUserRole();
  const [dependencies, setDependencies] = useState<Task[]>([]);
  const [dependents, setDependents] = useState<Task[]>([]);
  const [attachments, setAttachments] = useState<TaskAttachment[]>([]);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [selectedFileForUpload, setSelectedFileForUpload] = useState<File | null>(null);
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [projectMembers, setProjectMembers] = useState<Array<{ id: string; full_name: string | null; email: string }>>([]);
  const [selectedAssignee, setSelectedAssignee] = useState<string>("");
  const [projectFiles, setProjectFiles] = useState<ProjectFile[]>([]);
  const [showLinkFilesDialog, setShowLinkFilesDialog] = useState(false);
  const [selectedFilesToLink, setSelectedFilesToLink] = useState<string[]>([]);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectComment, setRejectComment] = useState("");
  const [selectedDueDate, setSelectedDueDate] = useState<Date | undefined>(
    task?.due_date ? new Date(task.due_date) : undefined
  );

  const canManageFiles = (isSuperAdmin || isAdmin || isProjectManager) && !isClient;
  const isAssignedUser = user?.id === task?.assigned_to_user_id;
  const isManagementRole = (isSuperAdmin || isAdmin || isProjectManager) && !isClient;
  const canUploadFiles = ((isAssignedUser && (task?.status === "to_do" || task?.status === "doing")) || isManagementRole) && !isClient;
  const canStartWork = isAssignedUser && task?.status === "to_do" && !isClient;
  const canSubmitForReview = isAssignedUser && task?.status === "doing" && !isClient;
  const canApproveReject = isManagementRole && task?.status === "waiting_for_review" && !isClient;

  useEffect(() => {
    if (task && open) {
      fetchDependencies();
      fetchDependents();
      fetchAttachments();
      fetchProjectMembers();
      fetchProjectFiles();
      setSelectedAssignee(task.assigned_to_user_id || "");
      setSelectedDueDate(task.due_date ? new Date(task.due_date) : undefined);
    }
  }, [task, open]);

  const fetchProjectMembers = async () => {
    if (!task?.project_id) return;

    const { data, error } = await supabase
      .from("project_members")
      .select("user_id, profiles(id, full_name, email)")
      .eq("project_id", task.project_id);

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

  const fetchDependencies = async () => {
    if (!task) return;

    const { data: depData } = await supabase
      .from("task_dependencies")
      .select("depends_on_task_id")
      .eq("task_id", task.id);

    if (depData && depData.length > 0) {
      const depIds = depData.map((d) => d.depends_on_task_id);
      const { data: tasksData } = await supabase
        .from("tasks")
        .select("*")
        .in("id", depIds);

      setDependencies(tasksData || []);
    } else {
      setDependencies([]);
    }
  };

  const fetchDependents = async () => {
    if (!task) return;

    const { data: depData } = await supabase
      .from("task_dependencies")
      .select("task_id")
      .eq("depends_on_task_id", task.id);

    if (depData && depData.length > 0) {
      const depIds = depData.map((d) => d.task_id);
      const { data: tasksData } = await supabase
        .from("tasks")
        .select("*")
        .in("id", depIds);

      setDependents(tasksData || []);
    } else {
      setDependents([]);
    }
  };

  const fetchAttachments = async () => {
    if (!task) return;

    const { data, error } = await supabase
      .from("task_attachments")
      .select("*")
      .eq("task_id", task.id)
      .order("created_at", { ascending: false });

    if (!error && data) {
      setAttachments(data);
    }
  };

  const fetchProjectFiles = async () => {
    if (!task?.project_id) return;

    const { data, error } = await supabase
      .from("project_files")
      .select("id, file_name, file_size, storage_path, is_private")
      .eq("project_id", task.project_id)
      .eq("is_private", false)
      .order("uploaded_at", { ascending: false });

    if (!error && data) {
      setProjectFiles(data);
    }
  };

  const handleDeleteTask = async () => {
    if (!task) return;

    try {
      const { error } = await supabase
        .from("tasks")
        .delete()
        .eq("id", task.id);

      if (error) throw error;

      toast({
        title: "Task eliminato",
        description: "Il task è stato eliminato con successo.",
      });

      onOpenChange(false);
      if (onDelete) onDelete();
    } catch (error: any) {
      toast({
        title: "Errore",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleUploadAttachment = async () => {
    if (!selectedFileForUpload || !task) return;

    setUploadingFile(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Non autenticato");

      // Validate file size (50MB max)
      const MAX_FILE_SIZE = 52428800; // 50MB
      if (selectedFileForUpload.size > MAX_FILE_SIZE) {
        throw new Error("File troppo grande. Massimo 50MB");
      }

      // Upload to Supabase Storage
      const fileExt = selectedFileForUpload.name.split('.').pop();
      const fileName = `task-${task.id}-${Date.now()}.${fileExt}`;
      const filePath = `task-attachments/${task.project_id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("project-files")
        .upload(filePath, selectedFileForUpload);

      if (uploadError) throw uploadError;

      // Save metadata with storage path
      const { error } = await supabase
        .from("task_attachments")
        .insert({
          task_id: task.id,
          file_name: selectedFileForUpload.name,
          file_size: selectedFileForUpload.size,
          file_url: filePath, // Store storage path, not blob URL
          uploaded_by: user.id,
        });

      if (error) throw error;

      toast({
        title: "File allegato",
        description: "Il file è stato aggiunto al task",
      });

      setSelectedFileForUpload(null);
      setShowUploadDialog(false);
      fetchAttachments();
    } catch (error: any) {
      toast({
        title: "Errore",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setUploadingFile(false);
    }
  };

  const handleTransferToDocumentation = async (attachment: TaskAttachment) => {
    if (!task || !task.project_id) {
      toast({
        title: "Errore",
        description: "Project ID non disponibile",
        variant: "destructive",
      });
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Non autenticato");

      // Insert into project_files
      const { error: insertError } = await supabase
        .from("project_files")
        .insert({
          project_id: task.project_id,
          file_name: attachment.file_name,
          file_size: attachment.file_size,
          file_type: null,
          storage_path: attachment.file_url,
          is_private: false,
          uploaded_by: user.id,
          transferred_from_task_id: task.id,
          notes: `Trasferito dal task: ${task.title}`,
        });

      if (insertError) throw insertError;

      // Mark attachment as transferred
      const { error: updateError } = await supabase
        .from("task_attachments")
        .update({ 
          transferred_to_docs: true,
          transferred_at: new Date().toISOString()
        })
        .eq("id", attachment.id);

      if (updateError) throw updateError;

      toast({
        title: "File trasferito",
        description: "Il file è stato spostato nella documentazione del progetto",
      });

      fetchAttachments();
    } catch (error: any) {
      toast({
        title: "Errore nel trasferimento",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleDownloadAttachment = async (attachment: TaskAttachment) => {
    try {
      // Download from Supabase Storage
      const { data, error } = await supabase.storage
        .from("project-files")
        .download(attachment.file_url);

      if (error) throw error;

      // Create blob URL and trigger download
      const url = URL.createObjectURL(data);
      const link = document.createElement("a");
      link.href = url;
      link.download = attachment.file_name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      toast({
        title: "Download completato",
        description: `${attachment.file_name} scaricato con successo`,
      });
    } catch (error: any) {
      toast({
        title: "Errore",
        description: error.message || "Errore durante il download",
        variant: "destructive",
      });
    }
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return "N/A";
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / 1048576).toFixed(1) + " MB";
  };

  const handleAssigneeChange = async () => {
    if (!task || !selectedAssignee) return;

    const { error } = await supabase
      .from("tasks")
      .update({ assigned_to_user_id: selectedAssignee })
      .eq("id", task.id);

    if (error) {
      toast({
        title: "Errore",
        description: "Errore durante l'assegnazione del task",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Task assegnato",
      description: "Il task è stato assegnato con successo",
    });

    onOpenChange(false);
    if (onDelete) onDelete(); // Refresh data
  };

  const handleStatusChange = async (newStatus: "to_do" | "doing" | "review" | "done" | "waiting_for_review", transferFiles: boolean = false, comment?: string) => {
    if (!task) return;

    try {
      // If approving and transferFiles is true, transfer all non-transferred attachments
      if (newStatus === "done" && transferFiles) {
        const nonTransferredAttachments = attachments.filter(att => !att.transferred_to_docs);
        
        for (const att of nonTransferredAttachments) {
          await handleTransferToDocumentation(att);
        }
      }

      const { error } = await supabase
        .from("tasks")
        .update({ status: newStatus })
        .eq("id", task.id);

      if (error) throw error;

      // If there's a comment (typically for rejection), add it
      if (comment && user) {
        const { error: commentError } = await supabase
          .from("comments")
          .insert({
            task_id: task.id,
            user_id: user.id,
            content: comment,
          });

        if (commentError) throw commentError;
      }

      toast({
        title: "Stato aggiornato",
        description: `Task ${newStatus === "done" ? "completato" : newStatus === "doing" && comment ? "rifiutato e rimandato al collaboratore" : "aggiornato"}`,
      });

      onOpenChange(false);
      if (onDelete) onDelete(); // Refresh data
    } catch (error: any) {
      toast({
        title: "Errore",
        description: error.message || "Errore durante l'aggiornamento dello stato",
        variant: "destructive",
      });
    }
  };

  const handleRejectTask = async () => {
    if (!rejectComment.trim()) {
      toast({
        title: "Commento richiesto",
        description: "Devi inserire un commento spiegando il motivo del rifiuto",
        variant: "destructive",
      });
      return;
    }

    await handleStatusChange("doing", false, rejectComment);
    setShowRejectDialog(false);
    setRejectComment("");
  };

  const handleLinkExistingFiles = async () => {
    if (!task || selectedFilesToLink.length === 0) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Non autenticato");

      // Link selected files from project_files to task_attachments
      const filesToLink = projectFiles.filter(f => selectedFilesToLink.includes(f.id));
      
      for (const file of filesToLink) {
        const { error } = await supabase
          .from("task_attachments")
          .insert({
            task_id: task.id,
            file_name: file.file_name,
            file_size: file.file_size,
            file_url: file.storage_path,
            uploaded_by: user.id,
          });

        if (error) throw error;
      }

      toast({
        title: "File collegati",
        description: `${selectedFilesToLink.length} file collegati al task`,
      });

      setShowLinkFilesDialog(false);
      setSelectedFilesToLink([]);
      fetchAttachments();
    } catch (error: any) {
      toast({
        title: "Errore",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleDueDateChange = async (newDate: Date | undefined) => {
    if (!task) return;

    try {
      const { error } = await supabase
        .from("tasks")
        .update({ due_date: newDate ? format(newDate, "yyyy-MM-dd") : null })
        .eq("id", task.id);

      if (error) throw error;

      setSelectedDueDate(newDate);

      toast({
        title: "Data aggiornata",
        description: "La data di scadenza è stata modificata con successo",
      });

      // Refresh data to update timeline/gantt
      if (onDelete) onDelete();
    } catch (error: any) {
      toast({
        title: "Errore",
        description: error.message || "Errore durante l'aggiornamento della data",
        variant: "destructive",
      });
    }
  };

  const canEditDueDate = (isManagementRole || isAssignedUser) && !isClient;

  if (!task) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between">
            <DialogTitle className="text-xl flex-1">{task.title}</DialogTitle>
            {(isAdmin || isSuperAdmin || isProjectManager) && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Elimina Task</AlertDialogTitle>
                    <AlertDialogDescription>
                      Sei sicuro di voler eliminare questo task? Tutti i dati correlati
                      (dipendenze, checklist, allegati) saranno eliminati. Questa operazione
                      non può essere annullata.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Annulla</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleDeleteTask}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Elimina
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </DialogHeader>

        <div className="space-y-6">
          <div className="flex gap-2">
            <Badge className={priorityColors[task.priority as keyof typeof priorityColors]}>
              {priorityLabels[task.priority as keyof typeof priorityLabels]}
            </Badge>
            <Badge variant="outline">
              {statusLabels[task.status as keyof typeof statusLabels]}
            </Badge>
          </div>

          {/* Assignment Section - Only for PM/Admin */}
          {canManageFiles && (
            <div className="border rounded-lg p-4 space-y-3 bg-muted/30">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <UserCheck className="h-4 w-4" />
                <span>Assegnazione Task</span>
              </div>
              <div className="flex items-center gap-3">
                <Select value={selectedAssignee} onValueChange={setSelectedAssignee}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Seleziona assegnatario..." />
                  </SelectTrigger>
                  <SelectContent>
                    {projectMembers.map((member) => (
                      <SelectItem key={member.id} value={member.id}>
                        {member.full_name || member.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedAssignee !== task.assigned_to_user_id && (
                  <Button onClick={handleAssigneeChange} size="sm">
                    Salva Assegnazione
                  </Button>
                )}
              </div>
              {task.assigned_to_user_id && (
                <p className="text-xs text-muted-foreground">
                  Attualmente assegnato a:{" "}
                  {projectMembers.find((m) => m.id === task.assigned_to_user_id)?.full_name ||
                    projectMembers.find((m) => m.id === task.assigned_to_user_id)?.email ||
                    "Utente sconosciuto"}
                </p>
              )}
            </div>
          )}

          {task.description && (
            <div>
              <h3 className="font-semibold mb-2">Descrizione</h3>
              <p className="text-muted-foreground">{task.description}</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center gap-2">
              <CalendarIcon className="h-4 w-4 text-muted-foreground" />
              <div className="flex-1">
                <p className="text-xs text-muted-foreground mb-1">Scadenza</p>
                {canEditDueDate ? (
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal h-8 px-3",
                          !selectedDueDate && "text-muted-foreground"
                        )}
                      >
                        {selectedDueDate ? (
                          format(selectedDueDate, "PPP", { locale: it })
                        ) : (
                          <span>Seleziona data...</span>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={selectedDueDate}
                        onSelect={handleDueDateChange}
                        initialFocus
                        className="pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                ) : (
                  <p className="text-sm font-medium">
                    {task.due_date
                      ? new Date(task.due_date).toLocaleDateString("it-IT")
                      : "Nessuna scadenza"}
                  </p>
                )}
              </div>
            </div>
            {task.estimated_hours && (
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Ore Stimate</p>
                  <p className="text-sm font-medium">{task.estimated_hours}h</p>
                </div>
              </div>
            )}
          </div>

          <Separator />

          <div>
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <LinkIcon className="h-4 w-4" />
              Dipendenze
            </h3>
            
            {dependencies.length > 0 ? (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <AlertCircle className="h-4 w-4" />
                    Questo task dipende da:
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {dependencies.map((dep) => (
                    <div
                      key={dep.id}
                      className="flex items-center justify-between p-2 border rounded-md"
                    >
                      <span className="text-sm">{dep.title}</span>
                      <Badge variant="outline" className="text-xs">
                        {statusLabels[dep.status as keyof typeof statusLabels]}
                      </Badge>
                    </div>
                  ))}
                </CardContent>
              </Card>
            ) : (
              <p className="text-sm text-muted-foreground">
                Nessuna dipendenza
              </p>
            )}

            {dependents.length > 0 && (
              <Card className="mt-4">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <AlertCircle className="h-4 w-4" />
                    Task che dipendono da questo:
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {dependents.map((dep) => (
                    <div
                      key={dep.id}
                      className="flex items-center justify-between p-2 border rounded-md"
                    >
                      <span className="text-sm">{dep.title}</span>
                      <Badge variant="outline" className="text-xs">
                        {statusLabels[dep.status as keyof typeof statusLabels]}
                      </Badge>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>

          <Separator />

          {/* Attachments Section */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Allegati Task
              </h3>
              <div className="flex gap-2">
                {canUploadFiles && (
                  <AlertDialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" size="sm">
                        <Upload className="h-4 w-4 mr-2" />
                        Aggiungi File
                      </Button>
                    </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Carica Allegato</AlertDialogTitle>
                      <AlertDialogDescription>
                        Aggiungi un file al task (es. screenshot, documento di completamento)
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="my-4">
                      <Label htmlFor="attachment">Seleziona File</Label>
                      <Input
                        id="attachment"
                        type="file"
                        onChange={(e) => setSelectedFileForUpload(e.target.files?.[0] || null)}
                      />
                      {selectedFileForUpload && (
                        <p className="text-sm text-muted-foreground mt-2">
                          {selectedFileForUpload.name} - {formatFileSize(selectedFileForUpload.size)}
                        </p>
                      )}
                    </div>
                    <AlertDialogFooter>
                      <AlertDialogCancel onClick={() => setSelectedFileForUpload(null)}>
                        Annulla
                      </AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleUploadAttachment}
                        disabled={!selectedFileForUpload || uploadingFile}
                      >
                        {uploadingFile ? "Caricamento..." : "Carica"}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
                )}
                {canManageFiles && projectFiles.length > 0 && (
                  <AlertDialog open={showLinkFilesDialog} onOpenChange={setShowLinkFilesDialog}>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" size="sm">
                        <Link2 className="h-4 w-4 mr-2" />
                        Collega da Documentazione
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                      <AlertDialogHeader>
                        <AlertDialogTitle>Collega File Esistenti</AlertDialogTitle>
                        <AlertDialogDescription>
                          Seleziona i file dalla documentazione del progetto da collegare a questo task
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <div className="my-4 space-y-2">
                        {projectFiles.map((file) => (
                          <div key={file.id} className="flex items-center space-x-2 p-2 border rounded hover:bg-muted/50">
                            <Checkbox
                              id={file.id}
                              checked={selectedFilesToLink.includes(file.id)}
                              onCheckedChange={(checked) => {
                                setSelectedFilesToLink(prev =>
                                  checked
                                    ? [...prev, file.id]
                                    : prev.filter(id => id !== file.id)
                                );
                              }}
                            />
                            <Label htmlFor={file.id} className="flex-1 cursor-pointer">
                              <div className="flex items-center gap-2">
                                <FileText className="h-4 w-4" />
                                <div>
                                  <p className="text-sm font-medium">{file.file_name}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {formatFileSize(file.file_size)}
                                  </p>
                                </div>
                              </div>
                            </Label>
                          </div>
                        ))}
                      </div>
                      <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setSelectedFilesToLink([])}>
                          Annulla
                        </AlertDialogCancel>
                        <AlertDialogAction
                          onClick={handleLinkExistingFiles}
                          disabled={selectedFilesToLink.length === 0}
                        >
                          Collega {selectedFilesToLink.length > 0 ? `(${selectedFilesToLink.length})` : ""}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </div>
            </div>

            {attachments.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nessun allegato</p>
            ) : (
              <div className="space-y-2">
                {attachments.map((att) => (
                  <Card key={att.id} className={att.transferred_to_docs ? "opacity-60" : ""}>
                    <CardContent className="pt-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 flex-1">
                          <FileText className="h-4 w-4" />
                          <div>
                            <p className="text-sm font-medium">{att.file_name}</p>
                            <p className="text-xs text-muted-foreground">
                              {formatFileSize(att.file_size)}
                              {att.transferred_to_docs && " • Trasferito a Documentazione"}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDownloadAttachment(att)}
                          >
                            <Download className="h-4 w-4 mr-2" />
                            Scarica
                          </Button>
                          {!att.transferred_to_docs && (task.status === 'waiting_for_review' || task.status === 'done') && (isAdmin || isSuperAdmin || isProjectManager) && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleTransferToDocumentation(att)}
                            >
                              <FolderUp className="h-4 w-4 mr-2" />
                              Trasferisci a Documentazione
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>

          <Separator />

          <div className="space-y-4">
            <h3 className="font-semibold">Azioni Task</h3>
            <div className="flex flex-wrap gap-2">
              {/* Assigned user can start working on the task */}
              {canStartWork && (
                <Button onClick={() => handleStatusChange("doing")} className="flex-1">
                  Inizia Lavoro
                </Button>
              )}

              {/* Only assigned user can submit for review */}
              {canSubmitForReview && (
                <Button onClick={() => handleStatusChange("waiting_for_review")} className="flex-1">
                  Richiedi Revisione
                </Button>
              )}

              {/* Only PM/Admin can approve or reject */}
              {canApproveReject && (
                <>
                  {attachments.some(att => !att.transferred_to_docs) ? (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button className="flex-1 bg-success hover:bg-success/90">
                          Accetta Task
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Accetta Task e Trasferisci File</AlertDialogTitle>
                          <AlertDialogDescription>
                            Vuoi trasferire automaticamente gli allegati alla documentazione del progetto?
                            I file verranno resi accessibili a tutti i membri del progetto.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Annulla</AlertDialogCancel>
                          <Button onClick={() => handleStatusChange("done", false)} variant="outline">
                            Accetta senza Trasferire
                          </Button>
                          <AlertDialogAction onClick={() => handleStatusChange("done", true)}>
                            Accetta e Trasferisci
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  ) : (
                    <Button onClick={() => handleStatusChange("done")} className="flex-1 bg-success hover:bg-success/90">
                      Accetta Task
                    </Button>
                  )}
                  
                  <AlertDialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="destructive"
                        className="flex-1"
                      >
                        Rifiuta Task
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Rifiuta Task</AlertDialogTitle>
                        <AlertDialogDescription>
                          Spiega al collaboratore cosa deve essere corretto. Il task tornerà allo stato "In Lavorazione".
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <div className="py-4">
                        <Label htmlFor="reject-comment">Commento (obbligatorio)</Label>
                        <Textarea
                          id="reject-comment"
                          placeholder="Descrivi cosa deve essere modificato o corretto..."
                          value={rejectComment}
                          onChange={(e) => setRejectComment(e.target.value)}
                          rows={4}
                          className="mt-2"
                        />
                      </div>
                      <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setRejectComment("")}>Annulla</AlertDialogCancel>
                        <AlertDialogAction onClick={handleRejectTask}>
                          Rifiuta e Invia Commento
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </>
              )}

              {/* Show message if user cannot perform actions */}
              {!isAssignedUser && !isManagementRole && task.status === "doing" && (
                <div className="text-sm text-muted-foreground text-center p-3 bg-muted/30 rounded-lg w-full">
                  Solo l'assegnatario o i gestori del progetto possono richiedere la revisione di questo task
                </div>
              )}

              {canSubmitForReview && !isAssignedUser && isManagementRole && (
                <div className="text-sm text-warning text-center p-2 bg-warning/10 rounded-lg w-full">
                  ⚠️ Stai consegnando un task non assegnato a te (Admin Override)
                </div>
              )}

              {!canApproveReject && task.status === "waiting_for_review" && (
                <div className="text-sm text-muted-foreground text-center p-3 bg-muted/30 rounded-lg w-full">
                  In attesa di revisione dal Project Manager
                </div>
              )}
            </div>
          </div>

          <Separator />

          <TaskComments taskId={task.id} />
        </div>
      </DialogContent>
    </Dialog>
  );
}