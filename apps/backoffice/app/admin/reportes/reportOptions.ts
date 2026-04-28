import { createClient } from "@supabase/supabase-js";
import { applyNotDeleted } from "shared/db/softDelete";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function getReportOptions() {
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
        .order("name", { ascending: true }),
    ),
    applyNotDeleted(
      supabase
        .from("events")
        .select("id,name,organizer_id")
        .order("starts_at", { ascending: false })
        .limit(300),
    ),
    applyNotDeleted(
      supabase
        .from("promoters")
        .select("id,code,organizer_id,person:persons(first_name,last_name)")
        .order("created_at", { ascending: true })
        .limit(500),
    ),
  ]);

  const organizers = (organizersRes.data || []).map((org: any) => ({
    id: org.id,
    label: org.name,
  }));
  const events = (eventsRes.data || []).map((event: any) => ({
    id: event.id,
    label: event.name,
    organizer_id: event.organizer_id || null,
  }));
  const promoters = (promotersRes.data || []).map((promoter: any) => {
    const personRel = Array.isArray(promoter.person)
      ? promoter.person[0]
      : promoter.person;
    const name = [personRel?.first_name, personRel?.last_name]
      .filter(Boolean)
      .join(" ")
      .trim();
    const label =
      name && promoter.code
        ? `${name} · ${promoter.code}`
        : name || promoter.code || promoter.id;
    return {
      id: promoter.id,
      label,
      organizer_id: promoter.organizer_id || null,
    };
  });

  return { organizers, events, promoters };
}
