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
  const totalTicketUnits = toPositiveInteger(input.totalTicketUnits);
  if (totalTicketUnits > 0) {
    return totalTicketUnits;
  }

  const ticketQuantity = toPositiveInteger(input.ticketQuantity);
  if (ticketQuantity > 0) {
    return ticketQuantity;
  }

  const codesCount = toPositiveInteger(input.codesCount);
  if (codesCount > 0) {
    return codesCount;
  }

  const liveTableTicketCount = toPositiveInteger(input.liveTableTicketCount);
  if (liveTableTicketCount > 0) {
    return liveTableTicketCount;
  }

  return Math.max(toPositiveInteger(input.minimum), 1);
}
