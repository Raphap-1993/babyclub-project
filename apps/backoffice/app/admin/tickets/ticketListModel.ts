type TicketRowLike = {
  id: string;
  table_reservation_id?: string | null;
  code?: any;
};

type TicketVisibilityRefs = {
  activeTicketIds: Set<string>;
  trackedReservationIds: Set<string>;
};

function readCodeRelation(row: TicketRowLike) {
  return Array.isArray(row.code) ? row.code?.[0] : row.code;
}

export function filterVisibleAdminTicketRows<T extends TicketRowLike>(
  rows: T[],
  refs: TicketVisibilityRefs,
): T[] {
  return rows.filter((row) => {
    const codeRel = readCodeRelation(row);
    const reservationId =
      row.table_reservation_id || codeRel?.table_reservation_id || null;
    return !(
      reservationId &&
      refs.trackedReservationIds.has(String(reservationId)) &&
      !refs.activeTicketIds.has(String(row.id))
    );
  });
}
