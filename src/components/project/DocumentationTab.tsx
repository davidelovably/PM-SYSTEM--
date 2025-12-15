import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Upload, Download, Trash2, Lock, FileText, AlertCircle, Send } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { format } from "date-fns";
import { ShareFileDialog } from "@/components/inbox/ShareFileDialog";

interface ProjectFile {
  id: string;
  file_name: string;
  file_size: number | null;
  file_type: string | null;
  storage_path: string;
  is_private: boolean;
  uploaded_by: string;
  uploaded_at: string;
  notes: string | null;
  transferred_from_task_id: string | null;
  profiles: {
    full_name: string | null;
    email: string;
  };
}

interface DocumentationTabProps {
  projectId: string;
}

export function DocumentationTab({ projectId }: DocumentationTabProps) {
  const { isSuperAdmin, isAdmin, isProjectManager, isClient } = useUserRole();
  const canManageFiles = (isSuperAdmin || isAdmin || isProjectManager) && !isClient;

  const [files, setFiles] = useState<ProjectFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isPrivate, setIsPrivate] = useState(false);
  const [notes, setNotes] = useState("");
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [shareFile, setShareFile] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    fetchFiles();
  }, [projectId]);

  const fetchFiles = async () => {
    try {
      const { data, error } = await supabase
        .from("project_files")
        .select("*")
        .eq("project_id", projectId)
        .order("uploaded_at", { ascending: false });

      if (error) throw error;

      // Fetch user profiles separately
      if (data && data.length > 0) {
        const userIds = [...new Set(data.map(f => f.uploaded_by))];
        const { data: profilesData } = await supabase
          .from("profiles")
          .select("id, full_name, email")
          .in("id", userIds);

        const profilesMap = new Map(profilesData?.map(p => [p.id, p]) || []);
        const filesWithProfiles = data.map(file => ({
          ...file,
          profiles: profilesMap.get(file.uploaded_by) || { full_name: null, email: "Unknown" }
        }));
        setFiles(filesWithProfiles as ProjectFile[]);
      } else {
        setFiles([]);
      }
    } catch (error) {
      console.error("Error fetching files:", error);
      toast.error("Errore nel caricamento dei file");
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 52428800) { // 50MB
        toast.error("File troppo grande. Massimo 50MB");
        return;
      }
      setSelectedFile(file);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Non autenticato");

      // Validate file size client-side
      if (selectedFile.size > 52428800) {
        toast.error("File troppo grande. Massimo 50MB");
        return;
      }

      // Upload to storage
      const fileExt = selectedFile.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `${projectId}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("project-files")
        .upload(filePath, selectedFile);

      if (uploadError) throw uploadError;

      // Save metadata to database
      const { error: dbError } = await supabase
        .from("project_files")
        .insert({
          project_id: projectId,
          file_name: selectedFile.name,
          file_size: selectedFile.size,
          file_type: selectedFile.type,
          storage_path: filePath,
          is_private: isPrivate,
          uploaded_by: user.id,
          notes: notes || null,
        });

      if (dbError) throw dbError;

      toast.success("File caricato con successo");
      setUploadDialogOpen(false);
      setSelectedFile(null);
      setIsPrivate(false);
      setNotes("");
      fetchFiles();
    } catch (error) {
      console.error("Error uploading file:", error);
      toast.error("Impossibile caricare il file");
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = async (file: ProjectFile) => {
    try {
      const { data, error } = await supabase.storage
        .from("project-files")
        .download(file.storage_path);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement("a");
      a.href = url;
      a.download = file.file_name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error downloading file:", error);
      toast.error("Impossibile scaricare il file");
    }
  };

  const handleDelete = async (file: ProjectFile) => {
    try {
      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from("project-files")
        .remove([file.storage_path]);

      if (storageError) throw storageError;

      // Delete from database
      const { error: dbError } = await supabase
        .from("project_files")
        .delete()
        .eq("id", file.id);

      if (dbError) throw dbError;

      toast.success("File eliminato");
      fetchFiles();
    } catch (error) {
      console.error("Error deleting file:", error);
      toast.error("Impossibile eliminare il file");
    }
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return "N/A";
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / 1048576).toFixed(1) + " MB";
  };

  if (loading) {
    return <div className="flex items-center justify-center p-8">Caricamento...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Documentazione Progetto</h3>
          <p className="text-sm text-muted-foreground">
            Gestisci i file e documenti del progetto
          </p>
        </div>
        {canManageFiles && (
          <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Upload className="h-4 w-4 mr-2" />
                Carica File
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Carica Documento</DialogTitle>
                <DialogDescription>
                  Carica un nuovo file nella documentazione del progetto (Max 50MB)
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="file">File</Label>
                  <Input
                    id="file"
                    type="file"
                    onChange={handleFileSelect}
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png,.gif,.webp,.txt,.zip,.rar"
                  />
                  {selectedFile && (
                    <p className="text-sm text-muted-foreground mt-2">
                      {selectedFile.name} - {formatFileSize(selectedFile.size)}
                    </p>
                  )}
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="private"
                    checked={isPrivate}
                    onCheckedChange={(checked) => setIsPrivate(checked as boolean)}
                  />
                  <Label htmlFor="private" className="flex items-center gap-2 cursor-pointer">
                    <Lock className="h-4 w-4" />
                    File Riservato (solo Admins e PM)
                  </Label>
                </div>
                <div>
                  <Label htmlFor="notes">Note (opzionale)</Label>
                  <Textarea
                    id="notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Descrizione o note sul file..."
                    rows={3}
                  />
                </div>
                <Button
                  onClick={handleUpload}
                  disabled={!selectedFile || uploading}
                  className="w-full"
                >
                  {uploading ? "Caricamento..." : "Carica"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {!canManageFiles && (
        <Card className="border-amber-500/50 bg-amber-500/10">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-amber-600">
              <AlertCircle className="h-4 w-4" />
              <p className="text-sm">
                I file riservati (con lucchetto) sono visibili solo agli Admins e Project Manager
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4">
        {files.length === 0 ? (
          <Card>
            <CardContent className="pt-6 text-center text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nessun documento caricato</p>
            </CardContent>
          </Card>
        ) : (
          files.map((file) => (
            <Card key={file.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-base flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      {file.file_name}
                      {file.is_private && (
                        <Badge variant="secondary" className="ml-2">
                          <Lock className="h-3 w-3 mr-1" />
                          Riservato
                        </Badge>
                      )}
                      {file.transferred_from_task_id && (
                        <Badge variant="outline" className="ml-2">
                          Da Task
                        </Badge>
                      )}
                    </CardTitle>
                    <CardDescription className="mt-1">
                      Caricato da {file.profiles?.full_name || file.profiles?.email} • {" "}
                      {format(new Date(file.uploaded_at), "dd/MM/yyyy HH:mm")} • {" "}
                      {formatFileSize(file.file_size)}
                    </CardDescription>
                    {file.notes && (
                      <p className="text-sm mt-2 text-muted-foreground">{file.notes}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setShareFile({ id: file.id, name: file.file_name });
                        setShareDialogOpen(true);
                      }}
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDownload(file)}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                    {canManageFiles && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="outline" size="sm">
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Conferma Eliminazione</AlertDialogTitle>
                            <AlertDialogDescription>
                              Sei sicuro di voler eliminare "{file.file_name}"? Questa azione è irreversibile.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Annulla</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDelete(file)}>
                              Elimina
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </div>
                </div>
              </CardHeader>
            </Card>
          ))
        )}
      </div>

      {/* Share File Dialog */}
      {shareFile && (
        <ShareFileDialog
          open={shareDialogOpen}
          onOpenChange={setShareDialogOpen}
          projectId={projectId}
          fileId={shareFile.id}
          fileName={shareFile.name}
        />
      )}
    </div>
  );
}
