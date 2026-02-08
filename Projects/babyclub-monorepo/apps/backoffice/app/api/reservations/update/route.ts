import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createTicketForReservation } from "../utils";
import { sendApprovalEmail, sendTicketEmail } from "../email";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const resendApiKey = process.env.RESEND_API_KEY;

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

  const trace: string[] = [];

  let body: any = null;
  try {
    body = await req.json();
  } catch (_err) {
    return NextResponse.json({ success: false, error: "Invalid JSON" }, { status: 400 });
  }

  const id = typeof body?.id === "string" ? body.id : "";
  const status = typeof body?.status === "string" ? body.status : "";
  const full_name = typeof body?.full_name === "string" ? body.full_name.trim() : undefined;
  const email = typeof body?.email === "string" ? body.email.trim() : undefined;
  const phone = typeof body?.phone === "string" ? body.phone.trim() : undefined;
  const doc_type = typeof body?.doc_type === "string" ? body.doc_type : undefined;
  const document = typeof body?.document === "string" ? body.document : undefined;

  if (!id) {
    return NextResponse.json({ success: false, error: "Invalid id" }, { status: 400 });
  }

  const { data: reservation } = await supabase
    .from("table_reservations")
    .select(
      "id,full_name,email,phone,doc_type,document,codes,ticket_quantity,event_id,event:event_id(id,name,starts_at,location),table:tables(id,name,event_id,event:events(id,name,starts_at,location))"
    )
    .eq("id", id)
    .maybeSingle();

  if (!reservation) {
    return NextResponse.json({ success: false, error: "Reserva no encontrada" }, { status: 404 });
  }

  const resolvedFullName = full_name?.trim() || (reservation as any).full_name || "";
  const resolvedEmail = email === "" ? "" : email ?? ((reservation as any).email || "");
  const resolvedPhone = phone === "" ? "" : phone ?? ((reservation as any).phone || "");
  const resolvedDocType = (doc_type || (reservation as any).doc_type || "dni") as any;
  const resolvedDocument = document ?? (reservation as any).document ?? (reservation as any).dni ?? "";

  const updateData: Record<string, any> = {};
  if (status && ["pending", "approved", "rejected"].includes(status)) updateData.status = status;
  if (full_name !== undefined && resolvedFullName.length > 0) updateData.full_name = resolvedFullName;
  if (email !== undefined) {
    const emailValid = email === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    if (!emailValid) return NextResponse.json({ success: false, error: "Email inválido" }, { status: 400 });
    updateData.email = resolvedEmail || null;
  }
  if (phone !== undefined) updateData.phone = resolvedPhone || null;
  if (doc_type !== undefined) updateData.doc_type = resolvedDocType;
  if (document !== undefined) updateData.document = resolvedDocument || null;

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ success: false, error: "Nada para actualizar" }, { status: 400 });
  }

  const tableRel = Array.isArray((reservation as any).table) ? (reservation as any).table?.[0] : (reservation as any).table;
  const eventRel = tableRel?.event ? (Array.isArray(tableRel.event) ? tableRel.event[0] : tableRel.event) : null;
  const eventDirectRel = (reservation as any).event
    ? Array.isArray((reservation as any).event)
      ? (reservation as any).event?.[0]
      : (reservation as any).event
    : null;
  const codesList = Array.isArray((reservation as any).codes)
    ? (reservation as any).codes.map((c: any) => String(c)).filter(Boolean)
    : [];
  const eventId = tableRel?.event_id || eventRel?.id || (reservation as any).event_id || eventDirectRel?.id || null;
  const ticketQuantity =
    typeof (reservation as any).ticket_quantity === "number" && (reservation as any).ticket_quantity > 0
      ? Math.floor((reservation as any).ticket_quantity)
      : 1;
  const tableName = tableRel?.name || "Entrada";
  const isTableReservation = Boolean(tableRel?.id);
  trace.push(`eventId:${eventId || "null"}`);
  trace.push(`table:${tableRel?.name || "?"}`);
  trace.push(`ticketQty:${ticketQuantity}`);
  trace.push(`codes:${codesList.length}`);

  if (updateData.status === "approved") {
    if (!resendApiKey) {
      return NextResponse.json(
        { success: false, error: "Correo no disponible: configura RESEND_API_KEY", trace },
        { status: 400 }
      );
    }
    if (!resolvedEmail) {
      return NextResponse.json({ success: false, error: "Ingresa un correo para notificar", trace }, { status: 400 });
    }
    if (!eventId) {
      return NextResponse.json(
        { success: false, error: "Mesa sin evento asignado; no se generó ticket/QR.", trace },
        { status: 400 }
      );
    }
  }

  const { error } = await supabase.from("table_reservations").update(updateData).eq("id", id);
  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  let emailSent = false;
  let emailError: string | null = null;

  if (updateData.status === "approved") {
    try {
      const ticketResults: Array<{ ticketId: string; code: string }> = [];
      for (let i = 0; i < ticketQuantity; i++) {
        const reuseCodes = i === 0 ? codesList : [];
        const result = await createTicketForReservation(supabase, {
          eventId,
          tableName,
          fullName: resolvedFullName,
          email: resolvedEmail,
          phone: resolvedPhone,
          docType: resolvedDocType,
          document: resolvedDocument,
          reuseCodes,
        });
        ticketResults.push(result);
      }

      const ticketIds = ticketResults.map((t) => t.ticketId).filter(Boolean);
      const ticketCodes = ticketResults.map((t) => t.code).filter(Boolean);
      if (ticketIds.length > 0) {
        trace.push(`ticketId:${ticketIds[0]}`);
        const updateReservation: Record<string, any> = {};
        if (!(reservation as any).ticket_id) {
          updateReservation.ticket_id = ticketIds[0];
        }
        if (codesList.length === 0 && ticketCodes.length > 0) {
          updateReservation.codes = ticketCodes;
        }
        if (Object.keys(updateReservation).length > 0) {
          await supabase.from("table_reservations").update(updateReservation).eq("id", id);
        }
      }

      let ticketEmailError: string | null = null;
      for (const ticketId of ticketIds) {
        try {
          await sendTicketEmail({ supabase, ticketId, toEmail: resolvedEmail });
        } catch (err: any) {
          ticketEmailError = err?.message || "No se pudo enviar el correo del ticket";
        }
      }
      if (ticketEmailError) {
        emailError = ticketEmailError;
        trace.push(`ticketEmailError:${ticketEmailError}`);
      }
      if (!ticketEmailError && ticketIds.length > 0) {
        emailSent = true;
        trace.push("emailSent:true");
      }

      if (isTableReservation) {
        const codesForEmail = Array.from(new Set([...(codesList || []), ...ticketCodes].filter(Boolean)));
        const eventData = eventRel || eventDirectRel || null;
        await sendApprovalEmail({
          supabase,
          id,
          full_name: resolvedFullName,
          email: resolvedEmail,
          phone: resolvedPhone || null,
          codes: codesForEmail,
          tableName,
          event: eventData,
        });
      }
    } catch (err: any) {
      emailError = err?.message || "No se pudo enviar el correo";
      trace.push(`error:${emailError}`);
      console.error("[reservations/update] approval error", { id, trace, err });
    }
  }

  return NextResponse.json({ success: true, emailSent, emailError, trace });
}
