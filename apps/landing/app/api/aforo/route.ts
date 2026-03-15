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
  if (!eventId) {
    return NextResponse.json({ success: false, error: "Código sin evento asociado" }, { status: 404 });
  }

  const { data: eventRow, error: eventError } = await applyNotDeleted(
    supabase.from("events").select("capacity,marketing_capacity").eq("id", eventId)
  ).maybeSingle();

  if (eventError || !eventRow) {
    return NextResponse.json({ success: false, error: "Evento no encontrado" }, { status: 404 });
  }

  // Fase B: la barra visual usa marketing_capacity si está configurada,
  // si no, usa la capacidad real. El bloqueo de tickets usa siempre capacity real.
  const displayCapacity =
    typeof eventRow.marketing_capacity === "number" && eventRow.marketing_capacity > 0
      ? eventRow.marketing_capacity
      : Number(eventRow.capacity) || 0;

  // Contar TODOS los tickets activos del evento (no solo del código)
  const { data: countData, error: ticketsError } = await supabase.rpc("count_event_tickets", {
    p_event_id: eventId,
  });

  if (ticketsError) {
    return NextResponse.json({ success: false, error: ticketsError.message }, { status: 500 });
  }

  const usedCount = Number(countData ?? 0);
  const available = Math.max(displayCapacity - usedCount, 0);
  const percent = displayCapacity > 0 ? Math.min(Math.round((usedCount / displayCapacity) * 100), 100) : 0;

  return NextResponse.json({ success: true, capacity: displayCapacity, used: usedCount, available, percent });
}
