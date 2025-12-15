import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";

interface MetricWithLatestValue {
  id: string;
  name: string;
  unit: "number" | "currency" | "percentage";
  latestValue: number;
}

interface MetricCompositionChartProps {
  metrics: MetricWithLatestValue[];
  areaName: string;
}

const COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--success))",
  "hsl(var(--warning))",
  "hsl(var(--destructive))",
  "hsl(var(--muted-foreground))",
];

export function MetricCompositionChart({ metrics, areaName }: MetricCompositionChartProps) {
  if (metrics.length === 0) {
    return (
      <div className="flex items-center justify-center h-[300px] text-muted-foreground">
        Nessun dato disponibile per la composizione
      </div>
    );
  }

  const chartData = metrics.map(metric => ({
    name: metric.name,
    value: metric.latestValue,
  }));

  const total = chartData.reduce((sum, item) => sum + item.value, 0);

  const formatValue = (value: number, unit: string) => {
    switch (unit) {
      case "currency": return `€${value.toFixed(2)}`;
      case "percentage": return `${value}%`;
      default: return value.toString();
    }
  };

  return (
    <div className="space-y-2">
      <h4 className="text-sm font-medium">{areaName} - Distribuzione Metriche</h4>
      
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
            outerRadius={80}
            fill="#8884d8"
            dataKey="value"
          >
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip 
            formatter={(value: number, name: string, props: any) => {
              const metric = metrics.find(m => m.name === name);
              return [
                metric ? formatValue(value, metric.unit) : value,
                name
              ];
            }}
            contentStyle={{
              backgroundColor: 'hsl(var(--background))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '6px',
            }}
          />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
      
      <div className="space-y-2">
        {metrics.map((metric, index) => (
          <div key={metric.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/30">
            <div className="flex items-center gap-2">
              <div 
                className="w-3 h-3 rounded-full" 
                style={{ backgroundColor: COLORS[index % COLORS.length] }}
              />
              <span className="text-sm">{metric.name}</span>
            </div>
            <span className="font-semibold text-sm">
              {formatValue(metric.latestValue, metric.unit)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
