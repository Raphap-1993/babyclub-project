import { ChartCard, SimpleLineChart } from "@/components/dashboard";

interface TicketsOverTimeChartProps {
  data: Array<{
    date: string;
    [eventName: string]: number | string;
  }>;
}

export function TicketsOverTimeChart({ data }: TicketsOverTimeChartProps) {
  // Detectar los nombres de eventos dinámicamente (todas las keys excepto 'date')
  const eventNames = data.length > 0 ? Object.keys(data[0]).filter(k => k !== 'date') : [];
  const colors = ["#e11d48", "#f59e0b", "#10b981", "#f43f5e", "#d946ef", "#f97316", "#a3a3a3"];

  return (
    <ChartCard title="Evolución de tickets generados" description="Tickets generados por día y evento">
      <SimpleLineChart
        data={data}
        lines={eventNames.map((name, i) => ({ key: name, color: colors[i % colors.length] }))}
        xKey="date"
        height={260}
      />
    </ChartCard>
  );
}
