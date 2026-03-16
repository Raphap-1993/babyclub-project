import { createClient } from "@supabase/supabase-js";
import { applyNotDeleted } from "shared/db/softDelete";
import { AdminHeader, AdminPage } from "@/components/admin/PageScaffold";
import ReportWorkspace from "../components/ReportWorkspace";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function getReportOptions() {
  if (!supabaseUrl || !supabaseServiceKey) {
    return { organizers: [], events: [], promoters: [] };
  }
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const [organizersRes, eventsRes] = await Promise.all([
    applyNotDeleted(
      supabase
        .from("organizers")
        .select("id,name")
        .eq("is_active", true)
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true })
    ),
    applyNotDeleted(
      supabase
        .from("events")
        .select("id,name,organizer_id")
        .order("starts_at", { ascending: false })
        .limit(300)
    ),
  ]);

  const organizers = (organizersRes.data || []).map((org: any) => ({ id: org.id, label: org.name }));
  const events = (eventsRes.data || []).map((event: any) => ({
    id: event.id,
    label: event.name,
    organizer_id: event.organizer_id || null,
  }));

  return { organizers, events, promoters: [] };
}

export const dynamic = "force-dynamic";

const allowedDefaultReports = new Set([
  "event_attendance",
  "free_qr_no_show",
]);

export default async function ReporteMesasPage({
  searchParams,
}: {
  searchParams?: Promise<{ report?: string }>;
}) {
  const options = await getReportOptions();
  const params = searchParams ? await searchParams : {};
  const reportParam = String(params?.report || "");
  const defaultReport = allowedDefaultReports.has(reportParam)
    ? (reportParam as "event_attendance" | "free_qr_no_show")
    : "event_attendance";

  return (
    <AdminPage>
      <AdminHeader
        kicker="Reportes / Operación"
        title="Operación de Eventos"
        description="Consulta asistencia, ventas y no-show de QR free por organizador/evento."
      />
      <ReportWorkspace
        title="Reporte de eventos"
        description="Puedes alternar entre asistencia, ventas y control de no-show de QR free."
        defaultReport={defaultReport}
        allowReportSwitch
        showDateRange={false}
        events={options.events}
        promoters={options.promoters}
      />
    </AdminPage>
  );
}
