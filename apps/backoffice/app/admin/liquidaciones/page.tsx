import { AdminHeader, AdminPage } from "@/components/admin/PageScaffold";
import { getReportOptions } from "../reportes/reportOptions";
import LiquidacionesClient from "./LiquidacionesClient";

export const dynamic = "force-dynamic";

export default async function LiquidacionesPage() {
  const options = await getReportOptions();

  return (
    <AdminPage>
      <AdminHeader
        kicker="Operacion / Liquidaciones"
        title="Liquidaciones de Promotores"
        description="Lista liquidaciones registradas y crea nuevas liquidaciones buscando al promotor desde un flujo operativo propio."
      />
      <LiquidacionesClient
        events={options.events}
        promoters={options.promoters}
      />
    </AdminPage>
  );
}
