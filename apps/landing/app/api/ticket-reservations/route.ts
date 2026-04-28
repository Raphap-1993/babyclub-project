import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  normalizeDocument,
  validateDocument,
  type DocumentType,
} from "shared/document";
import { applyNotDeleted } from "shared/db/softDelete";
import {
  ensureEventSalesDefaults,
  evaluateEventSales,
  isMissingEventSalesColumnsError,
} from "shared/eventSales";
import {
  resolveTicketTypeSelection,
  type TicketSalePhase,
} from "shared/ticketTypes";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const resolveActiveTicketSalePhase = (): TicketSalePhase => {
  const raw = (
    process.env.TICKET_SALE_PHASE ||
    process.env.NEXT_PUBLIC_TICKET_SALE_PHASE ||
    "early_bird"
  )
    .trim()
    .toLowerCase();
  return raw === "all_night" ? "all_night" : "early_bird";
};

function isMissingTicketTypesRelationError(error: any) {
  if (!error) return false;
  const haystack =
    `${error?.message || ""} ${error?.details || ""} ${error?.hint || ""}`.toLowerCase();
  return (
    haystack.includes("event_ticket_types") || haystack.includes("ticket_types")
  );
}

function isMissingTicketTypeReservationColumnsError(error: any) {
  if (!error) return false;
  const haystack =
    `${error?.message || ""} ${error?.details || ""} ${error?.hint || ""}`.toLowerCase();
  return (
    haystack.includes("ticket_type_id") ||
    haystack.includes("ticket_type_code") ||
    haystack.includes("ticket_type_label") ||
    haystack.includes("ticket_unit_price") ||
    haystack.includes("ticket_total_amount")
  );
}

function isMissingReservationAttendeesColumnError(error: any) {
  if (!error) return false;
  const haystack =
    `${error?.message || ""} ${error?.details || ""} ${error?.hint || ""}`.toLowerCase();
  return haystack.includes("attendees") && haystack.includes("column");
}

function isMissingPromoterLinkTraceColumnsError(error: any) {
  if (!error) return false;
  const haystack =
    `${error?.message || ""} ${error?.details || ""} ${error?.hint || ""}`.toLowerCase();
  return (
    haystack.includes("promoter_link_code_id") ||
    haystack.includes("promoter_link_code")
  );
}

function stripUnsupportedReservationColumns(
  payload: Record<string, any>,
  error: any,
) {
  const nextPayload = { ...payload };
  let changed = false;

  if (isMissingTicketTypeReservationColumnsError(error)) {
    delete nextPayload.ticket_type_id;
    delete nextPayload.ticket_type_code;
    delete nextPayload.ticket_type_label;
    delete nextPayload.ticket_unit_price;
    delete nextPayload.ticket_total_amount;
    changed = true;
  }

  if (isMissingReservationAttendeesColumnError(error)) {
    delete nextPayload.attendees;
    changed = true;
  }

  if (isMissingPromoterLinkTraceColumnsError(error)) {
    delete nextPayload.promoter_link_code_id;
    delete nextPayload.promoter_link_code;
    changed = true;
  }

  return changed ? nextPayload : null;
}

function buildFullName(
  firstName: string,
  lastNameP: string,
  lastNameM: string,
) {
  return [firstName, lastNameP, lastNameM]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(" ");
}

function normalizeAttendeeInput(input: any) {
  const docTypeRaw =
    typeof input?.doc_type === "string"
      ? (input.doc_type as DocumentType)
      : "dni";
  const documentRaw = typeof input?.document === "string" ? input.document : "";
  const { docType, document } = normalizeDocument(docTypeRaw, documentRaw);
  const nombre = typeof input?.nombre === "string" ? input.nombre.trim() : "";
  const apellidoPaterno =
    typeof input?.apellido_paterno === "string"
      ? input.apellido_paterno.trim()
      : "";
  const apellidoMaterno =
    typeof input?.apellido_materno === "string"
      ? input.apellido_materno.trim()
      : "";
  const email = typeof input?.email === "string" ? input.email.trim() : "";
  const phone =
    typeof input?.telefono === "string"
      ? input.telefono.trim()
      : typeof input?.phone === "string"
        ? input.phone.trim()
        : "";
  const fullName =
    typeof input?.full_name === "string" && input.full_name.trim()
      ? input.full_name.trim()
      : buildFullName(nombre, apellidoPaterno, apellidoMaterno);

  return {
    doc_type: docType,
    document,
    nombre,
    apellido_paterno: apellidoPaterno,
    apellido_materno: apellidoMaterno,
    full_name: fullName,
    email,
    phone,
  };
}

function attendeeHasMeaningfulData(
  attendee: ReturnType<typeof normalizeAttendeeInput>,
) {
  return Boolean(
    attendee.document ||
      attendee.nombre ||
      attendee.apellido_paterno ||
      attendee.apellido_materno ||
      attendee.email ||
      attendee.phone,
  );
}

function buildReservationAttendees({
  rawAttendees,
  quantity,
  primary,
}: {
  rawAttendees: any[];
  quantity: number;
  primary: ReturnType<typeof normalizeAttendeeInput>;
}) {
  const attendees = [];
  for (let index = 0; index < quantity; index++) {
    const raw = rawAttendees[index];
    const normalized =
      index === 0 ? primary : raw ? normalizeAttendeeInput(raw) : primary;
    const usePrimaryFallback =
      index > 0 && !attendeeHasMeaningfulData(normalized);
    const attendee = usePrimaryFallback ? primary : normalized;

    if (!validateDocument(attendee.doc_type, attendee.document)) {
      throw new Error(`Documento inválido para entrada ${index + 1}`);
    }
    if (!attendee.full_name) {
      throw new Error(
        `Nombre y apellidos requeridos para entrada ${index + 1}`,
      );
    }

    attendees.push({
      person_index: index + 1,
      doc_type: attendee.doc_type,
      document: attendee.document,
      full_name: attendee.full_name,
      first_name: attendee.nombre || null,
      last_name_p: attendee.apellido_paterno || null,
      last_name_m: attendee.apellido_materno || null,
      email: attendee.email || primary.email || null,
      phone: attendee.phone || primary.phone || null,
    });
  }
  return attendees;
}

export async function POST(req: NextRequest) {
  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json(
      { success: false, error: "Supabase config missing" },
      { status: 500 },
    );
  }

  let body: any = null;
  try {
    body = await req.json();
  } catch (_err) {
    return NextResponse.json(
      { success: false, error: "Invalid JSON" },
      { status: 400 },
    );
  }

  const event_id =
    typeof body?.event_id === "string" ? body.event_id.trim() : "";
  const promoter_id =
    typeof body?.promoter_id === "string" && body.promoter_id.trim()
      ? body.promoter_id.trim()
      : null;
  const promoterLinkCodeId =
    typeof body?.promoter_link_code_id === "string" &&
    body.promoter_link_code_id.trim()
      ? body.promoter_link_code_id.trim()
      : null;
  const promoterLinkCode =
    typeof body?.promoter_link_code === "string" &&
    body.promoter_link_code.trim()
      ? body.promoter_link_code.trim()
      : null;
  const docTypeRaw =
    typeof body?.doc_type === "string"
      ? (body.doc_type as DocumentType)
      : "dni";
  const documentRaw = typeof body?.document === "string" ? body.document : "";
  const { docType, document } = normalizeDocument(docTypeRaw, documentRaw);
  const first_name = typeof body?.nombre === "string" ? body.nombre.trim() : "";
  const last_name_p =
    typeof body?.apellido_paterno === "string"
      ? body.apellido_paterno.trim()
      : "";
  const last_name_m =
    typeof body?.apellido_materno === "string"
      ? body.apellido_materno.trim()
      : "";
  const full_name = [first_name, last_name_p, last_name_m]
    .filter(Boolean)
    .join(" ")
    .trim();
  const email = typeof body?.email === "string" ? body.email.trim() : "";
  const phone = typeof body?.telefono === "string" ? body.telefono.trim() : "";
  const voucher_url =
    typeof body?.voucher_url === "string" ? body.voucher_url.trim() : "";
  const paymentMethod =
    typeof body?.payment_method === "string" ? body.payment_method : "yape";
  const quantityRaw =
    typeof body?.ticket_quantity === "number"
      ? body.ticket_quantity
      : parseInt(body?.ticket_quantity, 10);
  const ticket_quantity = Number.isFinite(quantityRaw)
    ? Math.floor(quantityRaw)
    : NaN;
  const ticketTypeCode =
    typeof body?.ticket_type_code === "string"
      ? body.ticket_type_code.trim()
      : "";
  const rawAttendees = Array.isArray(body?.attendees) ? body.attendees : [];
  const pricingPhaseRaw =
    typeof body?.pricing_phase === "string"
      ? body.pricing_phase.trim().toLowerCase()
      : "";
  const activeTicketSalePhase = resolveActiveTicketSalePhase();
  const requestedTicketSalePhase: TicketSalePhase =
    pricingPhaseRaw === "all_night"
      ? "all_night"
      : pricingPhaseRaw === "early_bird"
        ? "early_bird"
        : activeTicketSalePhase;

  if (!event_id) {
    return NextResponse.json(
      { success: false, error: "event_id es requerido" },
      { status: 400 },
    );
  }
  if (!ticketTypeCode && ticket_quantity !== 1 && ticket_quantity !== 2) {
    return NextResponse.json(
      { success: false, error: "ticket_quantity debe ser 1 o 2" },
      { status: 400 },
    );
  }
  if (
    pricingPhaseRaw &&
    pricingPhaseRaw !== "early_bird" &&
    pricingPhaseRaw !== "all_night"
  ) {
    return NextResponse.json(
      { success: false, error: "pricing_phase inválido" },
      { status: 400 },
    );
  }
  if (paymentMethod !== "culqi" && !voucher_url) {
    return NextResponse.json(
      { success: false, error: "voucher_url es requerido" },
      { status: 400 },
    );
  }
  if (!validateDocument(docType, document)) {
    return NextResponse.json(
      { success: false, error: "Documento inválido" },
      { status: 400 },
    );
  }
  if (!first_name || !last_name_p || !last_name_m) {
    return NextResponse.json(
      { success: false, error: "Nombre y apellidos requeridos" },
      { status: 400 },
    );
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const eventQuery = applyNotDeleted(
    supabase
      .from("events")
      .select(
        "id,is_active,closed_at,sale_status,sale_public_message,early_bird_enabled,early_bird_price_1,early_bird_price_2,all_night_price_1,all_night_price_2,ticket_types:event_ticket_types(id,code,label,description,sale_phase,ticket_quantity,price,currency_code,is_active,sort_order)",
      )
      .eq("id", event_id),
  );
  let { data: eventRow, error: eventError } = await eventQuery.maybeSingle();
  if (
    eventError &&
    (isMissingEventSalesColumnsError(eventError) ||
      isMissingTicketTypesRelationError(eventError))
  ) {
    const legacyQuery = applyNotDeleted(
      supabase
        .from("events")
        .select(
          "id,is_active,closed_at,early_bird_enabled,early_bird_price_1,early_bird_price_2,all_night_price_1,all_night_price_2",
        )
        .eq("id", event_id),
    );
    const legacyResult = await legacyQuery.maybeSingle();
    eventRow = legacyResult.data as any;
    eventError = legacyResult.error;
  }

  if (eventError || !eventRow) {
    return NextResponse.json(
      { success: false, error: "Evento no encontrado" },
      { status: 404 },
    );
  }
  const saleDecision = evaluateEventSales(
    ensureEventSalesDefaults(eventRow as any),
  );
  if (!saleDecision.available) {
    return NextResponse.json(
      {
        success: false,
        error:
          saleDecision.public_message ||
          "La venta online no está disponible para este evento",
        code: "sales_blocked",
        sale_status: saleDecision.sale_status,
        sale_block_reason: saleDecision.block_reason,
        sale_public_message: saleDecision.public_message,
      },
      { status: 409 },
    );
  }

  const selectedTicketType = resolveTicketTypeSelection(eventRow, {
    code: ticketTypeCode,
    salePhase: requestedTicketSalePhase,
    ticketQuantity: ticket_quantity,
  });

  if (!selectedTicketType) {
    return NextResponse.json(
      {
        success: false,
        error: "Tipo de entrada no disponible para este evento",
        code: "ticket_type_unavailable",
      },
      { status: 409 },
    );
  }

  const finalTicketQuantity = selectedTicketType.ticketQuantity;
  const unitPrice = selectedTicketType.price / finalTicketQuantity;
  const totalAmount = selectedTicketType.price;
  let attendees: ReturnType<typeof buildReservationAttendees> = [];
  try {
    attendees = buildReservationAttendees({
      rawAttendees,
      quantity: finalTicketQuantity,
      primary: {
        doc_type: docType,
        document,
        nombre: first_name,
        apellido_paterno: last_name_p,
        apellido_materno: last_name_m,
        full_name,
        email,
        phone,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        success: false,
        error: err?.message || "Datos de asistentes inválidos",
      },
      { status: 400 },
    );
  }

  const insertPayload: Record<string, any> = {
    table_id: null,
    event_id: event_id,
    sale_origin: "ticket",
    ticket_pricing_phase: selectedTicketType.salePhase,
    ticket_type_id: selectedTicketType.id || null,
    ticket_type_code: selectedTicketType.code,
    ticket_type_label: selectedTicketType.label,
    ticket_unit_price: unitPrice,
    ticket_total_amount: totalAmount,
    full_name,
    doc_type: docType,
    document,
    email: email || null,
    phone: phone || null,
    voucher_url,
    status: "pending",
    ticket_quantity: finalTicketQuantity,
    promoter_id: promoter_id || null,
    promoter_link_code_id: promoterLinkCodeId,
    promoter_link_code: promoterLinkCode,
    attendees,
  };

  let reservation: any = null;
  let resError: any = null;
  let payloadForInsert = insertPayload;
  for (let attempt = 0; attempt < 4; attempt++) {
    const result = await supabase
      .from("table_reservations")
      .insert(payloadForInsert)
      .select("id")
      .single();
    reservation = result.data;
    resError = result.error;
    if (!resError) break;

    const fallbackPayload = stripUnsupportedReservationColumns(
      payloadForInsert,
      resError,
    );
    if (!fallbackPayload) break;
    payloadForInsert = fallbackPayload;
  }

  if (resError) {
    return NextResponse.json(
      { success: false, error: resError.message },
      { status: 500 },
    );
  }

  return NextResponse.json({
    success: true,
    reservationId: reservation?.id,
    ticket_type_code: selectedTicketType.code,
    ticket_type_label: selectedTicketType.label,
    pricing_phase: selectedTicketType.salePhase,
    ticket_quantity: finalTicketQuantity,
    amount: totalAmount,
    amount_cents: Math.round(totalAmount * 100),
    currency_code: selectedTicketType.currencyCode,
    ticket_type: selectedTicketType,
  });
}
