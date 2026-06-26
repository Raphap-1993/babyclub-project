type TicketRowLike = {
  id: string;
  table_reservation_id?: string | null;
  code?: any;
};

type TicketVisibilityRefs = {
  activeTicketIds: Set<string>;
  trackedReservationIds: Set<string>;
};

type CollectVisibleAdminTicketRowsInput<T extends TicketRowLike> = {
  loadBatch: (offset: number, limit: number) => Promise<T[]>;
  refs: TicketVisibilityRefs;
  batchSize?: number;
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

export async function collectVisibleAdminTicketRows<T extends TicketRowLike>({
  loadBatch,
  refs,
  batchSize = 500,
}: CollectVisibleAdminTicketRowsInput<T>): Promise<T[]> {
  const visibleRows: T[] = [];

  for (let offset = 0; ; offset += batchSize) {
    const batch = await loadBatch(offset, batchSize);
    if (!Array.isArray(batch) || batch.length === 0) break;

    visibleRows.push(...filterVisibleAdminTicketRows(batch, refs));

    if (batch.length < batchSize) break;
  }

  return visibleRows;
}
