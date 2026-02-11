import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireStaffRole } from "shared/auth/requireStaff";
import { applyNotDeleted } from "shared/db/softDelete";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function GET(req: NextRequest) {
  const guard = await requireStaffRole(req);
  if (!guard.ok) {
    return NextResponse.json({ success: false, error: guard.error }, { status: guard.status });
  }
  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json({ success: false, error: "Falta configuración de Supabase" }, { status: 500 });
  }

  const slugify = (val: string) =>
    val
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .trim();

  const search = req.nextUrl.searchParams;
  const from = search.get("from") || "";
  const to = search.get("to") || "";
  const q = search.get("q") || "";
  const promoter_id = search.get("promoter_id") || "";
  const organizer_id = search.get("organizer_id") || "";
  let promoterLabel: string | null = null;
  let organizerLabel: string | null = null;

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  let query = applyNotDeleted(
    supabase
      .from("tickets")
      .select("id,created_at,dni,full_name,email,phone,event_id,code_id,promoter_id,code:codes(id,code,promoter_id)", {
        count: "exact",
      })
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      // límite para evitar respuestas gigantes y respetar el tope de PostgREST
      .limit(5000)
  );

  if (from) {
    query = query.gte("created_at", `${from}T00:00:00`);
  }
  if (to) {
    query = query.lte("created_at", `${to}T23:59:59`);
  }
  if (q) {
    const term = q.trim();
    if (term) {
      query = query.or(["dni", "full_name", "email", "phone"].map((col) => `${col}.ilike.*${term}*`).join(","));
    }
  }
  if (promoter_id) {
    const promoterQuery = applyNotDeleted(
      supabase.from("promoters").select("code,person:persons(first_name,last_name)").eq("id", promoter_id)
    );
    const { data: promoterRows } = await promoterQuery.maybeSingle();
    const personRel = promoterRows ? (Array.isArray((promoterRows as any).person) ? (promoterRows as any).person?.[0] : (promoterRows as any).person) : null;
    const personName = [personRel?.first_name, personRel?.last_name].filter(Boolean).join(" ").trim();
    promoterLabel = personName || promoterRows?.code || promoter_id;

    const { data: codesByPromoter } = await applyNotDeleted(
      supabase.from("codes").select("id").eq("promoter_id", promoter_id).eq("is_active", true)
    );
    const codeIdsForPromoter = (codesByPromoter || []).map((c: any) => c.id).filter(Boolean);
    const promoterFilters = [`promoter_id.eq.${promoter_id}`];
    if (codeIdsForPromoter.length > 0) {
      promoterFilters.push(`code_id.in.(${codeIdsForPromoter.join(",")})`);
    }
    query = query.or(promoterFilters.join(","));
  }
  if (organizer_id) {
    const organizerQuery = applyNotDeleted(supabase.from("organizers").select("id,name").eq("id", organizer_id));
    const { data: organizerRow } = await organizerQuery.maybeSingle();
    organizerLabel = organizerRow?.name || organizer_id;

    const { data: organizerEvents, error: organizerEventsError } = await applyNotDeleted(
      supabase.from("events").select("id").eq("organizer_id", organizer_id)
    );
    if (organizerEventsError) {
      return NextResponse.json({ success: false, error: organizerEventsError.message }, { status: 400 });
    }
    const organizerEventIds = (organizerEvents || []).map((e: any) => e.id).filter(Boolean);
    if (organizerEventIds.length === 0) {
      return new Response("created_at,event_name,dni,full_name,email,phone,code,promoter,organizer\n", {
        status: 200,
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="tickets-organizer-${organizer_id}.csv"`,
        },
      });
    }
    query = query.in("event_id", organizerEventIds);
  }

  const { data, error } = await query;
  if (error || !data) {
    return NextResponse.json({ success: false, error: error?.message || "No se pudieron exportar tickets" }, { status: 400 });
  }

  const eventIds = Array.from(new Set((data as any[]).map((t) => t.event_id).filter(Boolean)));
  const codeIds = Array.from(
    new Set(
      (data as any[])
        .map((t) => {
          const cRel = Array.isArray((t as any).code) ? (t as any).code?.[0] : (t as any).code;
          return cRel?.id || t.code_id;
        })
        .filter(Boolean),
    ),
  );
  const promoterIds = Array.from(
    new Set(
      (data as any[])
        .flatMap((t) => {
          const codeRel = Array.isArray((t as any).code) ? (t as any).code?.[0] : (t as any).code;
          return [t.promoter_id, codeRel?.promoter_id].filter(Boolean);
        })
        .filter(Boolean),
    ),
  );

  const [eventsRes, codesRes, promotersRes] = await Promise.all([
    eventIds.length
      ? applyNotDeleted(supabase.from("events").select("id,name,organizer_id").in("id", eventIds))
      : Promise.resolve({ data: [] as any[], error: null }),
    codeIds.length
      ? applyNotDeleted(supabase.from("codes").select("id,code").in("id", codeIds))
      : Promise.resolve({ data: [] as any[], error: null }),
    promoterIds.length
      ? applyNotDeleted(supabase.from("promoters").select("id,code,person:persons(first_name,last_name)").in("id", promoterIds))
      : Promise.resolve({ data: [] as any[], error: null }),
  ]);

  const eventMap = new Map<string, string>();
  const eventOrganizerMap = new Map<string, string>();
  (eventsRes.data || []).forEach((e: any) => {
    eventMap.set(e.id, e.name);
    if (e.organizer_id) eventOrganizerMap.set(e.id, e.organizer_id);
  });
  const codeMap = new Map<string, string>();
  (codesRes.data || []).forEach((c: any) => codeMap.set(c.id, c.code));
  const promoterMap = new Map<string, string>();
  (promotersRes.data || []).forEach((p: any) => {
    const personRel = Array.isArray(p.person) ? p.person[0] : p.person;
    const full = [personRel?.first_name, personRel?.last_name].filter(Boolean).join(" ").trim();
    promoterMap.set(p.id, full || p.code || "");
  });

  const organizerIds = Array.from(new Set((eventsRes.data || []).map((e: any) => e.organizer_id).filter(Boolean)));
  const { data: organizersRes } =
    organizerIds.length > 0
      ? await applyNotDeleted(supabase.from("organizers").select("id,name").in("id", organizerIds))
      : { data: [] as any[] };
  const organizerMap = new Map<string, string>();
  (organizersRes || []).forEach((o: any) => organizerMap.set(o.id, o.name));

  const rows = (data as any[]).map((t) => {
    const codeRel = Array.isArray((t as any).code) ? (t as any).code?.[0] : (t as any).code;
    const promoterId = t.promoter_id || codeRel?.promoter_id || null;
    const organizerName = t.event_id ? organizerMap.get(eventOrganizerMap.get(t.event_id) || "") || "" : "";
    return {
      created_at: t.created_at,
      event_name: t.event_id ? eventMap.get(t.event_id) ?? "" : "",
      dni: t.dni ?? "",
      full_name: t.full_name ?? "",
      email: t.email ?? "",
      phone: t.phone ?? "",
      code_value: codeRel?.code || (t.code_id ? codeMap.get(t.code_id) ?? "" : ""),
      promoter_name: promoterId ? promoterMap.get(promoterId) ?? "" : "",
      organizer_name: organizerName,
    };
  });

  const headers = ["created_at", "event_name", "dni", "full_name", "email", "phone", "code", "promoter", "organizer"];
  const csv = [
    headers.join(","),
    ...rows.map((r) =>
      [
        r.created_at,
        r.event_name,
        r.dni,
        r.full_name,
        r.email,
        r.phone,
        r.code_value,
        r.promoter_name,
        r.organizer_name,
      ]
        .map((val) => `"${String(val ?? "").replace(/"/g, '""')}"`)
        .join(","),
    ),
  ].join("\n");

  const nameParts: string[] = [];
  if (from || to) nameParts.push(slugify(`rango-${from || "inicio"}-${to || "hoy"}`));
  if (promoter_id) nameParts.push(slugify(`promotor-${promoterLabel || promoter_id}`));
  if (organizer_id) nameParts.push(slugify(`organizer-${organizerLabel || organizer_id}`));
  if (q) nameParts.push(slugify(`q-${q.slice(0, 30)}`));
  const filename = `tickets-${nameParts.length ? nameParts.join("-") : "all"}.csv`;

  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
