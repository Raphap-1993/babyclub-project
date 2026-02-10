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

  const [organizersRes, eventsRes, promotersRes] = await Promise.all([
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
    applyNotDeleted(
      supabase
        .from("promoters")
        .select("id,code,organizer_id,person:persons(first_name,last_name)")
        .order("created_at", { ascending: true })
        .limit(500)
    ),
  ]);

  const organizers = (organizersRes.data || []).map((org: any) => ({ id: org.id, label: org.name }));
  const events = (eventsRes.data || []).map((event: any) => ({
    id: event.id,
    label: event.name,
    organizer_id: event.organizer_id || null,
  }));
  const promoters = (promotersRes.data || []).map((promoter: any) => {
    const personRel = Array.isArray(promoter.person) ? promoter.person[0] : promoter.person;
    const label =
      [personRel?.first_name, personRel?.last_name].filter(Boolean).join(" ").trim() || promoter.code || promoter.id;
    return {
      id: promoter.id,
      label,
      organizer_id: promoter.organizer_id || null,
    };
  });

  return { organizers, events, promoters };
}

export const dynamic = "force-dynamic";

export default async function ReportePromotoresPage() {
  const options = await getReportOptions();

  return (
    <AdminPage>
      <AdminHeader
        kicker="Reportes / Promotores"
        title="Rendimiento de Promotores"
        description="Consulta códigos generados vs asistencias y exporta CSV desde backend."
      />
      <ReportWorkspace
        title="Reporte de promotores"
        description="Filtro por rango, organizador, evento y promotor."
        defaultReport="promoter_performance"
        organizers={options.organizers}
        events={options.events}
        promoters={options.promoters}
      />
    </AdminPage>
  );
}

