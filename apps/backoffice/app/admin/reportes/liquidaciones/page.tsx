import { AdminHeader, AdminPage } from "@/components/admin/PageScaffold";
import { getReportOptions } from "../reportOptions";
import LiquidacionesReportClient from "./LiquidacionesReportClient";

export const dynamic = "force-dynamic";

export default async function ReporteLiquidacionesPage() {
  const options = await getReportOptions();

  return (
    <AdminPage>
      <AdminHeader
        kicker="Reportes / Liquidaciones"
        title="Reporte de Liquidaciones"
        description="Consolida las liquidaciones creadas por evento, promotor, estado e importe."
      />
      <LiquidacionesReportClient
        events={options.events}
        promoters={options.promoters}
      />
    </AdminPage>
  );
}
