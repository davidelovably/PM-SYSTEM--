import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, AlertTriangle, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useUserRole } from "@/hooks/useUserRole";
import { z } from "zod";

const riskSchema = z.object({
  title: z.string().trim().min(1, "Titolo obbligatorio").max(200, "Titolo troppo lungo"),
  description: z.string().max(2000, "Descrizione troppo lunga").optional(),
  probability: z.enum(["very_low", "low", "medium", "high", "very_high"]),
  impact: z.enum(["very_low", "low", "medium", "high", "very_high"]),
  mitigation_plan: z.string().max(2000, "Piano di mitigazione troppo lungo").optional(),
});

interface Risk {
  id: string;
  title: string;
  description: string | null;
  probability: string;
  impact: string;
  status: string;
  mitigation_plan: string | null;
}

interface RisksTabProps {
  projectId: string;
}

const probabilityLabels = {
  very_low: "Molto Bassa",
  low: "Bassa",
  medium: "Media",
  high: "Alta",
  very_high: "Molto Alta",
};

const impactLabels = {
  very_low: "Molto Basso",
  low: "Basso",
  medium: "Medio",
  high: "Alto",
  very_high: "Molto Alto",
};

const statusLabels = {
  open: "Aperto",
  identified: "Identificato",
  mitigated: "Mitigato",
  closed: "Chiuso",
};

export function RisksTab({ projectId }: RisksTabProps) {
  const [risks, setRisks] = useState<Risk[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const { toast } = useToast();
  const { isAdmin, isSuperAdmin, isProjectManager, isClient } = useUserRole();
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    probability: "medium",
    impact: "medium",
    mitigation_plan: "",
  });

  useEffect(() => {
    fetchRisks();
  }, [projectId]);

  const fetchRisks = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("risks")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false });

    if (error) {
      toast({
        title: "Errore",
        description: "Impossibile caricare i rischi",
        variant: "destructive",
      });
    } else {
      setRisks(data || []);
    }
    setLoading(false);
  };

  const handleAISuggest = async () => {
    if (!formData.title) {
      toast({
        title: "Attenzione",
        description: "Inserisci almeno il titolo per ottenere una stima AI",
        variant: "destructive",
      });
      return;
    }

    setAiLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('ai-chat', {
        body: {
          message: `Suggerisci probabilità e impatto per questo rischio: Titolo: "${formData.title}", Descrizione: "${formData.description}"`,
          projectId,
        },
      });

      if (!error && data?.response) {
        // Parse AI response
        const probMatch = data.response.match(/probabilità[:\s]+(\w+)/i);
        const impactMatch = data.response.match(/impatto[:\s]+(\w+)/i);

        if (probMatch || impactMatch) {
          const newFormData = { ...formData };
          if (probMatch) {
            const prob = probMatch[1].toLowerCase();
            if (['very_low', 'low', 'medium', 'high', 'very_high'].includes(prob)) {
              newFormData.probability = prob;
            }
          }
          if (impactMatch) {
            const imp = impactMatch[1].toLowerCase();
            if (['very_low', 'low', 'medium', 'high', 'very_high'].includes(imp)) {
              newFormData.impact = imp;
            }
          }
          setFormData(newFormData);
          toast({
            title: "Stima AI",
            description: data.response,
          });
        }
      }
    } catch (error) {
      console.error('AI Error:', error);
      toast({
        title: "Errore",
        description: "Impossibile ottenere la stima AI",
        variant: "destructive",
      });
    } finally {
      setAiLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const validation = riskSchema.safeParse(formData);
      if (!validation.success) {
        toast({
          title: "Errore di validazione",
          description: validation.error.errors[0].message,
          variant: "destructive",
        });
        return;
      }

      const { error } = await supabase.from("risks").insert([
        {
          project_id: projectId,
          title: validation.data.title,
          description: validation.data.description || null,
          probability: validation.data.probability,
          impact: validation.data.impact,
          mitigation_plan: validation.data.mitigation_plan || null,
          status: "open",
        },
      ]);

      if (error) throw error;

      toast({
        title: "Rischio creato",
        description: "Il rischio è stato aggiunto con successo",
      });
      setOpen(false);
      setFormData({
        title: "",
        description: "",
        probability: "medium",
        impact: "medium",
        mitigation_plan: "",
      });
      fetchRisks();
    } catch (error) {
      console.error("Error creating risk:", error);
      toast({
        title: "Errore",
        description: "Impossibile creare il rischio",
        variant: "destructive",
      });
    }
  };

  const getRiskScore = (probability: string, impact: string): number => {
    const probScores = { very_low: 1, low: 2, medium: 3, high: 4, very_high: 5 };
    const impactScores = { very_low: 1, low: 2, medium: 3, high: 4, very_high: 5 };
    return (probScores[probability as keyof typeof probScores] || 0) *
           (impactScores[impact as keyof typeof impactScores] || 0);
  };

  const getRiskColor = (score: number): string => {
    if (score >= 16) return "bg-destructive text-destructive-foreground";
    if (score >= 9) return "bg-warning text-warning-foreground";
    return "bg-muted text-muted-foreground";
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Registro Rischi</h2>
        {(isAdmin || isSuperAdmin || isProjectManager) && !isClient && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Nuovo Rischio
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Crea Nuovo Rischio</DialogTitle>
                <DialogDescription>
                  Inserisci i dettagli del rischio e usa l'AI per stimare probabilità e impatto
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="title">Titolo *</Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="description">Descrizione</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={3}
                  />
                </div>

                <div className="flex justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleAISuggest}
                    disabled={aiLoading}
                  >
                    {aiLoading ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <>🤖 Suggerisci Stima AI</>
                    )}
                  </Button>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="probability">Probabilità</Label>
                    <Select
                      value={formData.probability}
                      onValueChange={(value) => setFormData({ ...formData, probability: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="very_low">Molto Bassa</SelectItem>
                        <SelectItem value="low">Bassa</SelectItem>
                        <SelectItem value="medium">Media</SelectItem>
                        <SelectItem value="high">Alta</SelectItem>
                        <SelectItem value="very_high">Molto Alta</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="impact">Impatto</Label>
                    <Select
                      value={formData.impact}
                      onValueChange={(value) => setFormData({ ...formData, impact: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="very_low">Molto Basso</SelectItem>
                        <SelectItem value="low">Basso</SelectItem>
                        <SelectItem value="medium">Medio</SelectItem>
                        <SelectItem value="high">Alto</SelectItem>
                        <SelectItem value="very_high">Molto Alto</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label htmlFor="mitigation_plan">Piano di Mitigazione</Label>
                  <Textarea
                    id="mitigation_plan"
                    value={formData.mitigation_plan}
                    onChange={(e) => setFormData({ ...formData, mitigation_plan: e.target.value })}
                    rows={3}
                  />
                </div>

                <div className="flex justify-end gap-3">
                  <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                    Annulla
                  </Button>
                  <Button type="submit">Crea Rischio</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {risks.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <AlertTriangle className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Nessun rischio registrato</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {risks.map((risk) => {
            const score = getRiskScore(risk.probability, risk.impact);
            return (
              <Card key={risk.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-lg">{risk.title}</CardTitle>
                    <Badge className={getRiskColor(score)}>
                      Score: {score}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {risk.description && (
                    <p className="text-sm text-muted-foreground">{risk.description}</p>
                  )}
                  <div className="flex gap-2">
                    <Badge variant="outline">
                      {probabilityLabels[risk.probability as keyof typeof probabilityLabels]}
                    </Badge>
                    <Badge variant="outline">
                      {impactLabels[risk.impact as keyof typeof impactLabels]}
                    </Badge>
                    <Badge variant="secondary">
                      {statusLabels[risk.status as keyof typeof statusLabels]}
                    </Badge>
                  </div>
                  {risk.mitigation_plan && (
                    <div className="text-sm">
                      <span className="font-medium">Mitigazione: </span>
                      <span className="text-muted-foreground">{risk.mitigation_plan}</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
