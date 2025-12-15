import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Brain, CheckCircle2, Plus, LayoutDashboard, Flag, ChevronDown, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useAuth } from "@/contexts/AuthContext";
import { Link } from "react-router-dom";
import type { Database } from "@/integrations/supabase/types";
import { z } from "zod";

const requirementSchema = z.object({
  input_script_raw: z.string().trim().min(10, "Lo script deve contenere almeno 10 caratteri").max(50000, "Script troppo lungo (max 50000 caratteri)"),
});

interface RequirementsTabProps {
  projectId: string;
  onTasksCreated?: () => void;
}

interface SuggestedTask {
  title: string;
  description: string;
  priority: "must_have" | "should_have" | "could_have" | "wont_have";
  estimated_hours: number;
}

interface SuggestedMilestone {
  milestone_title: string;
  description: string;
  due_date_suggestion: string;
  strategic_priority: "low" | "medium" | "high";
  tasks: SuggestedTask[];
}

type DbRequirement = Database['public']['Tables']['project_requirements']['Row'];

interface Requirement extends Omit<DbRequirement, 'ai_tasks_json'> {
  ai_tasks_json: SuggestedMilestone[] | null;
}

interface MilestoneSelection {
  milestoneIndex: number;
  taskIndices: number[];
}

const priorityLabels = {
  must_have: "Must Have",
  should_have: "Should Have",
  could_have: "Could Have",
  wont_have: "Won't Have",
};

const priorityColors = {
  must_have: "bg-red-500",
  should_have: "bg-orange-500",
  could_have: "bg-blue-500",
  wont_have: "bg-gray-500",
};

const milestonePriorityConfig = {
  low: { label: "Bassa", icon: "text-muted-foreground" },
  medium: { label: "Media", icon: "text-warning" },
  high: { label: "Alta", icon: "text-destructive" },
};

export function RequirementsTab({ projectId, onTasksCreated }: RequirementsTabProps) {
  const [scriptText, setScriptText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [selectedStructure, setSelectedStructure] = useState<Map<number, Set<number>>>(new Map());
  const [expandedMilestones, setExpandedMilestones] = useState<Set<number>>(new Set());
  const [isCreatingStructure, setIsCreatingStructure] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    fetchRequirements();
  }, [projectId]);

  const fetchRequirements = async () => {
    const { data, error } = await supabase
      .from("project_requirements")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false });

    if (!error && data) {
      const typedData = data.map(req => ({
        ...req,
        ai_tasks_json: req.ai_tasks_json as unknown as SuggestedMilestone[] | null
      }));
      setRequirements(typedData);
    }
  };

  const handleAnalyze = async () => {
    setIsSubmitting(true);
    try {
      const validation = requirementSchema.safeParse({ input_script_raw: scriptText });
      if (!validation.success) {
        toast({
          title: "Errore di validazione",
          description: validation.error.errors[0].message,
          variant: "destructive",
        });
        return;
      }

      if (!user) throw new Error("User not authenticated");

      const { data, error } = await supabase
        .from("project_requirements")
        .insert({
          project_id: projectId,
          user_id: user.id,
          input_script_raw: validation.data.input_script_raw,
          status: "Pending",
        })
        .select()
        .single();

      if (error) throw error;

      toast({
        title: "Script salvato",
        description: "Lo script è stato salvato. Premi 'Elabora con AI' per generare la struttura.",
      });
      
      setScriptText("");
      fetchRequirements();
    } catch (error) {
      console.error("Error submitting script:", error);
      toast({
        title: "Errore",
        description: "Impossibile salvare lo script",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleProcessWithAI = async (requirementId: string) => {
    setIsProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke('process-requirements', {
        body: { requirementId }
      });

      if (error) throw error;

      toast({
        title: "Elaborazione completata",
        description: data.message || "Struttura generata con successo",
      });

      fetchRequirements();
    } catch (error) {
      console.error("Error processing requirement:", error);
      toast({
        title: "Errore",
        description: error instanceof Error ? error.message : "Impossibile elaborare i requisiti",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const toggleMilestoneExpansion = (index: number) => {
    setExpandedMilestones(prev => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  };

  const toggleMilestoneSelection = (milestoneIndex: number, requirement: Requirement) => {
    if (!requirement.ai_tasks_json) return;
    
    const milestone = requirement.ai_tasks_json[milestoneIndex];
    const newSelection = new Map(selectedStructure);
    
    if (newSelection.has(milestoneIndex)) {
      // Deselect milestone
      newSelection.delete(milestoneIndex);
    } else {
      // Select milestone with all tasks
      const allTaskIndices = new Set(milestone.tasks.map((_, i) => i));
      newSelection.set(milestoneIndex, allTaskIndices);
    }
    
    setSelectedStructure(newSelection);
  };

  const toggleTaskSelection = (milestoneIndex: number, taskIndex: number) => {
    const newSelection = new Map(selectedStructure);
    
    if (!newSelection.has(milestoneIndex)) {
      newSelection.set(milestoneIndex, new Set([taskIndex]));
    } else {
      const taskSet = new Set(newSelection.get(milestoneIndex));
      if (taskSet.has(taskIndex)) {
        taskSet.delete(taskIndex);
        if (taskSet.size === 0) {
          newSelection.delete(milestoneIndex);
        } else {
          newSelection.set(milestoneIndex, taskSet);
        }
      } else {
        taskSet.add(taskIndex);
        newSelection.set(milestoneIndex, taskSet);
      }
    }
    
    setSelectedStructure(newSelection);
  };

  const selectAll = (requirement: Requirement) => {
    if (!requirement.ai_tasks_json) return;
    const newSelection = new Map<number, Set<number>>();
    requirement.ai_tasks_json.forEach((milestone, mIndex) => {
      const allTaskIndices = new Set(milestone.tasks.map((_, tIndex) => tIndex));
      newSelection.set(mIndex, allTaskIndices);
    });
    setSelectedStructure(newSelection);
  };

  const handleCreateStructure = async (requirement: Requirement) => {
    if (!requirement.ai_tasks_json || selectedStructure.size === 0) return;

    const selectedMilestones: MilestoneSelection[] = Array.from(selectedStructure.entries()).map(([milestoneIndex, taskIndices]) => ({
      milestoneIndex,
      taskIndices: Array.from(taskIndices)
    }));

    setIsCreatingStructure(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-tasks-from-requirements', {
        body: { 
          requirementId: requirement.id,
          selectedMilestones
        }
      });

      if (error) throw error;

      console.log('Structure created successfully:', data);
      
      toast({
        title: "Struttura creata",
        description: data.message || "Milestone e task create con successo",
      });

      setSelectedStructure(new Map());
      fetchRequirements();

      if (onTasksCreated) {
        onTasksCreated();
      } else {
        window.location.hash = '#milestones';
      }
    } catch (error) {
      console.error("Error creating structure:", error);
      toast({
        title: "Errore",
        description: error instanceof Error ? error.message : "Impossibile creare la struttura",
        variant: "destructive",
      });
    } finally {
      setIsCreatingStructure(false);
    }
  };

  const getSelectionCount = () => {
    let milestoneCount = selectedStructure.size;
    let taskCount = 0;
    selectedStructure.forEach(tasks => {
      taskCount += tasks.size;
    });
    return { milestoneCount, taskCount };
  };

  return (
    <div className="space-y-6">
      {/* Input Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <CardTitle>Ingestione Requisiti AI - Struttura Gerarchica</CardTitle>
              <CardDescription>
                Incolla qui il testo del questionario o dello script di analisi. L'AI analizzerà il contenuto e genererà Milestone (fasi) con Task organizzate gerarchicamente.
              </CardDescription>
            </div>
            <Badge variant="outline" className="ml-4 border-primary/50 bg-primary/5">
              <Brain className="mr-1 h-3 w-3" />
              AI Strutturale
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-3 bg-accent/10 border border-accent/30 rounded-md text-sm">
            <p className="font-medium mb-1 flex items-center gap-2">
              <Brain className="h-4 w-4 text-primary" />
              Generazione Struttura Completa
            </p>
            <p className="text-muted-foreground">
              L'AI organizzerà il progetto in Milestone (fasi) e Task associate. 
              Analizzerà il contesto progettuale, suggerirà scadenze realistiche e priorità strategiche.
            </p>
          </div>
          <Textarea
            placeholder="Incolla qui il testo del questionario o script di analisi..."
            value={scriptText}
            onChange={(e) => setScriptText(e.target.value)}
            className="min-h-[300px] font-mono text-sm"
          />
          <Button 
            onClick={handleAnalyze}
            disabled={isSubmitting || !scriptText.trim()}
            className="w-full"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Salvataggio in corso...
              </>
            ) : (
              <>
                <Plus className="mr-2 h-4 w-4" />
                Salva Script
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Requirements List */}
      {requirements.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Script Salvati</h3>
          {requirements.map((requirement) => (
            <Card key={requirement.id}>
              <CardHeader>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">
                      Script del {new Date(requirement.created_at).toLocaleDateString('it-IT')}
                    </CardTitle>
                    <Badge variant={
                      requirement.status === "Tasks_Created" ? "default" :
                      requirement.status === "Generated" ? "secondary" : "outline"
                    }>
                      {requirement.status === "Tasks_Created" ? "Struttura Creata" :
                       requirement.status === "Generated" ? "Generato" : "In Attesa"}
                    </Badge>
                  </div>
                  
                  <Collapsible>
                    <CollapsibleTrigger asChild>
                      <Button variant="ghost" size="sm" className="w-full justify-start text-muted-foreground hover:text-foreground">
                        <ChevronRight className="h-4 w-4 mr-2" />
                        Visualizza Script Completo
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="pt-3">
                      <Textarea
                        value={requirement.input_script_raw}
                        readOnly
                        className="min-h-[200px] max-h-[400px] font-mono text-sm whitespace-pre-wrap resize-none"
                      />
                    </CollapsibleContent>
                  </Collapsible>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Pending State */}
                {requirement.status === "Pending" && (
                  <Button 
                    onClick={() => handleProcessWithAI(requirement.id)}
                    disabled={isProcessing}
                    className="w-full"
                  >
                    {isProcessing ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Elaborazione in corso...
                      </>
                    ) : (
                      <>
                        <Brain className="mr-2 h-4 w-4" />
                        Elabora con AI
                      </>
                    )}
                  </Button>
                )}

                {/* Generated State - Show Hierarchical Structure */}
                {(requirement.status === "Generated" || requirement.status === "Tasks_Created") && 
                 requirement.ai_tasks_json && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="font-semibold">
                        Struttura Proposta ({requirement.ai_tasks_json.length} Milestone)
                      </h4>
                      {requirement.status === "Generated" && (
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => selectAll(requirement)}
                          >
                            Seleziona Tutto
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => handleCreateStructure(requirement)}
                            disabled={selectedStructure.size === 0 || isCreatingStructure}
                          >
                            {isCreatingStructure ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Creazione...
                              </>
                            ) : (
                              <>
                                <CheckCircle2 className="mr-2 h-4 w-4" />
                                Crea Struttura ({getSelectionCount().milestoneCount}M, {getSelectionCount().taskCount}T)
                              </>
                            )}
                          </Button>
                        </div>
                      )}
                    </div>

                    <Separator />

                    {/* Milestones with nested tasks */}
                    <div className="space-y-4">
                      {requirement.ai_tasks_json.map((milestone, mIndex) => {
                        const isExpanded = expandedMilestones.has(mIndex);
                        const isMilestoneSelected = selectedStructure.has(mIndex);
                        const selectedTaskCount = selectedStructure.get(mIndex)?.size || 0;
                        const priority = milestonePriorityConfig[milestone.strategic_priority] || milestonePriorityConfig.medium;

                        return (
                          <Card key={mIndex} className={`border-2 ${isMilestoneSelected ? 'border-primary/50 bg-primary/5' : 'border-border'}`}>
                            <CardHeader className="pb-3">
                              <div className="flex items-start gap-3">
                                {requirement.status === "Generated" && (
                                  <Checkbox
                                    checked={isMilestoneSelected}
                                    onCheckedChange={() => toggleMilestoneSelection(mIndex, requirement)}
                                    className="mt-1"
                                  />
                                )}
                                <div className="flex-1 space-y-2">
                                  <div className="flex items-start gap-2">
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-6 w-6 flex-shrink-0"
                                      onClick={() => toggleMilestoneExpansion(mIndex)}
                                    >
                                      {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                    </Button>
                                    <Flag className={`h-4 w-4 mt-0.5 flex-shrink-0 ${priority.icon}`} />
                                    <div className="flex-1">
                                      <h5 className="font-semibold">{milestone.milestone_title}</h5>
                                      <p className="text-sm text-muted-foreground mt-1">{milestone.description}</p>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-3 text-sm text-muted-foreground">
                                    <span>📅 {new Date(milestone.due_date_suggestion).toLocaleDateString('it-IT')}</span>
                                    <Badge variant="outline" className="text-xs">{priority.label}</Badge>
                                    <Badge variant="secondary" className="text-xs">{milestone.tasks.length} Task</Badge>
                                    {isMilestoneSelected && <Badge className="text-xs bg-primary">{selectedTaskCount}/{milestone.tasks.length} selezionati</Badge>}
                                  </div>
                                </div>
                              </div>
                            </CardHeader>
                            
                            <Collapsible open={isExpanded}>
                              <CollapsibleContent>
                                <CardContent className="pt-0">
                                  <div className="space-y-2 pl-9">
                                    {milestone.tasks.map((task, tIndex) => {
                                      const isTaskSelected = selectedStructure.get(mIndex)?.has(tIndex) || false;
                                      
                                      return (
                                        <div
                                          key={tIndex}
                                          className={`border rounded-lg p-3 space-y-2 ${
                                            requirement.status === "Tasks_Created" ? "bg-muted/50" : ""
                                          } ${isTaskSelected ? 'border-primary bg-primary/5' : ''}`}
                                        >
                                          <div className="flex items-start gap-3">
                                            {requirement.status === "Generated" && (
                                              <Checkbox
                                                checked={isTaskSelected}
                                                onCheckedChange={() => toggleTaskSelection(mIndex, tIndex)}
                                                className="mt-0.5"
                                              />
                                            )}
                                            <div className="flex-1 space-y-1">
                                              <div className="flex items-start justify-between gap-2">
                                                <h6 className="font-medium text-sm">{task.title}</h6>
                                                <Badge className={priorityColors[task.priority] + " text-xs"}>
                                                  {priorityLabels[task.priority]}
                                                </Badge>
                                              </div>
                                              <p className="text-xs text-muted-foreground">
                                                {task.description}
                                              </p>
                                              <div className="text-xs text-muted-foreground">
                                                ⏱️ {task.estimated_hours}h stimato
                                              </div>
                                            </div>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </CardContent>
                              </CollapsibleContent>
                            </Collapsible>
                          </Card>
                        );
                      })}
                    </div>

                    {requirement.status === "Tasks_Created" && (
                      <div className="flex items-center justify-between p-4 bg-success/10 rounded-lg border border-success/20">
                        <div className="flex items-center gap-2 text-sm text-success">
                          <CheckCircle2 className="h-4 w-4" />
                          <span className="font-medium">
                            La struttura è stata creata nel progetto
                          </span>
                        </div>
                        <Button 
                          asChild
                          variant="outline" 
                          size="sm"
                          className="border-success/30 hover:bg-success/10"
                        >
                          <Link to={`/projects/${projectId}#milestones`}>
                            <LayoutDashboard className="mr-2 h-4 w-4" />
                            Visualizza Milestone
                          </Link>
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}