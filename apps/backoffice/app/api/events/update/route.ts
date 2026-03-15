import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { DateTime } from "luxon";
import { EVENT_TZ } from "shared/datetime";
import { DEFAULT_ENTRY_LIMIT, normalizeEntryLimit } from "shared/entryLimit";
import { requireStaffRole } from "shared/auth/requireStaff";
import { generateEventCode, addSuffixIfNeeded } from "shared/friendlyCode";
import { isMissingEventSalesColumnsError } from "shared/eventSales";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase =
  supabaseUrl && supabaseServiceKey
    ? createClient(supabaseUrl, supabaseServiceKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      })
    : null;

export async function POST(req: NextRequest) {
  const guard = await requireStaffRole(req);
  if (!guard.ok) {
    return NextResponse.json({ success: false, error: guard.error }, { status: guard.status });
  }
  if (!supabase) {
    return NextResponse.json({ success: false, error: "Supabase config missing" }, { status: 500 });
  }

  let body: any = null;
  try {
    body = await req.json();
  } catch (_err) {
    return NextResponse.json({ success: false, error: "Invalid JSON" }, { status: 400 });
  }

  const { payload, error, id, code, name, capacity, cover_image } = buildEventPayload(body);
  if (error || !id) {
    return NextResponse.json({ success: false, error: error || "id is required" }, { status: 400 });
  }
  if (payload) {
    payload.sale_updated_at = new Date().toISOString();
    payload.sale_updated_by = guard.context?.staffId || null;
  }

  let { data, error: dbError } = await supabase.from("events").update(payload).eq("id", id).select("id").single();
  if (dbError && isMissingEventSalesColumnsError(dbError)) {
    const legacyPayload = { ...(payload as Record<string, any>) };
    delete legacyPayload.sale_status;
    delete legacyPayload.sale_public_message;
    delete legacyPayload.sale_updated_at;
    delete legacyPayload.sale_updated_by;
    const legacyUpdate = await supabase.from("events").update(legacyPayload).eq("id", id).select("id").single();
    data = legacyUpdate.data;
    dbError = legacyUpdate.error;
  }
  if (dbError) {
    return NextResponse.json({ success: false, error: dbError.message }, { status: 500 });
  }

  const eventId = data?.id ?? id;
  
  const { data: rpcResult, error: rpcError } = await supabase.rpc("set_event_general_code", {
    p_event_id: eventId,
    p_code: code,
    p_capacity: capacity,
  });
  if (rpcError || !rpcResult) {
    const errorMessage =
      rpcError?.code === "23505"
        ? "Ese código ya está asignado a otro evento"
        : rpcError?.message || "El código ya está en uso";
    return NextResponse.json({ success: false, error: errorMessage }, { status: 400 });
  }
  if (cover_image) {
    await upsertCover(supabase, eventId, cover_image);
  } else {
    await supabase.from("event_messages").delete().eq("event_id", eventId).eq("key", "cover_image");
  }

  return NextResponse.json({ success: true, id: eventId });
}

function buildEventPayload(body: any): {
  id?: string;
  payload?: Record<string, any>;
  error?: string;
  code?: string;
  name?: string;
  capacity?: number;
  cover_image?: string;
} {
  const id = typeof body?.id === "string" ? body.id : undefined;
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const location = typeof body?.location === "string" ? body.location.trim() : "";
  const header_image = typeof body?.header_image === "string" ? body.header_image.trim() : "";
  const cover_image = typeof body?.cover_image === "string" ? body.cover_image.trim() : "";
  const entry_limit_input = typeof body?.entry_limit === "string" ? body.entry_limit.trim() : "";

  const date_input = body?.starts_at ?? body?.date;
  const date_value = parseDateToLima(date_input);

  const capacity = Number(body?.capacity);
  const entry_limit = normalizeEntryLimit(entry_limit_input || DEFAULT_ENTRY_LIMIT);

  if (!name) return { id, error: "name is required" };
  if (!date_value) return { id, error: "date must be a valid date" };
  if (!Number.isFinite(capacity) || capacity < 10) return { id, error: "capacity must be >= 10" };
  if (!entry_limit) return { id, error: "entry_limit inválido" };

  const is_active = typeof body?.is_active === "boolean" ? body.is_active : true;
  const saleStatusRaw = typeof body?.sale_status === "string" ? body.sale_status.trim().toLowerCase() : "on_sale";
  const allowedSaleStatuses = new Set(["on_sale", "sold_out", "paused"]);
  if (!allowedSaleStatuses.has(saleStatusRaw)) return { id, error: "sale_status inválido" };
  const sale_public_message =
    typeof body?.sale_public_message === "string" ? body.sale_public_message.trim() : "";
  const code = typeof body?.code === "string" ? body.code.trim() : "";
  const organizer_id = typeof body?.organizer_id === "string" ? body.organizer_id.trim() : "";
  
  if (!code) return { id, error: "Código es requerido" };
  if (!organizer_id) return { id, error: "Organizador es requerido" };

  const marketing_capacity_raw = body?.marketing_capacity != null ? Number(body.marketing_capacity) : null;
  const marketing_capacity = Number.isFinite(marketing_capacity_raw) && marketing_capacity_raw! > 0 ? marketing_capacity_raw : null;
  const early_bird_enabled = typeof body?.early_bird_enabled === "boolean" ? body.early_bird_enabled : false;
  const early_bird_price_1 = Number(body?.early_bird_price_1);
  const early_bird_price_2 = Number(body?.early_bird_price_2);
  const all_night_price_1  = Number(body?.all_night_price_1);
  const all_night_price_2  = Number(body?.all_night_price_2);

  return {
    id,
    payload: {
      name,
      location,
      starts_at: date_value.toUTC().toISO(),
      entry_limit,
      capacity,
      marketing_capacity,
      header_image,
      is_active,
      sale_status: saleStatusRaw,
      sale_public_message: sale_public_message || null,
      organizer_id,
      early_bird_enabled,
      early_bird_price_1: Number.isFinite(early_bird_price_1) && early_bird_price_1 > 0 ? early_bird_price_1 : 15,
      early_bird_price_2: Number.isFinite(early_bird_price_2) && early_bird_price_2 > 0 ? early_bird_price_2 : 25,
      all_night_price_1:  Number.isFinite(all_night_price_1)  && all_night_price_1  > 0 ? all_night_price_1  : 20,
      all_night_price_2:  Number.isFinite(all_night_price_2)  && all_night_price_2  > 0 ? all_night_price_2  : 35,
    },
    code: code || undefined,
    name,
    capacity,
    cover_image,
  };
}

async function upsertCover(supabase: any, eventId: string, coverUrl: string) {
  await supabase
    .from("event_messages")
    .upsert({ event_id: eventId, key: "cover_image", value_text: coverUrl }, { onConflict: "event_id,key" });
}

function parseDateToLima(date_input: any) {
  if (!date_input || typeof date_input !== "string") return null;
  const hasZone = /[zZ]|[+-]\d{2}:?\d{2}$/.test(date_input);
  const base = hasZone
    ? DateTime.fromISO(date_input, { setZone: true })
    : DateTime.fromISO(date_input, { zone: EVENT_TZ });
  if (!base.isValid) return null;
  return base.setZone(EVENT_TZ);
}
