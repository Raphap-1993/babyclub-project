import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { DateTime } from "luxon";
import { EVENT_TZ } from "shared/datetime";
import { DEFAULT_ENTRY_LIMIT, normalizeEntryLimit } from "shared/entryLimit";
import { requireStaffRole } from "shared/auth/requireStaff";

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

  const { payload, error, capacity, code: requestedCode, name, cover_image } = buildEventPayload(body);
  if (error) {
    return NextResponse.json({ success: false, error }, { status: 400 });
  }

  const { data, error: dbError } = await supabase.from("events").insert(payload).select("id").single();
  if (dbError) {
    return NextResponse.json({ success: false, error: dbError.message }, { status: 500 });
  }

  const eventId = data?.id;

  if (eventId) {
    const codeToUse = requestedCode as string;
    const { data: rpcResult, error: rpcError } = await supabase.rpc("set_event_general_code", {
      p_event_id: eventId,
      p_code: codeToUse,
      p_capacity: capacity,
    });
    if (rpcError) {
      await supabase.from("events").delete().eq("id", eventId);
      const errorMessage =
        rpcError.code === "23505" ? "Ese código ya está asignado a otro evento" : rpcError.message || "Código no disponible";
      return NextResponse.json({ success: false, error: errorMessage }, { status: 400 });
    }
    if (!rpcResult) {
      await supabase.from("events").delete().eq("id", eventId);
      return NextResponse.json({ success: false, error: "No se pudo guardar el código del evento" }, { status: 400 });
    }
    if (cover_image) {
      await upsertCover(supabase, eventId, cover_image);
    }
  }

  return NextResponse.json({ success: true, id: eventId ?? null });
}

function buildEventPayload(body: any): {
  payload?: Record<string, any>;
  error?: string;
  capacity?: number;
  code?: string;
  name?: string;
  cover_image?: string;
} {
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const location = typeof body?.location === "string" ? body.location.trim() : "";
  const header_image = typeof body?.header_image === "string" ? body.header_image.trim() : "";
  const cover_image = typeof body?.cover_image === "string" ? body.cover_image.trim() : "";
  const entry_limit_input = typeof body?.entry_limit === "string" ? body.entry_limit.trim() : "";

  const date_input = body?.starts_at ?? body?.date;
  const date_value = parseDateToLima(date_input);

  const capacity = Number(body?.capacity);
  const entry_limit = normalizeEntryLimit(entry_limit_input || DEFAULT_ENTRY_LIMIT);

  if (!name) return { error: "name is required" };
  if (!date_value) return { error: "date must be a valid date" };
  if (!Number.isFinite(capacity) || capacity < 10) return { error: "capacity must be >= 10" };
  if (!entry_limit) return { error: "entry_limit inválido" };

  const is_active = typeof body?.is_active === "boolean" ? body.is_active : true;
  const code = typeof body?.code === "string" ? body.code.trim() : "";
  if (!code) return { error: "code is required" };

  return {
    payload: {
      name,
      location,
      starts_at: date_value.toUTC().toISO(),
      entry_limit,
      capacity,
      header_image,
      is_active,
    },
    capacity,
    code,
    name,
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
