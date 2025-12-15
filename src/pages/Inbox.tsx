import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { 
  Mail, 
  MailOpen, 
  Bell, 
  MessageSquare, 
  FileText, 
  Trash2, 
  Download,
  ExternalLink,
  ArrowLeft,
  CheckCheck
} from "lucide-react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
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

interface InboxMessage {
  id: string;
  created_at: string;
  sender_id: string | null;
  recipient_id: string;
  subject: string;
  content: string;
  message_type: "notification" | "direct_message" | "file_share";
  related_entity_id: string | null;
  related_entity_type: string | null;
  attachment_file_id: string | null;
  is_read: boolean;
  sender?: {
    full_name: string | null;
    email: string;
  };
  attachment?: {
    file_name: string;
    storage_path: string;
  };
}

export default function Inbox() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<InboxMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMessage, setSelectedMessage] = useState<InboxMessage | null>(null);
  const [deleteMessageId, setDeleteMessageId] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      fetchMessages();
    }
  }, [user]);

  const fetchMessages = async () => {
    try {
      const { data, error } = await supabase
        .from("inbox_messages")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Fetch sender profiles and attachments
      if (data && data.length > 0) {
        const senderIds = [...new Set(data.filter(m => m.sender_id).map(m => m.sender_id))] as string[];
        const attachmentIds = [...new Set(data.filter(m => m.attachment_file_id).map(m => m.attachment_file_id))] as string[];

        const [profilesRes, filesRes] = await Promise.all([
          senderIds.length > 0 
            ? supabase.from("profiles").select("id, full_name, email").in("id", senderIds)
            : { data: [] as { id: string; full_name: string | null; email: string }[] },
          attachmentIds.length > 0
            ? supabase.from("project_files").select("id, file_name, storage_path").in("id", attachmentIds)
            : { data: [] as { id: string; file_name: string; storage_path: string }[] }
        ]);

        const profilesMap = new Map<string, { id: string; full_name: string | null; email: string }>();
        profilesRes.data?.forEach(p => profilesMap.set(p.id, p));
        
        const filesMap = new Map<string, { id: string; file_name: string; storage_path: string }>();
        filesRes.data?.forEach(f => filesMap.set(f.id, f));

        const messagesWithDetails: InboxMessage[] = data.map(msg => ({
          ...msg,
          message_type: msg.message_type as "notification" | "direct_message" | "file_share",
          sender: msg.sender_id ? profilesMap.get(msg.sender_id) : undefined,
          attachment: msg.attachment_file_id ? filesMap.get(msg.attachment_file_id) : undefined
        }));

        setMessages(messagesWithDetails);
      } else {
        setMessages([]);
      }
    } catch (error) {
      console.error("Error fetching messages:", error);
      toast.error("Errore nel caricamento dei messaggi");
    } finally {
      setLoading(false);
    }
  };

  const handleSelectMessage = async (message: InboxMessage) => {
    setSelectedMessage(message);
    
    if (!message.is_read) {
      try {
        await supabase
          .from("inbox_messages")
          .update({ is_read: true })
          .eq("id", message.id);
        
        setMessages(prev => prev.map(m => 
          m.id === message.id ? { ...m, is_read: true } : m
        ));
      } catch (error) {
        console.error("Error marking message as read:", error);
      }
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await supabase
        .from("inbox_messages")
        .update({ is_read: true })
        .eq("is_read", false);
      
      setMessages(prev => prev.map(m => ({ ...m, is_read: true })));
      toast.success("Tutti i messaggi segnati come letti");
    } catch (error) {
      console.error("Error marking all as read:", error);
      toast.error("Errore nell'operazione");
    }
  };

  const handleDeleteMessage = async () => {
    if (!deleteMessageId) return;

    try {
      await supabase
        .from("inbox_messages")
        .delete()
        .eq("id", deleteMessageId);
      
      setMessages(prev => prev.filter(m => m.id !== deleteMessageId));
      if (selectedMessage?.id === deleteMessageId) {
        setSelectedMessage(null);
      }
      toast.success("Messaggio eliminato");
    } catch (error) {
      console.error("Error deleting message:", error);
      toast.error("Errore nell'eliminazione");
    } finally {
      setDeleteMessageId(null);
    }
  };

  const handleDownloadAttachment = async (attachment: { file_name: string; storage_path: string }) => {
    try {
      const { data, error } = await supabase.storage
        .from("project-files")
        .download(attachment.storage_path);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement("a");
      a.href = url;
      a.download = attachment.file_name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error downloading file:", error);
      toast.error("Errore nel download del file");
    }
  };

  const handleNavigateToEntity = (message: InboxMessage) => {
    if (message.related_entity_type === "task" && message.related_entity_id) {
      // Navigate to the project containing this task
      supabase
        .from("tasks")
        .select("project_id")
        .eq("id", message.related_entity_id)
        .single()
        .then(({ data }) => {
          if (data?.project_id) {
            navigate(`/projects/${data.project_id}`);
          }
        });
    } else if (message.related_entity_type === "project" && message.related_entity_id) {
      navigate(`/projects/${message.related_entity_id}`);
    }
  };

  const getMessageIcon = (type: string) => {
    switch (type) {
      case "notification": return <Bell className="h-4 w-4" />;
      case "direct_message": return <MessageSquare className="h-4 w-4" />;
      case "file_share": return <FileText className="h-4 w-4" />;
      default: return <Mail className="h-4 w-4" />;
    }
  };

  const getMessageTypeBadge = (type: string) => {
    switch (type) {
      case "notification": return <Badge variant="secondary">Notifica</Badge>;
      case "direct_message": return <Badge variant="default">Messaggio</Badge>;
      case "file_share": return <Badge className="bg-success/10 text-success border-success/20">File</Badge>;
      default: return null;
    }
  };

  const unreadCount = messages.filter(m => !m.is_read).length;

  if (loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="container mx-auto py-6 px-4">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">Posta in Arrivo</h1>
            <p className="text-muted-foreground">
              {unreadCount > 0 ? `${unreadCount} messaggi non letti` : "Nessun messaggio non letto"}
            </p>
          </div>
          {unreadCount > 0 && (
            <Button variant="outline" onClick={handleMarkAllRead}>
              <CheckCheck className="h-4 w-4 mr-2" />
              Segna tutti come letti
            </Button>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-200px)]">
          {/* Message List */}
          <Card className="lg:col-span-1">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Messaggi</CardTitle>
              <CardDescription>{messages.length} totali</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[calc(100vh-320px)]">
                {messages.length === 0 ? (
                  <div className="p-6 text-center text-muted-foreground">
                    <Mail className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Nessun messaggio</p>
                  </div>
                ) : (
                  messages.map((message) => (
                    <div
                      key={message.id}
                      className={`p-4 cursor-pointer border-b hover:bg-muted/50 transition-colors ${
                        selectedMessage?.id === message.id ? "bg-muted" : ""
                      } ${!message.is_read ? "bg-primary/5" : ""}`}
                      onClick={() => handleSelectMessage(message)}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`mt-1 ${!message.is_read ? "text-primary" : "text-muted-foreground"}`}>
                          {message.is_read ? <MailOpen className="h-4 w-4" /> : <Mail className="h-4 w-4" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            {getMessageTypeBadge(message.message_type)}
                            {!message.is_read && (
                              <span className="w-2 h-2 bg-primary rounded-full" />
                            )}
                          </div>
                          <p className={`text-sm truncate ${!message.is_read ? "font-semibold" : ""}`}>
                            {message.subject}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {message.sender ? message.sender.full_name || message.sender.email : "Sistema"} • {" "}
                            {format(new Date(message.created_at), "dd MMM HH:mm", { locale: it })}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Message Detail */}
          <Card className="lg:col-span-2">
            {selectedMessage ? (
              <>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      {getMessageIcon(selectedMessage.message_type)}
                      {getMessageTypeBadge(selectedMessage.message_type)}
                    </div>
                    <div className="flex items-center gap-2">
                      {selectedMessage.related_entity_id && (
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleNavigateToEntity(selectedMessage)}
                        >
                          <ExternalLink className="h-4 w-4 mr-1" />
                          Vai al {selectedMessage.related_entity_type === "task" ? "Task" : "Progetto"}
                        </Button>
                      )}
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => setDeleteMessageId(selectedMessage.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                  <CardTitle className="mt-2">{selectedMessage.subject}</CardTitle>
                  <CardDescription>
                    Da: {selectedMessage.sender ? selectedMessage.sender.full_name || selectedMessage.sender.email : "Sistema"} • {" "}
                    {format(new Date(selectedMessage.created_at), "dd MMMM yyyy, HH:mm", { locale: it })}
                  </CardDescription>
                </CardHeader>
                <Separator />
                <CardContent className="pt-6">
                  <div className="prose prose-sm max-w-none dark:prose-invert">
                    <p className="whitespace-pre-wrap">{selectedMessage.content}</p>
                  </div>

                  {selectedMessage.attachment && (
                    <div className="mt-6 p-4 rounded-lg bg-muted/50 border">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <FileText className="h-8 w-8 text-primary" />
                          <div>
                            <p className="font-medium">{selectedMessage.attachment.file_name}</p>
                            <p className="text-sm text-muted-foreground">File allegato</p>
                          </div>
                        </div>
                        <Button onClick={() => handleDownloadAttachment(selectedMessage.attachment!)}>
                          <Download className="h-4 w-4 mr-2" />
                          Scarica
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-8">
                <Mail className="h-16 w-16 mb-4 opacity-30" />
                <p className="text-lg">Seleziona un messaggio</p>
                <p className="text-sm">Clicca su un messaggio dalla lista per visualizzarlo</p>
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteMessageId} onOpenChange={() => setDeleteMessageId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Elimina Messaggio</AlertDialogTitle>
            <AlertDialogDescription>
              Sei sicuro di voler eliminare questo messaggio? L'azione è irreversibile.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteMessage}>Elimina</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MainLayout>
  );
}
