export type BuildReservationUnitsInput = {
  reservationId: string;
  eventId: string;
  packageQuantity: number;
  unitsPerPackage: number;
};

export type TicketReservationUnitInsert = {
  reservation_id: string;
  event_id: string;
  package_index: number;
  person_index: number;
  unit_index: number;
  status: "pending_nomination";
};

export function buildReservationUnits({
  reservationId,
  eventId,
  packageQuantity,
  unitsPerPackage,
}: BuildReservationUnitsInput): TicketReservationUnitInsert[] {
  const packageCount = Math.max(1, Math.floor(packageQuantity || 0));
  const unitCountPerPackage = Math.max(1, Math.floor(unitsPerPackage || 0));
  const units: TicketReservationUnitInsert[] = [];

  let unitIndex = 0;
  for (let packageIndex = 0; packageIndex < packageCount; packageIndex += 1) {
    for (let personIndex = 0; personIndex < unitCountPerPackage; personIndex += 1) {
      units.push({
        reservation_id: reservationId,
        event_id: eventId,
        package_index: packageIndex,
        person_index: personIndex,
        unit_index: unitIndex,
        status: "pending_nomination",
      });
      unitIndex += 1;
    }
  }

  return units;
}
