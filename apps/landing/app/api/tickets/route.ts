import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { validateDocument, normalizeDocument, type DocumentType } from "shared/document";
import { sendEmail } from "shared/email/resend";
import { applyNotDeleted } from "shared/db/softDelete";
import { ensureEventSalesDefaults, evaluateEventSales, isMissingEventSalesColumnsError } from "shared/eventSales";
import {
  FREE_QR_DISABLED_MESSAGE,
  isFreeQrCodeType,
  isFreeQrReleaseEnabled,
} from "shared/freeQrGate";
import { isAdult } from "shared/datetime";
import { getPublicAppUrl } from "shared/publicUrl";
import {
  buildEventTicketConflictMessage,
  findActiveEventTicketConflict,
} from "shared/eventTicketIdentity";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

type ReservationUnitContext = {
  id: string;
  reservation_id: string;
  event_id: string | null;
  unit_index: number;
  status: string | null;
  ticket_id: string | null;
};

function normalizePositiveInteger(value: unknown) {
  const parsed =
    typeof value === "number" ? value : Number.parseInt(String(value || ""), 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

async function loadReservationUnit(
  supabase: any,
  reservationId: string,
  unitIndex: number,
) {
  const { data, error } = await applyNotDeleted(
    supabase
      .from("ticket_reservation_units")
      .select("id,reservation_id,event_id,unit_index,status,ticket_id")
      .eq("reservation_id", reservationId)
      .eq("unit_index", unitIndex),
  ).maybeSingle();

  return {
    data: data
      ? {
          id: String((data as any).id),
          reservation_id: String((data as any).reservation_id || reservationId),
          event_id:
            typeof (data as any).event_id === "string"
              ? (data as any).event_id
              : null,
          unit_index: Number((data as any).unit_index || unitIndex),
          status:
            typeof (data as any).status === "string"
              ? (data as any).status
              : null,
          ticket_id:
            typeof (data as any).ticket_id === "string"
              ? (data as any).ticket_id
              : null,
        }
      : null,
    error,
  };
}

async function loadTicketById(supabase: any, ticketId: string) {
  const { data, error } = await applyNotDeleted(
    supabase
      .from("tickets")
      .select("id,qr_token,person_id,payment_status,event_id,doc_type,document,dni")
      .eq("id", ticketId),
  ).maybeSingle();
  return { data, error };
}

function resolveExistingTicketHolderIdentity(ticket: any) {
  const docType =
    typeof ticket?.doc_type === "string" && ticket.doc_type.trim()
      ? ticket.doc_type.trim().toLowerCase()
      : typeof ticket?.dni === "string" && ticket.dni.trim()
        ? "dni"
        : null;

  if (!docType) {
    return { docType: null, document: null };
  }

  const document =
    docType === "dni"
      ? typeof ticket?.dni === "string" && ticket.dni.trim()
        ? ticket.dni.trim()
        : typeof ticket?.document === "string" && ticket.document.trim()
          ? ticket.document.trim()
          : null
      : typeof ticket?.document === "string" && ticket.document.trim()
        ? ticket.document.trim().toLowerCase()
        : null;

  return { docType, document };
}

async function syncReservationUnitIssued(
  supabase: any,
  reservationUnit: ReservationUnitContext,
  reservationId: string,
  patch: Record<string, any>,
) {
  const { error } = await supabase
    .from("ticket_reservation_units")
    .update({
      ...patch,
      status: "issued",
      updated_at: new Date().toISOString(),
    })
    .eq("id", reservationUnit.id)
    .eq("reservation_id", reservationId);

  return { error };
}

export async function POST(req: NextRequest) {
  console.log("[/api/tickets] Inicio de petición");
  
  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json({ success: false, error: "Supabase config missing" }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  let body: any = null;
  try {
    body = await req.json();
  } catch (_err) {
    return NextResponse.json({ success: false, error: "Invalid JSON" }, { status: 400 });
  }

  console.log("[/api/tickets] Datos recibidos:", {
    code: body?.code,
    document: body?.document,
    nombre: body?.nombre
  });

  const codeValue = typeof body?.code === "string" ? body.code.trim() : "";
  const withPayment = body?.with_payment === true;
  const docTypeRaw = typeof body?.doc_type === "string" ? (body.doc_type as DocumentType) : "dni";
  const documentRaw = typeof body?.document === "string" ? body.document : "";
  const { docType, document } = normalizeDocument(docTypeRaw, documentRaw);
  const normalizedDocument = document.toLowerCase();
  const dni = docType === "dni" ? document : "";
  const first_name = typeof body?.nombre === "string" ? body.nombre.trim() : "";
  const last_name_p = typeof body?.apellido_paterno === "string" ? body.apellido_paterno.trim() : "";
  const last_name_m = typeof body?.apellido_materno === "string" ? body.apellido_materno.trim() : "";
  const last_name = [last_name_p, last_name_m].filter(Boolean).join(" ").trim();
  const email = typeof body?.email === "string" ? body.email.trim() : "";
  const phone = typeof body?.telefono === "string" ? body.telefono.trim() : "";
  const promoter_id = typeof body?.promoter_id === "string" && body.promoter_id ? body.promoter_id : null;
  const birthdateStr = typeof body?.birthdate === "string" ? body.birthdate : "";
  const birthdate = birthdateStr ? new Date(birthdateStr) : null;
  const hasBirthdate = Boolean(birthdateStr);

  if (!validateDocument(docType, document)) {
    return NextResponse.json({ success: false, error: "Documento inválido" }, { status: 400 });
  }
  if (!first_name || !last_name)
    return NextResponse.json({ success: false, error: "nombre y apellido son requeridos" }, { status: 400 });
  if (hasBirthdate && Number.isNaN(birthdate!.getTime())) {
    return NextResponse.json({ success: false, error: "birthdate inválida" }, { status: 400 });
  }
  if (hasBirthdate && !isAdult(birthdate!)) {
    return NextResponse.json({ success: false, error: "Solo mayores de 18" }, { status: 403 });
  }

  if (!codeValue) return NextResponse.json({ success: false, error: "code is required" }, { status: 400 });

  const codeQuery = applyNotDeleted(
    supabase
      .from("codes")
      .select("id,code,event_id,promoter_id,is_active,max_uses,uses,expires_at,table_reservation_id,person_index,type")
      .eq("code", codeValue)
  );
  const { data: codeRow, error: codeError } = await codeQuery.maybeSingle();

  if (codeError || !codeRow) {
    return NextResponse.json({ success: false, error: "Código inválido" }, { status: 404 });
  }

  if (isFreeQrCodeType((codeRow as any).type) && !isFreeQrReleaseEnabled()) {
    return NextResponse.json(
      {
        success: false,
        error: FREE_QR_DISABLED_MESSAGE,
        code: "free_qr_disabled",
      },
      { status: 409 },
    );
  }

  if (codeRow.is_active === false) {
    return NextResponse.json({ success: false, error: "Código inactivo" }, { status: 400 });
  }

  let reservationContext: {
    id: string;
    table_id: string | null;
    product_id: string | null;
    event_id: string | null;
    status: string | null;
  } | null = null;
  let reservationUnit: ReservationUnitContext | null = null;
  const reservationUnitIndex = normalizePositiveInteger(
    (codeRow as any).person_index,
  );

  if ((codeRow as any).table_reservation_id) {
    const reservationQuery = applyNotDeleted(
      supabase
        .from("table_reservations")
        .select("id,event_id,table_id,product_id,status")
        .eq("id", (codeRow as any).table_reservation_id)
    );
    const { data: reservationRow, error: reservationError } = await reservationQuery.maybeSingle();

    if (reservationError) {
      return NextResponse.json({ success: false, error: reservationError.message }, { status: 500 });
    }
    if (!reservationRow) {
      return NextResponse.json({ success: false, error: "Código de mesa sin reserva válida" }, { status: 400 });
    }

    reservationContext = {
      id: (reservationRow as any).id,
      table_id: (reservationRow as any).table_id || null,
      product_id: (reservationRow as any).product_id || null,
      event_id: (reservationRow as any).event_id || null,
      status: (reservationRow as any).status || null,
    };

    const reservationStatus = String(reservationContext.status || "").toLowerCase();
    const activeReservationStatuses = new Set(["approved", "confirmed", "paid"]);
    if (reservationStatus && !activeReservationStatuses.has(reservationStatus)) {
      return NextResponse.json(
        { success: false, error: "Tu reserva de mesa aún no está aprobada para generar este QR" },
        { status: 400 }
      );
    }

    if (reservationUnitIndex) {
      const { data: unitRow, error: unitError } = await loadReservationUnit(
        supabase,
        reservationContext.id,
        reservationUnitIndex,
      );
      if (unitError) {
        return NextResponse.json(
          { success: false, error: unitError.message },
          { status: 500 },
        );
      }
      if (!unitRow) {
        return NextResponse.json(
          { success: false, error: "Código de reserva sin unidad válida" },
          { status: 404 },
        );
      }
      reservationUnit = unitRow;

      if (reservationUnit.ticket_id) {
        const { data: existingUnitTicket, error: existingUnitTicketError } =
          await loadTicketById(supabase, reservationUnit.ticket_id);
        if (existingUnitTicketError) {
          return NextResponse.json(
            { success: false, error: existingUnitTicketError.message },
            { status: 500 },
          );
        }
        if (existingUnitTicket?.id && existingUnitTicket.qr_token) {
          const issuedHolder = resolveExistingTicketHolderIdentity(
            existingUnitTicket,
          );
          if (issuedHolder.docType && issuedHolder.document) {
            const isSameHolder =
              issuedHolder.docType === docType &&
              issuedHolder.document === normalizedDocument;

            if (!isSameHolder) {
              return NextResponse.json(
                {
                  success: false,
                  error: "Este código ya fue registrado por otra persona",
                },
                { status: 409 },
              );
            }
          }

          const isPending = existingUnitTicket.payment_status === "pending";
          return NextResponse.json({
            success: true,
            existing: true,
            ticketId: existingUnitTicket.id,
            qr: existingUnitTicket.qr_token,
            needsPayment: isPending,
          });
        }
      }
    }
  }

  // Fase A — Aforo real del evento
  // Verifica TODOS los tickets del evento antes de crear uno nuevo,
  // sin importar qué código, reserva o cortesía los generó.
  if (codeRow.event_id) {
    const { data: eventCapRow } = await supabase
      .from("events")
      .select("capacity")
      .eq("id", codeRow.event_id)
      .maybeSingle();

    if (eventCapRow?.capacity) {
      const { data: countData } = await supabase.rpc("count_event_tickets", {
        p_event_id: codeRow.event_id,
      });
      const totalTickets = Number(countData ?? 0);
      if (totalTickets >= eventCapRow.capacity) {
        return NextResponse.json(
          { success: false, error: "Aforo del evento completo" },
          { status: 400 }
        );
      }
    }
  }

  const now = Date.now();
  if (codeRow.expires_at && new Date(codeRow.expires_at).getTime() < now) {
    return NextResponse.json({ success: false, error: "Código expirado" }, { status: 400 });
  }

  const eventId = codeRow.event_id || reservationContext?.event_id || "";
  if (!eventId) {
    return NextResponse.json({ success: false, error: "Código sin evento asociado" }, { status: 400 });
  }

  const eventStateQuery = applyNotDeleted(
    supabase
      .from("events")
      .select("id,is_active,closed_at,sale_status,sale_public_message")
      .eq("id", eventId)
  );
  let { data: eventRow, error: eventError } = await eventStateQuery.maybeSingle();
  if (eventError && isMissingEventSalesColumnsError(eventError)) {
    const legacyQuery = applyNotDeleted(
      supabase.from("events").select("id,is_active,closed_at").eq("id", eventId)
    );
    const legacyResult = await legacyQuery.maybeSingle();
    eventRow = legacyResult.data as any;
    eventError = legacyResult.error;
  }
  if (eventError || !eventRow) {
    return NextResponse.json({ success: false, error: "Evento no encontrado" }, { status: 404 });
  }
  const saleDecision = evaluateEventSales(ensureEventSalesDefaults(eventRow as any));
  const codeType = String((codeRow as any)?.type || "").trim().toLowerCase();
  const requiresPayment = withPayment && codeType === "general";
  const allowsRedemptionWhenSalesBlocked =
    Boolean(reservationContext?.id || (codeRow as any)?.table_reservation_id) ||
    codeType === "table" ||
    codeType === "courtesy" ||
    codeType === "promoter";

  if (!saleDecision.available && !allowsRedemptionWhenSalesBlocked) {
    return NextResponse.json(
      {
        success: false,
        error: saleDecision.public_message || "La venta online no está disponible para este evento",
        code: "sales_blocked",
        sale_status: saleDecision.sale_status,
        sale_block_reason: saleDecision.block_reason,
        sale_public_message: saleDecision.public_message,
      },
      { status: 409 }
    );
  }

  // Persona
  const personPayload = {
    dni: docType === "dni" ? dni : null,
    doc_type: docType,
    document: normalizedDocument,
    first_name,
    last_name,
    email: email || null,
    phone: phone || null,
    birthdate: hasBirthdate && birthdate ? birthdate.toISOString().slice(0, 10) : null,
  };

  // Buscamos primero por document/dni para no depender de un índice único en "document"
  const { data: existingPerson, error: findPersonError } = await supabase
    .from("persons")
    .select("id")
    .or(
      [
        docType === "dni" && dni ? `dni.eq.${dni}` : "",
        normalizedDocument ? `document.ilike.${normalizedDocument}` : "",
      ]
        .filter(Boolean)
        .join(",")
    )
    .limit(1)
    .maybeSingle();

  if (findPersonError && findPersonError.code !== "PGRST116") {
    return NextResponse.json({ success: false, error: findPersonError.message }, { status: 500 });
  }

  let person_id = existingPerson?.id;

  if (person_id) {
    const { error: updatePersonError } = await supabase.from("persons").update(personPayload).eq("id", person_id);
    if (updatePersonError) {
      return NextResponse.json({ success: false, error: updatePersonError.message }, { status: 500 });
    }
  } else {
    const { data: createdPerson, error: insertPersonError } = await supabase
      .from("persons")
      .insert(personPayload)
      .select("id")
      .single();

    if (insertPersonError) {
      return NextResponse.json({ success: false, error: insertPersonError.message }, { status: 500 });
    }

    person_id = createdPerson?.id;
  }
  const finalPromoterId = promoter_id || codeRow?.promoter_id || null;
  const full_name = `${first_name} ${last_name}`.trim();

  // Enforce "1 code = 1 person" ONLY for single-use codes (max_uses === 1).
  // Multi-use codes (max_uses > 1 or null) allow different people to register with the same code.
  const isSingleUseCode = typeof codeRow.max_uses === "number" && codeRow.max_uses === 1;

  const existingCodeTicketQuery = applyNotDeleted(
    supabase
      .from("tickets")
      .select("id,qr_token,person_id,payment_status,event_id")
      .eq("code_id", codeRow.id)
      .eq("is_active", true)
  );
  const { data: existingCodeTicket, error: existingCodeError } = await existingCodeTicketQuery
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingCodeError && existingCodeError.code !== "PGRST116") {
    return NextResponse.json({ success: false, error: existingCodeError.message }, { status: 500 });
  }

  if (reservationUnit && existingCodeTicket?.id && existingCodeTicket.qr_token) {
    if (!reservationUnit.ticket_id || reservationUnit.ticket_id !== existingCodeTicket.id) {
      const syncExisting = await syncReservationUnitIssued(
        supabase,
        reservationUnit,
        reservationContext?.id || reservationUnit.reservation_id,
        {
          ticket_id: existingCodeTicket.id,
          issued_at: new Date().toISOString(),
          full_name,
          doc_type: docType,
          document: normalizedDocument || null,
          email: email || null,
          phone: phone || null,
        },
      );
      if (syncExisting.error) {
        return NextResponse.json(
          { success: false, error: syncExisting.error.message },
          { status: 500 },
        );
      }
    }

    const isPending = (existingCodeTicket as any).payment_status === "pending";
    return NextResponse.json({
      success: true,
      existing: true,
      ticketId: existingCodeTicket.id,
      qr: existingCodeTicket.qr_token,
      needsPayment: isPending,
    });
  }

  if (existingCodeTicket?.id && existingCodeTicket.qr_token) {
    const isDifferentPerson = existingCodeTicket.person_id && existingCodeTicket.person_id !== person_id;

    if (isSingleUseCode && isDifferentPerson) {
      // Single-use code already claimed by someone else
      return NextResponse.json(
        { success: false, error: "Este código ya fue registrado por otra persona" },
        { status: 409 }
      );
    }

    if (!isDifferentPerson) {
      // Same person re-entering: return their existing ticket
      const isPending = (existingCodeTicket as any).payment_status === "pending";
      return NextResponse.json({
        success: true,
        existing: true,
        ticketId: existingCodeTicket.id,
        qr: existingCodeTicket.qr_token,
        needsPayment: isPending,
      });
    }
    // Different person + multi-use code: fall through to create a new ticket
  }

  if (typeof codeRow.uses === "number" && typeof codeRow.max_uses === "number" && codeRow.uses >= codeRow.max_uses) {
    return NextResponse.json({ success: false, error: "Código sin cupos" }, { status: 400 });
  }

  const eventTicketConflict = await findActiveEventTicketConflict(supabase as any, {
    eventId,
    personId: person_id,
    fullName: full_name,
    email: email || null,
    phone: phone || null,
    docType,
    document: normalizedDocument,
    dni,
  });

  if (eventTicketConflict?.ticketId) {
    if (
      (eventTicketConflict.reason === "person_id" ||
        eventTicketConflict.reason === "document") &&
      eventTicketConflict.qrToken
    ) {
      console.log(
        "[/api/tickets] Persona ya registrada en evento, retornando QR existente:",
        eventTicketConflict.ticketId,
      );
      return NextResponse.json({
        success: true,
        existing: true,
        ticketId: eventTicketConflict.ticketId,
        qr: eventTicketConflict.qrToken,
        needsPayment: false,
      });
    }

    return NextResponse.json(
      {
        success: false,
        error: buildEventTicketConflictMessage(eventTicketConflict.reason),
        code: "event_ticket_conflict",
        match_reason: eventTicketConflict.reason,
        ticketId: eventTicketConflict.ticketId,
      },
      { status: 409 },
    );
  }

  const qr_token = crypto.randomUUID();
  console.log("[/api/tickets] No hay ticket existente, creando nuevo...");

  const { data: ticketData, error: ticketError } = await supabase
    .from("tickets")
    .insert({
      event_id: eventId,
      code_id: codeRow?.id || null,
      person_id,
      promoter_id: finalPromoterId,
      qr_token,
      dni: docType === "dni" ? dni : null,
      document: normalizedDocument,
      doc_type: docType,
      full_name,
      email: email || null,
      phone: phone || null,
      table_id: reservationContext?.table_id || null,
      product_id: reservationContext?.product_id || null,
      table_reservation_id: reservationContext?.id || (codeRow as any).table_reservation_id || null,
      ...(requiresPayment ? { payment_status: "pending", is_active: false } : {}),
    })
    .select("id")
    .single();

  if (ticketError) {
    console.error("[/api/tickets] Error al insertar ticket:", ticketError);
    return NextResponse.json({ success: false, error: ticketError.message }, { status: 500 });
  }

  if (reservationUnit) {
    const syncResult = await syncReservationUnitIssued(
      supabase,
      reservationUnit,
      reservationContext?.id || reservationUnit.reservation_id,
      {
        ticket_id: ticketData?.id || null,
        issued_at: new Date().toISOString(),
        full_name,
        doc_type: docType,
        document: normalizedDocument || null,
        email: email || null,
        phone: phone || null,
      },
    );
    if (syncResult.error) {
      return NextResponse.json(
        { success: false, error: syncResult.error.message },
        { status: 500 },
      );
    }
  }

  let emailSent = false;
  let emailError: string | null = null;
  if (email && !requiresPayment) {
    try {
      const eventName = (eventRow as any)?.name || "evento";
      const eventLocation = (eventRow as any)?.location || "";
      const eventStartsAt = (eventRow as any)?.starts_at || null;
      const dateLabel = eventStartsAt ? new Date(eventStartsAt).toLocaleString("es-PE", { dateStyle: "full", timeStyle: "short", timeZone: "America/Lima" }) : "";
      const ticketUrl = `${getPublicAppUrl()}/ticket/${ticketData?.id}`;
      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&format=jpg&color=000000&bgcolor=ffffff&data=${encodeURIComponent(qr_token)}`;
      const html = `
        <div style="margin:0;padding:0;background:#050505;font-family:'Inter','Helvetica Neue',Arial,sans-serif;">
          <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#050505;padding:24px 12px;">
            <tr>
              <td align="center">
                <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:640px;background:#0b0b0b;border-radius:24px;border:1px solid rgba(255,255,255,0.05);overflow:hidden;">
                  <tr>
                    <td style="padding:28px 32px 16px;background:linear-gradient(135deg,rgba(255,255,255,0.06),rgba(233,30,99,0.1));color:#ffffff;">
                      <div style="text-transform:uppercase;font-size:12px;letter-spacing:0.28em;color:#f2f2f2;opacity:0.8;margin-bottom:6px;">Baby</div>
                      <h1 style="margin:0;font-size:26px;line-height:1.2;color:#ffffff;">Entrada generada</h1>
                      <p style="margin:8px 0 0;font-size:14px;color:#d9d9d9;">${eventName}${dateLabel ? ` • ${dateLabel}` : ""}</p>
                      ${eventLocation ? `<p style="margin:4px 0 0;font-size:13px;color:#c8c8c8;">${eventLocation}</p>` : ""}
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:20px 32px 28px;">
                      <div style="text-align:center;padding:12px 0 18px;">
                        <img src="${qrUrl}" alt="QR" width="220" height="220" style="border-radius:18px;border:8px solid #0f0f0f;background:#fff;display:block;margin:0 auto;" />
                      </div>
                      <p style="margin:0 0 14px;font-size:14px;color:#d7d7d7;line-height:1.6;">
                        Tu QR ya está listo. Si no ves la imagen, usa el enlace del ticket.
                      </p>
                      <div style="text-align:center;">
                        <a href="${ticketUrl}" style="display:inline-block;padding:12px 20px;border-radius:999px;background:linear-gradient(120deg,#e91e63,#ff6fb7);color:#ffffff;font-weight:700;font-size:14px;text-decoration:none;letter-spacing:0.04em;">Ver ticket</a>
                      </div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </div>`;
      const textBody = [
        `Tu QR para ${eventName}`,
        `Nombre: ${first_name} ${last_name}`.trim(),
        eventLocation ? `Lugar: ${eventLocation}` : null,
        dateLabel ? `Fecha: ${dateLabel}` : null,
        `Enlace del ticket: ${ticketUrl}`,
      ]
        .filter(Boolean)
        .join("\n");

      await sendEmail({
        to: email,
        subject: `BABY - Entrada ${eventName}`,
        html,
        text: textBody,
      });
      emailSent = true;
    } catch (err: any) {
      emailError = err?.message || "No se pudo enviar el correo automático";
      console.error("[/api/tickets] Error enviando correo automático:", err);
    }
  }

  console.log("[/api/tickets] Ticket creado exitosamente:", {
    ticketId: ticketData?.id,
    person_id,
    event_id: eventId,
    full_name
  });

  // incrementar uses del código
  if (codeRow?.id) {
    await supabase
      .from("codes")
      .update({ uses: (codeRow.uses || 0) + 1 })
      .eq("id", codeRow.id);
  }

  return NextResponse.json({
    success: true,
    ticketId: ticketData?.id,
    qr: qr_token,
    code: codeRow?.code || null,
    eventId,
    needsPayment: requiresPayment,
    emailSent,
    emailError,
  });
}
