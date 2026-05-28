export type TicketReservationUnitStatus =
  | "pending_nomination"
  | "nominated"
  | "issued"
  | "used"
  | "cancelled";

export type BuildReservationUnitsInput = {
  reservationId: string;
  eventId: string;
  packageQuantity: number;
  unitsPerPackage: number;
};

export type TicketReservationUnitSeed = {
  reservation_id: string;
  event_id: string;
  package_index: number;
  person_index: number;
  unit_index: number;
  status: "pending_nomination";
  full_name: null;
  doc_type: null;
  document: null;
  email: null;
  phone: null;
  ticket_id: null;
};

function assertPositiveInteger(value: number, field: string) {
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`${field} must be a positive integer`);
  }
}

export function buildReservationUnits({
  reservationId,
  eventId,
  packageQuantity,
  unitsPerPackage,
}: BuildReservationUnitsInput): TicketReservationUnitSeed[] {
  assertPositiveInteger(packageQuantity, "packageQuantity");
  assertPositiveInteger(unitsPerPackage, "unitsPerPackage");

  const rows: TicketReservationUnitSeed[] = [];
  let unitIndex = 1;

  for (let packageIndex = 1; packageIndex <= packageQuantity; packageIndex++) {
    for (let personIndex = 1; personIndex <= unitsPerPackage; personIndex++) {
      rows.push({
        reservation_id: reservationId,
        event_id: eventId,
        package_index: packageIndex,
        person_index: personIndex,
        unit_index: unitIndex++,
        status: "pending_nomination",
        full_name: null,
        doc_type: null,
        document: null,
        email: null,
        phone: null,
        ticket_id: null,
      });
    }
  }

  return rows;
}
