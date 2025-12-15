import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Send, FileText } from "lucide-react";
import { toast } from "sonner";

interface ProjectMember {
  user_id: string;
  profiles: {
    id: string;
    full_name: string | null;
    email: string;
  };
}

interface ShareFileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  fileId: string;
  fileName: string;
}

export function ShareFileDialog({
  open,
  onOpenChange,
  projectId,
  fileId,
  fileName,
}: ShareFileDialogProps) {
  const { user } = useAuth();
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [selectedRecipient, setSelectedRecipient] = useState<string>("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (open && projectId) {
      fetchProjectMembers();
    }
  }, [open, projectId]);

  const fetchProjectMembers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("project_members")
        .select("user_id")
        .eq("project_id", projectId);

      if (error) throw error;

      if (data && data.length > 0) {
        const userIds = data.map(m => m.user_id).filter(id => id !== user?.id);
        
        if (userIds.length > 0) {
          const { data: profilesData } = await supabase
            .from("profiles")
            .select("id, full_name, email")
            .in("id", userIds);

          const membersWithProfiles = userIds.map(userId => ({
            user_id: userId,
            profiles: profilesData?.find(p => p.id === userId) || { id: userId, full_name: null, email: "Unknown" }
          }));

          setMembers(membersWithProfiles);
        } else {
          setMembers([]);
        }
      }
    } catch (error) {
      console.error("Error fetching project members:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async () => {
    if (!selectedRecipient || !user) return;

    setSending(true);
    try {
      const { error } = await supabase.from("inbox_messages").insert({
        sender_id: user.id,
        recipient_id: selectedRecipient,
        subject: `File condiviso: ${fileName}`,
        content: message || `Ti è stato condiviso il file "${fileName}". Clicca sul pulsante Scarica per visualizzarlo.`,
        message_type: "file_share",
        related_entity_id: projectId,
        related_entity_type: "project",
        attachment_file_id: fileId,
      });

      if (error) throw error;

      toast.success("File condiviso con successo");
      onOpenChange(false);
      setSelectedRecipient("");
      setMessage("");
    } catch (error) {
      console.error("Error sharing file:", error);
      toast.error("Errore nella condivisione del file");
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Condividi File</DialogTitle>
          <DialogDescription>
            Invia questo file a un membro del progetto
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border">
            <FileText className="h-8 w-8 text-primary" />
            <div>
              <p className="font-medium text-sm">{fileName}</p>
              <p className="text-xs text-muted-foreground">File da condividere</p>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Destinatario</Label>
            <Select value={selectedRecipient} onValueChange={setSelectedRecipient}>
              <SelectTrigger>
                <SelectValue placeholder="Seleziona un destinatario..." />
              </SelectTrigger>
              <SelectContent>
                {loading ? (
                  <SelectItem value="loading" disabled>Caricamento...</SelectItem>
                ) : members.length === 0 ? (
                  <SelectItem value="empty" disabled>Nessun membro disponibile</SelectItem>
                ) : (
                  members.map((member) => (
                    <SelectItem key={member.user_id} value={member.user_id}>
                      {member.profiles.full_name || member.profiles.email}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Messaggio (opzionale)</Label>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Aggiungi un messaggio di accompagnamento..."
              rows={3}
            />
          </div>

          <Button
            onClick={handleSend}
            disabled={!selectedRecipient || sending}
            className="w-full"
          >
            <Send className="h-4 w-4 mr-2" />
            {sending ? "Invio in corso..." : "Invia"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
