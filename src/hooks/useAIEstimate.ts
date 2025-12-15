import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export function useAIEstimate() {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const suggestTaskEstimate = async (
    title: string,
    description: string,
    projectId?: string
  ): Promise<number | null> => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Non autenticato");

      const { data, error } = await supabase.functions.invoke('ai-chat', {
        body: {
          message: `Suggerisci le ore stimate per questa task: Titolo: "${title}", Descrizione: "${description}"`,
          projectId,
        },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) throw error;

      // Parse the response to extract hours
      const match = data.response.match(/(\d+(?:\.\d+)?)\s*ore/i);
      if (match) {
        return parseFloat(match[1]);
      }

      toast({
        title: "Stima AI",
        description: data.response,
      });
      return null;
    } catch (error) {
      console.error('AI Estimate Error:', error);
      toast({
        title: "Errore",
        description: "Impossibile ottenere la stima AI",
        variant: "destructive",
      });
      return null;
    } finally {
      setLoading(false);
    }
  };

  const suggestRiskEstimate = async (
    title: string,
    description: string,
    projectId?: string
  ): Promise<{ probability: string; impact: string } | null> => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Non autenticato");

      const { data, error } = await supabase.functions.invoke('ai-chat', {
        body: {
          message: `Suggerisci probabilità e impatto per questo rischio: Titolo: "${title}", Descrizione: "${description}"`,
          projectId,
        },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) throw error;

      // Parse the response
      const probMatch = data.response.match(/probabilità[:\s]+(\w+)/i);
      const impactMatch = data.response.match(/impatto[:\s]+(\w+)/i);

      if (probMatch && impactMatch) {
        return {
          probability: probMatch[1].toLowerCase(),
          impact: impactMatch[1].toLowerCase(),
        };
      }

      toast({
        title: "Stima AI",
        description: data.response,
      });
      return null;
    } catch (error) {
      console.error('AI Estimate Error:', error);
      toast({
        title: "Errore",
        description: "Impossibile ottenere la stima AI",
        variant: "destructive",
      });
      return null;
    } finally {
      setLoading(false);
    }
  };

  return {
    suggestTaskEstimate,
    suggestRiskEstimate,
    loading,
  };
}
