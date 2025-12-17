import TicketsClient from "./TicketsClient";
import { createClient } from "@supabase/supabase-js";
import { notFound } from "next/navigation";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

type TicketRow = {
  id: string;
  created_at: string;
  dni: string | null;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  event_name: string | null;
  code_value: string | null;
};

async function getTickets(params: {
  from?: string;
  to?: string;
  q?: string;
  page: number;
  pageSize: number;
}): Promise<{ tickets: TicketRow[]; total: number; error?: string }> {
  if (!supabaseUrl || !supabaseServiceKey) return { tickets: [], total: 0, error: "Falta configuración de Supabase" };

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const start = (params.page - 1) * params.pageSize;
  const end = start + params.pageSize - 1;

  let query = supabase
    .from("tickets")
    .select("id,created_at,dni,full_name,email,phone,event_id,code_id", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(start, end);

  if (params.from) {
    const fromIso = `${params.from}T00:00:00`;
    query = query.gte("created_at", fromIso);
  }
  if (params.to) {
    const toIso = `${params.to}T23:59:59`;
    query = query.lte("created_at", toIso);
  }
  if (params.q) {
    const term = params.q.trim();
    if (term) {
      query = query.or(
        ["dni", "full_name", "email", "phone"].map((col) => `${col}.ilike.*${term}*`).join(",")
      );
    }
  }

  const { data, error, count } = await query;
  if (error || !data) return { tickets: [], total: 0, error: error?.message || "No se pudieron cargar tickets" };

  const eventIds = Array.from(new Set((data as any[]).map((t) => t.event_id).filter(Boolean)));
  const codeIds = Array.from(new Set((data as any[]).map((t) => t.code_id).filter(Boolean)));

  const [eventsRes, codesRes] = await Promise.all([
    eventIds.length
      ? supabase.from("events").select("id,name").in("id", eventIds)
      : Promise.resolve({ data: [] as any[], error: null }),
    codeIds.length
      ? supabase.from("codes").select("id,code").in("id", codeIds)
      : Promise.resolve({ data: [] as any[], error: null }),
  ]);

  const eventMap = new Map<string, string>();
  (eventsRes.data || []).forEach((e: any) => eventMap.set(e.id, e.name));
  const codeMap = new Map<string, string>();
  (codesRes.data || []).forEach((c: any) => codeMap.set(c.id, c.code));

  const normalized: TicketRow[] = (data as any[]).map((t) => ({
    id: t.id,
    created_at: t.created_at,
    dni: t.dni ?? null,
    full_name: t.full_name ?? null,
    email: t.email ?? null,
    phone: t.phone ?? null,
    event_name: t.event_id ? eventMap.get(t.event_id) ?? null : null,
    code_value: t.code_id ? codeMap.get(t.code_id) ?? null : null,
  }));

  return { tickets: normalized, total: count ?? normalized.length };
}

export const dynamic = "force-dynamic";

export default async function TicketsPage({ searchParams }: { searchParams?: Record<string, string | string[] | undefined> }) {
  const from = (searchParams?.from as string) || "";
  const to = (searchParams?.to as string) || "";
  const q = (searchParams?.q as string) || "";
  const page = Math.max(1, parseInt((searchParams?.page as string) || "1", 10) || 1);
  const pageSize = Math.min(100, Math.max(5, parseInt((searchParams?.pageSize as string) || "10", 10) || 10));

  const { tickets, total, error } = await getTickets({ from, to, q, page, pageSize });
  if (!tickets && error) return notFound();

  return (
    <TicketsClient
      initialTickets={tickets || []}
      error={error || null}
      filters={{ from, to, q, page, pageSize, total }}
    />
  );
}
