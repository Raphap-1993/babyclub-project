export type TicketSalePhase = "early_bird" | "all_night";

export type TicketTypeDefinition = {
  code: string;
  label: string;
  description: string;
  salePhase: TicketSalePhase;
  ticketQuantity: 1 | 2;
  defaultPrice: number;
  legacyPriceField:
    | "early_bird_price_1"
    | "early_bird_price_2"
    | "all_night_price_1"
    | "all_night_price_2";
  sortOrder: number;
};

export const TICKET_TYPE_DEFINITIONS: TicketTypeDefinition[] = [
  {
    code: "early_bird_1",
    label: "1 QR EARLY BABY",
    description: "Incluye 1 trago de cortesia",
    salePhase: "early_bird",
    ticketQuantity: 1,
    defaultPrice: 15,
    legacyPriceField: "early_bird_price_1",
    sortOrder: 10,
  },
  {
    code: "early_bird_2",
    label: "2 QR EARLY BABY",
    description: "Incluye 2 tragos de cortesia",
    salePhase: "early_bird",
    ticketQuantity: 2,
    defaultPrice: 25,
    legacyPriceField: "early_bird_price_2",
    sortOrder: 20,
  },
  {
    code: "all_night_1",
    label: "1 QR ALL NIGHT",
    description: "Incluye 1 trago a eleccion",
    salePhase: "all_night",
    ticketQuantity: 1,
    defaultPrice: 20,
    legacyPriceField: "all_night_price_1",
    sortOrder: 30,
  },
  {
    code: "all_night_2",
    label: "2 QR ALL NIGHT",
    description: "Incluye 2 tragos a eleccion",
    salePhase: "all_night",
    ticketQuantity: 2,
    defaultPrice: 35,
    legacyPriceField: "all_night_price_2",
    sortOrder: 40,
  },
];

export type TicketTypeOption = {
  id?: string | null;
  code: string;
  label: string;
  description: string | null;
  salePhase: TicketSalePhase;
  ticketQuantity: number;
  price: number;
  currencyCode: string;
  isActive: boolean;
  sortOrder: number;
};

function toPositiveNumber(value: unknown, fallback: number) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) && numberValue > 0
    ? numberValue
    : fallback;
}

function toTicketQuantity(value: unknown) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) && numberValue > 0
    ? Math.floor(numberValue)
    : 0;
}

function normalizePhase(value: unknown): TicketSalePhase | null {
  return value === "early_bird" || value === "all_night" ? value : null;
}

function normalizeDbTicketType(row: any): TicketTypeOption | null {
  const salePhase = normalizePhase(row?.sale_phase ?? row?.salePhase);
  const ticketQuantity = toTicketQuantity(
    row?.ticket_quantity ?? row?.ticketQuantity,
  );
  const price = toPositiveNumber(row?.price, 0);
  const code = typeof row?.code === "string" ? row.code.trim() : "";
  const label = typeof row?.label === "string" ? row.label.trim() : "";

  if (!salePhase || !ticketQuantity || !price || !code || !label) return null;

  return {
    id: typeof row?.id === "string" ? row.id : null,
    code,
    label,
    description:
      typeof row?.description === "string" && row.description.trim()
        ? row.description.trim()
        : null,
    salePhase,
    ticketQuantity,
    price,
    currencyCode:
      typeof (row?.currency_code ?? row?.currencyCode) === "string" &&
      (row?.currency_code ?? row?.currencyCode).trim()
        ? (row?.currency_code ?? row?.currencyCode).trim()
        : "PEN",
    isActive: (row?.is_active ?? row?.isActive) !== false,
    sortOrder: Number.isFinite(Number(row?.sort_order ?? row?.sortOrder))
      ? Number(row?.sort_order ?? row?.sortOrder)
      : 0,
  };
}

function legacyOption(
  definition: TicketTypeDefinition,
  price: number,
  isActive: boolean,
): TicketTypeOption {
  return {
    id: null,
    code: definition.code,
    label: definition.label,
    description: definition.description,
    salePhase: definition.salePhase,
    ticketQuantity: definition.ticketQuantity,
    price,
    currencyCode: "PEN",
    isActive,
    sortOrder: definition.sortOrder,
  };
}

export function buildLegacyTicketTypes(event: any): TicketTypeOption[] {
  const earlyEnabled = event?.early_bird_enabled === true;
  return TICKET_TYPE_DEFINITIONS.map((definition) =>
    legacyOption(
      definition,
      toPositiveNumber(
        event?.[definition.legacyPriceField],
        definition.defaultPrice,
      ),
      definition.salePhase === "early_bird" ? earlyEnabled : true,
    ),
  );
}

export function normalizeTicketTypesFromEvent(event: any): TicketTypeOption[] {
  const dbRows: TicketTypeOption[] = Array.isArray(event?.ticket_types)
    ? event.ticket_types
        .map((row: any) => normalizeDbTicketType(row))
        .filter((row: TicketTypeOption | null): row is TicketTypeOption =>
          Boolean(row),
        )
    : [];

  const rows: TicketTypeOption[] =
    dbRows.length > 0 ? dbRows : buildLegacyTicketTypes(event);
  return rows
    .filter((row) => row.isActive)
    .sort((a, b) => {
      if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
      return a.label.localeCompare(b.label);
    });
}

export function resolveTicketTypeSelection(
  event: any,
  input: {
    code?: string | null;
    salePhase?: string | null;
    ticketQuantity?: number | null;
  },
) {
  const options = normalizeTicketTypesFromEvent(event);
  const code = typeof input.code === "string" ? input.code.trim() : "";
  if (code) {
    return options.find((option) => option.code === code) || null;
  }

  const salePhase = normalizePhase(input.salePhase);
  const ticketQuantity = toTicketQuantity(input.ticketQuantity);
  return (
    options.find(
      (option) =>
        option.salePhase === salePhase &&
        option.ticketQuantity === ticketQuantity,
    ) || null
  );
}
