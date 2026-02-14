import EventsClient from "./EventsClientModern";
import { createClient } from "@supabase/supabase-js";
import { notFound } from "next/navigation";
import { applyNotDeleted } from "shared/db/softDelete";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export type EventRow = {
  id: string;
  name: string;
  location: string | null;
  starts_at: string | null;
  capacity: number | null;
  is_active: boolean | null;
  closed_at: string | null;
  header_image: string | null;
  code?: string | null;
  organizer?: { name: string; slug: string } | null;
};

type EventStatusFilter = "all" | "active" | "inactive" | "closed";

async function getEvents(params: {
  page: number;
  pageSize: number;
  q?: string;
  status?: EventStatusFilter;
}): Promise<{ events: EventRow[]; total: number } | null> {
  if (!supabaseUrl || !supabaseServiceKey) return null;

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const start = (params.page - 1) * params.pageSize;
  const end = start + params.pageSize - 1;

  let query = applyNotDeleted(
    supabase
      .from("events")
      .select("id,name,location,starts_at,capacity,is_active,closed_at,header_image,organizer:organizers(name,slug)", { count: "exact" })
  );

  const term = params.q?.trim();
  if (term) {
    query = query.or(`name.ilike.*${term}*,location.ilike.*${term}*`);
  }

  if (params.status === "active") {
    query = query.eq("is_active", true).is("closed_at", null);
  } else if (params.status === "inactive") {
    query = query.eq("is_active", false).is("closed_at", null);
  } else if (params.status === "closed") {
    query = query.not("closed_at", "is", null);
  }

  const { data, error, count } = await query.order("created_at", { ascending: false }).range(start, end);

  if (error || !data) return null;
  if (data.length === 0) return { events: [], total: 0 };

  const ids = data.map((e: any) => e.id);
  const { data: codes } = await applyNotDeleted(
    supabase.from("codes").select("event_id,code").in("event_id", ids).eq("type", "general").eq("is_active", true)
  );
  const codeMap = new Map<string, string>();
  (codes || []).forEach((c: any) => {
    if (!codeMap.has(c.event_id)) codeMap.set(c.event_id, c.code);
  });

  return {
    events: (data as EventRow[]).map((e) => ({ ...e, code: codeMap.get(e.id) ?? null })),
    total: count ?? data.length,
  };
}

export const dynamic = "force-dynamic";

export default async function EventsPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const page = Math.max(1, parseInt((params?.page as string) || "1", 10) || 1);
  const pageSize = Math.min(100, Math.max(5, parseInt((params?.pageSize as string) || "10", 10) || 10));
  const q = ((params?.q as string) || "").trim();
  const statusParam = ((params?.status as string) || "all").toLowerCase();
  const status: EventStatusFilter =
    statusParam === "active" || statusParam === "inactive" || statusParam === "closed" ? statusParam : "all";

  const result = await getEvents({ page, pageSize, q, status });
  if (!result) return notFound();

  return <EventsClient events={result.events} pagination={{ page, pageSize, q, status }} total={result.total} />;
}
