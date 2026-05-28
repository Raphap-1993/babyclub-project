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
  reservationId: string;
  eventId: string;
  unitNumber: number;
  packageIndex: number;
  unitIndexInPackage: number;
  status: "pending_nomination";
  metadata: {
    packageQuantity: number;
    unitsPerPackage: number;
    totalTicketUnits: number;
  };
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

  const totalTicketUnits = packageQuantity * unitsPerPackage;
  const metadata = {
    packageQuantity,
    unitsPerPackage,
    totalTicketUnits,
  };

  return Array.from({ length: totalTicketUnits }, (_, index) => ({
    reservationId,
    eventId,
    unitNumber: index + 1,
    packageIndex: Math.floor(index / unitsPerPackage) + 1,
    unitIndexInPackage: (index % unitsPerPackage) + 1,
    status: "pending_nomination",
    metadata,
  }));
}
