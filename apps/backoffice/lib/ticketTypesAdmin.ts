import {
  TICKET_TYPE_DEFINITIONS,
  type TicketSalePhase,
} from "shared/ticketTypes";

export type AdminTicketType = {
  id: string | null;
  code: string;
  label: string;
  description: string;
  sale_phase: TicketSalePhase;
  ticket_quantity: number;
  price: number;
  currency_code: string;
  is_active: boolean;
  sort_order: number;
};

export type TicketTypeInput = {
  code: string;
  label?: string;
  description?: string;
  sale_phase?: TicketSalePhase;
  ticket_quantity?: number;
  price?: number;
  currency_code?: string;
  is_active?: boolean;
  sort_order?: number;
};

const DEFINITION_BY_CODE = new Map(
  TICKET_TYPE_DEFINITIONS.map((definition) => [definition.code, definition]),
);

function toPositiveNumber(value: unknown, fallback: number) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) && numberValue > 0
    ? numberValue
    : fallback;
}

function toOptionalText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function toTicketQuantity(value: unknown) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) && numberValue > 0
    ? Math.floor(numberValue)
    : undefined;
}

function toSortOrder(value: unknown) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : undefined;
}

function normalizeSalePhase(value: unknown): TicketSalePhase | undefined {
  if (value === null) return null;
  return value === "early_bird" || value === "all_night" ? value : undefined;
}

function sortTicketTypes<T extends { sort_order: number; label: string }>(ticketTypes: T[]) {
  return [...ticketTypes].sort((a, b) => {
    if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
    return a.label.localeCompare(b.label);
  });
}

function normalizeTicketInput(raw: any): TicketTypeInput | null {
  const code = typeof raw?.code === "string" ? raw.code.trim() : "";
  if (!code) return null;

  const price = Number(raw?.price);
  const hasDescription = Object.prototype.hasOwnProperty.call(
    raw || {},
    "description",
  );
  const hasSalePhase =
    Object.prototype.hasOwnProperty.call(raw || {}, "sale_phase") ||
    Object.prototype.hasOwnProperty.call(raw || {}, "salePhase");
  const hasTicketQuantity =
    Object.prototype.hasOwnProperty.call(raw || {}, "ticket_quantity") ||
    Object.prototype.hasOwnProperty.call(raw || {}, "ticketQuantity");
  const hasCurrencyCode =
    Object.prototype.hasOwnProperty.call(raw || {}, "currency_code") ||
    Object.prototype.hasOwnProperty.call(raw || {}, "currencyCode");
  const hasSortOrder =
    Object.prototype.hasOwnProperty.call(raw || {}, "sort_order") ||
    Object.prototype.hasOwnProperty.call(raw || {}, "sortOrder");
  const isActive =
    typeof raw?.is_active === "boolean"
      ? raw.is_active
      : typeof raw?.isActive === "boolean"
        ? raw.isActive
        : undefined;

  return {
    code,
    label:
      typeof raw?.label === "string" && raw.label.trim()
        ? raw.label.trim()
        : undefined,
    description: hasDescription ? toOptionalText(raw.description) : undefined,
    sale_phase: hasSalePhase
      ? normalizeSalePhase(raw?.sale_phase ?? raw?.salePhase)
      : undefined,
    ticket_quantity: hasTicketQuantity
      ? toTicketQuantity(raw?.ticket_quantity ?? raw?.ticketQuantity)
      : undefined,
    price: Number.isFinite(price) && price > 0 ? price : undefined,
    currency_code: hasCurrencyCode
      ? toOptionalText(raw?.currency_code ?? raw?.currencyCode) || undefined
      : undefined,
    is_active: isActive,
    sort_order: hasSortOrder
      ? toSortOrder(raw?.sort_order ?? raw?.sortOrder)
      : undefined,
  };
}

export function readTicketTypeInputs(value: unknown): {
  ticketTypes?: TicketTypeInput[];
  error?: string;
} {
  if (!Array.isArray(value)) {
    return { error: "ticket_types debe ser una lista" };
  }

  const ticketTypes = value
    .map((row) => normalizeTicketInput(row))
    .filter((row: TicketTypeInput | null): row is TicketTypeInput =>
      Boolean(row),
    );

  if (ticketTypes.length === 0) {
    return { error: "Agrega al menos un tipo de entrada valido" };
  }

  return { ticketTypes };
}

function normalizeAdminTicketTypeRow(row: any): AdminTicketType | null {
  const code = toOptionalText(row?.code);
  const label = toOptionalText(row?.label);
  const price = toPositiveNumber(row?.price, 0);
  const ticketQuantity = toTicketQuantity(row?.ticket_quantity);
  const salePhase =
    row?.sale_phase === null ? null : normalizeSalePhase(row?.sale_phase);

  if (!code || !label || !price || !ticketQuantity) return null;

  return {
    id: typeof row?.id === "string" ? row.id : null,
    code,
    label,
    description:
      typeof row?.description === "string" ? row.description.trim() : "",
    sale_phase: salePhase ?? null,
    ticket_quantity: ticketQuantity,
    price,
    currency_code: toOptionalText(row?.currency_code) || "PEN",
    is_active:
      typeof row?.is_active === "boolean" ? row.is_active : true,
    sort_order: toSortOrder(row?.sort_order) ?? 0,
  };
}

export function buildAdminTicketTypes(
  event: Record<string, any>,
  rows: any[] = [],
): AdminTicketType[] {
  const normalizedRows = rows
    .map((row) => normalizeAdminTicketTypeRow(row))
    .filter((row: AdminTicketType | null): row is AdminTicketType => Boolean(row));
  if (normalizedRows.length > 0) return sortTicketTypes(normalizedRows);

  const rowsByCode = new Map(
    rows
      .filter((row) => typeof row?.code === "string")
      .map((row) => [row.code, row]),
  );
  const earlyEnabled = event?.early_bird_enabled === true;

  return sortTicketTypes(TICKET_TYPE_DEFINITIONS.map((definition) => {
    const row = rowsByCode.get(definition.code);
    const legacyPrice = event?.[definition.legacyPriceField];
    const price = toPositiveNumber(
      row?.price,
      toPositiveNumber(legacyPrice, definition.defaultPrice),
    );

    return {
      id: typeof row?.id === "string" ? row.id : null,
      code: definition.code,
      label: toOptionalText(row?.label) || definition.label,
      description:
        typeof row?.description === "string"
          ? row.description
          : definition.description,
      sale_phase: definition.salePhase,
      ticket_quantity: definition.ticketQuantity,
      price,
      currency_code: toOptionalText(row?.currency_code) || "PEN",
      is_active:
        typeof row?.is_active === "boolean"
          ? row.is_active
          : definition.salePhase === "early_bird"
            ? earlyEnabled
            : true,
      sort_order: Number.isFinite(Number(row?.sort_order))
        ? Number(row.sort_order)
        : definition.sortOrder,
    };
  }));
}

export function applyTicketTypeInputs(
  baseRows: AdminTicketType[],
  inputs: TicketTypeInput[],
): { ticketTypes?: AdminTicketType[]; error?: string } {
  const baseRowsByCode = new Map(baseRows.map((baseRow) => [baseRow.code, baseRow]));
  const maxSortOrder = Math.max(0, ...baseRows.map((baseRow) => baseRow.sort_order));

  const ticketTypes = inputs.map((input, index) => {
    const baseRow = baseRowsByCode.get(input.code);
    const definition = DEFINITION_BY_CODE.get(input.code);

    return {
      id: baseRow?.id ?? null,
      code: input.code,
      label: input.label ?? baseRow?.label ?? definition?.label ?? "",
      description:
        input.description ?? baseRow?.description ?? definition?.description ?? "",
      sale_phase:
        input.sale_phase !== undefined
          ? input.sale_phase
          : baseRow?.sale_phase ?? definition?.salePhase ?? null,
      ticket_quantity:
        input.ticket_quantity ??
        baseRow?.ticket_quantity ??
        definition?.ticketQuantity ??
        0,
      price: input.price ?? baseRow?.price ?? definition?.defaultPrice ?? 0,
      currency_code: input.currency_code ?? baseRow?.currency_code ?? "PEN",
      is_active: input.is_active ?? baseRow?.is_active ?? true,
      sort_order:
        input.sort_order ??
        baseRow?.sort_order ??
        definition?.sortOrder ??
        maxSortOrder + (index + 1) * 10,
    };
  });

  for (const ticketType of ticketTypes) {
    if (!ticketType.label.trim()) {
      return { error: "Cada tipo de entrada necesita una etiqueta" };
    }
    if (
      !Number.isFinite(ticketType.ticket_quantity) ||
      ticketType.ticket_quantity <= 0
    ) {
      return { error: "Cada tipo de entrada necesita una cantidad valida" };
    }
    if (!Number.isFinite(ticketType.price) || ticketType.price <= 0) {
      return { error: "Cada tipo de entrada necesita un precio valido" };
    }
  }

  return {
    ticketTypes: sortTicketTypes(ticketTypes).map((ticketType) => ({
      ...ticketType,
      description: ticketType.description.trim(),
      currency_code: ticketType.currency_code.trim() || "PEN",
    })),
  };
}

export function buildLegacyEventPricePayload(ticketTypes: AdminTicketType[]) {
  const byCode = new Map(ticketTypes.map((ticketType) => [ticketType.code, ticketType]));
  const priceFor = (definition: (typeof TICKET_TYPE_DEFINITIONS)[number]) =>
    toPositiveNumber(byCode.get(definition.code)?.price, definition.defaultPrice);

  return {
    early_bird_enabled: TICKET_TYPE_DEFINITIONS.some(
      (definition) =>
        definition.salePhase === "early_bird" &&
        byCode.get(definition.code)?.is_active === true,
    ),
    early_bird_price_1: priceFor(TICKET_TYPE_DEFINITIONS[0]),
    early_bird_price_2: priceFor(TICKET_TYPE_DEFINITIONS[1]),
    all_night_price_1: priceFor(TICKET_TYPE_DEFINITIONS[2]),
    all_night_price_2: priceFor(TICKET_TYPE_DEFINITIONS[3]),
  };
}

export function buildTicketTypeUpsertRows(
  eventId: string,
  ticketTypes: AdminTicketType[],
) {
  const updatedAt = new Date().toISOString();

  return ticketTypes.map((ticketType) => ({
    event_id: eventId,
    code: ticketType.code,
    label: ticketType.label.trim(),
    description: ticketType.description.trim() || null,
    sale_phase: ticketType.sale_phase,
    ticket_quantity: ticketType.ticket_quantity,
    price: ticketType.price,
    currency_code: ticketType.currency_code || "PEN",
    is_active: ticketType.is_active,
    sort_order: ticketType.sort_order,
    deleted_at: null,
    updated_at: updatedAt,
  }));
}
