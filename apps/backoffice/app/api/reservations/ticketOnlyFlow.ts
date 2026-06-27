import { createTicketForReservation } from "./utils";
import { buildReservationUnits } from "shared/ticketReservationUnits";
import { applyNotDeleted } from "shared/db/softDelete";
import {
  normalizeDocument,
  validateDocument,
  type DocumentType,
} from "shared/document";
import { normalizeEmailAddress } from "shared/email/address";

type Supabase = any;

type TicketOnlyReservation = {
  id: string;
  full_name?: string | null;
  email?: string | null;
  phone?: string | null;
  doc_type?: string | null;
  document?: string | null;
  event_id?: string | null;
  ticket_type_label?: string | null;
  promoter_id?: string | null;
  sale_origin?: string | null;
};

type TicketOnlyUnit = {
  id: string;
  reservation_id: string;
  event_id: string;
  package_index: number;
  person_index: number;
  unit_index: number;
  status: string;
  full_name: string | null;
  doc_type: string | null;
  document: string | null;
  email: string | null;
  phone: string | null;
  ticket_id: string | null;
};

type EnsureTicketOnlyBuyerIssuedInput = {
  supabase: Supabase;
  reservation: TicketOnlyReservation;
  reservationId: string;
  eventId: string | null;
  ticketQuantity: number;
  tableName?: string | null;
  codeType?: "courtesy" | "table";
  tableId?: string | null;
  productId?: string | null;
  reusableCodes?: string[];
};

export async function ensureTicketOnlyBuyerIssued({
  supabase,
  reservation,
  reservationId,
  eventId,
  ticketQuantity,
  tableName,
  codeType = "courtesy",
  tableId = null,
  productId = null,
  reusableCodes = [],
}: EnsureTicketOnlyBuyerIssuedInput): Promise<{
  units: TicketOnlyUnit[];
  unitsPrepared: boolean;
  buyerCode: string | null;
}> {
  const unitsQuery = applyNotDeleted(
    supabase
      .from("ticket_reservation_units")
      .select(
        "id,reservation_id,event_id,package_index,person_index,unit_index,status,full_name,doc_type,document,email,phone,ticket_id",
      ),
  )
    .eq("reservation_id", reservationId)
    .order("unit_index", { ascending: true });

  const { data: unitRows, error: unitsError } = await unitsQuery;
  if (unitsError) {
    throw new Error(unitsError.message || "No se pudieron cargar las unidades");
  }

  let units: TicketOnlyUnit[] = Array.isArray(unitRows) ? unitRows : [];
  let unitsPrepared = false;

  if (eventId) {
    const expectedUnits = buildReservationUnits({
      reservationId,
      eventId,
      packageQuantity: 1,
      unitsPerPackage: ticketQuantity,
    });
    const existingUnitIndexes = new Set(
      units
        .map((unit) => Number(unit.unit_index || 0))
        .filter((unitIndex) => unitIndex > 0),
    );
    const missingUnits = expectedUnits.filter(
      (unit) => !existingUnitIndexes.has(unit.unit_index),
    );

    if (missingUnits.length > 0) {
      const { error: insertUnitsError } = await supabase
        .from("ticket_reservation_units")
        .insert(missingUnits);
      if (insertUnitsError) {
        throw new Error(
          insertUnitsError.message || "No se pudieron preparar las unidades",
        );
      }
      unitsPrepared = true;
    }
  }

  if (unitsPrepared) {
    const reloaded = await applyNotDeleted(
      supabase
        .from("ticket_reservation_units")
        .select(
          "id,reservation_id,event_id,package_index,person_index,unit_index,status,full_name,doc_type,document,email,phone,ticket_id",
        ),
    )
      .eq("reservation_id", reservationId)
      .order("unit_index", { ascending: true });
    if (reloaded.error) {
      throw new Error(
        reloaded.error.message || "No se pudieron recargar las unidades",
      );
    }
    units = Array.isArray(reloaded.data) ? reloaded.data : [];
  }

  const buyerUnit = units.find((unit) => Number(unit.unit_index || 0) === 1);
  if (!buyerUnit) {
    throw new Error(
      "No se pudo preparar la unidad principal del comprador para esta reserva.",
    );
  }

  if (buyerUnit.ticket_id && String(buyerUnit.ticket_id).trim()) {
    return { units, unitsPrepared, buyerCode: null };
  }

  const buyerName = String(
    buyerUnit.full_name || reservation.full_name || "",
  ).trim();
  const buyerEmail = normalizeEmailAddress(
    String(buyerUnit.email || reservation.email || ""),
  );
  const buyerPhone = String(buyerUnit.phone || reservation.phone || "").trim();
  const buyerDocType = (String(buyerUnit.doc_type || reservation.doc_type || "dni").trim() ||
    "dni") as DocumentType;
  const buyerDocument = String(
    buyerUnit.document || reservation.document || "",
  ).trim();
  const { document: normalizedDocument } = normalizeDocument(
    buyerDocType,
    buyerDocument,
  );

  if (!buyerName) {
    throw new Error("Completa el nombre del comprador antes de emitir el QR.");
  }
  if (!validateDocument(buyerDocType, normalizedDocument)) {
    throw new Error(
      "Completa el documento del comprador antes de emitir el QR.",
    );
  }
  const effectiveEventId = eventId || reservation.event_id || "";
  if (!effectiveEventId) {
    throw new Error(
      "Reserva sin evento asignado; no se pudo emitir el QR del comprador.",
    );
  }
  const buyerReuseCodes =
    reusableCodes.length > 0 && reusableCodes[0]
      ? [String(reusableCodes[0]).trim()]
      : [];

  const result = await createTicketForReservation(supabase, {
    eventId: effectiveEventId,
    tableName: tableName || reservation.ticket_type_label || "Entrada",
    fullName: buyerName,
    email: buyerEmail || null,
    phone: buyerPhone || null,
    dni: buyerDocType === "dni" ? normalizedDocument : null,
    docType: buyerDocType,
    document: normalizedDocument,
    promoterId: reservation.promoter_id || null,
    reuseCodes: buyerReuseCodes,
    codeType,
    tableId,
    productId,
    tableReservationId: reservationId,
  });

  const now = new Date().toISOString();
  const { error: updateError } = await supabase
    .from("ticket_reservation_units")
    .update({
      status: "issued",
      ticket_id: result.ticketId,
      issued_at: now,
      nominated_at: now,
      updated_at: now,
      full_name: buyerName,
      email: buyerEmail || null,
      phone: buyerPhone || null,
      doc_type: buyerDocType,
      document: normalizedDocument || null,
    })
    .eq("reservation_id", reservationId)
    .eq("unit_index", 1);

  if (updateError) {
    throw new Error(
      updateError.message || "No se pudo emitir el QR del comprador",
    );
  }

  const reloadedAfterIssue = await applyNotDeleted(
    supabase
      .from("ticket_reservation_units")
      .select(
        "id,reservation_id,event_id,package_index,person_index,unit_index,status,full_name,doc_type,document,email,phone,ticket_id",
      ),
  )
    .eq("reservation_id", reservationId)
    .order("unit_index", { ascending: true });
  if (reloadedAfterIssue.error) {
    throw new Error(
      reloadedAfterIssue.error.message ||
        "No se pudieron recargar las unidades emitidas",
    );
  }

  return {
    units: Array.isArray(reloadedAfterIssue.data)
      ? reloadedAfterIssue.data
      : [],
    unitsPrepared,
    buyerCode: result.code,
  };
}
