import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createTicketForReservation } from "../utils";
import { sendApprovalEmail, sendCancellationEmail } from "../email";
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

function uniqueStrings(values: Array<string | null | undefined>): string[] {
  return Array.from(new Set(values.map((value) => (value ? String(value).trim() : "")).filter(Boolean)));
}

function isMissingColumnError(error: any): boolean {
  const message = String(error?.message || "");
  const details = String(error?.details || "");
  const hint = String(error?.hint || "");
  const haystack = `${message} ${details} ${hint}`.toLowerCase();
  return haystack.includes("does not exist") && haystack.includes("column");
}

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
      "id,table_id,product_id,full_name,email,phone,doc_type,document,codes,ticket_quantity,event_id,ticket_id,promoter_id,event:event_id(id,name,starts_at,location),table:tables(id,name,event_id,event:events(id,name,starts_at,location))"
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

  const isApproval = updateData.status === "approved";

  if (!isApproval) {
    const { error } = await supabase.from("table_reservations").update(updateData).eq("id", id);
    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
  }

  let emailSent = false;
  let emailError: string | null = null;

  if (isApproval) {
    try {
      const { data: reservationCodesRows } = await supabase
        .from("codes")
        .select("code,is_active")
        .eq("table_reservation_id", id)
        .is("deleted_at", null)
        .eq("is_active", true);

      const reservationCodesFromRows = (reservationCodesRows || [])
        .map((row: any) => String(row.code || "").trim())
        .filter(Boolean);

      const reusableCodes = uniqueStrings([...reservationCodesFromRows, ...codesList]);
      const ticketResults: Array<{ ticketId: string; code: string }> = [];
      for (let i = 0; i < ticketQuantity; i++) {
        const reuseCodes = reusableCodes[i] ? [reusableCodes[i]] : [];
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
          codeType: isTableReservation ? "table" : "courtesy",
          tableId: (reservation as any).table_id || tableRel?.id || null,
          productId: (reservation as any).product_id || null,
          tableReservationId: id,
        });
        ticketResults.push(result);
      }

      const ticketIds = ticketResults.map((t) => t.ticketId).filter(Boolean);
      const ticketCodes = ticketResults.map((t) => t.code).filter(Boolean);
      const mergedCodes = uniqueStrings([...(codesList || []), ...reusableCodes, ...ticketCodes]);
      if (ticketIds.length === 0) {
        return NextResponse.json(
          { success: false, error: "No se pudieron generar tickets para la aprobación", trace },
          { status: 500 }
        );
      }
      trace.push(`ticketId:${ticketIds[0]}`);

      const approvalUpdatePayload: Record<string, any> = { ...updateData };
      if (!(reservation as any).ticket_id) {
        approvalUpdatePayload.ticket_id = ticketIds[0];
      }
      if (mergedCodes.length > 0) {
        approvalUpdatePayload.codes = mergedCodes;
      }

      const { error: approvalUpdateError } = await supabase
        .from("table_reservations")
        .update(approvalUpdatePayload)
        .eq("id", id);
      if (approvalUpdateError) {
        return NextResponse.json({ success: false, error: approvalUpdateError.message, trace }, { status: 500 });
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

      // Enviar un solo correo consolidado con todos los tickets/códigos.
      const codesForEmail = mergedCodes;
      const eventData = eventRel || eventDirectRel || null;

      try {
        await sendApprovalEmail({
          supabase,
          id,
          full_name: resolvedFullName,
          email: resolvedEmail,
          phone: resolvedPhone || null,
          codes: codesForEmail,
          ticketIds,
          tableName,
          event: eventData,
        });
        emailSent = true;
        trace.push(`approvalEmailSent:tickets=${ticketIds.length},codes=${codesForEmail.length}`);
      } catch (err: any) {
        emailError = err?.message || "No se pudo enviar el correo de aprobación";
        trace.push(`approvalEmailError:${emailError}`);
      }
    } catch (err: any) {
      emailError = err?.message || "No se pudo completar la aprobación";
      trace.push(`approvalFlowError:${emailError}`);
      console.error("[reservations/update] approval error", { id, trace, err });
      return NextResponse.json({ success: false, error: emailError, trace }, { status: 500 });
    }
  }

  // Enviar email de cancelación si se rechaza la reserva
  if (updateData.status === "rejected") {
    const cancellationErrors: string[] = [];
    const cancellationWarnings: string[] = [];
    const previousStatus = String((reservation as any).status || "").toLowerCase();
    const codeRowsByReservation = await supabase
      .from("codes")
      .select("id,code")
      .eq("table_reservation_id", id)
      .is("deleted_at", null);

    const codeRowsByLegacyList =
      codesList.length > 0
        ? await supabase.from("codes").select("id,code").in("code", codesList).is("deleted_at", null)
        : { data: [], error: null };

    if (codeRowsByReservation.error) {
      trace.push(`error_loading_reservation_codes:${codeRowsByReservation.error.message}`);
      cancellationWarnings.push(`codes_by_reservation:${codeRowsByReservation.error.message}`);
    }
    if (codeRowsByLegacyList.error) {
      trace.push(`error_loading_legacy_codes:${codeRowsByLegacyList.error.message}`);
      cancellationWarnings.push(`codes_by_legacy_list:${codeRowsByLegacyList.error.message}`);
    }

    const codeIds = uniqueStrings([
      ...((codeRowsByReservation.data || []).map((row: any) => row.id) as string[]),
      ...((codeRowsByLegacyList.data || []).map((row: any) => row.id) as string[]),
    ]);
    const codesResolved = uniqueStrings([
      ...((codeRowsByReservation.data || []).map((row: any) => row.code) as string[]),
      ...((codeRowsByLegacyList.data || []).map((row: any) => row.code) as string[]),
      ...codesList,
    ]);

    if (codeIds.length > 0) {
      const { error: codesDeactivateError } = await supabase
        .from("codes")
        .update({ is_active: false })
        .in("id", codeIds);
      if (codesDeactivateError) {
        trace.push(`error_deactivating_codes:${codesDeactivateError.message}`);
        cancellationErrors.push(`deactivate_codes:${codesDeactivateError.message}`);
      } else {
        trace.push(`codes_deactivated:${codeIds.length}`);
      }
    } else {
      trace.push("codes_deactivated:0");
    }

    const ticketIds = uniqueStrings([(reservation as any).ticket_id || null]);
    if (codeIds.length > 0) {
      const { data: ticketsByCodes, error: ticketsByCodesError } = await supabase
        .from("tickets")
        .select("id")
        .in("code_id", codeIds)
        .is("deleted_at", null);
      if (ticketsByCodesError) {
        trace.push(`error_loading_tickets_by_codes:${ticketsByCodesError.message}`);
        cancellationWarnings.push(`tickets_by_codes:${ticketsByCodesError.message}`);
      } else {
        ticketIds.push(...uniqueStrings((ticketsByCodes || []).map((row: any) => row.id)));
      }
    }
    const { data: ticketsByReservation, error: ticketsByReservationError } = await supabase
      .from("tickets")
      .select("id")
      .eq("table_reservation_id", id)
      .is("deleted_at", null);
    if (ticketsByReservationError) {
      trace.push(`error_loading_tickets_by_reservation:${ticketsByReservationError.message}`);
      cancellationWarnings.push(`tickets_by_reservation:${ticketsByReservationError.message}`);
    } else {
      ticketIds.push(...uniqueStrings((ticketsByReservation || []).map((row: any) => row.id)));
    }

    // Fallback para data legacy: cancelar tickets activos por mesa+evento de la reserva.
    // Esto cubre tickets antiguos que no quedaron enlazados por code_id/table_reservation_id.
    const reservationTableId = (reservation as any).table_id || tableRel?.id || null;
    const reservationEventId = (reservation as any).event_id || eventRel?.id || eventDirectRel?.id || null;
    if (reservationTableId && reservationEventId) {
      const { data: ticketsByTableEvent, error: ticketsByTableEventError } = await supabase
        .from("tickets")
        .select("id")
        .eq("table_id", reservationTableId)
        .eq("event_id", reservationEventId)
        .eq("is_active", true)
        .is("deleted_at", null);
      if (ticketsByTableEventError) {
        trace.push(`error_loading_tickets_by_table_event:${ticketsByTableEventError.message}`);
        cancellationWarnings.push(`tickets_by_table_event:${ticketsByTableEventError.message}`);
      } else {
        ticketIds.push(...uniqueStrings((ticketsByTableEvent || []).map((row: any) => row.id)));
      }
    }

    const uniqueTicketIds = uniqueStrings(ticketIds);
    const shouldHaveTickets =
      previousStatus === "approved" ||
      previousStatus === "confirmed" ||
      previousStatus === "paid" ||
      Boolean((reservation as any).ticket_id) ||
      codesResolved.length > 0;

    if (uniqueTicketIds.length === 0 && shouldHaveTickets) {
      cancellationErrors.push("no_linked_tickets_found_for_cancellation");
      trace.push("error_no_linked_tickets_found");
    }

    if (uniqueTicketIds.length > 0) {
      const { error: deactivateTicketsError } = await supabase
        .from("tickets")
        .update({ is_active: false })
        .in("id", uniqueTicketIds);
      if (deactivateTicketsError) {
        trace.push(`error_deactivating_tickets:${deactivateTicketsError.message}`);
        cancellationErrors.push(`deactivate_tickets:${deactivateTicketsError.message}`);
      } else {
        const { error: markCancelledError } = await supabase
          .from("tickets")
          .update({ status: "cancelled" })
          .in("id", uniqueTicketIds);
        if (markCancelledError) {
          trace.push(`warning_mark_tickets_cancelled:${markCancelledError.message}`);
          if (!isMissingColumnError(markCancelledError)) {
            cancellationWarnings.push(`mark_tickets_cancelled:${markCancelledError.message}`);
          }
        }
        trace.push(`tickets_cancelled:${uniqueTicketIds.length}`);
      }
    } else {
      trace.push("tickets_cancelled:0");
    }

    if (codesResolved.length > 0) {
      trace.push(`codes_resolved:${codesResolved.length}`);
    }

    if (cancellationErrors.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: "La reserva se anuló, pero falló la cancelación de tickets/códigos vinculados",
          trace,
          cancellationErrors,
          cancellationWarnings,
        },
        { status: 500 }
      );
    }

    // Enviar email de cancelación SOLO cuando la anulación se completó sin errores críticos
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
