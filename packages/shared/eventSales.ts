export type EventSaleStatus = "on_sale" | "sold_out" | "paused";

export type EventSaleBlockReason =
  | "event_inactive"
  | "event_closed"
  | "sold_out"
  | "sales_paused";

export type EventSalesSnapshot = {
  is_active?: boolean | null;
  closed_at?: string | null;
  sale_status?: string | null;
  sale_public_message?: string | null;
};

export type EventSalesDecision = {
  available: boolean;
  sale_status: EventSaleStatus;
  block_reason: EventSaleBlockReason | null;
  public_message: string | null;
};

type EventSalesMutableShape = {
  sale_status?: string | null;
  sale_public_message?: string | null;
  [key: string]: any;
};

const DEFAULT_BLOCK_MESSAGES: Record<EventSaleBlockReason, string> = {
  event_inactive: "La venta online para este evento no está disponible.",
  event_closed: "La venta online para este evento ya cerró.",
  sold_out: "Entradas agotadas. Este evento está sold out.",
  sales_paused: "La venta online está pausada temporalmente.",
};

export function normalizeEventSaleStatus(value: string | null | undefined): EventSaleStatus {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "sold_out") return "sold_out";
  if (normalized === "paused") return "paused";
  return "on_sale";
}

export function isMissingEventSalesColumnsError(error: any): boolean {
  if (!error) return false;
  const message = `${String(error?.message || "")} ${String(error?.details || "")} ${String(error?.hint || "")}`.toLowerCase();
  const hasMissingSignal =
    message.includes("does not exist") ||
    message.includes("could not find") ||
    message.includes("schema cache");
  const hasSalesColumnSignal =
    message.includes("sale_status") ||
    message.includes("sale_public_message") ||
    message.includes("sale_updated_at") ||
    message.includes("sale_updated_by");
  const code = String(error?.code || "").toLowerCase();
  const hasKnownCodeSignal = code === "42703" || code.startsWith("pgrst");
  return hasSalesColumnSignal && (hasMissingSignal || hasKnownCodeSignal);
}

export function ensureEventSalesDefaults<T extends EventSalesMutableShape>(event: T): T {
  return {
    ...event,
    sale_status: normalizeEventSaleStatus(event?.sale_status),
    sale_public_message:
      typeof event?.sale_public_message === "string" && event.sale_public_message.trim().length > 0
        ? event.sale_public_message.trim()
        : null,
  };
}

export function ensureEventSalesDefaultsList<T extends EventSalesMutableShape>(events: T[] | null | undefined): T[] {
  return (events || []).map((event) => ensureEventSalesDefaults(event));
}

export function evaluateEventSales(event?: EventSalesSnapshot | null): EventSalesDecision {
  const saleStatus = normalizeEventSaleStatus(event?.sale_status);
  const customMessage =
    typeof event?.sale_public_message === "string" && event.sale_public_message.trim().length > 0
      ? event.sale_public_message.trim()
      : null;

  if (event?.is_active === false) {
    return {
      available: false,
      sale_status: saleStatus,
      block_reason: "event_inactive",
      public_message: customMessage || DEFAULT_BLOCK_MESSAGES.event_inactive,
    };
  }

  if (event?.closed_at) {
    return {
      available: false,
      sale_status: saleStatus,
      block_reason: "event_closed",
      public_message: customMessage || DEFAULT_BLOCK_MESSAGES.event_closed,
    };
  }

  if (saleStatus === "sold_out") {
    return {
      available: false,
      sale_status: saleStatus,
      block_reason: "sold_out",
      public_message: customMessage || DEFAULT_BLOCK_MESSAGES.sold_out,
    };
  }

  if (saleStatus === "paused") {
    return {
      available: false,
      sale_status: saleStatus,
      block_reason: "sales_paused",
      public_message: customMessage || DEFAULT_BLOCK_MESSAGES.sales_paused,
    };
  }

  return {
    available: true,
    sale_status: saleStatus,
    block_reason: null,
    public_message: customMessage,
  };
}
