import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createTicketForReservation } from "../utils";
import { sendApprovalEmail, sendTicketEmail } from "../email";
import { requireStaffRole } from "shared/auth/requireStaff";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const resendApiKey = process.env.RESEND_API_KEY;

export async function POST(req: NextRequest) {
  const guard = await requireStaffRole(req);
  if (!guard.ok) {
    return NextResponse.json({ success: false, error: guard.error }, { status: guard.status });
  }
  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json({ success: false, error: "Supabase config missing" }, { status: 500 });
  }
  if (!resendApiKey) {
    return NextResponse.json(
      { success: false, error: "Correo no disponible: configura RESEND_API_KEY" },
      { status: 400 }
    );
  }

  let body: any = null;
  try {
    body = await req.json();
  } catch (_err) {
    return NextResponse.json({ success: false, error: "Invalid JSON" }, { status: 400 });
  }

  const id = typeof body?.id === "string" ? body.id : "";
  if (!id) {
    return NextResponse.json({ success: false, error: "Invalid id" }, { status: 400 });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: reservation } = await supabase
    .from("table_reservations")
    .select(
      "id,full_name,email,phone,doc_type,document,status,codes,ticket_id,event_id,promoter_id,table:tables(id,name,event_id,event:events(id,name,starts_at,location)),event:event_id(id,name,starts_at,location)"
    )
    .eq("id", id)
    .maybeSingle();

  if (!reservation) {
    return NextResponse.json({ success: false, error: "Reserva no encontrada" }, { status: 404 });
  }

  const status = ((reservation as any).status || "").toLowerCase();
  if (status !== "approved") {
    return NextResponse.json(
      { success: false, error: "Solo puedes reenviar correos para reservas aprobadas" },
      { status: 400 }
    );
  }

  const email = typeof (reservation as any).email === "string" ? (reservation as any).email.trim() : "";
  if (!email) {
    return NextResponse.json({ success: false, error: "Ingresa un correo para notificar" }, { status: 400 });
  }

  const tableRel = Array.isArray((reservation as any).table) ? (reservation as any).table?.[0] : (reservation as any).table;
  const isTableReservation = Boolean(tableRel?.id);
  const tableName = tableRel?.name || "Entrada";
  const eventRel = tableRel?.event
    ? Array.isArray(tableRel.event)
      ? tableRel.event[0]
      : tableRel.event
    : null;
  const eventDirectRel = (reservation as any).event
    ? Array.isArray((reservation as any).event)
      ? (reservation as any).event?.[0]
      : (reservation as any).event
    : null;
  const eventData = eventRel || eventDirectRel || null;
  const eventId = tableRel?.event_id || eventRel?.id || (reservation as any).event_id || eventDirectRel?.id || null;
  const codesList = Array.isArray((reservation as any).codes)
    ? (reservation as any).codes.map((c: any) => String(c)).filter(Boolean)
    : [];

  let ticketId: string | null = (reservation as any).ticket_id || null;
  let ticketCode: string | null = null;

  if (!ticketId) {
    const { data: ticketByReservation } = await supabase
      .from("tickets")
      .select("id")
      .eq("table_reservation_id", id)
      .is("deleted_at", null)
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (ticketByReservation?.id) {
      ticketId = ticketByReservation.id;
    }
  }

  if (!ticketId && codesList.length > 0) {
    const { data: codeRows } = await supabase.from("codes").select("id,code").in("code", codesList);
    const codeIds = (codeRows || []).map((row: any) => row.id).filter(Boolean);
    if (codeIds.length > 0) {
      const { data: ticketRow } = await supabase
        .from("tickets")
        .select("id,code_id")
        .in("code_id", codeIds)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (ticketRow?.id) ticketId = ticketRow.id;
    }
  }

  if (ticketId) {
    const { data: ticketRow } = await supabase
      .from("tickets")
      .select("id,code:codes(code)")
      .eq("id", ticketId)
      .maybeSingle();
    const codeRel = Array.isArray(ticketRow?.code) ? ticketRow?.code?.[0] : ticketRow?.code;
    ticketCode = codeRel?.code || null;
  }

  let ticketLookupError: string | null = null;

  if (!ticketId) {
    if (!eventId) {
      ticketLookupError = "Mesa sin evento asignado; no se generó ticket/QR.";
    } else {
      try {
        const { ticketId: createdTicketId, code } = await createTicketForReservation(supabase, {
          eventId,
          tableName,
          fullName: (reservation as any).full_name || "Invitado reserva",
          email: email || null,
          phone: (reservation as any).phone || null,
          docType: (reservation as any).doc_type || "dni",
          document: (reservation as any).document || "",
          promoterId: (reservation as any).promoter_id || null,
          reuseCodes: codesList,
          codeType: "table",
          tableId: tableRel?.id || null,
          productId: null,
          tableReservationId: id,
        });
        ticketId = createdTicketId;
        ticketCode = code;
      } catch (err: any) {
        ticketLookupError = err?.message || "No se pudo generar ticket";
      }
    }
  }

  if (ticketId && ticketId !== (reservation as any).ticket_id) {
    await supabase.from("table_reservations").update({ ticket_id: ticketId }).eq("id", id);
  }

  const codesForEmail = Array.from(new Set([...codesList, ticketCode].filter(Boolean)));

  let ticketEmailError: string | null = ticketLookupError;
  let reservationEmailError: string | null = null;

  if (ticketId) {
    try {
      await sendTicketEmail({ supabase, ticketId, toEmail: email });
    } catch (err: any) {
      ticketEmailError = err?.message || "No se pudo enviar el correo del ticket";
    }
  }

  try {
    if (isTableReservation) {
      await sendApprovalEmail({
        supabase,
        id,
        full_name: (reservation as any).full_name || "",
        email,
        phone: (reservation as any).phone || null,
        codes: codesForEmail,
        ticketIds: ticketId ? [ticketId] : undefined, // ✅ Incluir ticketId si existe
        tableName,
        event: eventData,
      });
    }
  } catch (err: any) {
    reservationEmailError = err?.message || "No se pudo enviar el correo de la reserva";
  }

  const success = !ticketEmailError && !reservationEmailError;

  return NextResponse.json({
    success,
    ticketId,
    ticketEmailError,
    reservationEmailError,
  });
}
