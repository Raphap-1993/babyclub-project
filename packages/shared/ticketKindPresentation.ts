export type TicketCommercialKind =
  | "table"
  | "purchased"
  | "free"
  | "promoter"
  | "courtesy"
  | "unknown";

export type TicketKindPresentationInput = {
  codeType?: string | null;
  reservationSaleOrigin?: string | null;
  ticketTypeLabel?: string | null;
  hasTableContext?: boolean;
  hasPromoter?: boolean;
};

export type TicketKindPresentation = {
  kind: TicketCommercialKind;
  label: string;
  kicker: string;
  badgeClassName: string;
};

function normalizeCodeType(value: string | null | undefined) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function normalizeSaleOrigin(value: string | null | undefined) {
  return value === "table" || value === "ticket" ? value : null;
}

export function getTicketKindPresentation(
  input: TicketKindPresentationInput,
): TicketKindPresentation {
  const codeType = normalizeCodeType(input.codeType);
  const reservationSaleOrigin = normalizeSaleOrigin(input.reservationSaleOrigin);
  const ticketTypeLabel = String(input.ticketTypeLabel || "").trim();
  const hasTableContext = Boolean(input.hasTableContext);
  const hasPromoter = Boolean(input.hasPromoter);

  if (hasTableContext || reservationSaleOrigin === "table" || codeType === "table") {
    return {
      kind: "table",
      label: "Mesa / Box",
      kicker: "Mesa / Box",
      badgeClassName: "border-cyan-500/35 bg-cyan-500/12 text-cyan-100",
    };
  }

  if (reservationSaleOrigin === "ticket") {
    return {
      kind: "purchased",
      label: ticketTypeLabel || (codeType === "general" ? "Entrada general" : "Entrada comprada"),
      kicker: "Entrada comprada",
      badgeClassName: "border-emerald-500/35 bg-emerald-500/12 text-emerald-100",
    };
  }

  if (codeType === "general") {
    return {
      kind: "purchased",
      label: "Entrada general",
      kicker: "Entrada comprada",
      badgeClassName: "border-fuchsia-500/35 bg-fuchsia-500/10 text-fuchsia-100",
    };
  }

  if (codeType === "free") {
    return {
      kind: "free",
      label: "QR libre",
      kicker: "QR libre",
      badgeClassName: "border-amber-500/35 bg-amber-500/12 text-amber-100",
    };
  }

  if (codeType === "promoter" || hasPromoter) {
    return {
      kind: "promoter",
      label: "QR promotor",
      kicker: "Promotor",
      badgeClassName: "border-sky-500/35 bg-sky-500/10 text-sky-100",
    };
  }

  if (codeType === "courtesy") {
    return {
      kind: "courtesy",
      label: "QR cortesía",
      kicker: "Cortesía",
      badgeClassName: "border-rose-500/35 bg-rose-500/10 text-rose-100",
    };
  }

  return {
    kind: "unknown",
    label: "QR",
    kicker: "QR",
    badgeClassName: "border-white/15 bg-white/[0.06] text-white",
  };
}
