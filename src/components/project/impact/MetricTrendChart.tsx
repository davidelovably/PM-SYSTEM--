import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from "recharts";
import { format } from "date-fns";
import { it } from "date-fns/locale";

interface MetricEntry {
  id: string;
  date: string;
  value: number;
  is_published: boolean;
}

interface MetricTrendChartProps {
  entries: MetricEntry[];
  metricName: string;
  unit: "number" | "currency" | "percentage";
  targetValue: number | null;
  isClient: boolean;
}

export function MetricTrendChart({ entries, metricName, unit, targetValue, isClient }: MetricTrendChartProps) {
  const filteredEntries = isClient 
    ? entries.filter(e => e.is_published)
    : entries;

  const publishedEntries = entries.filter(e => e.is_published);
  const draftEntries = entries.filter(e => !e.is_published);

  const chartData = filteredEntries
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .map(entry => ({
      date: format(new Date(entry.date), "dd MMM", { locale: it }),
      fullDate: format(new Date(entry.date), "dd MMM yyyy", { locale: it }),
      value: entry.value,
      isDraft: !entry.is_published,
    }));

  if (chartData.length === 0) {
    return (
      <div className="flex items-center justify-center h-[300px] text-muted-foreground">
        Nessun dato disponibile per visualizzare il grafico
      </div>
    );
  }

  const formatValue = (value: number) => {
    switch (unit) {
      case "currency": return `€${value.toFixed(2)}`;
      case "percentage": return `${value}%`;
      default: return value.toString();
    }
  };

  return (
    <div className="space-y-2">
      <h4 className="text-sm font-medium">{metricName} - Andamento Temporale</h4>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis 
            dataKey="date" 
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
            labelFormatter={(label, payload) => payload?.[0]?.payload?.fullDate || label}
            contentStyle={{
              backgroundColor: 'hsl(var(--background))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '6px',
            }}
          />
          <Legend />
          
          {!isClient && draftEntries.length > 0 && (
            <Line 
              type="monotone" 
              dataKey="value" 
              stroke="hsl(var(--muted-foreground))" 
              strokeWidth={2}
              strokeDasharray="5 5"
              name="Bozze"
              dot={{ r: 4, opacity: 0.5 }}
            />
          )}
          
          <Line 
            type="monotone" 
            dataKey="value" 
            stroke="hsl(var(--primary))" 
            strokeWidth={2}
            name={isClient ? "Valore" : "Pubblicati"}
            dot={{ r: 5 }}
            activeDot={{ r: 7 }}
          />
          
          {targetValue !== null && (
            <ReferenceLine 
              y={targetValue} 
              stroke="hsl(var(--success))" 
              strokeDasharray="3 3"
              strokeWidth={2}
              label={{ 
                value: `Target: ${formatValue(targetValue)}`, 
                position: 'right',
                fill: 'hsl(var(--success))',
                fontSize: 12,
              }}
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
