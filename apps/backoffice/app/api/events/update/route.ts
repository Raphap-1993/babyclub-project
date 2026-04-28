import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { DateTime } from "luxon";
import { EVENT_TZ } from "shared/datetime";
import { DEFAULT_ENTRY_LIMIT, normalizeEntryLimit } from "shared/entryLimit";
import { requireStaffRole } from "shared/auth/requireStaff";
import { generateEventCode, addSuffixIfNeeded } from "shared/friendlyCode";
import { isMissingEventSalesColumnsError } from "shared/eventSales";
import { TICKET_TYPE_DEFINITIONS } from "shared/ticketTypes";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase =
  supabaseUrl && supabaseServiceKey
    ? createClient(supabaseUrl, supabaseServiceKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      })
    : null;

export async function POST(req: NextRequest) {
  const guard = await requireStaffRole(req);
  if (!guard.ok) {
    return NextResponse.json(
      { success: false, error: guard.error },
      { status: guard.status },
    );
  }
  if (!supabase) {
    return NextResponse.json(
      { success: false, error: "Supabase config missing" },
      { status: 500 },
    );
  }

  let body: any = null;
  try {
    body = await req.json();
  } catch (_err) {
    return NextResponse.json(
      { success: false, error: "Invalid JSON" },
      { status: 400 },
    );
  }

  const {
    payload,
    error,
    id,
    code,
    name,
    capacity,
    cover_image,
    ticketTypes,
    syncTicketTypes,
  } = buildEventPayload(body);
  if (error || !id) {
    return NextResponse.json(
      { success: false, error: error || "id is required" },
      { status: 400 },
    );
  }
  if (payload) {
    payload.sale_updated_at = new Date().toISOString();
    payload.sale_updated_by = guard.context?.staffId || null;
  }

  let { data, error: dbError } = await supabase
    .from("events")
    .update(payload)
    .eq("id", id)
    .select("id")
    .single();
  if (dbError && isMissingEventSalesColumnsError(dbError)) {
    const legacyPayload = { ...(payload as Record<string, any>) };
    delete legacyPayload.sale_status;
    delete legacyPayload.sale_public_message;
    delete legacyPayload.sale_updated_at;
    delete legacyPayload.sale_updated_by;
    const legacyUpdate = await supabase
      .from("events")
      .update(legacyPayload)
      .eq("id", id)
      .select("id")
      .single();
    data = legacyUpdate.data;
    dbError = legacyUpdate.error;
  }
  if (dbError) {
    return NextResponse.json(
      { success: false, error: dbError.message },
      { status: 500 },
    );
  }

  const eventId = data?.id ?? id;

  const { data: rpcResult, error: rpcError } = await supabase.rpc(
    "set_event_general_code",
    {
      p_event_id: eventId,
      p_code: code,
      p_capacity: capacity,
    },
  );
  if (rpcError || !rpcResult) {
    const errorMessage =
      rpcError?.code === "23505"
        ? "Ese código ya está asignado a otro evento"
        : rpcError?.message || "El código ya está en uso";
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 400 },
    );
  }
  if (syncTicketTypes) {
    await syncEventTicketTypes(supabase, eventId, payload, ticketTypes);
  }
  if (cover_image) {
    await upsertCover(supabase, eventId, cover_image);
  } else {
    await supabase
      .from("event_messages")
      .delete()
      .eq("event_id", eventId)
      .eq("key", "cover_image");
  }

  return NextResponse.json({ success: true, id: eventId });
}

function buildEventPayload(body: any): {
  id?: string;
  payload?: Record<string, any>;
  error?: string;
  code?: string;
  name?: string;
  capacity?: number;
  cover_image?: string;
  ticketTypes?: TicketTypeInput[];
  syncTicketTypes?: boolean;
} {
  const id = typeof body?.id === "string" ? body.id : undefined;
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const location =
    typeof body?.location === "string" ? body.location.trim() : "";
  const header_image =
    typeof body?.header_image === "string" ? body.header_image.trim() : "";
  const cover_image =
    typeof body?.cover_image === "string" ? body.cover_image.trim() : "";
  const entry_limit_input =
    typeof body?.entry_limit === "string" ? body.entry_limit.trim() : "";

  const date_input = body?.starts_at ?? body?.date;
  const date_value = parseDateToLima(date_input);

  const capacity = Number(body?.capacity);
  const entry_limit = normalizeEntryLimit(
    entry_limit_input || DEFAULT_ENTRY_LIMIT,
  );

  if (!name) return { id, error: "name is required" };
  if (!date_value) return { id, error: "date must be a valid date" };
  if (!Number.isFinite(capacity) || capacity < 10)
    return { id, error: "capacity must be >= 10" };
  if (!entry_limit) return { id, error: "entry_limit inválido" };

  const is_active =
    typeof body?.is_active === "boolean" ? body.is_active : true;
  const saleStatusRaw =
    typeof body?.sale_status === "string"
      ? body.sale_status.trim().toLowerCase()
      : "on_sale";
  const allowedSaleStatuses = new Set(["on_sale", "sold_out", "paused"]);
  if (!allowedSaleStatuses.has(saleStatusRaw))
    return { id, error: "sale_status inválido" };
  const sale_public_message =
    typeof body?.sale_public_message === "string"
      ? body.sale_public_message.trim()
      : "";
  const code = typeof body?.code === "string" ? body.code.trim() : "";
  const organizer_id =
    typeof body?.organizer_id === "string" ? body.organizer_id.trim() : "";

  if (!code) return { id, error: "Código es requerido" };
  if (!organizer_id) return { id, error: "Organizador es requerido" };

  const marketing_capacity_raw =
    body?.marketing_capacity != null ? Number(body.marketing_capacity) : null;
  const marketing_capacity =
    Number.isFinite(marketing_capacity_raw) && marketing_capacity_raw! > 0
      ? marketing_capacity_raw
      : null;
  const ticketTypes = readTicketTypesInput(body);
  const syncTicketTypes = shouldSyncTicketTypes(body);
  const ticketTypeByCode = new Map(
    (ticketTypes || []).map((ticketType) => [ticketType.code, ticketType]),
  );
  const getTicketPrice = (field: string, code: string, fallback: number) => {
    const explicit = Number(body?.[field]);
    if (Number.isFinite(explicit) && explicit > 0) return explicit;
    const ticketTypePrice = Number(ticketTypeByCode.get(code)?.price);
    return Number.isFinite(ticketTypePrice) && ticketTypePrice > 0
      ? ticketTypePrice
      : fallback;
  };
  const early_bird_enabled =
    typeof body?.early_bird_enabled === "boolean"
      ? body.early_bird_enabled
      : ticketTypes
        ? ticketTypes.some(
            (ticketType) =>
              ticketType.code.startsWith("early_bird") &&
              ticketType.is_active !== false,
          )
        : false;

  const payload: Record<string, any> = {
    name,
    location,
    starts_at: date_value.toUTC().toISO(),
    entry_limit,
    capacity,
    marketing_capacity,
    header_image,
    is_active,
    sale_status: saleStatusRaw,
    sale_public_message: sale_public_message || null,
    organizer_id,
  };

  if (syncTicketTypes) {
    Object.assign(payload, {
      early_bird_enabled,
      early_bird_price_1: getTicketPrice(
        "early_bird_price_1",
        "early_bird_1",
        15,
      ),
      early_bird_price_2: getTicketPrice(
        "early_bird_price_2",
        "early_bird_2",
        25,
      ),
      all_night_price_1: getTicketPrice("all_night_price_1", "all_night_1", 20),
      all_night_price_2: getTicketPrice("all_night_price_2", "all_night_2", 35),
    });
  }

  return {
    id,
    payload,
    code: code || undefined,
    name,
    capacity,
    cover_image,
    ticketTypes,
    syncTicketTypes,
  };
}

type TicketTypeInput = {
  code: string;
  label?: string;
  description?: string;
  price?: number;
  is_active?: boolean;
};

function shouldSyncTicketTypes(body: any) {
  if (Array.isArray(body?.ticket_types)) return true;
  if (typeof body?.early_bird_enabled === "boolean") return true;
  return [
    "early_bird_price_1",
    "early_bird_price_2",
    "all_night_price_1",
    "all_night_price_2",
  ].some((field) => Object.prototype.hasOwnProperty.call(body || {}, field));
}

function readTicketTypesInput(body: any): TicketTypeInput[] | undefined {
  if (!Array.isArray(body?.ticket_types)) return undefined;
  const allowedCodes = new Set(
    TICKET_TYPE_DEFINITIONS.map((definition) => definition.code),
  );

  return body.ticket_types
    .map((raw: any) => {
      const code = typeof raw?.code === "string" ? raw.code.trim() : "";
      if (!allowedCodes.has(code)) return null;
      const price = Number(raw?.price);

      return {
        code,
        label:
          typeof raw?.label === "string" && raw.label.trim()
            ? raw.label.trim()
            : undefined,
        description:
          typeof raw?.description === "string"
            ? raw.description.trim()
            : undefined,
        price: Number.isFinite(price) && price > 0 ? price : undefined,
        is_active:
          typeof raw?.is_active === "boolean" ? raw.is_active : undefined,
      };
    })
    .filter((row: TicketTypeInput | null): row is TicketTypeInput =>
      Boolean(row),
    );
}

async function upsertCover(supabase: any, eventId: string, coverUrl: string) {
  await supabase
    .from("event_messages")
    .upsert(
      { event_id: eventId, key: "cover_image", value_text: coverUrl },
      { onConflict: "event_id,key" },
    );
}

async function syncEventTicketTypes(
  supabase: any,
  eventId: string,
  payload?: Record<string, any>,
  ticketTypes?: TicketTypeInput[],
) {
  if (!payload) return;
  const earlyEnabled = payload.early_bird_enabled === true;
  const updatedAt = new Date().toISOString();
  const inputByCode = new Map(
    (ticketTypes || []).map((ticketType) => [ticketType.code, ticketType]),
  );
  let existingByCode = new Map<string, any>();
  if (!ticketTypes) {
    const { data } = await supabase
      .from("event_ticket_types")
      .select("code,label,description")
      .eq("event_id", eventId)
      .is("deleted_at", null);
    existingByCode = new Map(
      Array.isArray(data) ? data.map((row: any) => [row.code, row]) : [],
    );
  }

  const rows = TICKET_TYPE_DEFINITIONS.map((definition) => {
    const input = inputByCode.get(definition.code);
    const existing = existingByCode.get(definition.code);
    const price = Number(input?.price ?? payload[definition.legacyPriceField]);

    return {
      event_id: eventId,
      code: definition.code,
      label: input?.label || existing?.label || definition.label,
      description:
        input && Object.prototype.hasOwnProperty.call(input, "description")
          ? input.description || null
          : (existing?.description ?? definition.description),
      sale_phase: definition.salePhase,
      ticket_quantity: definition.ticketQuantity,
      price:
        Number.isFinite(price) && price > 0 ? price : definition.defaultPrice,
      currency_code: "PEN",
      is_active:
        input?.is_active ??
        (definition.salePhase === "early_bird" ? earlyEnabled : true),
      sort_order: definition.sortOrder,
      updated_at: updatedAt,
    };
  });

  const { error } = await supabase
    .from("event_ticket_types")
    .upsert(rows, { onConflict: "event_id,code" });
  if (error) console.warn("No se pudieron sincronizar tipos de entrada", error);
}

function parseDateToLima(date_input: any) {
  if (!date_input || typeof date_input !== "string") return null;
  const hasZone = /[zZ]|[+-]\d{2}:?\d{2}$/.test(date_input);
  const base = hasZone
    ? DateTime.fromISO(date_input, { setZone: true })
    : DateTime.fromISO(date_input, { zone: EVENT_TZ });
  if (!base.isValid) return null;
  return base.setZone(EVENT_TZ);
}
