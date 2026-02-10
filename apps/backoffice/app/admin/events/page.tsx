import EventsClient from "./EventsClient";
import { createClient } from "@supabase/supabase-js";
import { notFound } from "next/navigation";
import { applyNotDeleted } from "shared/db/softDelete";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

type EventRow = {
  id: string;
  name: string;
  location: string | null;
  starts_at: string | null;
  capacity: number | null;
  is_active: boolean | null;
  header_image: string | null;
  organizer_id?: string | null;
  organizer_name?: string | null;
  code?: string | null;
};

type OrganizerOption = { id: string; name: string; slug: string | null };

async function getEvents(params: {
  page: number;
  pageSize: number;
  organizer_id?: string;
}): Promise<{ events: EventRow[]; total: number; organizers: OrganizerOption[] } | null> {
  if (!supabaseUrl || !supabaseServiceKey) return null;

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const start = (params.page - 1) * params.pageSize;
  const end = start + params.pageSize - 1;

  let eventsQuery = applyNotDeleted(
    supabase
      .from("events")
      .select("id,name,location,starts_at,capacity,is_active,header_image,organizer_id,organizer:organizers(name)", { count: "exact" })
      .order("starts_at", { ascending: true })
      .range(start, end)
  );
  if (params.organizer_id) {
    eventsQuery = eventsQuery.eq("organizer_id", params.organizer_id);
  }

  const [eventsRes, organizersRes] = await Promise.all([
    eventsQuery,
    applyNotDeleted(
      supabase.from("organizers").select("id,name,slug").eq("is_active", true).order("sort_order", { ascending: true }).order("name", { ascending: true })
    ),
  ]);
  const { data, error, count } = eventsRes;
  const organizers = (organizersRes.data || []) as OrganizerOption[];

  if (error || !data) return null;
  if (data.length === 0) return { events: [], total: 0, organizers };

  const rows = data as EventRow[];
  const ids = rows.map((e) => e.id);
  const { data: codes } = await applyNotDeleted(
    supabase.from("codes").select("event_id,code").in("event_id", ids).eq("type", "general").eq("is_active", true)
  );
  const codeMap = new Map<string, string>();
  (codes || []).forEach((c: any) => {
    if (!codeMap.has(c.event_id)) codeMap.set(c.event_id, c.code);
  });

  return {
    events: rows.map((e: any) => {
      const organizerRel = Array.isArray(e.organizer) ? e.organizer[0] : e.organizer;
      return {
        ...e,
        organizer_name: organizerRel?.name || null,
        code: codeMap.get(e.id) ?? null,
      };
    }),
    total: count ?? data.length,
    organizers,
  };
}

export const dynamic = "force-dynamic";

export default async function EventsPage({ searchParams }: { searchParams?: Record<string, string | string[] | undefined> }) {
  const page = Math.max(1, parseInt((searchParams?.page as string) || "1", 10) || 1);
  const pageSize = Math.min(100, Math.max(5, parseInt((searchParams?.pageSize as string) || "10", 10) || 10));
  const organizer_id = typeof searchParams?.organizer_id === "string" ? searchParams.organizer_id : "";

  const result = await getEvents({ page, pageSize, organizer_id });
  if (!result) return notFound();

  return (
    <EventsClient
      events={result.events}
      pagination={{ page, pageSize }}
      total={result.total}
      organizerFilter={organizer_id}
      organizerOptions={result.organizers}
    />
  );
}
