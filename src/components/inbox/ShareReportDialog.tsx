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

interface ShareReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  reportId: string;
  reportPeriod: string;
}

export function ShareReportDialog({
  open,
  onOpenChange,
  projectId,
  reportId,
  reportPeriod,
}: ShareReportDialogProps) {
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
        subject: `Report Progetto: ${reportPeriod}`,
        content: message || `Ti è stato inviato un report "${reportPeriod}". Accedi alla sezione Reportistica del progetto per visualizzarlo.`,
        message_type: "notification",
        related_entity_id: projectId,
        related_entity_type: "project",
      });

      if (error) throw error;

      toast.success("Report condiviso con successo");
      onOpenChange(false);
      setSelectedRecipient("");
      setMessage("");
    } catch (error) {
      console.error("Error sharing report:", error);
      toast.error("Errore nella condivisione del report");
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Condividi Report</DialogTitle>
          <DialogDescription>
            Notifica un membro del progetto riguardo questo report
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border">
            <FileText className="h-8 w-8 text-primary" />
            <div>
              <p className="font-medium text-sm">Report {reportPeriod}</p>
              <p className="text-xs text-muted-foreground">Report da condividere</p>
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
            {sending ? "Invio in corso..." : "Invia Notifica"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
