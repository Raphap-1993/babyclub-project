import type { TicketTypeOption } from "shared/ticketTypes";

export type TicketSelectionSnapshot = {
  ticketTypeId: string | null;
  ticketTypeCode: string;
  ticketTypeLabel: string;
  ticketQuantity: number;
  price: number;
  currencyCode: string;
  packageQuantity: number;
  totalUnits: number;
  totalPrice: number;
};

export function reconcileTicketTypeCode(
  currentCode: string,
  options: TicketTypeOption[],
  allowAutoSelect = true,
) {
  if (options.length === 0) {
    return {
      nextCode: "",
      invalidated: Boolean(currentCode),
    };
  }

  if (!currentCode) {
    return {
      nextCode: allowAutoSelect ? options[0]?.code || "" : "",
      invalidated: false,
    };
  }

  const stillAvailable = options.some((option) => option.code === currentCode);
  if (stillAvailable) {
    return {
      nextCode: currentCode,
      invalidated: false,
    };
  }

  return {
    nextCode: "",
    invalidated: true,
  };
}

export function buildTicketSelectionSnapshot(
  option: TicketTypeOption,
  packageQuantity: number,
): TicketSelectionSnapshot {
  const safePackageQuantity =
    Number.isFinite(packageQuantity) && packageQuantity > 0
      ? Math.floor(packageQuantity)
      : 1;
  const ticketQuantity = Math.max(Number(option.ticketQuantity || 0), 0);
  const price = Number(option.price || 0);

  return {
    ticketTypeId: typeof option.id === "string" ? option.id : null,
    ticketTypeCode: option.code,
    ticketTypeLabel: option.label,
    ticketQuantity,
    price,
    currencyCode: option.currencyCode || "PEN",
    packageQuantity: safePackageQuantity,
    totalUnits: ticketQuantity * safePackageQuantity,
    totalPrice: price * safePackageQuantity,
  };
}

export function hasTicketSelectionDrifted(
  snapshot: TicketSelectionSnapshot | null,
  option: TicketTypeOption | null,
) {
  if (!snapshot || !option) return false;

  if (snapshot.ticketTypeCode !== option.code) return true;
  if (
    snapshot.ticketTypeId &&
    typeof option.id === "string" &&
    option.id !== snapshot.ticketTypeId
  ) {
    return true;
  }

  const currentTicketQuantity = Math.max(Number(option.ticketQuantity || 0), 0);
  const currentPrice = Number(option.price || 0);

  return (
    currentTicketQuantity !== snapshot.ticketQuantity ||
    Math.abs(currentPrice - snapshot.price) > 0.001
  );
}
