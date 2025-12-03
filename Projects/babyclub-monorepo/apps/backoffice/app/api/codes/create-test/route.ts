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

const missingConfig = !supabaseUrl || !supabaseServiceKey;

const json = (payload: unknown, status = 200) =>
  NextResponse.json(payload, { status });

export async function GET() {
  if (missingConfig || !supabase) {
    return json({ events: [], error: "Supabase config missing" }, 500);
  }

  const { data, error } = await supabase
    .from("events")
    .select("id,name")
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    return json({ events: [], error: error.message }, 500);
  }

  return json({ events: data ?? [] });
}

export async function POST(req: NextRequest) {
  if (missingConfig || !supabase) {
    return json({ error: "Supabase config missing" }, 500);
  }

  let body: any = null;
  try {
    body = await req.json();
  } catch (_err) {
    return json({ error: "Invalid JSON payload" }, 400);
  }

  const {
    code,
    event_id,
    max_uses = 1,
    expires_at = null,
    is_active = true,
    type = "general",
    promoter_id = null,
  } = body || {};

  if (!code || !event_id) {
    return json({ error: "code and event_id are required" }, 400);
  }

  const payload = {
    code,
    event_id,
    max_uses: Number.isFinite(max_uses) ? Number(max_uses) : 1,
    expires_at: expires_at ? new Date(expires_at).toISOString() : null,
    is_active: Boolean(is_active),
    type,
    promoter_id,
  };

  const { data, error } = await supabase
    .from("codes")
    .insert(payload)
    .select("id")
    .single();

  if (error) {
    return json({ error: error.message }, 500);
  }

  return json({ success: true, id: data?.id });
}
