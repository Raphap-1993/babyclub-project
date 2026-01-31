import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
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

const missingConfig = !supabaseUrl || !supabaseServiceKey;

const json = (payload: unknown, status = 200) =>
  NextResponse.json(payload, { status });

export async function GET(req: NextRequest) {
  const guard = await requireStaffRole(req, ["admin", "superadmin"]);
  if (!guard.ok) {
    return json({ error: guard.error }, guard.status);
  }
  if (missingConfig || !supabase) {
    return json({ events: [], error: "Supabase config missing" }, 500);
  }

  const { data, error } = await applyNotDeleted(
    supabase.from("events").select("id,name").order("created_at", { ascending: false }).limit(200)
  );

  if (error) {
    return json({ events: [], error: error.message }, 500);
  }

  return json({ events: data ?? [] });
}

export async function POST(req: NextRequest) {
  const guard = await requireStaffRole(req, ["admin", "superadmin"]);
  if (!guard.ok) {
    return json({ error: guard.error }, guard.status);
  }
  if (missingConfig || !supabase) {
    return json({ error: "Supabase config missing" }, 500);
  }

  let body: any = null;
  try {
    body = await req.json();
  } catch (_err) {
    return json({ error: "Invalid JSON payload" }, 400);
  }

  const { code, event_id, max_uses = null } = body || {};

  if (!code || !event_id) {
    return json({ error: "code and event_id are required" }, 400);
  }

  const trimmedCode = typeof code === "string" ? code.trim() : "";
  if (!trimmedCode) {
    return json({ error: "code and event_id are required" }, 400);
  }
  const numericCapacity = Number(max_uses);
  const parsedCapacity = Number.isFinite(numericCapacity) ? numericCapacity : null;

  const { data, error } = await supabase.rpc("set_event_general_code", {
    p_event_id: event_id,
    p_code: trimmedCode,
    p_capacity: parsedCapacity,
  });

  if (error) {
    const isConflict = error.code === "23505";
    const isEventMissing = error.code === "P0002";
    const message = isConflict ? "El código ya está en uso" : error.message;
    return json({ error: message || "No se pudo guardar el código" }, isConflict || isEventMissing ? 400 : 500);
  }

  return json({ success: true, id: data?.id });
}
