import { applyNotDeleted } from "shared/db/softDelete";
import { normalizeDocument, validateDocument, type DocumentType } from "shared/document";
import { resolveFirstValidEmailAddress } from "shared/email/address";
import {
  buildEventTicketIdentityKeys,
  findActiveEventTicketConflict,
} from "shared/eventTicketIdentity";
import { createTicketForReservation } from "../../../../../backoffice/app/api/reservations/utils";
import { sendTicketEmail } from "../../../../../backoffice/app/api/reservations/email";
import { ensureReservationUnitCodes } from "./reservationUnitCodes";

const UNIT_SELECT =
  "id,reservation_id,event_id,package_index,person_index,unit_index,status,full_name,doc_type,document,email,phone,ticket_id";

function uniqueStrings(values: Array<string | null | undefined>) {
  return Array.from(
    new Set(
      values
        .map((value) => (value ? String(value).trim() : ""))
        .filter(Boolean),
    ),
  );
}

function buildNominationError(
  unitLabel: string,
  fullName: string,
  docType: DocumentType,
  document: string,
) {
  if (!fullName.trim()) {
    return `Completa el nombre de ${unitLabel} antes de emitir el QR.`;
  }
  const { document: normalizedDocument } = normalizeDocument(docType, document);
  if (!validateDocument(docType, normalizedDocument)) {
    return `Completa el documento de ${unitLabel} antes de emitir el QR.`;
  }
  return null;
}

export class ReservationIssueError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ReservationIssueError";
    this.status = status;
  }
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

function getUnitIdentity(unit: any, reservation: any) {
  const isBuyerUnit = Number(unit.unit_index || 0) === 1;
  const buyerName = String((reservation as any).full_name || "").trim();
  const buyerEmail = String((reservation as any).email || "").trim();
  const buyerPhone = String((reservation as any).phone || "").trim();
  const buyerDocType =
    String((reservation as any).doc_type || "dni").trim() || "dni";
  const buyerDocument = String((reservation as any).document || "").trim();
  const fullName =
    String(unit.full_name || "").trim() ||
    (isBuyerUnit ? buyerName : "") ||
    buyerName;
  const email =
    String(unit.email || "").trim() || (isBuyerUnit ? buyerEmail : "") || null;
  const effectiveEmail = resolveFirstValidEmailAddress(
    email,
    String((reservation as any).email || ""),
  );
  const phone =
    String(unit.phone || "").trim() || (isBuyerUnit ? buyerPhone : "") || null;
  const docType = (String(unit.doc_type || "").trim() ||
    (isBuyerUnit ? buyerDocType : "dni")) as DocumentType;
  const document =
    String(unit.document || "").trim() || (isBuyerUnit ? buyerDocument : "");

  return {
    isBuyerUnit,
    fullName,
    email,
    effectiveEmail: effectiveEmail || null,
    phone,
    docType,
    document,
  };
}

function resolveIssuableUnits(units: any[], targetUnitId?: string) {
  if (targetUnitId) {
    const selectedUnit = units.find(
      (unit) => String(unit.id || "") === targetUnitId,
    );
    if (!selectedUnit) {
      throw new ReservationIssueError(404, "Unidad no encontrada para esta reserva");
    }
    if (
      selectedUnit.ticket_id ||
      String(selectedUnit.status || "").toLowerCase() === "issued"
    ) {
      return [];
    }
    if (Number(selectedUnit.unit_index || 0) === 1) {
      return [selectedUnit];
    }
    if (String(selectedUnit.status || "").toLowerCase() !== "nominated") {
      throw new ReservationIssueError(
        400,
        `Completa la nominación de unidad ${Number(selectedUnit.unit_index || 0) || "?"} antes de emitir el QR.`,
      );
    }
    return [selectedUnit];
  }

  const buyerUnit =
    units.find((unit: any) => Number(unit.unit_index || 0) === 1) || null;
  const buyerNeedsIssue = Boolean(buyerUnit && !buyerUnit.ticket_id);
  const issuableAssistantUnits = units.filter(
    (unit: any) =>
      Number(unit.unit_index || 0) > 1 &&
      String(unit.status || "").toLowerCase() === "nominated" &&
      !unit.ticket_id,
  );

  return [
    ...(buyerNeedsIssue ? [buyerUnit] : []),
    ...issuableAssistantUnits,
  ].filter(Boolean);
}

export async function issueReservationUnits({
  supabase,
  reservation,
  reservationId,
  targetUnitId,
  createTicketForReservationFn = createTicketForReservation,
  sendTicketEmailFn = sendTicketEmail,
}: {
  supabase: any;
  reservation: any;
  reservationId: string;
  targetUnitId?: string;
  createTicketForReservationFn?: typeof createTicketForReservation;
  sendTicketEmailFn?: typeof sendTicketEmail;
}) {
  const units = await loadUnits(supabase, reservationId);
  if (units.error) {
    throw new ReservationIssueError(500, units.error.message);
  }

  const pendingNominationCount = units.data.filter(
    (unit: any) =>
      Number(unit.unit_index || 0) > 1 &&
      String(unit.status || "").toLowerCase() === "pending_nomination",
  ).length;

  const { codesByUnitIndex, mergedCodes } = await ensureReservationUnitCodes(
    supabase,
    {
      reservation,
      units: units.data,
    },
  );

  const issuableUnits = resolveIssuableUnits(units.data, targetUnitId);
  if (issuableUnits.length === 0) {
    return {
      success: true,
      issuedCount: 0,
      pendingNominationCount,
      codes: mergedCodes,
      units: units.data,
    };
  }

  const saleOrigin = String((reservation as any).sale_origin || "")
    .trim()
    .toLowerCase();
  const isTableReservation = saleOrigin === "table";
  const tableRel = Array.isArray((reservation as any).table)
    ? (reservation as any).table?.[0]
    : (reservation as any).table;
  const resolvedTableName = isTableReservation
    ? String(
        tableRel?.name || (reservation as any).ticket_type_label || "Mesa",
      ).trim() || "Mesa"
    : String((reservation as any).ticket_type_label || "Entrada").trim() ||
      "Entrada";

  const seenIdentityKeys = new Map<string, string>();
  for (const unit of issuableUnits as any[]) {
    const identity = getUnitIdentity(unit, reservation);
    for (const key of buildEventTicketIdentityKeys({
      fullName: identity.fullName,
      email: identity.email,
      phone: identity.phone,
      docType: identity.docType,
      document: identity.document,
      dni: identity.docType === "dni" ? identity.document : null,
    })) {
      const previousLabel = seenIdentityKeys.get(key);
      if (previousLabel) {
        throw new ReservationIssueError(
          409,
          `No puedes emitir dos QR para la misma persona en este evento. Revisa ${previousLabel} y unidad ${Number(unit.unit_index || 0) || "?"}.`,
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
        eventId: String((reservation as any).event_id || ""),
        fullName: identity.fullName,
        email: identity.email,
        phone: identity.phone,
        docType: identity.docType,
        document: identity.document,
        dni: identity.docType === "dni" ? identity.document : null,
      },
    );
    if (existingConflict?.ticketId) {
      throw new ReservationIssueError(
        409,
        `La unidad ${Number(unit.unit_index || 0) || "?"} ya tiene un QR activo en este evento con esos datos. Corrige la nominación antes de emitir.`,
      );
    }
  }

  const issuedCodes: string[] = [];
  for (const unit of issuableUnits as any[]) {
    const identity = getUnitIdentity(unit, reservation);
    const validationError = buildNominationError(
      `unidad ${Number(unit.unit_index || 0) || "?"}`,
      identity.fullName,
      identity.docType,
      identity.document,
    );
    if (validationError) {
      throw new ReservationIssueError(400, validationError);
    }

    const reuseCode = codesByUnitIndex.get(Number(unit.unit_index || 0)) || "";
    const result = await createTicketForReservationFn(supabase, {
      eventId: (reservation as any).event_id,
      tableName: resolvedTableName,
      fullName: identity.fullName,
      email: identity.effectiveEmail || null,
      phone: identity.phone,
      dni: identity.docType === "dni" ? identity.document : null,
      docType: identity.docType,
      document: identity.document,
      promoterId: (reservation as any).promoter_id || null,
      reuseCodes: reuseCode ? [reuseCode] : [],
      codeType: isTableReservation ? "table" : "courtesy",
      tableId: isTableReservation
        ? ((reservation as any).table_id || null)
        : null,
      productId: isTableReservation
        ? ((reservation as any).product_id || null)
        : null,
      tableReservationId: reservationId,
    });

    issuedCodes.push(result.code);
    const now = new Date().toISOString();
    const unitPatch: Record<string, any> = {
      status: "issued",
      ticket_id: result.ticketId,
      issued_at: now,
      updated_at: now,
    };

    if (identity.isBuyerUnit) {
      unitPatch.full_name = identity.fullName;
      unitPatch.email = identity.email;
      unitPatch.phone = identity.phone;
      unitPatch.doc_type = identity.docType;
      unitPatch.document = identity.document || null;
    } else {
      if (identity.fullName) unitPatch.full_name = identity.fullName;
      if (identity.email) unitPatch.email = identity.email;
      if (identity.phone) unitPatch.phone = identity.phone;
      if (identity.docType) unitPatch.doc_type = identity.docType;
      if (identity.document) unitPatch.document = identity.document;
    }

    const { error: updateError } = await supabase
      .from("ticket_reservation_units")
      .update(unitPatch)
      .eq("id", unit.id)
      .eq("reservation_id", reservationId);
    if (updateError) {
      throw new ReservationIssueError(500, updateError.message);
    }

    if (identity.effectiveEmail) {
      await sendTicketEmailFn({
        supabase,
        ticketId: result.ticketId,
        toEmail: identity.effectiveEmail,
      });
    }
  }

  const finalCodes = uniqueStrings([...mergedCodes, ...issuedCodes]);
  const { error: reservationUpdateError } = await supabase
    .from("table_reservations")
    .update({
      codes: finalCodes,
      updated_at: new Date().toISOString(),
    })
    .eq("id", reservationId);
  if (reservationUpdateError) {
    throw new ReservationIssueError(500, reservationUpdateError.message);
  }

  const reloadedUnits = await loadUnits(supabase, reservationId);
  if (reloadedUnits.error) {
    throw new ReservationIssueError(500, reloadedUnits.error.message);
  }

  return {
    success: true,
    issuedCount: issuableUnits.length,
    pendingNominationCount,
    codes: finalCodes,
    units: reloadedUnits.data,
  };
}
