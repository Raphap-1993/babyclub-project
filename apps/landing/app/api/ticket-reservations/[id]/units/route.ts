import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  normalizeDocument,
  validateDocument,
  type DocumentType,
} from "shared/document";
import { applyNotDeleted } from "shared/db/softDelete";
import { buildEventTicketIdentityKeys } from "shared/eventTicketIdentity";
import { resolveReservationTicketQuantity } from "shared/reservationTicketQuantity";
import { getTicketAccessState } from "shared/ticketAccess";
import { ensureTicketOnlyBuyerIssued } from "../../../../../../backoffice/app/api/reservations/ticketOnlyFlow";
import { ensureReservationUnitClaimCodes } from "../../lib/reservationUnitCodes";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ACTIVE_TICKET_RESERVATION_STATUSES = new Set([
  "approved",
  "confirmed",
  "paid",
]);

const RESERVATION_SELECT =
  "id,event_id,promoter_id,sale_origin,status,ticket_quantity,ticket_type_label,package_quantity,total_ticket_units,codes,full_name,email,phone,doc_type,document,event:events(name,starts_at,location,event_prefix)";
const UNIT_SELECT =
  "id,reservation_id,event_id,package_index,person_index,unit_index,status,full_name,doc_type,document,email,phone,ticket_id,nominated_at,issued_at,used_at,cancelled_at,updated_at";

function getSupabase() {
  if (!supabaseUrl || !supabaseServiceKey) return null;
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function jsonError(error: string, status: number, code?: string) {
  return NextResponse.json(
    { success: false, error, ...(code ? { code } : {}) },
    { status },
  );
}

function normalizeOptionalEmailAddress(value: unknown) {
  const email = typeof value === "string" ? value.trim() : "";
  return email ? email.toLowerCase() : "";
}

function isPresentButInvalidEmailAddress(value: string) {
  return Boolean(value && !EMAIL_PATTERN.test(value));
}

async function loadReservation(supabase: any, reservationId: string) {
  const { data, error } = await applyNotDeleted(
    supabase.from("table_reservations").select(RESERVATION_SELECT),
  )
    .eq("id", reservationId)
    .maybeSingle();

  if (error) return { error };
  if (!data) return { notFound: true };
  const saleOrigin = String((data as any).sale_origin || "")
    .trim()
    .toLowerCase();
  if (saleOrigin !== "ticket" && saleOrigin !== "table") {
    return { wrongType: true, data };
  }
  return { data };
}

async function loadUnits(supabase: any, reservationId: string) {
  const { data, error } = await applyNotDeleted(
    supabase.from("ticket_reservation_units").select(UNIT_SELECT),
  )
    .eq("reservation_id", reservationId)
    .order("unit_index", { ascending: true });

  return {
    data: Array.isArray(data)
      ? [...data].sort(
          (a: any, b: any) =>
            Number(a?.unit_index || 0) - Number(b?.unit_index || 0),
        )
      : [],
    error,
  };
}

async function addAccessStates(supabase: any, units: any[]) {
  const ticketIds = Array.from(
    new Set(units.map((unit) => String(unit.ticket_id || "")).filter(Boolean)),
  );
  const ticketsById = new Map<string, any>();
  for (let start = 0; start < ticketIds.length; start += 500) {
    const { data, error } = await supabase
      .from("tickets")
      .select(
        "id,used,is_active,deleted_at,payment_status,code:codes(type,expires_at),event:events(starts_at,entry_limit,is_active,closed_at,deleted_at)",
      )
      .in("id", ticketIds.slice(start, start + 500));
    if (error)
      throw new Error("No se pudo comprobar el estado de las entradas.");
    for (const ticket of Array.isArray(data) ? data : [])
      ticketsById.set(String(ticket.id), ticket);
  }
  return units.map((unit) => {
    const ticket = ticketsById.get(String(unit.ticket_id || ""));
    const code = Array.isArray(ticket?.code) ? ticket.code[0] : ticket?.code;
    const event = Array.isArray(ticket?.event)
      ? ticket.event[0]
      : ticket?.event;
    const access = ticket
      ? getTicketAccessState({ ticket, code, event: event || null, unit })
      : {
          state:
            unit.status === "cancelled" || unit.ticket_id
              ? "inactive"
              : "pending",
          reason: unit.ticket_id ? "ticket_unavailable" : "nomination_required",
          expiredAt: null,
        };
    return {
      ...unit,
      access_status: access.state,
      access_reason: access.reason,
      expired_at: access.expiredAt,
    };
  });
}

function normalizeComparableUnitState(
  raw: any,
  reservationDocType: DocumentType,
) {
  const fullName =
    typeof raw?.full_name === "string" ? raw.full_name.trim() : "";
  const docTypeRaw =
    typeof raw?.doc_type === "string" && raw.doc_type.trim()
      ? (raw.doc_type as DocumentType)
      : reservationDocType;
  const documentRaw =
    typeof raw?.document === "string" ? raw.document.trim() : "";
  const { docType, document } = normalizeDocument(docTypeRaw, documentRaw);
  const email = normalizeOptionalEmailAddress(raw?.email);
  const phone = typeof raw?.phone === "string" ? raw.phone.trim() : "";
  return { fullName, docType, document, email, phone };
}

function sameNominationState(
  existing: any,
  next: ReturnType<typeof normalizeComparableUnitState>,
) {
  const existingState = normalizeComparableUnitState(
    existing,
    (existing?.doc_type as DocumentType) || "dni",
  );
  return (
    existingState.fullName === next.fullName &&
    existingState.docType === next.docType &&
    existingState.document === next.document &&
    existingState.email === next.email &&
    existingState.phone === next.phone
  );
}

function friendlyNominationUpdateError(message: string, unitLabel: string) {
  const normalized = message.toLowerCase();
  if (
    normalized.includes("ticket_reservation_units_nomination_name_check") ||
    normalized.includes("ticket_reservation_units_nomination_doc_type_check") ||
    normalized.includes("ticket_reservation_units_nomination_document_check")
  ) {
    return `Completa el nombre y documento de ${unitLabel} antes de guardar.`;
  }
  return message;
}

function buildEffectiveUnitIdentityState(
  unit: any,
  reservation: any,
  reservationDocType: DocumentType,
  pendingUpdate?: ReturnType<typeof normalizeComparableUnitState>,
) {
  if (pendingUpdate) return pendingUpdate;

  const isBuyerUnit = Number(unit?.unit_index || 0) === 1;
  if (
    !isBuyerUnit ||
    String(unit?.status || "").toLowerCase() === "issued" ||
    String(unit?.status || "").toLowerCase() === "nominated" ||
    String(unit?.status || "").toLowerCase() === "used"
  ) {
    return normalizeComparableUnitState(unit, reservationDocType);
  }

  return normalizeComparableUnitState(
    {
      full_name: (reservation as any)?.full_name || "",
      doc_type: (reservation as any)?.doc_type || reservationDocType,
      document: (reservation as any)?.document || "",
      email: (reservation as any)?.email || "",
      phone: (reservation as any)?.phone || "",
    },
    reservationDocType,
  );
}

function buildDuplicateIdentityError(
  previousLabel: string,
  currentLabel: string,
  identityKey: string,
) {
  if (identityKey.startsWith("document:")) {
    return `No puedes reutilizar el mismo documento dentro de esta reserva. Revisa ${previousLabel} y ${currentLabel}.`;
  }
  return `No puedes nominar a la misma persona dos veces dentro de esta reserva. Revisa ${previousLabel} y ${currentLabel}.`;
}

function shouldRepairBuyerQr(reservation: any, units: any[]) {
  const saleOrigin = String(reservation?.sale_origin || "")
    .trim()
    .toLowerCase();
  const status = String(reservation?.status || "")
    .trim()
    .toLowerCase();
  if (
    saleOrigin !== "ticket" ||
    !ACTIVE_TICKET_RESERVATION_STATUSES.has(status)
  ) {
    return false;
  }

  const buyerUnit =
    units.find((unit) => Number(unit?.unit_index || 0) === 1) || null;
  return !buyerUnit || !String(buyerUnit.ticket_id || "").trim();
}

async function loadWorkspace(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
  prepare: boolean,
) {
  const supabase = getSupabase();
  if (!supabase) return jsonError("Supabase config missing", 500);

  const { id } = await context.params;
  const reservation = await loadReservation(supabase, id);
  if (reservation.notFound) return jsonError("Reserva no encontrada", 404);
  if (reservation.wrongType) {
    return jsonError("La reserva no pertenece al flujo de nominación", 400);
  }
  if (reservation.error) return jsonError(reservation.error.message, 500);

  const units = await loadUnits(supabase, id);
  if (units.error) return jsonError(units.error.message, 500);

  if (
    prepare &&
    !ACTIVE_TICKET_RESERVATION_STATUSES.has(
      String((reservation.data as any)?.status || "").toLowerCase(),
    )
  ) {
    return jsonError(
      "La compra aún no está aprobada para preparar sus entradas.",
      409,
    );
  }
  const buyer = units.data.find((unit: any) => Number(unit.unit_index) === 1);
  if (
    prepare &&
    buyer &&
    ["used", "cancelled"].includes(String(buyer.status).toLowerCase()) &&
    !buyer.ticket_id
  ) {
    return jsonError("Esta entrada no se puede volver a emitir.", 409);
  }
  let currentUnits = units.data;
  if (prepare && shouldRepairBuyerQr(reservation.data, currentUnits)) {
    try {
      const repaired = await ensureTicketOnlyBuyerIssued({
        supabase,
        reservation: reservation.data as any,
        reservationId: id,
        eventId:
          String((reservation.data as any)?.event_id || "").trim() || null,
        ticketQuantity: resolveReservationTicketQuantity({
          totalTicketUnits: (reservation.data as any)?.total_ticket_units,
          ticketQuantity: (reservation.data as any)?.ticket_quantity,
          codesCount: Array.isArray((reservation.data as any)?.codes)
            ? (reservation.data as any).codes.length
            : 0,
          minimum: 1,
        }),
        tableName:
          String((reservation.data as any)?.ticket_type_label || "").trim() ||
          "Entrada",
        codeType: "courtesy",
        reusableCodes: Array.isArray((reservation.data as any)?.codes)
          ? (reservation.data as any).codes
          : [],
      });
      currentUnits = repaired.units;
    } catch (err: any) {
      return jsonError(
        err?.message || "No se pudieron preparar las entradas.",
        409,
      );
    }
  }

  let unitsWithClaimCodes;
  try {
    unitsWithClaimCodes = await ensureReservationUnitClaimCodes({
      supabase,
      reservation: reservation.data as any,
      units: currentUnits,
      requestUrl: req.url,
      readOnly: !prepare,
    });
    unitsWithClaimCodes = await addAccessStates(supabase, unitsWithClaimCodes);
  } catch (err: any) {
    return jsonError(
      err?.message || "No se pudieron preparar los códigos",
      500,
    );
  }

  return NextResponse.json({
    success: true,
    reservation: reservation.data,
    units: unitsWithClaimCodes,
    needsPreparation:
      shouldRepairBuyerQr(reservation.data, currentUnits) ||
      unitsWithClaimCodes.some((unit: any) => !unit.claim_code),
  });
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  return loadWorkspace(req, context, false);
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return jsonError("Solicitud inválida.", 400);
  }
  if (body?.action !== "prepare") return jsonError("Acción no válida.", 400);
  return loadWorkspace(req, context, true);
}

export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const supabase = getSupabase();
  if (!supabase) return jsonError("Supabase config missing", 500);

  let body: any = null;
  try {
    body = await req.json();
  } catch (_err) {
    return jsonError("Invalid JSON", 400);
  }

  const inputs = Array.isArray(body?.units) ? body.units : [];
  if (inputs.length === 0) {
    return jsonError("units debe incluir al menos una unidad", 400);
  }

  const { id } = await context.params;
  const reservation = await loadReservation(supabase, id);
  if (reservation.notFound) return jsonError("Reserva no encontrada", 404);
  if (reservation.wrongType) {
    return jsonError("La reserva no pertenece al flujo de nominación", 400);
  }
  if (reservation.error) return jsonError(reservation.error.message, 500);

  if (
    !ACTIVE_TICKET_RESERVATION_STATUSES.has(
      String((reservation.data as any)?.status || "").toLowerCase(),
    )
  ) {
    return jsonError(
      "La compra no está disponible para nominar entradas.",
      409,
    );
  }

  const units = await loadUnits(supabase, id);
  if (units.error) return jsonError(units.error.message, 500);
  const unitsById = new Map(
    units.data.map((unit: any) => [String(unit.id), unit]),
  );
  const reservationDocType =
    typeof (reservation.data as any)?.doc_type === "string" &&
    (reservation.data as any).doc_type.trim()
      ? ((reservation.data as any).doc_type as DocumentType)
      : "dni";
  const reissueTimestamp = new Date().toISOString();
  const pendingUpdates = new Map<
    string,
    {
      unitId: string;
      unitLabel: string;
      existingUnit: any;
      normalizedInput: ReturnType<typeof normalizeComparableUnitState>;
      isIssuedUnit: boolean;
      nominationChanged: boolean;
      expectedUpdatedAt: string | null;
    }
  >();

  for (const raw of inputs) {
    const unitId = typeof raw?.id === "string" ? raw.id.trim() : "";
    const existingUnit = unitsById.get(unitId);
    if (!unitId || !existingUnit) {
      return jsonError("Unidad no encontrada para esta reserva", 404);
    }
    const unitLabel = `unidad ${existingUnit.unit_index || "?"}`;
    if (
      ["used", "cancelled"].includes(
        String(existingUnit.status || "").toLowerCase(),
      )
    ) {
      return jsonError(`No puedes editar ${unitLabel} usada o cancelada`, 409);
    }

    const normalizedInput = normalizeComparableUnitState(
      raw,
      reservationDocType,
    );
    if (!normalizedInput.fullName) {
      return jsonError(`${unitLabel} necesita nombre completo`, 400);
    }
    if (!validateDocument(normalizedInput.docType, normalizedInput.document)) {
      return jsonError(`Documento inválido para ${unitLabel}`, 400);
    }
    if (isPresentButInvalidEmailAddress(normalizedInput.email)) {
      return jsonError(`Email inválido para ${unitLabel}`, 400);
    }

    const isIssuedUnit =
      String(existingUnit.status || "").toLowerCase() === "issued";
    const nominationChanged = !sameNominationState(
      existingUnit,
      normalizedInput,
    );
    if (isIssuedUnit && !existingUnit.ticket_id)
      return jsonError(
        "Esta entrada necesita una revisión antes de continuar.",
        409,
      );
    const expectedUpdatedAt =
      typeof raw?.expected_updated_at === "string"
        ? raw.expected_updated_at
        : null;
    if (
      expectedUpdatedAt &&
      expectedUpdatedAt !== existingUnit.updated_at &&
      !sameNominationState(existingUnit, normalizedInput)
    ) {
      return jsonError(
        "La entrada fue modificada. Actualiza la compra antes de continuar.",
        409,
        "NOMINATION_VERSION_CONFLICT",
      );
    }

    pendingUpdates.set(unitId, {
      unitId,
      unitLabel,
      existingUnit,
      normalizedInput,
      isIssuedUnit,
      nominationChanged,
      expectedUpdatedAt,
    });
  }

  const seenIdentityKeys = new Map<string, string>();
  for (const unit of units.data) {
    const unitLabel = `unidad ${Number(unit?.unit_index || 0) || "?"}`;
    const effectiveState = buildEffectiveUnitIdentityState(
      unit,
      reservation.data,
      reservationDocType,
      pendingUpdates.get(String(unit?.id || ""))?.normalizedInput,
    );

    for (const key of buildEventTicketIdentityKeys({
      fullName: effectiveState.fullName,
      email: effectiveState.email || null,
      phone: effectiveState.phone || null,
      docType: effectiveState.docType,
      document: effectiveState.document,
      dni: effectiveState.docType === "dni" ? effectiveState.document : null,
    })) {
      const previousLabel = seenIdentityKeys.get(key);
      if (previousLabel && previousLabel !== unitLabel) {
        return jsonError(
          buildDuplicateIdentityError(previousLabel, unitLabel, key),
          409,
        );
      }
      seenIdentityKeys.set(key, unitLabel);
    }
  }

  const updatedUnits: Array<{
    id: string;
    ticketId: string | null;
    qrRotated: boolean;
    updated_at: string;
  }> = [];
  for (const {
    unitId,
    unitLabel,
    existingUnit,
    normalizedInput,
    isIssuedUnit,
    nominationChanged,
    expectedUpdatedAt,
  } of pendingUpdates.values()) {
    if (isIssuedUnit && !nominationChanged) {
      continue;
    }

    if (isIssuedUnit && existingUnit.ticket_id && nominationChanged) {
      if (!expectedUpdatedAt)
        return jsonError(
          "Actualiza la compra antes de editar esta entrada.",
          409,
          "NOMINATION_VERSION_REQUIRED",
        );
      const { data: edited, error } = await supabase.rpc(
        "update_ticket_reservation_unit_nomination",
        {
          p_reservation_id: id,
          p_unit_id: unitId,
          p_expected_updated_at: expectedUpdatedAt,
          p_full_name: normalizedInput.fullName,
          p_doc_type: normalizedInput.docType,
          p_document: normalizedInput.document,
          p_email: normalizedInput.email || null,
          p_phone: normalizedInput.phone || null,
        },
      );
      if (error) {
        const message = String(error.message || "");
        if (error.code === "PGRST202" || error.code === "42883")
          return jsonError(
            "La actualización de entradas está en preparación. No se modificó tu entrada.",
            503,
            "NOMINATION_UPDATE_UNAVAILABLE",
          );
        const reasons: Record<string, string> = {
          NOMINATION_VERSION_CONFLICT:
            "La entrada fue modificada. Actualiza la compra antes de continuar.",
          UNIT_NOT_EDITABLE:
            "Esta entrada está usada, cancelada o ya no está disponible para editar.",
          UNIT_EXPIRED:
            "Esta entrada venció. Para asistir necesitas comprar otra entrada.",
          EVENT_TICKET_IDENTITY_CONFLICT:
            "Esta persona ya tiene otra entrada para este evento.",
          PERSON_DOCUMENT_TYPE_CONFLICT:
            "Este documento requiere una revisión del equipo antes de continuar.",
        };
        const code = Object.keys(reasons).find((reason) =>
          message.includes(reason),
        );
        return jsonError(
          code
            ? reasons[code]
            : "No se pudo confirmar la actualización. Actualiza la compra antes de reintentar.",
          409,
          code || "NOMINATION_UPDATE_FAILED",
        );
      }
      if (!edited?.unit_id || !edited?.ticket_id || !edited?.updated_at)
        return jsonError(
          "No se pudo confirmar la actualización. Actualiza la compra.",
          500,
        );
      updatedUnits.push({
        id: edited.unit_id,
        ticketId: edited.ticket_id,
        qrRotated: Boolean(edited.qr_rotated),
        updated_at: edited.updated_at,
      });
      continue;
    }

    const patch = {
      full_name: normalizedInput.fullName,
      doc_type: normalizedInput.docType,
      document: normalizedInput.document,
      email: normalizedInput.email || null,
      phone: normalizedInput.phone || null,
      status: "nominated",
      nominated_at: reissueTimestamp,
      updated_at: reissueTimestamp,
    };

    let updateQuery = supabase
      .from("ticket_reservation_units")
      .update(patch)
      .eq("id", unitId)
      .eq("reservation_id", id)
      .eq("status", existingUnit.status)
      .is("ticket_id", null);
    if (expectedUpdatedAt || existingUnit.updated_at)
      updateQuery = updateQuery.eq(
        "updated_at",
        expectedUpdatedAt || existingUnit.updated_at,
      );
    const { data: updated, error } = await updateQuery
      .select("id")
      .maybeSingle();

    if (error) {
      return jsonError(
        friendlyNominationUpdateError(error.message, unitLabel),
        400,
      );
    }
    if (!updated)
      return jsonError(
        "La entrada cambió de estado. Actualiza la compra antes de continuar.",
        409,
        "NOMINATION_VERSION_CONFLICT",
      );
    updatedUnits.push({
      id: unitId,
      ticketId: null,
      qrRotated: false,
      updated_at: reissueTimestamp,
    });
  }

  const reloadedUnits = await loadUnits(supabase, id);
  if (reloadedUnits.error) return jsonError(reloadedUnits.error.message, 500);

  let unitsWithClaimCodes;
  try {
    unitsWithClaimCodes = await ensureReservationUnitClaimCodes({
      supabase,
      reservation: reservation.data as any,
      units: reloadedUnits.data,
      requestUrl: req.url,
      readOnly: true,
    });
    unitsWithClaimCodes = await addAccessStates(supabase, unitsWithClaimCodes);
  } catch (err: any) {
    return jsonError(
      err?.message || "No se pudieron preparar los códigos",
      500,
    );
  }

  return NextResponse.json({
    success: true,
    updatedCount: pendingUpdates.size,
    updatedUnits,
    reservation: reservation.data,
    units: unitsWithClaimCodes,
  });
}
