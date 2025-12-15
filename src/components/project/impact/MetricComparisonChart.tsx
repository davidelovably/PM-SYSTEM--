import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from "recharts";
import { TrendingUp, TrendingDown } from "lucide-react";

interface MetricEntry {
  id: string;
  date: string;
  value: number;
  is_published: boolean;
}

interface MetricComparisonChartProps {
  entries: MetricEntry[];
  metricName: string;
  unit: "number" | "currency" | "percentage";
  baselineValue: number | null;
  isClient: boolean;
}

export function MetricComparisonChart({ entries, metricName, unit, baselineValue, isClient }: MetricComparisonChartProps) {
  const filteredEntries = isClient 
    ? entries.filter(e => e.is_published)
    : entries;

  if (filteredEntries.length === 0) {
    return (
      <div className="flex items-center justify-center h-[300px] text-muted-foreground">
        Nessun dato disponibile per il confronto
      </div>
    );
  }

  const latestEntry = filteredEntries.sort((a, b) => 
    new Date(b.date).getTime() - new Date(a.date).getTime()
  )[0];

  const baseline = baselineValue ?? 0;
  const current = latestEntry.value;
  const growth = baseline !== 0 ? ((current - baseline) / baseline) * 100 : 0;

  const chartData = [
    {
      name: "Baseline",
      value: baseline,
      fill: "hsl(var(--muted-foreground))",
    },
    {
      name: "Attuale",
      value: current,
      fill: growth >= 0 ? "hsl(var(--success))" : "hsl(var(--destructive))",
    },
  ];

  const formatValue = (value: number) => {
    switch (unit) {
      case "currency": return `€${value.toFixed(2)}`;
      case "percentage": return `${value}%`;
      default: return value.toString();
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium">{metricName} - Confronto ROI</h4>
        <div className={`flex items-center gap-1 font-semibold ${growth >= 0 ? 'text-success' : 'text-destructive'}`}>
          {growth >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
          {growth > 0 ? '+' : ''}{growth.toFixed(1)}%
        </div>
      </div>
      
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis 
            dataKey="name" 
            className="text-xs"
            tick={{ fill: 'hsl(var(--muted-foreground))' }}
          />
          <YAxis 
            className="text-xs"
            tick={{ fill: 'hsl(var(--muted-foreground))' }}
            tickFormatter={formatValue}
          />
          <Tooltip 
            formatter={(value: number) => [formatValue(value), "Valore"]}
            contentStyle={{
              backgroundColor: 'hsl(var(--background))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '6px',
            }}
          />
          <Legend />
          <Bar dataKey="value" name="Valore" radius={[8, 8, 0, 0]}>
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.fill} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div className="p-3 rounded-lg bg-muted/50">
          <p className="text-muted-foreground">Baseline</p>
          <p className="font-semibold text-lg">{formatValue(baseline)}</p>
        </div>
        <div className="p-3 rounded-lg bg-primary/10">
          <p className="text-muted-foreground">Valore Attuale</p>
          <p className="font-semibold text-lg">{formatValue(current)}</p>
        </div>
      </div>
    </div>
  );
}
