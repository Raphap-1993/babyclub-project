import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireStaffRole } from "shared/auth/requireStaff";
import { applyNotDeleted } from "shared/db/softDelete";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const MAX_QUANTITY = 500;
const MAX_USES = 50;

function cleanToken(input: string, max = 12): string {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, max);
}

function resolveAuthHeader(req: NextRequest) {
  return req.headers.get("authorization") || req.headers.get("Authorization");
}

export async function POST(req: NextRequest) {
  const guard = await requireStaffRole(req);
  if (!guard.ok) {
    return NextResponse.json({ success: false, error: guard.error }, { status: guard.status });
  }
  if (!supabaseUrl || !supabaseServiceKey || !supabaseAnonKey) {
    return NextResponse.json({ success: false, error: "Falta configuración de Supabase" }, { status: 500 });
  }
  const authHeader = resolveAuthHeader(req);
  if (!authHeader) {
    return NextResponse.json({ success: false, error: "Token requerido" }, { status: 401 });
  }

  let body: any = null;
  try {
    body = await req.json();
  } catch (_err) {
    return NextResponse.json({ success: false, error: "JSON inválido" }, { status: 400 });
  }

  const promoter_id = typeof body?.promoter_id === "string" ? body.promoter_id.trim() : "";
  const event_id = typeof body?.event_id === "string" ? body.event_id.trim() : "";
  const quantity = Math.min(MAX_QUANTITY, Math.max(1, parseInt(body?.quantity, 10) || 0));
  const max_uses = Math.min(MAX_USES, Math.max(1, parseInt(body?.max_uses, 10) || 1));
  const notes = typeof body?.notes === "string" ? body.notes.trim() : null;
  const requestedPrefix = typeof body?.prefix === "string" ? body.prefix.trim() : "";
  const expiresAtRaw = typeof body?.expires_at === "string" ? body.expires_at.trim() : "";
  const expiresAt = expiresAtRaw ? new Date(expiresAtRaw) : null;
  const expiresAtIso = expiresAt && !Number.isNaN(expiresAt.getTime()) ? expiresAt.toISOString() : null;

  if (!promoter_id || !event_id || quantity < 1) {
    return NextResponse.json({ success: false, error: "promoter_id, event_id y cantidad son requeridos" }, { status: 400 });
  }
  if (expiresAtRaw && !expiresAtIso) {
    return NextResponse.json({ success: false, error: "expires_at inválido" }, { status: 400 });
  }

  const serviceSupabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const [promoterRes, eventRes] = await Promise.all([
    applyNotDeleted(
      serviceSupabase
        .from("promoters")
        .select("id,code,person:persons(first_name,last_name)")
        .eq("id", promoter_id),
    ).maybeSingle(),
    applyNotDeleted(
      serviceSupabase
        .from("events")
        .select("id,name,event_prefix,is_active,starts_at")
        .eq("id", event_id),
    ).maybeSingle(),
  ]);

  if (promoterRes.error) {
    return NextResponse.json({ success: false, error: promoterRes.error.message }, { status: 500 });
  }
  if (!promoterRes.data) {
    return NextResponse.json({ success: false, error: "Promotor no encontrado" }, { status: 404 });
  }
  if (eventRes.error) {
    return NextResponse.json({ success: false, error: eventRes.error.message }, { status: 500 });
  }
  if (!eventRes.data) {
    return NextResponse.json({ success: false, error: "Evento no encontrado" }, { status: 404 });
  }
  if (eventRes.data.is_active === false) {
    return NextResponse.json({ success: false, error: "El evento está inactivo" }, { status: 400 });
  }

  const personRel = Array.isArray((promoterRes.data as any).person)
    ? (promoterRes.data as any).person[0]
    : (promoterRes.data as any).person;

  const eventToken = cleanToken((eventRes.data as any).event_prefix || eventRes.data.name || "evento", 10);
  const promoterToken = cleanToken(
    promoterRes.data.code || `${personRel?.first_name || ""} ${personRel?.last_name || ""}`,
    12,
  );
  const suggestedPrefix = [eventToken, promoterToken].filter(Boolean).join("-") || "courtesy";
  const finalPrefix = cleanToken(requestedPrefix || suggestedPrefix, 28) || "courtesy";

  const rpcSupabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data, error } = await rpcSupabase.rpc("generate_codes_batch", {
    p_event_id: event_id,
    p_promoter_id: promoter_id,
    p_type: "promoter",
    p_quantity: quantity,
    p_expires_at: expiresAtIso,
    p_max_uses: max_uses,
    p_prefix: finalPrefix,
    p_notes: notes,
  });

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }

  const batchId = (data as any[])?.[0]?.batch_id || null;
  const codes =
    (data as any[])?.map((row) => (row.generated_code as string) || (row.code as string) || "").filter(Boolean) || [];

  return NextResponse.json({
    success: true,
    batch_id: batchId,
    prefix: finalPrefix,
    codes,
  });
}
