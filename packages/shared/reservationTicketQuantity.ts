function toPositiveInteger(value: unknown) {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue) || numberValue <= 0) return 0;
  return Math.floor(numberValue);
}

export function resolveReservationTicketQuantity(input: {
  totalTicketUnits?: unknown;
  ticketQuantity?: unknown;
  codesCount?: unknown;
  liveTableTicketCount?: unknown;
  minimum?: number;
}) {
  const snapshotCandidates = [
    toPositiveInteger(input.totalTicketUnits),
    toPositiveInteger(input.ticketQuantity),
    toPositiveInteger(input.codesCount),
  ].filter((value) => value > 0);

  if (snapshotCandidates.length > 0) {
    return Math.max(...snapshotCandidates);
  }

  const liveTableTicketCount = toPositiveInteger(input.liveTableTicketCount);
  if (liveTableTicketCount > 0) {
    return liveTableTicketCount;
  }

  return Math.max(toPositiveInteger(input.minimum), 1);
}
