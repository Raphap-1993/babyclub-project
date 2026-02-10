import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { DateTime } from "luxon";
import { EVENT_TZ } from "shared/datetime";
import { DEFAULT_ENTRY_LIMIT, normalizeEntryLimit } from "shared/entryLimit";
import { requireStaffRole } from "shared/auth/requireStaff";
import { applyNotDeleted } from "shared/db/softDelete";

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

  const { payload, error, id, code, name, capacity, cover_image, organizer_id } = buildEventPayload(body);
  if (error || !id) {
    return NextResponse.json({ success: false, error: error || "id is required" }, { status: 400 });
  }

  const existingEventQuery = applyNotDeleted(supabase.from("events").select("id,organizer_id").eq("id", id));
  const { data: existingEvent, error: existingEventError } = await existingEventQuery.maybeSingle();
  if (existingEventError || !existingEvent) {
    return NextResponse.json({ success: false, error: "Evento no encontrado" }, { status: 404 });
  }

  const resolvedOrganizerId =
    organizer_id || (typeof existingEvent.organizer_id === "string" ? existingEvent.organizer_id : "") || (await resolveDefaultOrganizerId(supabase));
  if (!resolvedOrganizerId) {
    return NextResponse.json({ success: false, error: "No hay organizador configurado" }, { status: 400 });
  }

  const organizerQuery = applyNotDeleted(supabase.from("organizers").select("id").eq("id", resolvedOrganizerId));
  const { data: organizerRow, error: organizerError } = await organizerQuery.maybeSingle();
  if (organizerError || !organizerRow) {
    return NextResponse.json({ success: false, error: "Organizador inválido" }, { status: 400 });
  }

  const payloadToUpdate = { ...payload, organizer_id: resolvedOrganizerId };

  const { data, error: dbError } = await supabase.from("events").update(payloadToUpdate).eq("id", id).select("id").single();
  if (dbError) {
    return NextResponse.json({ success: false, error: dbError.message }, { status: 500 });
  }

  const eventId = data?.id ?? id;

  const codeToUse = code as string;
  const { data: rpcResult, error: rpcError } = await supabase.rpc("set_event_general_code", {
    p_event_id: eventId,
    p_code: codeToUse,
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
  organizer_id?: string;
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
  const code = typeof body?.code === "string" ? body.code.trim() : "";
  const organizer_id = typeof body?.organizer_id === "string" ? body.organizer_id.trim() : "";
  if (!code) return { id, error: "code is required" };

  return {
    id,
    payload: {
      name,
      location,
      starts_at: date_value.toUTC().toISO(),
      entry_limit,
      capacity,
      header_image,
      is_active,
    },
    code,
    name,
    capacity,
    cover_image,
    organizer_id,
  };
}

async function resolveDefaultOrganizerId(supabase: any): Promise<string | null> {
  const { data } = await applyNotDeleted(
    supabase
      .from("organizers")
      .select("id")
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true })
      .limit(1)
  ).maybeSingle();
  return data?.id || null;
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
