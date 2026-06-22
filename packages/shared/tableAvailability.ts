export type EventTableLike = {
  id: string;
  event_id?: string | null;
  price?: number | null;
  min_consumption?: number | null;
};

export type TableAvailabilityLike = {
  table_id?: string | null;
  is_available?: boolean | null;
  custom_price?: number | null;
  custom_min_consumption?: number | null;
};

function normalizeId(value: string | null | undefined) {
  return String(value || "").trim();
}

export function findTableAvailability(
  tableId: string,
  availabilityRows: TableAvailabilityLike[] | null | undefined,
) {
  const normalizedTableId = normalizeId(tableId);
  if (!normalizedTableId) return null;
  return (
    (availabilityRows || []).find(
      (row) => normalizeId(row?.table_id) === normalizedTableId,
    ) || null
  );
}

export function isTableAvailableForEvent(
  tableId: string,
  availabilityRows: TableAvailabilityLike[] | null | undefined,
) {
  const availability = findTableAvailability(tableId, availabilityRows);
  return availability?.is_available !== false;
}

export function applyEventTableAvailability<T extends EventTableLike>(
  tables: T[] | null | undefined,
  availabilityRows: TableAvailabilityLike[] | null | undefined,
  eventId?: string | null,
): T[] {
  const rows = availabilityRows || [];
  const normalizedEventId = normalizeId(eventId);

  return (tables || [])
    .filter((table) => {
      const availability = findTableAvailability(table.id, rows);
      if (availability?.is_available === false) return false;
      if (!availability && table.event_id && normalizedEventId) {
        return table.event_id === normalizedEventId;
      }
      return true;
    })
    .map((table) => {
      const availability = findTableAvailability(table.id, rows);
      if (!availability) return table;
      return {
        ...table,
        price:
          availability.custom_price != null
            ? availability.custom_price
            : table.price,
        min_consumption:
          availability.custom_min_consumption != null
            ? availability.custom_min_consumption
            : table.min_consumption,
      };
    });
}
