import ModernTicketsClient from "./ModernTicketsClient";
import { createClient } from "@supabase/supabase-js";
import { notFound } from "next/navigation";
import { applyNotDeleted } from "shared/db/softDelete";

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
  promoter_name: string | null;
  table_name: string | null;
};

type SearchParams = Record<string, string | string[] | undefined>;

async function getTickets(params: {
  event_id?: string;
  q?: string;
  promoter_id?: string;
  page: number;
  pageSize: number;
}): Promise<{ tickets: TicketRow[]; total: number; error?: string }> {
  if (!supabaseUrl || !supabaseServiceKey)
    return { tickets: [], total: 0, error: "Falta configuración de Supabase" };

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const start = (params.page - 1) * params.pageSize;
  const end = start + params.pageSize - 1;

  let query = applyNotDeleted(
    supabase
      .from("tickets")
      .select(
        "id,created_at,dni,full_name,email,phone,event_id,code_id,promoter_id,table_reservation_id,code:codes(id,code,promoter_id,table_reservation_id)",
        { count: "exact" },
      )
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .range(start, end),
  );

  if (params.event_id) {
    query = query.eq("event_id", params.event_id);
  }
  if (params.q) {
    const term = params.q.trim();
    if (term) {
      query = query.or(
        ["dni", "full_name", "email", "phone"]
          .map((col) => `${col}.ilike.*${term}*`)
          .join(","),
      );
    }
  }
  if (params.promoter_id) {
    // Traemos los IDs de códigos asignados a ese promotor para filtrar también por code_id y evitar parsers raros en Supabase.
    const { data: codesByPromoter } = await applyNotDeleted(
      supabase
        .from("codes")
        .select("id")
        .eq("promoter_id", params.promoter_id)
        .eq("is_active", true),
    );
    const codeIdsForPromoter = (codesByPromoter || [])
      .map((c: any) => c.id)
      .filter(Boolean);
    const promoterFilters = [`promoter_id.eq.${params.promoter_id}`];
    if (codeIdsForPromoter.length > 0) {
      promoterFilters.push(`code_id.in.(${codeIdsForPromoter.join(",")})`);
    }
    query = query.or(promoterFilters.join(","));
  }

  const { data, error, count } = await query;
  if (error || !data)
    return {
      tickets: [],
      total: 0,
      error: error?.message || "No se pudieron cargar tickets",
    };

  const eventIds = Array.from(
    new Set((data as any[]).map((t) => t.event_id).filter(Boolean)),
  );
  const codeIds = Array.from(
    new Set(
      (data as any[])
        .map((t) => {
          const cRel = Array.isArray((t as any).code)
            ? (t as any).code?.[0]
            : (t as any).code;
          return cRel?.id || t.code_id;
        })
        .filter(Boolean),
    ),
  );
  const promoterIds = Array.from(
    new Set(
      (data as any[])
        .flatMap((t) => {
          const codeRel = Array.isArray((t as any).code)
            ? (t as any).code?.[0]
            : (t as any).code;
          return [t.promoter_id, codeRel?.promoter_id].filter(Boolean);
        })
        .filter(Boolean),
    ),
  );
  const reservationIds = Array.from(
    new Set(
      (data as any[])
        .map((t) => {
          const codeRel = Array.isArray((t as any).code)
            ? (t as any).code?.[0]
            : (t as any).code;
          return (
            (t as any).table_reservation_id ||
            codeRel?.table_reservation_id ||
            null
          );
        })
        .filter(Boolean),
    ),
  );

  const [eventsRes, codesRes, promotersRes, reservationsRes] =
    await Promise.all([
      eventIds.length
        ? applyNotDeleted(
            supabase.from("events").select("id,name").in("id", eventIds),
          )
        : Promise.resolve({ data: [] as any[], error: null }),
      codeIds.length
        ? applyNotDeleted(
            supabase.from("codes").select("id,code").in("id", codeIds),
          )
        : Promise.resolve({ data: [] as any[], error: null }),
      promoterIds.length
        ? applyNotDeleted(
            supabase
              .from("promoters")
              .select("id,code,person:persons(first_name,last_name)")
              .in("id", promoterIds),
          )
        : Promise.resolve({ data: [] as any[], error: null }),
      reservationIds.length
        ? applyNotDeleted(
            supabase
              .from("table_reservations")
              .select("id,table:tables(name)")
              .in("id", reservationIds),
          )
        : Promise.resolve({ data: [] as any[], error: null }),
    ]);

  const eventMap = new Map<string, string>();
  (eventsRes.data || []).forEach((e: any) => eventMap.set(e.id, e.name));
  const codeMap = new Map<string, string>();
  (codesRes.data || []).forEach((c: any) => codeMap.set(c.id, c.code));
  const promoterMap = new Map<string, string>();
  (promotersRes.data || []).forEach((p: any) => {
    const personRel = Array.isArray(p.person) ? p.person[0] : p.person;
    const full = [personRel?.first_name, personRel?.last_name]
      .filter(Boolean)
      .join(" ")
      .trim();
    promoterMap.set(p.id, full || p.code || "");
  });
  const reservationTableMap = new Map<string, string | null>();
  (reservationsRes.data || []).forEach((reservation: any) => {
    const tableRel = Array.isArray(reservation.table)
      ? reservation.table[0]
      : reservation.table;
    reservationTableMap.set(reservation.id, tableRel?.name || null);
  });

  const normalized: TicketRow[] = (data as any[]).map((t) => ({
    id: t.id,
    created_at: t.created_at,
    dni: t.dni ?? null,
    full_name: t.full_name ?? null,
    email: t.email ?? null,
    phone: t.phone ?? null,
    event_name: t.event_id ? (eventMap.get(t.event_id) ?? null) : null,
    code_value: (() => {
      const codeRel = Array.isArray((t as any).code)
        ? (t as any).code?.[0]
        : (t as any).code;
      return (
        codeRel?.code || (t.code_id ? (codeMap.get(t.code_id) ?? null) : null)
      );
    })(),
    promoter_name: (() => {
      const codeRel = Array.isArray((t as any).code)
        ? (t as any).code?.[0]
        : (t as any).code;
      const promoterId = t.promoter_id || codeRel?.promoter_id || null;
      if (!promoterId) return null;
      return promoterMap.get(promoterId) ?? null;
    })(),
    table_name: (() => {
      const codeRel = Array.isArray((t as any).code)
        ? (t as any).code?.[0]
        : (t as any).code;
      const reservationId =
        (t as any).table_reservation_id ||
        codeRel?.table_reservation_id ||
        null;
      if (!reservationId) return null;
      return reservationTableMap.get(reservationId) ?? null;
    })(),
  }));

  return { tickets: normalized, total: count ?? normalized.length };
}

export const dynamic = "force-dynamic";

export default async function TicketsPage({
  searchParams,
}: {
  searchParams?: SearchParams | Promise<SearchParams>;
}) {
  const params = await searchParams;
  const event_id = (params?.event_id as string) || "";
  const q = (params?.q as string) || "";
  const promoter_id = (params?.promoter_id as string) || "";
  const page = Math.max(1, parseInt((params?.page as string) || "1", 10) || 1);
  const pageSize = Math.min(
    100,
    Math.max(5, parseInt((params?.pageSize as string) || "10", 10) || 10),
  );

  const { tickets, total, error } = await getTickets({
    event_id,
    q,
    promoter_id,
    page,
    pageSize,
  });
  const supabaseForFilters =
    supabaseUrl && supabaseServiceKey
      ? createClient(supabaseUrl, supabaseServiceKey, {
          auth: { autoRefreshToken: false, persistSession: false },
        })
      : null;
  const [promoterOptionsRes, eventOptionsRes] = supabaseForFilters
    ? await Promise.all([
        supabaseForFilters
          .from("promoters")
          .select("id,code,person:persons(first_name,last_name)")
          .order("created_at", { ascending: true })
          .limit(300),
        applyNotDeleted(
          supabaseForFilters
            .from("events")
            .select("id,name")
            .order("name", { ascending: true })
            .limit(500),
        ),
      ])
    : [{ data: [] as any[] }, { data: [] as any[] }];

  const promoterOptions = promoterOptionsRes.data;
  const promoterFilters =
    (promoterOptions || []).map((p: any) => {
      const personRel = Array.isArray(p.person) ? p.person[0] : p.person;
      const full = [personRel?.first_name, personRel?.last_name]
        .filter(Boolean)
        .join(" ")
        .trim();
      return { id: p.id as string, label: full || p.code || "" };
    }) ?? [];
  const eventFilters =
    (eventOptionsRes.data || []).map((event: any) => ({
      id: event.id as string,
      label: event.name as string,
    })) ?? [];

  if (!tickets && error) return notFound();

  return (
    <ModernTicketsClient
      initialTickets={tickets || []}
      error={error || null}
      filters={{ event_id, q, promoter_id, page, pageSize, total }}
      promoterOptions={promoterFilters}
      eventOptions={eventFilters}
    />
  );
}
