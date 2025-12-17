import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function POST(req: NextRequest) {
  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json({ success: false, error: "Supabase config missing" }, { status: 500 });
  }

  let body: any = null;
  try {
    body = await req.json();
  } catch (_err) {
    return NextResponse.json({ success: false, error: "JSON inválido" }, { status: 400 });
  }

  const code_id = typeof body?.code_id === "string" ? body.code_id.trim() : null;
  const ticket_id = typeof body?.ticket_id === "string" ? body.ticket_id.trim() : null;

  if (!code_id && !ticket_id) {
    return NextResponse.json({ success: false, error: "code_id o ticket_id es requerido" }, { status: 400 });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Buscar ticket
  const { data: ticket, error: ticketErr } = await supabase
    .from("tickets")
    .select("id,code_id,event_id,used,used_at")
    .match(ticket_id ? { id: ticket_id } : { code_id })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (ticketErr) {
    return NextResponse.json({ success: false, error: ticketErr.message }, { status: 400 });
  }

  if (!ticket) {
    return NextResponse.json({ success: false, error: "Ticket no encontrado", result: "not_found" }, { status: 404 });
  }

  if (ticket.used) {
    return NextResponse.json({ success: false, error: "Este ticket ya fue usado", result: "duplicate" }, { status: 400 });
  }

  // Marcar ticket como usado
  const now = new Date().toISOString();
  const { error: updErr } = await supabase
    .from("tickets")
    .update({ used: true, used_at: now })
    .eq("id", ticket.id);
  if (updErr) {
    return NextResponse.json({ success: false, error: updErr.message }, { status: 400 });
  }

  // Log de escaneo confirmado
  await supabase.from("scan_logs").insert({
    event_id: ticket.event_id,
    code_id: ticket.code_id,
    ticket_id: ticket.id,
    raw_value: ticket.id,
    result: "valid",
    scanned_by_staff_id: null,
  });

  return NextResponse.json({ success: true, result: "valid" });
}
