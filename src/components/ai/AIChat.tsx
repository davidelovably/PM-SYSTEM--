import { useRef, useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Send, Sparkles, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useLocation } from "react-router-dom";
import { useChatMemory } from "@/contexts/ChatMemoryContext";

interface AIChatProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AIChat({ open, onOpenChange }: AIChatProps) {
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const location = useLocation();
  
  // Extract project ID from URL if on project detail page
  const projectId = location.pathname.includes("/projects/") 
    ? location.pathname.split("/projects/")[1]?.split("/")[0]?.split("?")[0]?.split("#")[0] 
    : null;

  const { getMessages, addMessage, clearMessages } = useChatMemory();
  const messages = getMessages(projectId);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = { role: "user" as const, content: input };
    addMessage(projectId, userMessage);
    const currentMessages = [...messages, userMessage];
    setInput("");
    setIsLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const { data, error } = await supabase.functions.invoke("ai-chat", {
        body: { 
          message: input,
          projectId: projectId,
          conversationHistory: currentMessages
        },
        headers: {
          Authorization: `Bearer ${session?.access_token}`
        }
      });

      if (error) {
        if (error.message?.includes("429")) {
          toast.error("Limite richieste raggiunto. Riprova tra qualche minuto.");
        } else if (error.message?.includes("402")) {
          toast.error("Crediti esauriti. Aggiungi crediti nelle impostazioni.");
        } else {
          throw error;
        }
        return;
      }

      const assistantMessage = { 
        role: "assistant" as const, 
        content: data.response 
      };
      addMessage(projectId, assistantMessage);
    } catch (error) {
      console.error("Error sending message:", error);
      toast.error("Errore nell'invio del messaggio. Riprova.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearChat = () => {
    clearMessages(projectId);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] h-[600px] flex flex-col">
        <DialogHeader className="flex flex-row items-center justify-between">
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Assistente AI
            {projectId && <span className="text-xs text-muted-foreground font-normal ml-2">(Progetto)</span>}
          </DialogTitle>
          {messages.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearChat}
              className="h-8 px-2 text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </DialogHeader>

        <ScrollArea className="flex-1 pr-4" ref={scrollRef}>
          <div className="space-y-4">
            {messages.length === 0 && (
              <div className="text-center text-muted-foreground py-8">
                <Sparkles className="h-12 w-12 mx-auto mb-4 text-primary/50" />
                <p className="text-sm font-medium mb-2">Ciao! Sono il tuo assistente AI.</p>
                <p className="text-sm mb-4">Posso aiutarti con:</p>
                <div className="text-xs space-y-1 max-w-xs mx-auto">
                  <p>• Analizzare lo stato dei tuoi progetti</p>
                  <p>• Creare task e milestone</p>
                  <p>• Monitorare rischi e scadenze</p>
                  <p>• Rispondere a domande sulla gestione progetti</p>
                </div>
              </div>
            )}
            
            {messages.map((message, index) => (
              <div
                key={index}
                className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[80%] rounded-lg px-4 py-2 ${
                    message.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-foreground"
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                </div>
              </div>
            ))}
            
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-muted rounded-lg px-4 py-3 flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  <span className="text-sm text-muted-foreground">Sto pensando...</span>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        <div className="flex gap-2 pt-4">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyPress}
            placeholder="Scrivi il tuo messaggio..."
            className="min-h-[60px] resize-none"
            disabled={isLoading}
          />
          <Button
            onClick={sendMessage}
            disabled={isLoading || !input.trim()}
            size="icon"
            className="h-[60px] w-[60px]"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}