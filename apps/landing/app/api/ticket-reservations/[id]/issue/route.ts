import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { applyNotDeleted } from "shared/db/softDelete";
import { normalizeDocument, validateDocument, type DocumentType } from "shared/document";
import {
  buildEventTicketIdentityKeys,
  findActiveEventTicketConflict,
} from "shared/eventTicketIdentity";
import { createTicketForReservation } from "../../../../../../backoffice/app/api/reservations/utils";
import { sendTicketEmail } from "../../../../../../backoffice/app/api/reservations/email";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const APPROVED_STATUSES = new Set(["approved", "confirmed", "paid"]);
const RESERVATION_SELECT =
  "id,event_id,sale_origin,status,promoter_id,full_name,email,phone,doc_type,document,ticket_type_label,codes";
const UNIT_SELECT =
  "id,reservation_id,event_id,package_index,person_index,unit_index,status,full_name,doc_type,document,email,phone,ticket_id";

function getSupabase() {
  if (!supabaseUrl || !supabaseServiceKey) return null;
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function jsonError(error: string, status: number) {
  return NextResponse.json({ success: false, error }, { status });
}

async function loadReservation(supabase: any, reservationId: string) {
  const { data, error } = await applyNotDeleted(
    supabase.from("table_reservations").select(RESERVATION_SELECT),
  )
    .eq("id", reservationId)
    .maybeSingle();

  return { data, error };
}

async function loadUnits(supabase: any, reservationId: string) {
  const { data, error } = await applyNotDeleted(
    supabase.from("ticket_reservation_units").select(UNIT_SELECT),
  )
    .eq("reservation_id", reservationId)
    .order("unit_index", { ascending: true });

  return {
    data: Array.isArray(data) ? data : [],
    error,
  };
}

function uniqueStrings(values: Array<string | null | undefined>) {
  return Array.from(
    new Set(
      values
        .map((value) => (value ? String(value).trim() : ""))
        .filter(Boolean),
    ),
  );
}

function buildNominationError(unitLabel: string, fullName: string, docType: DocumentType, document: string) {
  if (!fullName.trim()) {
    return `Completa el nombre de ${unitLabel} antes de emitir el QR.`;
  }
  const { document: normalizedDocument } = normalizeDocument(docType, document);
  if (!validateDocument(docType, normalizedDocument)) {
    return `Completa el documento de ${unitLabel} antes de emitir el QR.`;
  }
  return null;
}

export async function POST(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const supabase = getSupabase();
  if (!supabase) return jsonError("Supabase config missing", 500);

  const { id } = await context.params;
  const reservation = await loadReservation(supabase, id);
  if (reservation.error) return jsonError(reservation.error.message, 500);
  if (!reservation.data) return jsonError("Reserva no encontrada", 404);
  if ((reservation.data as any).sale_origin !== "ticket") {
    return jsonError("La reserva no pertenece al flujo ticket-only", 400);
  }
  if (
    !APPROVED_STATUSES.has(
      String((reservation.data as any).status || "").toLowerCase(),
    )
  ) {
    return jsonError("La reserva aún no está approved para emitir QRs", 400);
  }

  const units = await loadUnits(supabase, id);
  if (units.error) return jsonError(units.error.message, 500);

  const pendingNominationCount = units.data.filter(
    (unit: any) =>
      Number(unit.unit_index || 0) > 1 && unit.status === "pending_nomination",
  ).length;
  const buyerUnit =
    units.data.find((unit: any) => Number(unit.unit_index || 0) === 1) || null;
  const buyerNeedsIssue = Boolean(buyerUnit && !buyerUnit.ticket_id);
  const issuableAssistantUnits = units.data.filter(
    (unit: any) =>
      Number(unit.unit_index || 0) > 1 &&
      unit.status === "nominated" &&
      !unit.ticket_id,
  );
  const issuableUnits = [
    ...(buyerNeedsIssue ? [buyerUnit] : []),
    ...issuableAssistantUnits,
  ].filter(Boolean);
  if (issuableUnits.length === 0) {
    return NextResponse.json({
      success: true,
      issuedCount: 0,
      pendingNominationCount,
      codes: Array.isArray((reservation.data as any).codes)
        ? (reservation.data as any).codes
        : [],
      units: units.data,
    });
  }

  const seenIdentityKeys = new Map<string, string>();
  for (const unit of issuableUnits as any[]) {
    const isBuyerUnit = Number(unit.unit_index || 0) === 1;
    const buyerName = String((reservation.data as any).full_name || "").trim();
    const buyerEmail = String((reservation.data as any).email || "").trim();
    const buyerPhone = String((reservation.data as any).phone || "").trim();
    const buyerDocType =
      String((reservation.data as any).doc_type || "dni").trim() || "dni";
    const buyerDocument = String((reservation.data as any).document || "").trim();
    const fullName =
      String(unit.full_name || "").trim() ||
      (isBuyerUnit ? buyerName : "") ||
      buyerName;
    const email =
      String(unit.email || "").trim() ||
      (isBuyerUnit ? buyerEmail : "") ||
      null;
    const phone =
      String(unit.phone || "").trim() ||
      (isBuyerUnit ? buyerPhone : "") ||
      null;
    const docType = (String(unit.doc_type || "").trim() ||
      (isBuyerUnit ? buyerDocType : "dni")) as DocumentType;
    const document =
      String(unit.document || "").trim() || (isBuyerUnit ? buyerDocument : "");

    for (const key of buildEventTicketIdentityKeys({
      fullName,
      email,
      phone,
      docType,
      document,
      dni: docType === "dni" ? document : null,
    })) {
      const previousLabel = seenIdentityKeys.get(key);
      if (previousLabel) {
        return jsonError(
          `No puedes emitir dos QR para la misma persona en este evento. Revisa ${previousLabel} y unidad ${Number(unit.unit_index || 0) || "?"}.`,
          409,
        );
      }
      seenIdentityKeys.set(
        key,
        `unidad ${Number(unit.unit_index || 0) || "?"}`,
      );
    }
    const existingConflict = await findActiveEventTicketConflict(
      supabase as any,
      {
        eventId: String((reservation.data as any).event_id || ""),
        fullName,
        email,
        phone,
        docType,
        document,
        dni: docType === "dni" ? document : null,
      },
    );
    if (existingConflict?.ticketId) {
      return jsonError(
        `La ${`unidad ${Number(unit.unit_index || 0) || "?"}`} ya tiene un QR activo en este evento con esos datos. Corrige la nominación antes de emitir.`,
        409,
      );
    }
  }

  const issuedCodes: string[] = [];
  for (const unit of issuableUnits as any[]) {
    const isBuyerUnit = Number(unit.unit_index || 0) === 1;
    const buyerName = String((reservation.data as any).full_name || "").trim();
    const buyerEmail = String((reservation.data as any).email || "").trim();
    const buyerPhone = String((reservation.data as any).phone || "").trim();
    const buyerDocType =
      String((reservation.data as any).doc_type || "dni").trim() || "dni";
    const buyerDocument = String(
      (reservation.data as any).document || "",
    ).trim();
    const fullName =
      String(unit.full_name || "").trim() ||
      (isBuyerUnit ? buyerName : "") ||
      buyerName;
    const email =
      String(unit.email || "").trim() ||
      (isBuyerUnit ? buyerEmail : "") ||
      null;
    const phone =
      String(unit.phone || "").trim() ||
      (isBuyerUnit ? buyerPhone : "") ||
      null;
    const docType = (String(unit.doc_type || "").trim() ||
      (isBuyerUnit ? buyerDocType : "dni")) as DocumentType;
    const document =
      String(unit.document || "").trim() || (isBuyerUnit ? buyerDocument : "");
    const validationError = buildNominationError(
      `unidad ${Number(unit.unit_index || 0) || "?"}`,
      fullName,
      docType,
      document,
    );
    if (validationError) return jsonError(validationError, 400);
    const result = await createTicketForReservation(supabase, {
      eventId: (reservation.data as any).event_id,
      tableName: (reservation.data as any).ticket_type_label || "Entrada",
      fullName,
      email,
      phone,
      dni: docType === "dni" ? document : null,
      docType,
      document,
      promoterId: (reservation.data as any).promoter_id || null,
      reuseCodes: [],
      codeType: "courtesy",
      tableId: null,
      productId: null,
      tableReservationId: id,
    });

    issuedCodes.push(result.code);
    const unitPatch: Record<string, any> = {
      status: "issued",
      ticket_id: result.ticketId,
      issued_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (isBuyerUnit) {
      unitPatch.full_name = fullName;
      unitPatch.email = email;
      unitPatch.phone = phone;
      unitPatch.doc_type = docType;
      unitPatch.document = document || null;
    } else {
      if (fullName) unitPatch.full_name = fullName;
      if (email) unitPatch.email = email;
      if (phone) unitPatch.phone = phone;
      if (docType) unitPatch.doc_type = docType;
      if (document) unitPatch.document = document;
    }

    const { error: updateError } = await supabase
      .from("ticket_reservation_units")
      .update(unitPatch)
      .eq("id", unit.id)
      .eq("reservation_id", id);

    if (updateError) return jsonError(updateError.message, 500);

    if (email) {
      await sendTicketEmail({
        supabase,
        ticketId: result.ticketId,
        toEmail: email,
      });
    }
  }

  const mergedCodes = uniqueStrings([
    ...(((reservation.data as any).codes || []) as string[]),
    ...issuedCodes,
  ]);
  const { error: reservationUpdateError } = await supabase
    .from("table_reservations")
    .update({
      codes: mergedCodes,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (reservationUpdateError) {
    return jsonError(reservationUpdateError.message, 500);
  }

  const reloadedUnits = await loadUnits(supabase, id);
  if (reloadedUnits.error) return jsonError(reloadedUnits.error.message, 500);

  return NextResponse.json({
    success: true,
    issuedCount: issuableUnits.length,
    pendingNominationCount,
    codes: mergedCodes,
    units: reloadedUnits.data,
  });
}
