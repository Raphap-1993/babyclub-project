import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

type ScanResult =
  | "valid"
  | "duplicate"
  | "expired"
  | "inactive"
  | "invalid"
  | "not_found"
  | "exhausted";
type MatchType = "code" | "ticket" | "none";

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

  const codeValue = typeof body?.code === "string" ? body.code.trim() : "";
  const event_id = typeof body?.event_id === "string" ? body.event_id.trim() : "";
  const raw_value = codeValue;

  if (!codeValue || !event_id) {
    return NextResponse.json({ success: false, error: "code y event_id son requeridos" }, { status: 400 });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const now = new Date();

  // Buscar el código exacto dentro del evento
  const { data: codeRow, error: codeErr } = await supabase
    .from("codes")
    .select("id,code,type,event_id,is_active,max_uses,uses,expires_at")
    .eq("event_id", event_id)
    .eq("code", codeValue)
    .maybeSingle();

  if (codeErr) {
    return NextResponse.json({ success: false, error: codeErr.message }, { status: 400 });
  }

  let result: ScanResult = "not_found";
  let code_id: string | null = null;
  let ticket_id: string | null = null;
  let person: { full_name: string | null; dni: string | null; email: string | null; phone: string | null } | null = null;
  let ticket_used = false;
  let match_type: MatchType = "none";
  let reason: string | null = null;
  let other_event: { id: string; name: string | null } | null = null;

  if (codeRow) {
    match_type = "code";
    code_id = codeRow.id;
    const expired = codeRow.expires_at ? new Date(codeRow.expires_at) < now : false;
    if (!codeRow.is_active) {
      result = "inactive";
    } else if (expired) {
      result = "expired";
    } else if (codeRow.max_uses !== null && codeRow.max_uses !== undefined && (codeRow.uses ?? 0) >= codeRow.max_uses) {
      result = "exhausted";
    } else {
      result = "valid";
    }

    // Intentar buscar datos de ticket asociado al code
    const { data: ticketData } = await supabase
      .from("tickets")
      .select("id,full_name,dni,email,phone,used")
      .eq("code_id", codeRow.id)
      .eq("event_id", event_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (ticketData) {
      ticket_id = (ticketData as any).id ?? null;
      ticket_used = Boolean((ticketData as any).used);
      person = {
        full_name: (ticketData as any).full_name ?? null,
        dni: (ticketData as any).dni ?? null,
        email: (ticketData as any).email ?? null,
        phone: (ticketData as any).phone ?? null,
      };
      if (ticket_used) {
        result = "duplicate";
      }
    }
  }

  // Si no encontró código, intentar por QR token en tickets
  if (!codeRow) {
    const { data: ticketRow } = await supabase
      .from("tickets")
      .select("id,code_id,full_name,dni,email,phone,used")
      .eq("qr_token", codeValue)
      .eq("event_id", event_id)
      .maybeSingle();
    if (ticketRow) {
      match_type = "ticket";
      ticket_id = ticketRow.id;
      code_id = ticketRow.code_id ?? null;
      ticket_used = Boolean((ticketRow as any).used);
      result = ticket_used ? "duplicate" : "valid";
      person = {
        full_name: (ticketRow as any).full_name ?? null,
        dni: (ticketRow as any).dni ?? null,
        email: (ticketRow as any).email ?? null,
        phone: (ticketRow as any).phone ?? null,
      };
    }
  }

  if (!codeRow && match_type === "none") {
    const { data: otherCode } = await supabase
      .from("codes")
      .select("event_id,event:events(name)")
      .eq("code", codeValue)
      .neq("event_id", event_id)
      .maybeSingle();
    const { data: otherTicket } = await supabase
      .from("tickets")
      .select("event_id,event:events(name)")
      .eq("qr_token", codeValue)
      .neq("event_id", event_id)
      .maybeSingle();
    const otherSource: any = otherCode || otherTicket;
    if (otherSource?.event_id) {
      const eventRel = Array.isArray(otherSource.event) ? otherSource.event?.[0] : otherSource.event;
      other_event = {
        id: otherSource.event_id,
        name: eventRel?.name ?? null,
      };
      result = "invalid";
      reason = "event_mismatch";
    } else {
      result = "not_found";
      reason = "not_found";
    }
  }

  // Guardar log
  await supabase.from("scan_logs").insert({
    event_id,
    code_id,
    ticket_id,
    raw_value,
    result,
    scanned_by_staff_id: null,
  });

  return NextResponse.json({
    success: true,
    result,
    reason,
    match_type,
    other_event,
    code_id,
    ticket_id,
    uses: codeRow?.uses ?? 0,
    max_uses: codeRow?.max_uses ?? null,
    expired_at: codeRow?.expires_at ?? null,
    person,
    ticket_used,
  });
}
