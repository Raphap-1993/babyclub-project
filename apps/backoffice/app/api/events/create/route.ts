import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { DateTime } from "luxon";
import { EVENT_TZ } from "shared/datetime";
import { DEFAULT_ENTRY_LIMIT, normalizeEntryLimit } from "shared/entryLimit";
import { requireStaffRole } from "shared/auth/requireStaff";
import { buildArchivePayload } from "shared/db/softDelete";
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
    capacity,
    code: requestedCode,
    name,
    cover_image,
    ticketTypes,
  } = buildEventPayload(body);
  if (error) {
    return NextResponse.json({ success: false, error }, { status: 400 });
  }
  if (payload) {
    payload.sale_updated_at = new Date().toISOString();
    payload.sale_updated_by = guard.context?.staffId || null;
  }

  let { data, error: dbError } = await supabase
    .from("events")
    .insert(payload)
    .select("id")
    .single();
  if (dbError && isMissingEventSalesColumnsError(dbError)) {
    const legacyPayload = { ...(payload as Record<string, any>) };
    delete legacyPayload.sale_status;
    delete legacyPayload.sale_public_message;
    delete legacyPayload.sale_updated_at;
    delete legacyPayload.sale_updated_by;
    const legacyInsert = await supabase
      .from("events")
      .insert(legacyPayload)
      .select("id")
      .single();
    data = legacyInsert.data;
    dbError = legacyInsert.error;
  }
  if (dbError) {
    return NextResponse.json(
      { success: false, error: dbError.message },
      { status: 500 },
    );
  }

  const eventId = data?.id;

  if (eventId) {
    const archivePayload = buildArchivePayload(guard.context?.staffId);

    // Si no viene código, generar uno friendly automáticamente
    let codeToUse = requestedCode as string;
    if (!codeToUse && name && payload?.starts_at) {
      codeToUse = generateEventCode(name, payload.starts_at);

      // Verificar si código ya existe y agregar sufijo si es necesario
      let attempt = 1;
      let finalCode = codeToUse;
      while (attempt <= 5) {
        const { data: existing } = await supabase
          .from("codes")
          .select("id")
          .eq("code", finalCode)
          .eq("type", "general")
          .maybeSingle();

        if (!existing) break;

        attempt++;
        finalCode = addSuffixIfNeeded(codeToUse, attempt);
      }
      codeToUse = finalCode;
    }

    const { data: rpcResult, error: rpcError } = await supabase.rpc(
      "set_event_general_code",
      {
        p_event_id: eventId,
        p_code: codeToUse,
        p_capacity: capacity,
      },
    );
    if (rpcError) {
      await supabase.from("events").update(archivePayload).eq("id", eventId);
      const errorMessage =
        rpcError.code === "23505"
          ? "Ese código ya está asignado a otro evento"
          : rpcError.message || "Código no disponible";
      return NextResponse.json(
        { success: false, error: errorMessage },
        { status: 400 },
      );
    }
    if (!rpcResult) {
      await supabase.from("events").update(archivePayload).eq("id", eventId);
      return NextResponse.json(
        { success: false, error: "No se pudo guardar el código del evento" },
        { status: 400 },
      );
    }
    await syncEventTicketTypes(supabase, eventId, payload, ticketTypes);
    if (cover_image) {
      await upsertCover(supabase, eventId, cover_image);
    }
  }

  return NextResponse.json({ success: true, id: eventId ?? null });
}

function buildEventPayload(body: any): {
  payload?: Record<string, any>;
  error?: string;
  capacity?: number;
  code?: string;
  name?: string;
  cover_image?: string;
  ticketTypes?: TicketTypeInput[];
} {
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

  if (!name) return { error: "name is required" };
  if (!date_value) return { error: "date must be a valid date" };
  if (!Number.isFinite(capacity) || capacity < 10)
    return { error: "capacity must be >= 10" };
  if (!entry_limit) return { error: "entry_limit inválido" };

  const is_active =
    typeof body?.is_active === "boolean" ? body.is_active : true;
  const saleStatusRaw =
    typeof body?.sale_status === "string"
      ? body.sale_status.trim().toLowerCase()
      : "on_sale";
  const allowedSaleStatuses = new Set(["on_sale", "sold_out", "paused"]);
  if (!allowedSaleStatuses.has(saleStatusRaw))
    return { error: "sale_status inválido" };
  const sale_public_message =
    typeof body?.sale_public_message === "string"
      ? body.sale_public_message.trim()
      : "";
  const code = typeof body?.code === "string" ? body.code.trim() : "";
  const organizer_id =
    typeof body?.organizer_id === "string" ? body.organizer_id.trim() : "";

  if (!code) return { error: "Código es requerido" };
  if (!organizer_id) return { error: "Organizador es requerido" };

  const marketing_capacity_raw =
    body?.marketing_capacity != null ? Number(body.marketing_capacity) : null;
  const marketing_capacity =
    Number.isFinite(marketing_capacity_raw) && marketing_capacity_raw! > 0
      ? marketing_capacity_raw
      : null;
  const early_bird_enabled =
    typeof body?.early_bird_enabled === "boolean"
      ? body.early_bird_enabled
      : false;
  const early_bird_price_1 = Number(body?.early_bird_price_1);
  const early_bird_price_2 = Number(body?.early_bird_price_2);
  const all_night_price_1 = Number(body?.all_night_price_1);
  const all_night_price_2 = Number(body?.all_night_price_2);

  return {
    payload: {
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
      early_bird_enabled,
      early_bird_price_1:
        Number.isFinite(early_bird_price_1) && early_bird_price_1 > 0
          ? early_bird_price_1
          : 15,
      early_bird_price_2:
        Number.isFinite(early_bird_price_2) && early_bird_price_2 > 0
          ? early_bird_price_2
          : 25,
      all_night_price_1:
        Number.isFinite(all_night_price_1) && all_night_price_1 > 0
          ? all_night_price_1
          : 20,
      all_night_price_2:
        Number.isFinite(all_night_price_2) && all_night_price_2 > 0
          ? all_night_price_2
          : 35,
    },
    capacity,
    code: code || undefined, // undefined si está vacío
    name,
    cover_image,
    ticketTypes: readTicketTypesInput(body),
  };
}

type TicketTypeInput = {
  code: string;
  label?: string;
  description?: string;
  price?: number;
  is_active?: boolean;
};

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
  const rows = TICKET_TYPE_DEFINITIONS.map((definition) => {
    const input = inputByCode.get(definition.code);
    const price = Number(input?.price ?? payload[definition.legacyPriceField]);

    return {
      event_id: eventId,
      code: definition.code,
      label: input?.label || definition.label,
      description:
        input && Object.prototype.hasOwnProperty.call(input, "description")
          ? input.description || null
          : definition.description,
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
