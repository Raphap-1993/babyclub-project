import { AdminHeader, AdminPage } from "@/components/admin/PageScaffold";
import ReportWorkspace from "../components/ReportWorkspace";
import { getReportOptions } from "../reportOptions";

export const dynamic = "force-dynamic";

export default async function ReportePromotoresPage() {
  const options = await getReportOptions();

  return (
    <AdminPage>
      <AdminHeader
        kicker="Reportes / Promotores"
        title="Reporte de Promotores"
        description="Analiza rendimiento, asistencia y no-show por evento o promotor. Las liquidaciones se operan en su pagina propia."
      />
      <ReportWorkspace
        title="Reporte de promotores"
        description="Filtra por evento y promotor para revisar conversion, asistencia y no-show sin ejecutar acciones de pago."
        defaultReport="promoter_performance"
        allowReportSwitch
        showDateRange={false}
        events={options.events}
        promoters={options.promoters}
      />
    </AdminPage>
  );
}
