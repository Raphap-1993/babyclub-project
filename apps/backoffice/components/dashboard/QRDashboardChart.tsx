import { ChartCard, SimpleBarChart } from "@/components/dashboard";

interface QRDashboardChartProps {
  data: Array<{
    name: string;
    total_qr: number;
    entrada?: number;
    mesa?: number;
    cortesia?: number;
    fecha?: string;
  }>;
}

export function QRDashboardChart({ data }: QRDashboardChartProps) {
  // Prepara los datos para el gráfico de barras apiladas
  const chartData = data.map(ev => ({
    name: ev.name,
    Entradas: ev.entrada || 0,
    Mesas: ev.mesa || 0,
    Cortesía: ev.cortesia || 0,
  }));

  return (
    <ChartCard title="QRs generados por evento" description="Desglose por tipo de ticket">
      <SimpleBarChart
        data={chartData}
        dataKeys={[
          { key: "Entradas", color: "#e11d48" },
          { key: "Mesas", color: "#f59e0b" },
          { key: "Cortesía", color: "#10b981" },
        ]}
        height={260}
      />
    </ChartCard>
  );
}
