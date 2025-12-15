import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, ChevronDown, ChevronRight, TrendingUp, Calendar as CalendarIcon, Eye, EyeOff, Lock, Upload, BarChart3, LineChart, PieChart, Trash2, Info, Pencil } from "lucide-react";
import { useUserRole } from "@/hooks/useUserRole";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { MetricTrendChart } from "./impact/MetricTrendChart";
import { MetricComparisonChart } from "./impact/MetricComparisonChart";
import { MetricCompositionChart } from "./impact/MetricCompositionChart";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface ImpactArea {
  id: string;
  name: string;
  description: string | null;
  investment_budget: number | null;
  investment_period: string | null;
  visibility_scope: "shared" | "internal_only";
  metrics?: ImpactMetric[];
}

interface ImpactMetric {
  id: string;
  area_id: string;
  name: string;
  unit: "number" | "currency" | "percentage";
  frequency: string | null;
  baseline_value: number | null;
  target_value: number | null;
  entries?: MetricEntry[];
}

interface MetricEntry {
  id: string;
  metric_id: string;
  date: string;
  value: number;
  is_published: boolean;
  created_at: string;
}

interface BusinessImpactTabProps {
  projectId: string;
}

export function BusinessImpactTab({ projectId }: BusinessImpactTabProps) {
  const [areas, setAreas] = useState<ImpactArea[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedAreas, setExpandedAreas] = useState<Set<string>>(new Set());
  const [expandedMetrics, setExpandedMetrics] = useState<Set<string>>(new Set());
  const [isAreaDialogOpen, setIsAreaDialogOpen] = useState(false);
  const [isMetricDialogOpen, setIsMetricDialogOpen] = useState(false);
  const [isEntryDialogOpen, setIsEntryDialogOpen] = useState(false);
  const [selectedAreaId, setSelectedAreaId] = useState<string | null>(null);
  const [selectedMetric, setSelectedMetric] = useState<ImpactMetric | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [selectedEntries, setSelectedEntries] = useState<Set<string>>(new Set());
  const [activeView, setActiveView] = useState<"dashboard" | "data">("dashboard");
  const [deleteAreaId, setDeleteAreaId] = useState<string | null>(null);
  const [areaToDelete, setAreaToDelete] = useState<ImpactArea | null>(null);
  const [editingArea, setEditingArea] = useState<ImpactArea | null>(null);
  const [editingEntry, setEditingEntry] = useState<MetricEntry | null>(null);
  const [editingMetric, setEditingMetric] = useState<ImpactMetric | null>(null);
  const [entryToDelete, setEntryToDelete] = useState<MetricEntry | null>(null);
  const [editEntryDate, setEditEntryDate] = useState<Date | undefined>(undefined);
  const [editEntryValue, setEditEntryValue] = useState<string>("");
  const [editEntryPublished, setEditEntryPublished] = useState<boolean>(false);
  const { toast } = useToast();
  const { isSuperAdmin, isAdmin, isProjectManager, isClient } = useUserRole();

  const canManage = (isSuperAdmin || isAdmin || isProjectManager) && !isClient;

  useEffect(() => {
    fetchAreas();
  }, [projectId]);

  const fetchAreas = async () => {
    try {
      const { data: areasData, error: areasError } = await supabase
        .from("impact_areas")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: true });

      if (areasError) throw areasError;

      const { data: metricsData, error: metricsError } = await supabase
        .from("impact_metrics")
        .select("*")
        .in("area_id", areasData?.map(a => a.id) || [])
        .order("created_at", { ascending: true });

      if (metricsError) throw metricsError;

      const { data: entriesData, error: entriesError } = await supabase
        .from("metric_entries")
        .select("*")
        .in("metric_id", metricsData?.map(m => m.id) || [])
        .order("date", { ascending: false });

      if (entriesError) throw entriesError;

      const metricsWithEntries = metricsData?.map(metric => ({
        ...metric,
        entries: entriesData?.filter(e => e.metric_id === metric.id) || []
      })) || [];

      const areasWithMetrics = areasData?.map(area => ({
        ...area,
        visibility_scope: area.visibility_scope as "shared" | "internal_only",
        metrics: metricsWithEntries.filter(m => m.area_id === area.id) || []
      })) || [];

      setAreas(areasWithMetrics);
    } catch (error) {
      console.error("Error fetching impact areas:", error);
      toast({
        title: "Errore",
        description: "Impossibile caricare le aree di impatto",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateArea = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    try {
      const investmentBudget = formData.get("investment_budget") as string;
      
      const { error } = await supabase
        .from("impact_areas")
        .insert({
          project_id: projectId,
          name: formData.get("name") as string,
          description: formData.get("description") as string || null,
          investment_budget: investmentBudget ? parseFloat(investmentBudget) : null,
          investment_period: formData.get("investment_period") as string || "Totale",
          visibility_scope: formData.get("visibility_scope") as string || "shared",
        });

      if (error) throw error;

      toast({
        title: "Successo",
        description: "Area creata con successo",
      });

      setIsAreaDialogOpen(false);
      fetchAreas();
    } catch (error) {
      console.error("Error creating area:", error);
      toast({
        title: "Errore",
        description: "Impossibile creare l'area",
        variant: "destructive",
      });
    }
  };

  const handleUpdateArea = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingArea) return;
    
    const formData = new FormData(e.currentTarget);
    
    try {
      const investmentBudget = formData.get("investment_budget") as string;
      
      const { error } = await supabase
        .from("impact_areas")
        .update({
          name: formData.get("name") as string,
          description: formData.get("description") as string || null,
          investment_budget: investmentBudget ? parseFloat(investmentBudget) : null,
          investment_period: formData.get("investment_period") as string || "Totale",
          visibility_scope: formData.get("visibility_scope") as string || "shared",
        })
        .eq("id", editingArea.id);

      if (error) throw error;

      toast({
        title: "Successo",
        description: "Area aggiornata con successo",
      });

      setEditingArea(null);
      fetchAreas();
    } catch (error) {
      console.error("Error updating area:", error);
      toast({
        title: "Errore",
        description: "Impossibile aggiornare l'area",
        variant: "destructive",
      });
    }
  };

  const handleCreateMetric = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    if (!selectedAreaId) return;

    try {
      const baselineValue = formData.get("baseline_value") as string;
      const targetValue = formData.get("target_value") as string;

      const { error } = await supabase
        .from("impact_metrics")
        .insert({
          area_id: selectedAreaId,
          name: formData.get("name") as string,
          unit: formData.get("unit") as "number" | "currency" | "percentage",
          frequency: formData.get("frequency") as string || null,
          baseline_value: baselineValue ? parseFloat(baselineValue) : null,
          target_value: targetValue ? parseFloat(targetValue) : null,
        });

      if (error) throw error;

      toast({
        title: "Successo",
        description: "Metrica creata con successo",
      });

      setIsMetricDialogOpen(false);
      setSelectedAreaId(null);
      fetchAreas();
    } catch (error) {
      console.error("Error creating metric:", error);
      toast({
        title: "Errore",
        description: "Impossibile creare la metrica",
        variant: "destructive",
      });
    }
  };

  const handleUpdateMetric = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingMetric) return;
    
    const formData = new FormData(e.currentTarget);
    
    try {
      const baselineValue = formData.get("baseline_value") as string;
      const targetValue = formData.get("target_value") as string;

      const { error } = await supabase
        .from("impact_metrics")
        .update({
          name: formData.get("name") as string,
          unit: formData.get("unit") as "number" | "currency" | "percentage",
          frequency: formData.get("frequency") as string || null,
          baseline_value: baselineValue ? parseFloat(baselineValue) : null,
          target_value: targetValue ? parseFloat(targetValue) : null,
        })
        .eq("id", editingMetric.id);

      if (error) throw error;

      toast({
        title: "Successo",
        description: "Metrica aggiornata con successo",
      });

      setEditingMetric(null);
      fetchAreas();
    } catch (error) {
      console.error("Error updating metric:", error);
      toast({
        title: "Errore",
        description: "Impossibile aggiornare la metrica",
        variant: "destructive",
      });
    }
  };

  const handleCreateEntry = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    if (!selectedMetric || !selectedDate) return;

    try {
      const value = formData.get("value") as string;

      const { error } = await supabase
        .from("metric_entries")
        .insert({
          metric_id: selectedMetric.id,
          date: format(selectedDate, "yyyy-MM-dd"),
          value: parseFloat(value),
          is_published: false,
        });

      if (error) throw error;

      toast({
        title: "Successo",
        description: "Rilevazione aggiunta con successo",
      });

      setIsEntryDialogOpen(false);
      setSelectedMetric(null);
      setSelectedDate(new Date());
      fetchAreas();
    } catch (error) {
      console.error("Error creating entry:", error);
      toast({
        title: "Errore",
        description: "Impossibile aggiungere la rilevazione",
        variant: "destructive",
      });
    }
  };

  const handleEditEntry = (entry: MetricEntry) => {
    setEditingEntry(entry);
    setEditEntryDate(new Date(entry.date));
    setEditEntryValue(entry.value.toString());
    setEditEntryPublished(entry.is_published);
  };

  const handleUpdateEntry = async () => {
    if (!editingEntry || !editEntryDate) return;

    try {
      const { error } = await supabase
        .from("metric_entries")
        .update({
          date: format(editEntryDate, "yyyy-MM-dd"),
          value: parseFloat(editEntryValue),
          is_published: editEntryPublished,
        })
        .eq("id", editingEntry.id);

      if (error) throw error;

      toast({
        title: "Successo",
        description: "Rilevazione aggiornata con successo",
      });

      setEditingEntry(null);
      fetchAreas();
    } catch (error) {
      console.error("Error updating entry:", error);
      toast({
        title: "Errore",
        description: "Impossibile aggiornare la rilevazione",
        variant: "destructive",
      });
    }
  };

  const handleDeleteEntry = async () => {
    if (!entryToDelete) return;

    try {
      const { error } = await supabase
        .from("metric_entries")
        .delete()
        .eq("id", entryToDelete.id);

      if (error) throw error;

      toast({
        title: "Successo",
        description: "Rilevazione eliminata con successo",
      });

      setEntryToDelete(null);
      fetchAreas();
    } catch (error) {
      console.error("Error deleting entry:", error);
      toast({
        title: "Errore",
        description: "Impossibile eliminare la rilevazione",
        variant: "destructive",
      });
    }
  };

  const handleTogglePublish = async (entryId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from("metric_entries")
        .update({ is_published: !currentStatus })
        .eq("id", entryId);

      if (error) throw error;

      toast({
        title: "Successo",
        description: !currentStatus ? "Dato pubblicato" : "Dato nascosto",
      });

      fetchAreas();
    } catch (error) {
      console.error("Error toggling publish:", error);
      toast({
        title: "Errore",
        description: "Impossibile modificare lo stato di pubblicazione",
        variant: "destructive",
      });
    }
  };

  const handlePublishSelected = async () => {
    if (selectedEntries.size === 0) return;

    try {
      const { error } = await supabase
        .from("metric_entries")
        .update({ is_published: true })
        .in("id", Array.from(selectedEntries));

      if (error) throw error;

      toast({
        title: "Successo",
        description: `${selectedEntries.size} rilevazioni pubblicate`,
      });

      setSelectedEntries(new Set());
      fetchAreas();
    } catch (error) {
      console.error("Error publishing entries:", error);
      toast({
        title: "Errore",
        description: "Impossibile pubblicare le rilevazioni",
        variant: "destructive",
      });
    }
  };

  const handleDeleteArea = async () => {
    if (!deleteAreaId) return;

    try {
      // Delete area - cascading deletes will remove metrics and entries
      const { error } = await supabase
        .from("impact_areas")
        .delete()
        .eq("id", deleteAreaId);

      if (error) throw error;

      toast({
        title: "Successo",
        description: "Area eliminata con successo",
      });

      setDeleteAreaId(null);
      setAreaToDelete(null);
      fetchAreas();
    } catch (error) {
      console.error("Error deleting area:", error);
      toast({
        title: "Errore",
        description: "Impossibile eliminare l'area",
        variant: "destructive",
      });
    }
  };

  const toggleArea = (areaId: string) => {
    setExpandedAreas(prev => {
      const newSet = new Set(prev);
      if (newSet.has(areaId)) {
        newSet.delete(areaId);
      } else {
        newSet.add(areaId);
      }
      return newSet;
    });
  };

  const toggleMetric = (metricId: string) => {
    setExpandedMetrics(prev => {
      const newSet = new Set(prev);
      if (newSet.has(metricId)) {
        newSet.delete(metricId);
      } else {
        newSet.add(metricId);
      }
      return newSet;
    });
  };

  const toggleEntrySelection = (entryId: string) => {
    setSelectedEntries(prev => {
      const newSet = new Set(prev);
      if (newSet.has(entryId)) {
        newSet.delete(entryId);
      } else {
        newSet.add(entryId);
      }
      return newSet;
    });
  };

  const getUnitLabel = (unit: string) => {
    switch (unit) {
      case "number": return "Numero";
      case "currency": return "Valuta (€)";
      case "percentage": return "Percentuale (%)";
      default: return unit;
    }
  };

  const formatValue = (value: number, unit: string) => {
    switch (unit) {
      case "currency": return `€${value.toFixed(2)}`;
      case "percentage": return `${value}%`;
      default: return value.toString();
    }
  };

  const calculateEfficiencyMetric = (
    investment: number | null,
    baseline: number | null,
    currentValue: number,
    unit: "number" | "currency" | "percentage",
    metricName: string
  ) => {
    if (!investment || investment === 0) return null;
    
    const delta = baseline !== null ? currentValue - baseline : currentValue;
    
    if (delta <= 0) return null;

    if (unit === "currency") {
      // Calculate ROAS/ROI for currency metrics
      const roi = (delta / investment) * 100;
      return {
        type: "roi" as const,
        value: roi,
        label: roi >= 100 ? `ROAS: ${(delta / investment).toFixed(2)}x` : `ROI: +${roi.toFixed(1)}%`,
        tooltip: `Calcolato su un investimento di €${investment.toFixed(2)}. Crescita: €${delta.toFixed(2)}`
      };
    } else {
      // Calculate Cost Per Unit for number/percentage metrics
      const cpu = investment / delta;
      return {
        type: "cpu" as const,
        value: cpu,
        label: `€${cpu.toFixed(2)} per ${metricName}`,
        tooltip: `Costo unitario calcolato su ${delta.toFixed(0)} unità con investimento di €${investment.toFixed(2)}`
      };
    }
  };

  if (loading) {
    return <div className="p-6">Caricamento...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold">Business Impact & ROI</h3>
          <p className="text-sm text-muted-foreground">
            Traccia KPI e metriche di impatto economico del progetto
          </p>
        </div>
        <div className="flex gap-2">
          {canManage && selectedEntries.size > 0 && (
            <Button variant="default" onClick={handlePublishSelected}>
              <Upload className="mr-2 h-4 w-4" />
              Pubblica {selectedEntries.size} Selezionate
            </Button>
          )}
          {canManage && (
            <Dialog open={isAreaDialogOpen} onOpenChange={setIsAreaDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Aggiungi Area Operativa
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Nuova Area di Impatto</DialogTitle>
                  <DialogDescription>
                    Definisci una categoria macro per raggruppare le metriche e tracciare l'investimento
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleCreateArea} className="space-y-6">
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="name">Nome Area *</Label>
                      <Input id="name" name="name" placeholder="es. Social Media, Vendite" required />
                    </div>
                    <div>
                      <Label htmlFor="description">Descrizione</Label>
                      <Textarea id="description" name="description" placeholder="Descrizione opzionale" />
                    </div>
                  </div>

                  <div className="border-t pt-4">
                    <h4 className="text-sm font-semibold mb-3">Dati di Investimento</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="investment_budget">Budget Investito (€)</Label>
                        <Input 
                          id="investment_budget" 
                          name="investment_budget" 
                          type="number" 
                          step="0.01" 
                          placeholder="0.00"
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          Il costo sostenuto per quest'area
                        </p>
                      </div>
                      <div>
                        <Label htmlFor="investment_period">Periodo Budget</Label>
                        <Select name="investment_period" defaultValue="Totale">
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Totale">Totale Progetto</SelectItem>
                            <SelectItem value="Mensile">Mensile</SelectItem>
                            <SelectItem value="Trimestrale">Trimestrale</SelectItem>
                            <SelectItem value="Annuale">Annuale</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>

                  <div className="border-t pt-4">
                    <h4 className="text-sm font-semibold mb-3">Visibilità Area</h4>
                    <div>
                      <Label htmlFor="visibility_scope">Chi può vedere quest'area?</Label>
                      <Select name="visibility_scope" defaultValue="shared">
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="shared">
                            <div className="flex items-center gap-2">
                              <Eye className="h-4 w-4" />
                              <div>
                                <div className="font-medium">Condivisa con Cliente</div>
                                <div className="text-xs text-muted-foreground">Visibile a tutti i membri del progetto</div>
                              </div>
                            </div>
                          </SelectItem>
                          <SelectItem value="internal_only">
                            <div className="flex items-center gap-2">
                              <Lock className="h-4 w-4" />
                              <div>
                                <div className="font-medium">Riservata Interna</div>
                                <div className="text-xs text-muted-foreground">Visibile solo al team (Admin, PM)</div>
                              </div>
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground mt-2">
                        Le aree interne sono utili per KPI di gestione come Budget Variance o Profittabilità
                      </p>
                    </div>
                  </div>

                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={() => setIsAreaDialogOpen(false)}>
                      Annulla
                    </Button>
                    <Button type="submit">Crea Area</Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      <Tabs value={activeView} onValueChange={(v) => setActiveView(v as "dashboard" | "data")}>
        <TabsList>
          <TabsTrigger value="dashboard">
            <BarChart3 className="mr-2 h-4 w-4" />
            Dashboard Performance
          </TabsTrigger>
          <TabsTrigger value="data">
            Registro Dati
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="mt-6">
          {areas.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <TrendingUp className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground text-center">
                  Nessuna area di impatto configurata.
                  {canManage && " Inizia creando la prima area operativa."}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-6">
              {areas.map(area => {
                const metricsWithData = area.metrics?.filter(m => m.entries && m.entries.length > 0) || [];
                const visibleMetrics = isClient
                  ? metricsWithData.filter(m => m.entries?.some(e => e.is_published))
                  : metricsWithData;

                if (visibleMetrics.length === 0) {
                  return isClient ? null : (
                    <Card key={area.id}>
                      <CardHeader>
                        <CardTitle>{area.name}</CardTitle>
                        <CardDescription>Nessun dato disponibile per questa area</CardDescription>
                      </CardHeader>
                    </Card>
                  );
                }

                return (
                  <Card key={area.id}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          <div>
                            <div className="flex items-center gap-2">
                              <CardTitle>{area.name}</CardTitle>
                              {area.visibility_scope === "internal_only" && (
                                <Badge variant="secondary" className="bg-destructive/10 text-destructive border-destructive/20">
                                  <Lock className="h-3 w-3 mr-1" />
                                  INTERNO
                                </Badge>
                              )}
                            </div>
                            {area.description && <CardDescription>{area.description}</CardDescription>}
                          </div>
                        </div>
                        {canManage && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setAreaToDelete(area);
                              setDeleteAreaId(area.id);
                            }}
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-8">
                      {area.investment_budget && (
                        <div className="bg-muted/50 rounded-lg p-4 border">
                          <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                            💰 Investimento
                          </h4>
                          <div className="flex items-baseline gap-2">
                            <span className="text-2xl font-bold">€{area.investment_budget.toFixed(2)}</span>
                            <span className="text-sm text-muted-foreground">({area.investment_period})</span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            Budget allocato per quest'area operativa
                          </p>
                        </div>
                      )}
                      {visibleMetrics.map(metric => {
                        const filteredEntries = isClient 
                          ? metric.entries?.filter(e => e.is_published) || []
                          : metric.entries || [];
                        
                        const latestEntry = filteredEntries.length > 0
                          ? filteredEntries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0]
                          : null;
                        
                        const efficiencyMetric = latestEntry && area.investment_budget
                          ? calculateEfficiencyMetric(
                              area.investment_budget,
                              metric.baseline_value,
                              latestEntry.value,
                              metric.unit,
                              metric.name
                            )
                          : null;

                        return (
                        <div key={metric.id} className="space-y-6">
                          <div className="flex items-center justify-between">
                            <h4 className="text-sm font-semibold">{metric.name}</h4>
                            {efficiencyMetric && (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Badge 
                                      variant="secondary"
                                      className={cn(
                                        "gap-1 font-semibold",
                                        efficiencyMetric.type === "roi" && "bg-success/10 text-success border-success/20 hover:bg-success/20",
                                        efficiencyMetric.type === "cpu" && "bg-primary/10 text-primary border-primary/20 hover:bg-primary/20"
                                      )}
                                    >
                                      {efficiencyMetric.label}
                                      <Info className="h-3 w-3 ml-1" />
                                    </Badge>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p className="text-xs">{efficiencyMetric.tooltip}</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
                          </div>
                          <Tabs defaultValue="trend" className="w-full">
                            <TabsList className="grid w-full grid-cols-3">
                              <TabsTrigger value="trend">
                                <LineChart className="mr-2 h-4 w-4" />
                                Trend
                              </TabsTrigger>
                              <TabsTrigger value="comparison">
                                <BarChart3 className="mr-2 h-4 w-4" />
                                ROI
                              </TabsTrigger>
                              <TabsTrigger value="composition">
                                <PieChart className="mr-2 h-4 w-4" />
                                Composizione
                              </TabsTrigger>
                            </TabsList>

                            <TabsContent value="trend" className="mt-4">
                              <MetricTrendChart
                                entries={metric.entries || []}
                                metricName={metric.name}
                                unit={metric.unit}
                                targetValue={metric.target_value}
                                isClient={isClient}
                              />
                            </TabsContent>

                            <TabsContent value="comparison" className="mt-4">
                              {metric.baseline_value === null ? (
                                <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                                  <BarChart3 className="h-10 w-10 mb-3 opacity-50" />
                                  <p className="text-sm text-center">
                                    Nessun dato Baseline configurato per questa metrica.
                                  </p>
                                  <p className="text-xs text-center mt-1">
                                    Imposta il "Dato di Partenza (Start)" nella creazione della metrica per abilitare il confronto ROI.
                                  </p>
                                </div>
                              ) : (
                                <MetricComparisonChart
                                  entries={metric.entries || []}
                                  metricName={metric.name}
                                  unit={metric.unit}
                                  baselineValue={metric.baseline_value}
                                  isClient={isClient}
                                />
                              )}
                            </TabsContent>

                            <TabsContent value="composition" className="mt-4">
                              {visibleMetrics.length < 2 ? (
                                <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                                  <PieChart className="h-10 w-10 mb-3 opacity-50" />
                                  <p className="text-sm text-center">
                                    Aggiungi almeno 2 metriche per visualizzare un grafico di composizione.
                                  </p>
                                  <p className="text-xs text-center mt-1">
                                    Il grafico mostra la distribuzione relativa tra più metriche della stessa area.
                                  </p>
                                </div>
                              ) : (
                                <MetricCompositionChart
                                  metrics={visibleMetrics
                                    .filter(m => m.entries && m.entries.length > 0)
                                    .map(m => ({
                                      id: m.id,
                                      name: m.name,
                                      unit: m.unit,
                                      latestValue: (isClient 
                                        ? m.entries?.filter(e => e.is_published)
                                        : m.entries
                                      )?.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0]?.value || 0
                                    }))}
                                  areaName={area.name}
                                />
                              )}
                            </TabsContent>
                          </Tabs>
                        </div>
                        );
                      })}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="data" className="mt-6">
          {areas.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <TrendingUp className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground text-center">
                  Nessuna area di impatto configurata.
                  {canManage && " Inizia creando la prima area operativa."}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {areas.map(area => (
            <Card key={area.id}>
              <Collapsible open={expandedAreas.has(area.id)} onOpenChange={() => toggleArea(area.id)}>
                <CardHeader className="cursor-pointer" onClick={() => toggleArea(area.id)}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 flex-1">
                      {expandedAreas.has(area.id) ? (
                        <ChevronDown className="h-5 w-5 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-5 w-5 text-muted-foreground" />
                      )}
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <CardTitle>{area.name}</CardTitle>
                          {area.visibility_scope === "internal_only" && (
                            <Badge variant="secondary" className="bg-destructive/10 text-destructive border-destructive/20">
                              <Lock className="h-3 w-3 mr-1" />
                              INTERNO
                            </Badge>
                          )}
                          {area.investment_budget && (
                            <Badge variant="secondary">
                              💰 €{area.investment_budget.toFixed(0)}
                            </Badge>
                          )}
                        </div>
                        {area.description && (
                          <CardDescription className="mt-1">{area.description}</CardDescription>
                        )}
                      </div>
                    </div>
                    {canManage && (
                      <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => setEditingArea(area)}
                          title="Modifica area"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => {
                            setAreaToDelete(area);
                            setDeleteAreaId(area.id);
                          }}
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          title="Elimina area"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSelectedAreaId(area.id);
                            setIsMetricDialogOpen(true);
                          }}
                        >
                          <Plus className="mr-2 h-4 w-4" />
                          Aggiungi Metrica
                        </Button>
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CollapsibleTrigger asChild>
                  <div />
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent>
                    {area.metrics && area.metrics.length > 0 ? (
                      <div className="space-y-4">
                        {area.metrics.map(metric => (
                          <Card key={metric.id} className="border-muted">
                            <Collapsible open={expandedMetrics.has(metric.id)} onOpenChange={() => toggleMetric(metric.id)}>
                              <CardHeader className="cursor-pointer pb-3" onClick={() => toggleMetric(metric.id)}>
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    {expandedMetrics.has(metric.id) ? (
                                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                    ) : (
                                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                    )}
                                    <div>
                                      <h4 className="font-medium">{metric.name}</h4>
                                      <div className="flex gap-3 text-sm text-muted-foreground mt-1">
                                        <span>{getUnitLabel(metric.unit)}</span>
                                        {metric.frequency && <span>• {metric.frequency}</span>}
                                        {metric.entries && metric.entries.length > 0 && (
                                          <span>• {metric.entries.length} rilevazioni</span>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                  {canManage && (
                                    <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => setEditingMetric(metric)}
                                        title="Modifica metrica"
                                      >
                                        <Pencil className="h-4 w-4" />
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => {
                                          setSelectedMetric(metric);
                                          setIsEntryDialogOpen(true);
                                        }}
                                      >
                                        <Plus className="mr-2 h-3 w-3" />
                                        Aggiungi Rilevazione
                                      </Button>
                                    </div>
                                  )}
                                </div>
                              </CardHeader>
                              <CollapsibleTrigger asChild>
                                <div />
                              </CollapsibleTrigger>
                              <CollapsibleContent>
                                <CardContent className="pt-0">
                                  {metric.entries && metric.entries.length > 0 ? (
                                    <div className="space-y-2">
                                      {metric.entries.map(entry => (
                                        <div key={entry.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                                          <div className="flex items-center gap-4">
                                            {canManage && (
                                              <input
                                                type="checkbox"
                                                checked={selectedEntries.has(entry.id)}
                                                onChange={() => toggleEntrySelection(entry.id)}
                                                className="h-4 w-4"
                                              />
                                            )}
                                            <div>
                                              <div className="flex items-center gap-2">
                                                <span className="font-medium">{format(new Date(entry.date), "dd MMM yyyy", { locale: it })}</span>
                                                {!entry.is_published ? (
                                                  <Badge variant="outline" className="gap-1">
                                                    <Lock className="h-3 w-3" />
                                                    Privato
                                                  </Badge>
                                                ) : (
                                                  <Badge variant="default" className="gap-1 bg-success">
                                                    <Eye className="h-3 w-3" />
                                                    Pubblicato
                                                  </Badge>
                                                )}
                                              </div>
                                              <p className="text-sm text-muted-foreground">
                                                Valore: {formatValue(entry.value, metric.unit)}
                                              </p>
                                            </div>
                                          </div>
                                          {canManage && (
                                            <div className="flex items-center gap-1">
                                              <Button
                                                size="sm"
                                                variant="ghost"
                                                onClick={() => handleEditEntry(entry)}
                                                title="Modifica rilevazione"
                                              >
                                                <Pencil className="h-4 w-4" />
                                              </Button>
                                              <Button
                                                size="sm"
                                                variant="ghost"
                                                onClick={() => handleTogglePublish(entry.id, entry.is_published)}
                                                title={entry.is_published ? "Nascondi" : "Pubblica"}
                                              >
                                                {entry.is_published ? (
                                                  <EyeOff className="h-4 w-4" />
                                                ) : (
                                                  <Eye className="h-4 w-4" />
                                                )}
                                              </Button>
                                              <Button
                                                size="sm"
                                                variant="ghost"
                                                onClick={() => setEntryToDelete(entry)}
                                                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                                title="Elimina rilevazione"
                                              >
                                                <Trash2 className="h-4 w-4" />
                                              </Button>
                                            </div>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <p className="text-sm text-muted-foreground text-center py-4">
                                      Nessuna rilevazione inserita
                                    </p>
                                  )}
                                </CardContent>
                              </CollapsibleContent>
                            </Collapsible>
                          </Card>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        Nessuna metrica configurata per questa area
                      </p>
                    )}
                  </CardContent>
                </CollapsibleContent>
              </Collapsible>
            </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={isMetricDialogOpen} onOpenChange={setIsMetricDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nuova Metrica</DialogTitle>
            <DialogDescription>
              Definisci una metrica da tracciare nel tempo
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateMetric} className="space-y-4">
            <div>
              <Label htmlFor="metric-name">Nome Metrica *</Label>
              <Input id="metric-name" name="name" placeholder="es. Follower Instagram, Fatturato" required />
            </div>
            <div>
              <Label htmlFor="unit">Unità di Misura *</Label>
              <Select name="unit" required>
                <SelectTrigger>
                  <SelectValue placeholder="Seleziona unità" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="number">Numero</SelectItem>
                  <SelectItem value="currency">Valuta (€)</SelectItem>
                  <SelectItem value="percentage">Percentuale (%)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="frequency">Frequenza di Rilevazione</Label>
              <Input id="frequency" name="frequency" placeholder="es. Mensile, Settimanale" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="baseline_value">Dato di Partenza (opzionale)</Label>
                <Input id="baseline_value" name="baseline_value" type="number" step="0.01" placeholder="0" />
                <p className="text-xs text-muted-foreground mt-1">
                  Valore storico iniziale, non il costo
                </p>
              </div>
              <div>
                <Label htmlFor="target_value">Obiettivo (opzionale)</Label>
                <Input id="target_value" name="target_value" type="number" step="0.01" placeholder="0" />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setIsMetricDialogOpen(false)}>
                Annulla
              </Button>
              <Button type="submit">Crea Metrica</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isEntryDialogOpen} onOpenChange={setIsEntryDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nuova Rilevazione</DialogTitle>
            <DialogDescription>
              Inserisci il valore rilevato per {selectedMetric?.name}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateEntry} className="space-y-4">
            <div>
              <Label>Data Rilevazione *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !selectedDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {selectedDate ? format(selectedDate, "PPP", { locale: it }) : "Seleziona data"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={setSelectedDate}
                    locale={it}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div>
              <Label htmlFor="value">Valore Rilevato *</Label>
              <Input
                id="value"
                name="value"
                type="number"
                step="0.01"
                placeholder={selectedMetric ? getUnitLabel(selectedMetric.unit) : "Valore"}
                required
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setIsEntryDialogOpen(false)}>
                Annulla
              </Button>
              <Button type="submit">Salva Rilevazione</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteAreaId !== null} onOpenChange={(open) => {
        if (!open) {
          setDeleteAreaId(null);
          setAreaToDelete(null);
        }
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Conferma Eliminazione Area</AlertDialogTitle>
            <AlertDialogDescription>
              Sei sicuro di voler eliminare l'area <strong>"{areaToDelete?.name}"</strong>?
              <br /><br />
              Verranno eliminate anche:
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>Tutte le metriche associate</li>
                <li>Tutti i dati di rilevazione inseriti</li>
              </ul>
              <br />
              <strong>Questa azione è irreversibile.</strong>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setDeleteAreaId(null);
              setAreaToDelete(null);
            }}>
              Annulla
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteArea}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Elimina Area
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit Entry Dialog */}
      <Dialog open={editingEntry !== null} onOpenChange={(open) => {
        if (!open) setEditingEntry(null);
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifica Rilevazione</DialogTitle>
            <DialogDescription>
              Modifica i dati della rilevazione selezionata
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Data Rilevazione *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !editEntryDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {editEntryDate ? format(editEntryDate, "PPP", { locale: it }) : "Seleziona data"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={editEntryDate}
                    onSelect={setEditEntryDate}
                    locale={it}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div>
              <Label htmlFor="edit_value">Valore Rilevato *</Label>
              <Input
                id="edit_value"
                type="number"
                step="0.01"
                value={editEntryValue}
                onChange={(e) => setEditEntryValue(e.target.value)}
                placeholder="Valore"
                required
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="edit_published"
                checked={editEntryPublished}
                onChange={(e) => setEditEntryPublished(e.target.checked)}
                className="h-4 w-4"
              />
              <Label htmlFor="edit_published" className="cursor-pointer">
                Pubblica rilevazione (visibile ai clienti)
              </Label>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setEditingEntry(null)}>
                Annulla
              </Button>
              <Button onClick={handleUpdateEntry}>Salva Modifiche</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Entry Confirmation */}
      <AlertDialog open={entryToDelete !== null} onOpenChange={(open) => {
        if (!open) setEntryToDelete(null);
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Conferma Eliminazione Rilevazione</AlertDialogTitle>
            <AlertDialogDescription>
              Sei sicuro di voler eliminare la rilevazione del{" "}
              <strong>{entryToDelete ? format(new Date(entryToDelete.date), "dd MMMM yyyy", { locale: it }) : ""}</strong>
              {" "}con valore <strong>{entryToDelete?.value}</strong>?
              <br /><br />
              <strong>Questa azione è irreversibile.</strong>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setEntryToDelete(null)}>
              Annulla
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteEntry}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Elimina Rilevazione
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit Area Dialog */}
      <Dialog open={editingArea !== null} onOpenChange={(open) => {
        if (!open) setEditingArea(null);
      }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Modifica Area di Impatto</DialogTitle>
            <DialogDescription>
              Modifica i dettagli dell'area operativa
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUpdateArea} className="space-y-6">
            <div className="space-y-4">
              <div>
                <Label htmlFor="edit_name">Nome Area *</Label>
                <Input 
                  id="edit_name" 
                  name="name" 
                  defaultValue={editingArea?.name || ""} 
                  placeholder="es. Social Media, Vendite" 
                  required 
                />
              </div>
              <div>
                <Label htmlFor="edit_description">Descrizione</Label>
                <Textarea 
                  id="edit_description" 
                  name="description" 
                  defaultValue={editingArea?.description || ""} 
                  placeholder="Descrizione opzionale" 
                />
              </div>
            </div>

            <div className="border-t pt-4">
              <h4 className="text-sm font-semibold mb-3">Dati di Investimento</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="edit_investment_budget">Budget Investito (€)</Label>
                  <Input 
                    id="edit_investment_budget" 
                    name="investment_budget" 
                    type="number" 
                    step="0.01" 
                    defaultValue={editingArea?.investment_budget || ""}
                    placeholder="0.00"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Il costo sostenuto per quest'area
                  </p>
                </div>
                <div>
                  <Label htmlFor="edit_investment_period">Periodo Budget</Label>
                  <Select name="investment_period" defaultValue={editingArea?.investment_period || "Totale"}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Totale">Totale Progetto</SelectItem>
                      <SelectItem value="Mensile">Mensile</SelectItem>
                      <SelectItem value="Trimestrale">Trimestrale</SelectItem>
                      <SelectItem value="Annuale">Annuale</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <div className="border-t pt-4">
              <h4 className="text-sm font-semibold mb-3">Visibilità</h4>
              <Select name="visibility_scope" defaultValue={editingArea?.visibility_scope || "shared"}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="shared">Condivisa (visibile ai clienti)</SelectItem>
                  <SelectItem value="internal_only">Solo Interno (nascosta ai clienti)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setEditingArea(null)}>
                Annulla
              </Button>
              <Button type="submit">Salva Modifiche</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Metric Dialog */}
      <Dialog open={editingMetric !== null} onOpenChange={(open) => {
        if (!open) setEditingMetric(null);
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifica Metrica</DialogTitle>
            <DialogDescription>
              Modifica i parametri della metrica selezionata
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUpdateMetric} className="space-y-4">
            <div>
              <Label htmlFor="edit-metric-name">Nome Metrica *</Label>
              <Input 
                id="edit-metric-name" 
                name="name" 
                defaultValue={editingMetric?.name || ""} 
                placeholder="es. Follower Instagram, Fatturato" 
                required 
              />
            </div>
            <div>
              <Label htmlFor="edit-unit">Unità di Misura *</Label>
              <Select name="unit" defaultValue={editingMetric?.unit || "number"}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleziona unità" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="number">Numero</SelectItem>
                  <SelectItem value="currency">Valuta (€)</SelectItem>
                  <SelectItem value="percentage">Percentuale (%)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="edit-frequency">Frequenza di Rilevazione</Label>
              <Input 
                id="edit-frequency" 
                name="frequency" 
                defaultValue={editingMetric?.frequency || ""} 
                placeholder="es. Mensile, Settimanale" 
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit-baseline_value">Dato di Partenza</Label>
                <Input 
                  id="edit-baseline_value" 
                  name="baseline_value" 
                  type="number" 
                  step="0.01" 
                  defaultValue={editingMetric?.baseline_value ?? ""} 
                  placeholder="0" 
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Valore storico iniziale per calcolo ROI
                </p>
              </div>
              <div>
                <Label htmlFor="edit-target_value">Obiettivo</Label>
                <Input 
                  id="edit-target_value" 
                  name="target_value" 
                  type="number" 
                  step="0.01" 
                  defaultValue={editingMetric?.target_value ?? ""} 
                  placeholder="0" 
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setEditingMetric(null)}>
                Annulla
              </Button>
              <Button type="submit">Salva Modifiche</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
