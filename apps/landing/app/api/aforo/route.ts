import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { applyNotDeleted } from "shared/db/softDelete";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function GET(req: NextRequest) {
  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json({ success: false, error: "Supabase config missing" }, { status: 500 });
  }

  const code = req.nextUrl.searchParams.get("code")?.trim() || "";
  if (!code) {
    return NextResponse.json({ success: false, error: "code is required" }, { status: 400 });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const codeQuery = applyNotDeleted(
    supabase.from("codes").select("id,event_id,max_uses").eq("code", code)
  );
  const { data: codeRow, error: codeError } = await codeQuery.maybeSingle();

  if (codeError || !codeRow) {
    return NextResponse.json({ success: false, error: "Código inválido" }, { status: 404 });
  }

  const eventId = codeRow.event_id;
  let capacity = typeof codeRow.max_uses === "number" ? codeRow.max_uses : 0;
  if (!capacity && eventId) {
    const eventQuery = applyNotDeleted(supabase.from("events").select("capacity").eq("id", eventId));
    const { data: eventRow, error: eventError } = await eventQuery.maybeSingle();

    if (eventError || !eventRow) {
      return NextResponse.json({ success: false, error: "Evento no encontrado" }, { status: 404 });
    }

    capacity = Number(eventRow.capacity) || 0;
  }

  const { count: used, error: ticketsError } = await applyNotDeleted(
    supabase.from("tickets").select("id", { count: "exact", head: true }).eq("code_id", codeRow.id)
  );

  if (ticketsError) {
    return NextResponse.json({ success: false, error: ticketsError.message }, { status: 500 });
  }

  const usedCount = used ?? 0;
  const available = Math.max(capacity - usedCount, 0);
  const percent = capacity > 0 ? Math.min(Math.round((usedCount / capacity) * 100), 100) : 0;

  return NextResponse.json({ success: true, capacity, used: usedCount, available, percent });
}
