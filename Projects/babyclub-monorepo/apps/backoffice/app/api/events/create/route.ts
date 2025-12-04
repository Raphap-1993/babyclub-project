import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase =
  supabaseUrl && supabaseServiceKey
    ? createClient(supabaseUrl, supabaseServiceKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      })
    : null;

export async function POST(req: NextRequest) {
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
    const codeToUse = generateCode(requestedCode || "", name || "", eventId);
    await insertCodeWithFallback(supabase, codeToUse, eventId, capacity);
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

  const date_input = body?.starts_at ?? body?.date;
  const date_value = date_input ? new Date(date_input) : null;

  const capacity = Number(body?.capacity);

  if (!name) return { error: "name is required" };
  if (!date_value || Number.isNaN(date_value.getTime())) return { error: "date must be a valid date" };
  if (!Number.isFinite(capacity) || capacity < 10) return { error: "capacity must be >= 10" };

  const is_active = typeof body?.is_active === "boolean" ? body.is_active : true;
  const code = typeof body?.code === "string" ? body.code.trim() : "";

  return {
    payload: {
      name,
      location,
      starts_at: new Date(date_value).toISOString(),
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

function generateCode(requested: string, name: string, eventId: string) {
  const base =
    requested ||
    name
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 32);

  const cleaned = base || eventId.replace(/-/g, "").slice(0, 8);
  return cleaned.toLowerCase();
}

async function insertCodeWithFallback(
  supabase: any,
  code: string,
  eventId: string,
  capacity?: number
) {
  const candidates = [code, `${code}-${Math.floor(Math.random() * 9000 + 1000)}`].filter(Boolean) as string[];

  for (const candidate of candidates) {
    const { error } = await supabase.from("codes").insert({
      code: candidate,
      event_id: eventId,
      max_uses: Number.isFinite(capacity) ? capacity : 1,
      expires_at: null,
      is_active: true,
      type: "general",
      promoter_id: null,
    });
    if (!error) return candidate;
  }

  return code;
}

async function upsertCover(supabase: any, eventId: string, coverUrl: string) {
  await supabase
    .from("event_messages")
    .upsert({ event_id: eventId, key: "cover_image", value_text: coverUrl }, { onConflict: "event_id,key" });
}
