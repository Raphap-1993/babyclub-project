import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createTicketForReservation } from "../utils";
import { sendApprovalEmail, sendTicketEmail, sendCancellationEmail } from "../email";
import { requireStaffRole } from "shared/auth/requireStaff";

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
  const guard = await requireStaffRole(req);
  if (!guard.ok) {
    return NextResponse.json({ success: false, error: guard.error }, { status: guard.status });
  }
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
      "id,full_name,email,phone,doc_type,document,codes,ticket_quantity,event_id,ticket_id,promoter_id,event:event_id(id,name,starts_at,location),table:tables(id,name,event_id,event:events(id,name,starts_at,location))"
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
          promoterId: (reservation as any).promoter_id || null,
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

      // ⚠️ DESHABILITADO: No enviar correos individuales por ticket (genera spam)
      // El correo consolidado de aprobación incluye todos los códigos/tickets
      // Ver AUDIT-RESERVATIONS-EMAILS-2026-02-09.md para detalles
      /*
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
      */

      // NUEVO: Enviar UN SOLO correo consolidado con todos los tickets/códigos
      if (isTableReservation) {
        const codesForEmail = Array.from(new Set([...(codesList || []), ...ticketCodes].filter(Boolean)));
        const eventData = eventRel || eventDirectRel || null;
        
        try {
          await sendApprovalEmail({
            supabase,
            id,
            full_name: resolvedFullName,
            email: resolvedEmail,
            phone: resolvedPhone || null,
            codes: codesForEmail,
            ticketIds, // ✅ Enviar IDs de tickets para generar links con QR
            tableName,
            event: eventData,
          });
          emailSent = true;
          trace.push(`approvalEmailSent:tickets=${ticketIds.length},codes=${codesForEmail.length}`);
        } catch (err: any) {
          emailError = err?.message || "No se pudo enviar el correo de aprobación";
          trace.push(`approvalEmailError:${emailError}`);
        }
      }
    } catch (err: any) {
      emailError = err?.message || "No se pudo enviar el correo";
      trace.push(`error:${emailError}`);
      console.error("[reservations/update] approval error", { id, trace, err });
    }
  }

  // Enviar email de cancelación si se rechaza la reserva
  if (updateData.status === "rejected") {
    // Invalidar todos los códigos asociados a esta reserva
    if (codesList.length > 0) {
      try {
        await supabase
          .from("codes")
          .update({ is_active: false })
          .in("code", codesList);
        trace.push(`codes_deactivated:${codesList.length}`);
      } catch (err: any) {
        trace.push(`error_deactivating_codes:${err.message}`);
        console.error("[reservations/update] error deactivating codes", { id, codes: codesList, err });
      }
    }

    // Invalidar ticket asociado si existe
    if ((reservation as any).ticket_id) {
      try {
        await supabase
          .from("tickets")
          .update({ is_active: false, status: "cancelled" })
          .eq("id", (reservation as any).ticket_id);
        trace.push(`ticket_cancelled:${(reservation as any).ticket_id}`);
      } catch (err: any) {
        trace.push(`error_cancelling_ticket:${err.message}`);
        console.error("[reservations/update] error cancelling ticket", { id, ticketId: (reservation as any).ticket_id, err });
      }
    }

    // Enviar email de cancelación
    if (resolvedEmail) {
      try {
        const eventData = eventRel || eventDirectRel || null;
        await sendCancellationEmail({
          supabase,
          id,
          full_name: resolvedFullName,
          email: resolvedEmail,
          tableName,
          event: eventData,
        });
        emailSent = true;
        trace.push("cancellationEmailSent:true");
      } catch (err: any) {
        emailError = err?.message || "No se pudo enviar el correo de cancelación";
        trace.push(`cancellationEmailError:${emailError}`);
        console.error("[reservations/update] cancellation email error", { id, trace, err });
      }
    }
  }

  return NextResponse.json({ success: true, emailSent, emailError, trace });
}
