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

export default async function ReporteMesasPage() {
  const options = await getReportOptions();

  return (
    <AdminPage>
      <AdminHeader
        kicker="Reportes / Operación"
        title="Asistencia y Ventas por Evento"
        description="Consulta métricas por organizador/evento y exporta en CSV."
      />
      <ReportWorkspace
        title="Reporte de eventos"
        description="Puedes alternar entre asistencia y ventas."
        defaultReport="event_attendance"
        allowReportSwitch
        organizers={options.organizers}
        events={options.events}
        promoters={options.promoters}
      />
    </AdminPage>
  );
}

