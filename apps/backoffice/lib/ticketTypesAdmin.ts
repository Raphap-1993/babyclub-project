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
  price?: number;
  is_active?: boolean;
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

function normalizeTicketInput(raw: any): TicketTypeInput | null {
  const code = typeof raw?.code === "string" ? raw.code.trim() : "";
  const definition = DEFINITION_BY_CODE.get(code);
  if (!definition) return null;

  const price = Number(raw?.price);
  const hasDescription = Object.prototype.hasOwnProperty.call(
    raw || {},
    "description",
  );
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
    price: Number.isFinite(price) && price > 0 ? price : undefined,
    is_active: isActive,
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

export function buildAdminTicketTypes(
  event: Record<string, any>,
  rows: any[] = [],
): AdminTicketType[] {
  const rowsByCode = new Map(
    rows
      .filter((row) => typeof row?.code === "string")
      .map((row) => [row.code, row]),
  );
  const earlyEnabled = event?.early_bird_enabled === true;

  return TICKET_TYPE_DEFINITIONS.map((definition) => {
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
  });
}

export function applyTicketTypeInputs(
  baseRows: AdminTicketType[],
  inputs: TicketTypeInput[],
): { ticketTypes?: AdminTicketType[]; error?: string } {
  const inputByCode = new Map(inputs.map((input) => [input.code, input]));

  const ticketTypes = baseRows.map((baseRow) => {
    const input = inputByCode.get(baseRow.code);
    if (!input) return baseRow;

    return {
      ...baseRow,
      label: input.label ?? baseRow.label,
      description: input.description ?? baseRow.description,
      price: input.price ?? baseRow.price,
      is_active: input.is_active ?? baseRow.is_active,
    };
  });

  for (const ticketType of ticketTypes) {
    if (!ticketType.label.trim()) {
      return { error: "Cada tipo de entrada necesita una etiqueta" };
    }
    if (!Number.isFinite(ticketType.price) || ticketType.price <= 0) {
      return { error: "Cada tipo de entrada necesita un precio valido" };
    }
  }

  return { ticketTypes };
}

export function buildLegacyEventPricePayload(ticketTypes: AdminTicketType[]) {
  const byCode = new Map(ticketTypes.map((ticketType) => [ticketType.code, ticketType]));
  const priceFor = (code: string, fallback: number) =>
    toPositiveNumber(byCode.get(code)?.price, fallback);

  return {
    early_bird_enabled: ticketTypes.some(
      (ticketType) =>
        ticketType.sale_phase === "early_bird" && ticketType.is_active,
    ),
    early_bird_price_1: priceFor("early_bird_1", 15),
    early_bird_price_2: priceFor("early_bird_2", 25),
    all_night_price_1: priceFor("all_night_1", 20),
    all_night_price_2: priceFor("all_night_2", 35),
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
