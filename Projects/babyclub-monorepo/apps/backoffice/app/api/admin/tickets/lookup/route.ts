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
    return NextResponse.json({ success: false, error: "Invalid JSON" }, { status: 400 });
  }

  const ticket_id = typeof body?.ticket_id === "string" ? body.ticket_id.trim() : "";
  const dni = typeof body?.dni === "string" ? body.dni.trim() : "";
  const email = typeof body?.email === "string" ? body.email.trim() : "";
  const phone = typeof body?.phone === "string" ? body.phone.trim() : "";
  const code = typeof body?.code === "string" ? body.code.trim() : "";
  const event_id = typeof body?.event_id === "string" ? body.event_id.trim() : "";

  if (!ticket_id && !dni && !email && !phone && !code) {
    return NextResponse.json({ success: false, error: "Ingresa ticket_id o DNI/Email/Teléfono/Código" }, { status: 400 });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  let codeId: string | null = null;
  if (code) {
    const { data: codeRow, error: codeErr } = await supabase
      .from("codes")
      .select("id,event_id")
      .eq("code", code)
      .maybeSingle();
    if (codeErr) {
      return NextResponse.json({ success: false, error: codeErr.message }, { status: 400 });
    }
    if (!codeRow?.id) {
      return NextResponse.json({ success: false, error: "Código no encontrado" }, { status: 404 });
    }
    codeId = codeRow.id;
    // si el código pertenece a otro evento, devolvemos igualmente para que el admin decida
    if (!event_id && codeRow.event_id) {
      // noop: se usará en la respuesta
    }
  }

  let query = supabase
    .from("tickets")
    .select(
      "id,event_id,code_id,full_name,email,phone,dni,code:codes(code),person:persons(first_name,last_name,email,phone),event:events(name,starts_at)"
    )
    .limit(1);

  const ors: string[] = [];
  if (ticket_id) {
    query = query.eq("id", ticket_id);
  } else {
    if (dni) ors.push(`dni.eq.${dni}`);
    if (email) ors.push(`email.eq.${email}`);
    if (phone) ors.push(`phone.eq.${phone}`);
    if (ors.length > 0) {
      query = query.or(ors.join(",")).order("created_at", { ascending: false });
    }
    if (codeId) {
      query = query.eq("code_id", codeId);
    }
  }

  if (event_id) query = query.eq("event_id", event_id);

  const { data, error } = await query.maybeSingle();
  if (error || !data) {
    return NextResponse.json({ success: false, error: error?.message || "Ticket no encontrado" }, { status: 404 });
  }

  const personRel = Array.isArray((data as any).person) ? (data as any).person?.[0] : (data as any).person;
  const eventRel = Array.isArray((data as any).event) ? (data as any).event?.[0] : (data as any).event;
  const codeRel = Array.isArray((data as any).code) ? (data as any).code?.[0] : (data as any).code;

  const full_name = data.full_name || `${personRel?.first_name || ""} ${personRel?.last_name || ""}`.trim();

  return NextResponse.json({
    success: true,
    ticket: {
      id: data.id,
      event_id: data.event_id,
      full_name,
      email: data.email || personRel?.email || null,
      phone: data.phone || personRel?.phone || null,
      dni: data.dni || null,
      code: codeRel?.code || null,
      event: eventRel ? { name: eventRel.name, starts_at: eventRel.starts_at } : null,
    },
  });
}
