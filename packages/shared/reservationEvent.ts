export function resolveReservationEventId(
  tableEventId?: string | null,
  requestedEventId?: string | null,
) {
  const requested = String(requestedEventId || "").trim();
  if (requested) return requested;
  const tableEvent = String(tableEventId || "").trim();
  return tableEvent || null;
}
