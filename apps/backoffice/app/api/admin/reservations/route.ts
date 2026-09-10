import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createTicketForReservation, createReservationCodes } from "../../reservations/utils";
import { sendApprovalEmail } from "../../reservations/email";
import {
  isPresentButInvalidEmailAddress,
  normalizeOptionalEmailAddress,
  resolveFirstValidEmailAddress,
} from "shared/email/address";
import { normalizeDocument, validateDocument, type DocumentType } from "shared/document";
import { requireStaffRole } from "shared/auth/requireStaff";
import { applyNotDeleted } from "shared/db/softDelete";
import { findTableAvailability, isTableAvailableForEvent } from "shared/tableAvailability";
import { resolveReservationEventId } from "shared/reservationEvent";
import { EventTicketConflictError } from "shared/eventTicketIdentity";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ACTIVE_STATUSES = ["pending", "approved", "confirmed", "paid"];
const ALLOWED_STATUSES = ["pending", "approved", "rejected"];

export async function POST(req: NextRequest) {
  const guard = await requireStaffRole(req);
  if (!guard.ok) {
    return NextResponse.json({ success: false, error: guard.error }, { status: guard.status });
  }
  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json({ success: false, error: "Supabase config missing" }, { status: 500 });
  }

  let body: any = null;
  try {
    body = await req.json();
  } catch (_err) {
    return NextResponse.json({ success: false, error: "Invalid JSON" }, { status: 400 });
  }

  const docTypeRaw = typeof body?.doc_type === "string" ? (body.doc_type as DocumentType) : "dni";
  const documentRaw = typeof body?.document === "string" ? body.document : body?.dni || "";
  const { docType: bodyDocType, document: bodyDocument } = normalizeDocument(docTypeRaw, documentRaw);

  const modeRaw = typeof body?.mode === "string" ? body.mode : "";
  const mode: "existing_ticket" | "new_customer" = modeRaw === "existing_ticket" ? "existing_ticket" : "new_customer";

  const table_id = typeof body?.table_id === "string" ? body.table_id : "";
  const product_id = typeof body?.product_id === "string" ? body.product_id : null;
  const status = ALLOWED_STATUSES.includes(body?.status) ? body.status : "approved";
  const voucher_url = typeof body?.voucher_url === "string" ? body.voucher_url.trim() : "";
  const notes = typeof body?.notes === "string" ? body.notes.trim() : "";
  const rawCodes = Array.isArray(body?.codes) ? body.codes : [];
  const providedCodes: string[] = rawCodes.map((c: any) => String(c).trim()).filter(Boolean);
  const created_by_staff_id = typeof body?.created_by_staff_id === "string" ? body.created_by_staff_id : null;
  let eventId = typeof body?.event_id === "string" ? body.event_id : null;

  if (!table_id) return NextResponse.json({ success: false, error: "table_id es requerido" }, { status: 400 });

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Mesa
  const tableQuery = applyNotDeleted(
    supabase.from("tables").select("id,name,event_id,ticket_count,is_active").eq("id", table_id)
  );
  const { data: table, error: tableError } = await tableQuery.maybeSingle();

  if (tableError || !table) {
    return NextResponse.json({ success: false, error: tableError?.message || "Mesa no encontrada" }, { status: 404 });
  }
  if (table.is_active === false) {
    return NextResponse.json({ success: false, error: "Mesa inactiva" }, { status: 400 });
  }

  eventId = resolveReservationEventId(table.event_id, eventId);
  const requiredQrCount = Math.max(table.ticket_count || 1, 1);

  // Fetch event data with event_prefix
  let eventData: any = null;
  if (eventId) {
    const { data: evt } = await supabase
      .from("events")
      .select("id,name,event_prefix")
      .eq("id", eventId)
      .maybeSingle();
    eventData = evt;
  }

  // Invariante de negocio: toda reserva de mesa debe ir con pack/producto activo.
  const activeProductsQuery = applyNotDeleted(
    supabase
      .from("table_products")
      .select("id,table_id,is_active")
      .eq("table_id", table_id)
      .eq("is_active", true)
  );
  const { data: activeProducts, error: activeProductsError } = await activeProductsQuery;
  if (activeProductsError) {
    return NextResponse.json({ success: false, error: activeProductsError.message }, { status: 500 });
  }
  if (!activeProducts || activeProducts.length === 0) {
    return NextResponse.json(
      { success: false, error: "La mesa no tiene packs activos configurados" },
      { status: 400 }
    );
  }
  if (!product_id) {
    return NextResponse.json(
      { success: false, error: "product_id es requerido para reservar mesa" },
      { status: 400 }
    );
  }
  const selectedProduct = activeProducts.find((product: any) => product.id === product_id);
  if (!selectedProduct) {
    return NextResponse.json(
      { success: false, error: "El producto no pertenece a la mesa seleccionada o está inactivo" },
      { status: 400 }
    );
  }

  if (eventId) {
    const availabilityQuery = applyNotDeleted(
      supabase
        .from("table_availability")
        .select("table_id,is_available")
        .eq("event_id", eventId)
    );
    const { data: availabilityRows, error: availabilityError } = await availabilityQuery;
    if (availabilityError) {
      return NextResponse.json({ success: false, error: availabilityError.message }, { status: 500 });
    }

    const rows = availabilityRows || [];
    if (rows.length > 0) {
      const tableAvailability = findTableAvailability(table_id, rows);
      const legacyEventMismatch =
        table.event_id && table.event_id !== eventId && !tableAvailability;
      if (legacyEventMismatch || !isTableAvailableForEvent(table_id, rows)) {
        return NextResponse.json(
          { success: false, error: "La mesa no está disponible para este evento" },
          { status: 409 }
        );
      }
    }
  }

  // Evitar doble reserva
  let existingReservationQuery = applyNotDeleted(
    supabase
      .from("table_reservations")
      .select("id,status,event_id")
      .eq("table_id", table_id)
      .in("status", ACTIVE_STATUSES)
      .limit(1)
  );
  if (eventId) {
    existingReservationQuery = existingReservationQuery.eq("event_id", eventId);
  }
  const { data: existingReservation } = await existingReservationQuery.maybeSingle();

  if (existingReservation) {
    return NextResponse.json({ success: false, error: "La mesa ya tiene una reserva activa" }, { status: 409 });
  }

  try {
    if (mode === "existing_ticket") {
      const ticket_id = typeof body?.ticket_id === "string" ? body.ticket_id : "";
      const email = normalizeOptionalEmailAddress(body?.email);
      const phone = typeof body?.phone === "string" ? body.phone.trim() : "";
      const documentValue = bodyDocument;
      const docTypeValue = bodyDocType;
      const docSearchValid = documentValue ? validateDocument(docTypeValue, documentValue) : false;
      if (documentValue && !docSearchValid) {
        return NextResponse.json({ success: false, error: "Documento inválido" }, { status: 400 });
      }
      if (isPresentButInvalidEmailAddress(email)) {
        return NextResponse.json({ success: false, error: "Email inválido" }, { status: 400 });
      }

      if (!ticket_id && !docSearchValid && !email && !phone) {
        return NextResponse.json(
          { success: false, error: "Proporciona ticket_id o un dato de contacto (documento/email/teléfono)" },
          { status: 400 }
        );
      }

      let ticketQuery = applyNotDeleted(
        supabase
          .from("tickets")
          .select(
            "id,event_id,full_name,email,phone,dni,doc_type,document,person:persons(first_name,last_name,email,phone,doc_type,document,dni),code:codes(code)"
          )
          .limit(1)
      );

      if (ticket_id) {
        ticketQuery = ticketQuery.eq("id", ticket_id);
      } else {
        const orFilters = [
          docSearchValid ? `document.eq.${documentValue}` : "",
          docSearchValid && docTypeValue === "dni" ? `dni.eq.${documentValue}` : "",
          email ? `email.eq.${email}` : "",
          phone ? `phone.eq.${phone}` : "",
        ].filter(Boolean);
        if (orFilters.length === 0) {
          return NextResponse.json(
            { success: false, error: "Falta ticket_id o al menos un campo para buscar el ticket" },
            { status: 400 }
          );
        }
        ticketQuery = ticketQuery.or(orFilters.join(",")).order("created_at", { ascending: false });
      }

      if (eventId) ticketQuery = ticketQuery.eq("event_id", eventId);

      const { data: ticket, error: ticketError } = await ticketQuery.maybeSingle();
      if (ticketError || !ticket) {
        return NextResponse.json({ success: false, error: ticketError?.message || "Ticket no encontrado" }, { status: 404 });
      }

          if (eventId && ticket.event_id && ticket.event_id !== eventId) {
            return NextResponse.json({ success: false, error: "El ticket pertenece a otro evento" }, { status: 400 });
          }
          eventId = eventId || ticket.event_id || null;
          if (!eventId) {
            return NextResponse.json({ success: false, error: "No se pudo determinar el evento" }, { status: 400 });
          }

          const personRel = Array.isArray((ticket as any).person) ? (ticket as any).person?.[0] : (ticket as any).person;
          const nameFromPerson = personRel ? `${personRel.first_name || ""} ${personRel.last_name || ""}`.trim() : "";
          const full_name = typeof body?.full_name === "string" && body.full_name.trim() ? body.full_name.trim() : ticket.full_name || nameFromPerson;
          const contactEmail =
            resolveFirstValidEmailAddress(
              email,
              ticket.email || null,
              personRel?.email || null,
            ) || null;
          const contactPhone = phone || ticket.phone || personRel?.phone || null;
          const ticketDocType = ((ticket as any).doc_type as DocumentType) || (personRel?.doc_type as DocumentType) || "dni";
          const ticketDocument =
            (ticket as any).document ||
            (ticketDocType === "dni" ? (ticket as any).dni : null) ||
            personRel?.document ||
            (ticketDocType === "dni" ? (personRel as any)?.dni : null) ||
            null;
          const resolvedDocType = docSearchValid ? docTypeValue : ticketDocType;
          const resolvedDocument = docSearchValid ? documentValue : ticketDocument || "";
          
          // Create reservation first to get ID for codes
          const { data: reservation, error: resError } = await supabase
            .from("table_reservations")
            .insert({
              table_id,
              event_id: eventId,
              sale_origin: "table",
              ticket_pricing_phase: null,
              product_id,
              full_name: full_name || "Invitado reserva",
              email: contactEmail,
              phone: contactPhone,
              doc_type: resolvedDocType,
              document: resolvedDocument || null,
              voucher_url: voucher_url || null,
              status,
              codes: [], // Will update after creating individual codes
              ticket_quantity: requiredQrCount,
              notes: notes || null,
              created_by_staff_id,
            })
            .select("id")
            .single();

      if (resError || !reservation?.id) {
        return NextResponse.json({ success: false, error: resError?.message || "No se pudo crear la reserva" }, { status: 500 });
      }

      const { error: linkExistingTicketError } = await supabase
        .from("tickets")
        .update({
          table_reservation_id: reservation.id,
          table_id,
          product_id,
        })
        .eq("id", ticket.id);
      if (linkExistingTicketError) {
        return NextResponse.json({ success: false, error: linkExistingTicketError.message }, { status: 500 });
      }

      // Generate individual friendly codes
      const eventPrefix = eventData?.event_prefix || "BC";
      const quantity = requiredQrCount;
      const { codes } = await createReservationCodes(supabase, {
        eventId: eventId!,
        eventPrefix,
        tableName: table.name,
        reservationId: reservation.id,
        quantity,
      });

      // Update reservation with codes array (backward compatibility)
      await supabase
        .from("table_reservations")
        .update({ codes })
        .eq("id", reservation.id);

      if (status === "approved" && contactEmail) {
        await sendReservationEmail({ supabase, reservationId: reservation.id, ticketId: ticket.id, email: contactEmail });
      }

      return NextResponse.json({
        success: true,
        reservationId: reservation.id,
        ticketId: ticket.id,
        codes,
        eventId,
      });
    }

    // mode === "new_customer"
    const full_name = typeof body?.full_name === "string" ? body.full_name.trim() : "";
    const email = normalizeOptionalEmailAddress(body?.email);
    const phone = typeof body?.phone === "string" ? body.phone.trim() : "";
    const docType = bodyDocType;
    const document = bodyDocument;
    const dniForTicket = docType === "dni" ? document : null;
    const ticketCount = requiredQrCount;

    if (!full_name) {
      return NextResponse.json({ success: false, error: "full_name es requerido para crear ticket" }, { status: 400 });
    }
    if (!eventId) {
      return NextResponse.json({ success: false, error: "event_id es requerido para crear ticket" }, { status: 400 });
    }
    if (!validateDocument(docType, document)) {
      return NextResponse.json({ success: false, error: "Documento inválido" }, { status: 400 });
    }
    if (isPresentButInvalidEmailAddress(email)) {
      return NextResponse.json({ success: false, error: "Email inválido" }, { status: 400 });
    }

    const ticketResult = await createTicketForReservation(supabase, {
      eventId,
      tableName: table.name,
      fullName: full_name,
      email: email || null,
      phone: phone || null,
      dni: dniForTicket || null,
      docType,
      document,
      reuseCodes: providedCodes,
      codeType: "table",
      tableId: table_id,
      productId: product_id,
    });

    // Create reservation first
    const { data: reservation, error: resError } = await supabase
      .from("table_reservations")
      .insert({
        table_id,
        event_id: eventId,
        sale_origin: "table",
        ticket_pricing_phase: null,
        product_id,
        full_name,
        doc_type: docType,
        document,
        email: email || null,
        phone: phone || null,
        voucher_url: voucher_url || null,
        status,
        ticket_quantity: ticketCount,
        codes: [], // Will update after creating individual codes
        notes: notes || null,
        created_by_staff_id,
      })
      .select("id")
      .single();

    if (resError || !reservation?.id) {
      return NextResponse.json({ success: false, error: resError?.message || "No se pudo crear la reserva" }, { status: 500 });
    }

    const { error: linkNewTicketError } = await supabase
      .from("tickets")
      .update({ table_reservation_id: reservation.id })
      .eq("id", ticketResult.ticketId);
    if (linkNewTicketError) {
      return NextResponse.json({ success: false, error: linkNewTicketError.message }, { status: 500 });
    }

    // Generate individual friendly codes
    const eventPrefix = eventData?.event_prefix || "BC";
    const quantity = ticketCount;
    const { codes } = await createReservationCodes(supabase, {
      eventId,
      eventPrefix,
      tableName: table.name,
      reservationId: reservation.id,
      quantity,
    });

    // Update reservation with codes array (backward compatibility)
    await supabase
      .from("table_reservations")
      .update({ codes })
      .eq("id", reservation.id);

    if (status === "approved" && email) {
      await sendReservationEmail({ supabase, reservationId: reservation.id, ticketId: ticketResult.ticketId, email });
    }

    return NextResponse.json({ success: true, reservationId: reservation.id, ticketId: ticketResult.ticketId, codes, eventId });
  } catch (err: any) {
    if (err instanceof EventTicketConflictError) {
      return NextResponse.json(
        { success: false, error: err.message, conflict: err.conflict },
        { status: 409 },
      );
    }
    return NextResponse.json({ success: false, error: err?.message || "Error creando reserva" }, { status: 500 });
  }
}

async function sendReservationEmail({
  supabase,
  reservationId,
  ticketId,
  email,
}: {
  supabase: any;
  reservationId: string;
  ticketId: string;
  email: string;
}) {
  try {
    const { data: reservation, error } = await supabase
      .from("table_reservations")
      .select("id,status,full_name,email,phone,codes,table:tables(name,event:events(name,starts_at,location))")
      .eq("id", reservationId)
      .maybeSingle();
    if (error || !reservation || !["approved", "confirmed", "paid"].includes(String(reservation.status || "").toLowerCase())) return;

    const table = Array.isArray(reservation.table) ? reservation.table[0] : reservation.table;
    const event = Array.isArray(table?.event) ? table.event[0] : table?.event;
    await sendApprovalEmail({
      supabase,
      id: reservationId,
      full_name: reservation.full_name || "",
      email,
      phone: reservation.phone || null,
      codes: Array.isArray(reservation.codes) ? reservation.codes : [],
      ticketIds: [ticketId],
      tableName: table?.name || "Mesa",
      event: event || null,
      resourceLabel: "Mesa",
      logAction: "reservation_confirmed",
    });
  } catch {
    // The reservation is already saved; delivery failures are logged by the sender.
  }
}
