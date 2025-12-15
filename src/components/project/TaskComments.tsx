import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Smile, Meh, Frown, Loader2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { it } from "date-fns/locale";

interface Comment {
  id: string;
  content: string;
  sentiment_label: 'Positive' | 'Neutral' | 'Negative';
  created_at: string;
  user_id: string;
  profiles: {
    full_name: string | null;
    email: string;
  };
}

interface TaskCommentsProps {
  taskId: string;
}

export function TaskComments({ taskId }: TaskCommentsProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchComments();

    // Subscribe to realtime updates
    const channel = supabase
      .channel(`comments:${taskId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'comments',
          filter: `task_id=eq.${taskId}`,
        },
        () => {
          fetchComments();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [taskId]);

  const fetchComments = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('comments')
      .select('*, profiles(full_name, email)')
      .eq('task_id', taskId)
      .order('created_at', { ascending: false });

    if (error) {
      toast({
        title: "Errore",
        description: "Impossibile caricare i commenti",
        variant: "destructive",
      });
    } else {
      setComments(data as Comment[] || []);
    }
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    setSubmitting(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: comment, error } = await supabase
      .from('comments')
      .insert({
        task_id: taskId,
        user_id: user.id,
        content: newComment.trim(),
      })
      .select()
      .single();

    if (error) {
      toast({
        title: "Errore",
        description: "Impossibile aggiungere il commento",
        variant: "destructive",
      });
    } else {
      setNewComment("");
      toast({
        title: "Successo",
        description: "Commento aggiunto. Analisi sentiment in corso...",
      });

      // Trigger async sentiment analysis with proper auth
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        supabase.functions.invoke('analyze-sentiment', {
          body: { commentId: comment.id, content: comment.content }
        }).catch(err => console.error('Sentiment analysis error:', err));
      }
    }
    setSubmitting(false);
  };

  const getSentimentIcon = (sentiment: string) => {
    switch (sentiment) {
      case 'Positive':
        return <Smile className="h-4 w-4 text-green-500" />;
      case 'Negative':
        return <Frown className="h-4 w-4 text-red-500" />;
      default:
        return <Meh className="h-4 w-4 text-gray-500" />;
    }
  };

  const getSentimentBadge = (sentiment: string) => {
    const variants: Record<string, "default" | "destructive" | "secondary"> = {
      Positive: "default",
      Negative: "destructive",
      Neutral: "secondary",
    };
    return (
      <Badge variant={variants[sentiment] || "secondary"} className="gap-1">
        {getSentimentIcon(sentiment)}
        {sentiment}
      </Badge>
    );
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Commenti</h3>

      <form onSubmit={handleSubmit} className="space-y-2">
        <Textarea
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder="Aggiungi un commento..."
          className="min-h-[80px]"
          disabled={submitting}
        />
        <Button type="submit" disabled={submitting || !newComment.trim()}>
          {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Invia Commento
        </Button>
      </form>

      <div className="space-y-3">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : comments.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            Nessun commento ancora
          </p>
        ) : (
          comments.map((comment) => (
            <div key={comment.id} className="border rounded-lg p-4 space-y-2">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-medium text-sm">
                    {comment.profiles?.full_name || comment.profiles?.email || 'Utente Sconosciuto'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(comment.created_at), {
                      addSuffix: true,
                      locale: it,
                    })}
                  </p>
                </div>
                {getSentimentBadge(comment.sentiment_label)}
              </div>
              <p className="text-sm">{comment.content}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
