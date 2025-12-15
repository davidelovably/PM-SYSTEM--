import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useUserRole } from "@/hooks/useUserRole";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Loader2, FileText, Download, Edit2, Check, Lock, Eye, Trash2, Calendar, Send } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import jsPDF from "jspdf";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { ShareReportDialog } from "@/components/inbox/ShareReportDialog";

interface Report {
  id: string;
  created_at: string;
  report_period: string;
  content_summary: string;
  key_metrics_snapshot: any;
  status: string;
}

interface ReportsTabProps {
  projectId: string;
}

const CHART_COLORS = ["hsl(var(--primary))", "hsl(var(--success))", "hsl(var(--warning))", "hsl(var(--destructive))", "hsl(var(--muted))"];

export function ReportsTab({ projectId }: ReportsTabProps) {
  const { toast } = useToast();
  const { isAdmin, isSuperAdmin, isProjectManager, isClient } = useUserRole();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState("last_7_days");
  const [customStartDate, setCustomStartDate] = useState<Date | undefined>();
  const [customEndDate, setCustomEndDate] = useState<Date | undefined>();
  const [editingReportId, setEditingReportId] = useState<string | null>(null);
  const [editedContent, setEditedContent] = useState("");
  const [deleteReportId, setDeleteReportId] = useState<string | null>(null);
  const [project, setProject] = useState<any>(null);
  const [shareReportOpen, setShareReportOpen] = useState(false);
  const [shareReport, setShareReport] = useState<{ id: string; period: string } | null>(null);

  const canManage = isAdmin || isSuperAdmin || isProjectManager;

  // Validation for generate button
  const canGenerate = selectedPeriod !== "custom" || (customStartDate && customEndDate);

  useEffect(() => {
    fetchReports();
    fetchProject();
  }, [projectId]);

  const fetchProject = async () => {
    const { data, error } = await supabase
      .from("projects")
      .select("title")
      .eq("id", projectId)
      .single();

    if (!error && data) {
      setProject(data);
    }
  };

  const fetchReports = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("project_reports")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false });

    if (error) {
      toast({
        title: "Errore",
        description: "Impossibile caricare i report",
        variant: "destructive",
      });
    } else {
      setReports(data || []);
    }
    setLoading(false);
  };

  const handleGenerateReport = async () => {
    setGenerating(true);
    try {
      const body: any = { projectId };

      if (selectedPeriod === "custom" && customStartDate && customEndDate) {
        body.period = "custom";
        body.startDate = customStartDate.toISOString();
        body.endDate = customEndDate.toISOString();
      } else {
        body.period = selectedPeriod;
      }

      const { data, error } = await supabase.functions.invoke("generate-report", {
        body,
      });

      if (error) throw error;

      toast({
        title: "Report Generato",
        description: "Il report è stato creato con successo",
      });

      fetchReports();
    } catch (error) {
      console.error("Error generating report:", error);
      toast({
        title: "Errore",
        description: "Impossibile generare il report",
        variant: "destructive",
      });
    } finally {
      setGenerating(false);
    }
  };

  const handleEditReport = (report: Report) => {
    setEditingReportId(report.id);
    setEditedContent(report.content_summary);
  };

  const handleSaveEdit = async (reportId: string) => {
    try {
      const { error } = await supabase
        .from("project_reports")
        .update({ content_summary: editedContent })
        .eq("id", reportId);

      if (error) throw error;

      toast({
        title: "Modifiche Salvate",
        description: "Il report è stato aggiornato",
      });

      setEditingReportId(null);
      fetchReports();
    } catch (error) {
      console.error("Error updating report:", error);
      toast({
        title: "Errore",
        description: "Impossibile salvare le modifiche",
        variant: "destructive",
      });
    }
  };

  const handleFinalizeReport = async (reportId: string) => {
    try {
      const { error } = await supabase
        .from("project_reports")
        .update({ status: "Finalized" })
        .eq("id", reportId);

      if (error) throw error;

      toast({
        title: "Report Finalizzato",
        description: "Il report è ora visibile ai clienti",
      });

      fetchReports();
    } catch (error) {
      console.error("Error finalizing report:", error);
      toast({
        title: "Errore",
        description: "Impossibile finalizzare il report",
        variant: "destructive",
      });
    }
  };

  const handleDeleteReport = async () => {
    if (!deleteReportId) return;

    try {
      const { error } = await supabase
        .from("project_reports")
        .delete()
        .eq("id", deleteReportId);

      if (error) throw error;

      toast({
        title: "Report Eliminato",
        description: "Il report è stato rimosso con successo",
      });

      fetchReports();
    } catch (error) {
      console.error("Error deleting report:", error);
      toast({
        title: "Errore",
        description: "Impossibile eliminare il report",
        variant: "destructive",
      });
    } finally {
      setDeleteReportId(null);
    }
  };

  const handleExportPDF = (report: Report) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 20;
    const maxWidth = pageWidth - 2 * margin;

    // Title
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text(`Report Progetto: ${project?.title || ""}`, margin, 20);

    // Metadata
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Generato il: ${new Date(report.created_at).toLocaleDateString("it-IT")}`, margin, 30);
    doc.text(`Periodo: ${report.report_period}`, margin, 35);
    doc.text(`Stato: ${report.status === "Finalized" ? "Finalizzato" : "Bozza"}`, margin, 40);

    let yPos = 50;

    // Key Metrics Summary Table
    if (report.key_metrics_snapshot) {
      const metrics = report.key_metrics_snapshot;

      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text("Dashboard Metriche", margin, yPos);
      yPos += 10;

      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");

      if (metrics.tasks) {
        doc.text(`Task: ${metrics.tasks.completed}/${metrics.tasks.total} completati | ${metrics.tasks.overdue} in ritardo | ${metrics.tasks.completed_in_period} nel periodo`, margin, yPos);
        yPos += 7;
      }

      if (metrics.milestones) {
        doc.text(`Milestone: ${metrics.milestones.completed}/${metrics.milestones.total} completate | ${metrics.milestones.at_risk} a rischio | ${metrics.milestones.upcoming} imminenti`, margin, yPos);
        yPos += 7;
      }

      if (metrics.risks) {
        doc.text(`Rischi: ${metrics.risks.open} aperti | ${metrics.risks.critical} critici | ${metrics.risks.new_in_period} nuovi nel periodo`, margin, yPos);
        yPos += 7;
      }

      if (metrics.roi && metrics.roi.length > 0) {
        doc.text("Business Impact:", margin, yPos);
        yPos += 5;
        metrics.roi.forEach((area: any) => {
          if (area.metrics && area.metrics.length > 0) {
            area.metrics.forEach((m: any) => {
              const roiText = m.roi ? ` (ROI: ${m.roi}%)` : "";
              doc.text(`  • ${area.area_name} - ${m.name}: ${m.current} ${m.unit}${roiText}`, margin, yPos);
              yPos += 5;
            });
          }
        });
      }

      yPos += 10;
    }

    // Content
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("Executive Summary", margin, yPos);
    yPos += 7;

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    const lines = doc.splitTextToSize(report.content_summary.replace(/[#*]/g, ""), maxWidth);
    
    // Check if we need a new page
    if (yPos + lines.length * 5 > doc.internal.pageSize.getHeight() - 20) {
      doc.addPage();
      yPos = 20;
    }
    
    doc.text(lines, margin, yPos);

    doc.save(`report-${project?.title || "progetto"}-${new Date(report.created_at).toLocaleDateString("it-IT")}.pdf`);
  };

  // Render charts from metrics snapshot
  const renderMetricsCharts = (metrics: any) => {
    if (!metrics) return null;

    const taskPieData = metrics.tasks ? [
      { name: "Completati", value: metrics.tasks.completed, fill: "hsl(var(--success))" },
      { name: "In Corso", value: metrics.tasks.in_progress, fill: "hsl(var(--primary))" },
      { name: "Da Fare", value: metrics.tasks.to_do, fill: "hsl(var(--muted))" },
      { name: "In Revisione", value: metrics.tasks.waiting_review, fill: "hsl(var(--warning))" },
    ].filter(d => d.value > 0) : [];

    const milestoneBarData = metrics.milestones ? [
      { name: "Completate", value: metrics.milestones.completed },
      { name: "In Corso", value: metrics.milestones.in_progress },
      { name: "A Rischio", value: metrics.milestones.at_risk },
      { name: "Pianificate", value: metrics.milestones.total - metrics.milestones.completed - metrics.milestones.in_progress - metrics.milestones.at_risk },
    ].filter(d => d.value > 0) : [];

    const riskBarData = metrics.risks ? [
      { name: "Aperti", value: metrics.risks.open, fill: "hsl(var(--warning))" },
      { name: "Critici", value: metrics.risks.critical, fill: "hsl(var(--destructive))" },
      { name: "Nuovi", value: metrics.risks.new_in_period, fill: "hsl(var(--primary))" },
    ] : [];

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        {/* Task Distribution Pie Chart */}
        {taskPieData.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Distribuzione Task</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={taskPieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={70}
                    paddingAngle={2}
                    dataKey="value"
                    label={({ name, value }) => `${name}: ${value}`}
                    labelLine={false}
                  >
                    {taskPieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="text-center text-sm text-muted-foreground mt-2">
                Totale: {metrics.tasks.total} task | {metrics.tasks.overdue} in ritardo
              </div>
            </CardContent>
          </Card>
        )}

        {/* Milestone Status Bar Chart */}
        {milestoneBarData.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Stato Milestone</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={milestoneBarData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" />
                  <YAxis dataKey="name" type="category" width={80} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="value" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
              <div className="text-center text-sm text-muted-foreground mt-2">
                {metrics.milestones.upcoming} milestone imminenti (30gg)
              </div>
            </CardContent>
          </Card>
        )}

        {/* Risk Overview */}
        {riskBarData.some(d => d.value > 0) && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Analisi Rischi</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={riskBarData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                    {riskBarData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <div className="text-center text-sm text-muted-foreground mt-2">
                Totale: {metrics.risks.total} rischi registrati
              </div>
            </CardContent>
          </Card>
        )}

        {/* ROI Summary */}
        {metrics.roi && metrics.roi.length > 0 && metrics.roi.some((a: any) => a.metrics?.length > 0) && (
          <Card className="md:col-span-2 lg:col-span-3">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Business Impact & ROI</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {metrics.roi.map((area: any, areaIndex: number) => (
                  area.metrics && area.metrics.length > 0 && (
                    <div key={areaIndex} className="p-3 rounded-lg bg-muted/50">
                      <div className="font-medium text-sm mb-2">{area.area_name}</div>
                      {area.investment && (
                        <div className="text-xs text-muted-foreground mb-2">
                          Investimento: €{parseFloat(area.investment).toLocaleString("it-IT")}
                        </div>
                      )}
                      {area.metrics.map((metric: any, metricIndex: number) => (
                        <div key={metricIndex} className="flex justify-between items-center text-sm py-1 border-b border-border/50 last:border-0">
                          <span>{metric.name}</span>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">
                              {metric.unit === "currency" ? "€" : ""}
                              {metric.current?.toLocaleString("it-IT")}
                              {metric.unit === "percentage" ? "%" : ""}
                            </span>
                            {metric.delta !== 0 && (
                              <Badge variant={metric.delta > 0 ? "default" : "destructive"} className="text-xs">
                                {metric.delta > 0 ? "+" : ""}{metric.delta?.toLocaleString("it-IT")}
                              </Badge>
                            )}
                            {metric.roi && (
                              <Badge className="bg-success/10 text-success border-success/20 text-xs">
                                ROI: {metric.roi}%
                              </Badge>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Generation Controls */}
      {canManage && (
        <Card>
          <CardHeader>
            <CardTitle>Genera Nuovo Report AI</CardTitle>
            <CardDescription>
              L'AI analizzerà i dati del progetto e genererà un Executive Summary professionale
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleziona periodo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="last_7_days">Ultima Settimana (7 giorni)</SelectItem>
                      <SelectItem value="last_30_days">Ultimo Mese (30 giorni)</SelectItem>
                      <SelectItem value="custom">Periodo Personalizzato</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={handleGenerateReport} disabled={generating || !canGenerate}>
                  {generating ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Generazione...
                    </>
                  ) : (
                    <>
                      <FileText className="mr-2 h-4 w-4" />
                      Genera Report
                    </>
                  )}
                </Button>
              </div>

              {/* Custom Date Range Picker */}
              {selectedPeriod === "custom" && (
                <div className="flex items-center gap-4 p-4 rounded-lg bg-muted/50 border border-border">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Periodo:</span>
                  </div>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-[180px] justify-start text-left font-normal">
                        <Calendar className="mr-2 h-4 w-4" />
                        {customStartDate ? format(customStartDate, "dd/MM/yyyy", { locale: it }) : "Data inizio"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 z-50" align="start">
                      <CalendarComponent
                        mode="single"
                        selected={customStartDate}
                        onSelect={setCustomStartDate}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  <span className="text-muted-foreground">→</span>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-[180px] justify-start text-left font-normal">
                        <Calendar className="mr-2 h-4 w-4" />
                        {customEndDate ? format(customEndDate, "dd/MM/yyyy", { locale: it }) : "Data fine"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 z-50" align="start">
                      <CalendarComponent
                        mode="single"
                        selected={customEndDate}
                        onSelect={setCustomEndDate}
                        disabled={(date) => customStartDate ? date < customStartDate : false}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  {(!customStartDate || !customEndDate) && (
                    <span className="text-sm text-destructive">Seleziona entrambe le date</span>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Reports List */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Report Generati</h3>
        {reports.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              Nessun report disponibile. {canManage && "Genera il primo report per iniziare."}
            </CardContent>
          </Card>
        ) : (
          reports.map((report) => (
            <Card key={report.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <CardTitle className="flex items-center gap-2">
                      <FileText className="h-5 w-5" />
                      Report {report.report_period}
                      <Badge variant={report.status === "Finalized" ? "default" : "secondary"}>
                        {report.status === "Finalized" ? (
                          <>
                            <Eye className="mr-1 h-3 w-3" />
                            Finalizzato
                          </>
                        ) : (
                          <>
                            <Lock className="mr-1 h-3 w-3" />
                            Bozza
                          </>
                        )}
                      </Badge>
                    </CardTitle>
                    <CardDescription>
                      Generato il {new Date(report.created_at).toLocaleDateString("it-IT")} alle{" "}
                      {new Date(report.created_at).toLocaleTimeString("it-IT", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    {report.status === "Finalized" && (
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => {
                          setShareReport({ id: report.id, period: report.report_period });
                          setShareReportOpen(true);
                        }}
                        title="Condividi report"
                      >
                        <Send className="h-4 w-4" />
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => handleExportPDF(report)}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                    {canManage && (
                      <>
                        {editingReportId === report.id ? (
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => handleSaveEdit(report.id)}
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                        ) : (
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => handleEditReport(report)}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                        )}
                        {report.status === "Draft" && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleFinalizeReport(report.id)}
                          >
                            <Eye className="mr-2 h-4 w-4" />
                            Finalizza
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => setDeleteReportId(report.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {/* Charts Section */}
                {report.key_metrics_snapshot && renderMetricsCharts(report.key_metrics_snapshot)}

                {/* Report Content */}
                {editingReportId === report.id ? (
                  <Textarea
                    value={editedContent}
                    onChange={(e) => setEditedContent(e.target.value)}
                    className="min-h-[300px] font-mono"
                  />
                ) : (
                  <div className="prose prose-sm max-w-none dark:prose-invert">
                    <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed bg-transparent p-0 m-0">
                      {report.content_summary}
                    </pre>
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteReportId} onOpenChange={() => setDeleteReportId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Conferma Eliminazione</AlertDialogTitle>
            <AlertDialogDescription>
              Sei sicuro di voler eliminare questo report? Questa azione non può essere annullata.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteReport}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Elimina
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Share Report Dialog */}
      {shareReport && (
        <ShareReportDialog
          open={shareReportOpen}
          onOpenChange={setShareReportOpen}
          projectId={projectId}
          reportId={shareReport.id}
          reportPeriod={shareReport.period}
        />
      )}
    </div>
  );
}
