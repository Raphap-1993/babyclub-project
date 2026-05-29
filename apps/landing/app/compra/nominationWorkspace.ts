export type NominationReservationSummary = {
  buyer_full_name: string | null;
  buyer_email?: string | null;
  buyer_phone?: string | null;
};

export type NominationUnitLike = {
  id?: string;
  unit_index: number;
  status: string;
  package_index?: number;
  person_index?: number;
  full_name: string;
  doc_type?: string;
  document?: string;
  email: string;
  phone: string;
  ticket_id: string | null;
  ticket_url?: string | null;
};

const TERMINAL_UNIT_STATUSES = new Set(["issued", "used", "cancelled"]);

export function getBuyerUnit<T extends { unit_index: number }>(units: T[]) {
  return units.find((unit) => unit.unit_index === 1) ?? null;
}

export function getAssistantUnits<
  T extends { unit_index: number; status: string },
>(units: T[]) {
  return units.filter(
    (unit) => unit.unit_index !== 1 && !TERMINAL_UNIT_STATUSES.has(unit.status),
  );
}

export function getBuyerDisplayName(
  reservation: NominationReservationSummary | null,
  buyerUnit: NominationUnitLike | null,
) {
  return (
    reservation?.buyer_full_name ||
    buyerUnit?.full_name ||
    "Comprador / primer asistente"
  );
}
