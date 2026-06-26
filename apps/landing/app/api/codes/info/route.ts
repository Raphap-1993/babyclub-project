import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { applyNotDeleted } from "shared/db/softDelete";
import {
  ensureEventSalesDefaults,
  evaluateEventSales,
  isMissingEventSalesColumnsError,
} from "shared/eventSales";
import {
  FREE_QR_DISABLED_MESSAGE,
  isFreeQrCodeType,
  isFreeQrReleaseEnabled,
} from "shared/freeQrGate";
import {
  parseRateLimitEnv,
  rateLimit,
  rateLimitHeaders,
} from "shared/security/rateLimit";

type TicketSalePhase = "early_bird" | "all_night";

const TICKET_PRICES_FALLBACK: Record<TicketSalePhase, number> = {
  early_bird: 15,
  all_night: 20,
};

function resolveActiveTicketSalePhase(): TicketSalePhase {
  const raw = (
    process.env.TICKET_SALE_PHASE ||
    process.env.NEXT_PUBLIC_TICKET_SALE_PHASE ||
    "early_bird"
  )
    .trim()
    .toLowerCase();
  return raw === "all_night" ? "all_night" : "early_bird";
}

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_CODES_INFO_PER_MIN = parseRateLimitEnv(
  process.env.RATE_LIMIT_CODES_INFO_PER_MIN,
  20,
);

async function findRegisteredTicketByCode(
  supabase: any,
  codeRow: {
    id?: string | null;
    event_id?: string | null;
    table_reservation_id?: string | null;
    person_index?: number | null;
  },
) {
  const reservationId =
    typeof codeRow.table_reservation_id === "string"
      ? codeRow.table_reservation_id
      : null;
  const unitIndex = Number(codeRow.person_index || 0);

  if (reservationId && unitIndex >= 1) {
    const { data: unitRow, error: unitError } = await applyNotDeleted(
      supabase
        .from("ticket_reservation_units")
        .select("id,reservation_id,unit_index,status,ticket_id")
        .eq("reservation_id", reservationId)
        .eq("unit_index", unitIndex),
    ).maybeSingle();

    if (unitError) {
      throw new Error(unitError.message || "No se pudo consultar la unidad");
    }

    const ticketId =
      typeof (unitRow as any)?.ticket_id === "string"
        ? (unitRow as any).ticket_id
        : null;
    if (ticketId) {
      const { data: ticketRow, error: ticketError } = await applyNotDeleted(
        supabase.from("tickets").select("id,event_id").eq("id", ticketId),
      ).maybeSingle();

      if (ticketError) {
        throw new Error(
          ticketError.message || "No se pudo consultar el ticket emitido",
        );
      }

      return {
        ticket_id: typeof (ticketRow as any)?.id === "string" ? (ticketRow as any).id : ticketId,
        ticket_event_id:
          typeof (ticketRow as any)?.event_id === "string"
            ? (ticketRow as any).event_id
            : (typeof codeRow.event_id === "string" ? codeRow.event_id : null),
      };
    }
  }

  if (!codeRow.id) return null;

  const ticketsQuery = applyNotDeleted(
    supabase
      .from("tickets")
      .select("id,event_id,is_active")
      .eq("code_id", codeRow.id)
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(5),
  );
  let { data: ticketsData, error: ticketsError } = await ticketsQuery;

  if (
    ticketsError &&
    (String(ticketsError.message || "").includes("tickets.is_active") ||
      String(ticketsError.details || "").includes("tickets.is_active"))
  ) {
    const legacyTicketsQuery = applyNotDeleted(
      supabase
        .from("tickets")
        .select("id,event_id")
        .eq("code_id", codeRow.id)
        .order("created_at", { ascending: false })
        .limit(5),
    );
    const legacyResult = await legacyTicketsQuery;
    ticketsData = legacyResult.data;
    ticketsError = legacyResult.error;
  }

  if (ticketsError) {
    throw new Error(ticketsError.message || "No se pudo consultar tickets");
  }

  const ticketRow = Array.isArray(ticketsData) ? ticketsData[0] : null;
  if (!ticketRow?.id) return null;

  return {
    ticket_id: typeof ticketRow.id === "string" ? ticketRow.id : null,
    ticket_event_id:
      typeof ticketRow.event_id === "string" ? ticketRow.event_id : null,
  };
}

export async function GET(req: NextRequest) {
  const limiter = rateLimit(req, {
    keyPrefix: "landing:codes-info",
    limit: RATE_LIMIT_CODES_INFO_PER_MIN,
    windowMs: RATE_LIMIT_WINDOW_MS,
  });
  if (!limiter.ok) {
    return NextResponse.json(
      { error: "rate_limited", retryAfterMs: limiter.resetMs },
      { status: 429, headers: rateLimitHeaders(limiter) },
    );
  }

  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json(
      { error: "Missing Supabase config" },
      { status: 500 },
    );
  }

  const code = req.nextUrl.searchParams.get("code")?.trim();
  if (!code)
    return NextResponse.json({ error: "code required" }, { status: 400 });

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const codeQuery = applyNotDeleted(
    supabase
      .from("codes")
      .select(
        "id,code,type,promoter_id,event_id,is_active,expires_at,uses,max_uses,table_reservation_id,person_index",
      )
      .eq("code", code),
  );
  const { data, error } = await codeQuery.maybeSingle();

  if (error || !data) {
    return NextResponse.json(
      { error: "Código no encontrado" },
      { status: 404 },
    );
  }

  if (!data.is_active) {
    return NextResponse.json({ error: "Código inactivo" }, { status: 400 });
  }

  if (data.expires_at && new Date(data.expires_at) < new Date()) {
    return NextResponse.json({ error: "Código expirado" }, { status: 400 });
  }

  if (isFreeQrCodeType(data.type) && !isFreeQrReleaseEnabled()) {
    return NextResponse.json(
      {
        error: FREE_QR_DISABLED_MESSAGE,
        code: "free_qr_disabled",
      },
      { status: 409 },
    );
  }

  let sale_status: "on_sale" | "sold_out" | "paused" = "on_sale";
  let sale_block_reason: string | null = null;
  let sale_public_message: string | null = null;
  let sales_available = true;
  let ticket_price: number | null = null;
  let ticket_sale_phase: TicketSalePhase | null = null;
  let registered_person: {
    ticket_id: string | null;
    ticket_event_id: string | null;
  } | null = null;

  if (data.event_id) {
    const eventQuery = applyNotDeleted(
      supabase
        .from("events")
        .select(
          "id,is_active,closed_at,sale_status,sale_public_message,early_bird_price_1,all_night_price_1,early_bird_enabled",
        )
        .eq("id", data.event_id),
    );
    let { data: eventRow, error: eventError } = await eventQuery.maybeSingle();
    if (eventError && isMissingEventSalesColumnsError(eventError)) {
      const legacyQuery = applyNotDeleted(
        supabase
          .from("events")
          .select("id,is_active,closed_at")
          .eq("id", data.event_id),
      );
      const legacyResult = await legacyQuery.maybeSingle();
      eventRow = legacyResult.data as any;
    }
    const saleDecision = evaluateEventSales(
      ensureEventSalesDefaults((eventRow || {}) as any),
    );
    sale_status = saleDecision.sale_status;
    sale_block_reason = saleDecision.block_reason;
    sale_public_message = saleDecision.public_message;
    sales_available = saleDecision.available;

    // Resolve ticket price for general codes
    if (data.type === "general" && eventRow) {
      const phase = resolveActiveTicketSalePhase();
      ticket_sale_phase = phase;
      const priceFromEvent =
        phase === "early_bird"
          ? (eventRow as any).early_bird_price_1
          : (eventRow as any).all_night_price_1;
      ticket_price =
        typeof priceFromEvent === "number" && priceFromEvent > 0
          ? priceFromEvent
          : TICKET_PRICES_FALLBACK[phase];
    }
  }

  if (data.id && data.type !== "promoter_link") {
    try {
      registered_person = await findRegisteredTicketByCode(supabase, data);
    } catch (error: any) {
      return NextResponse.json(
        { error: error?.message || "No se pudo consultar el ticket emitido" },
        { status: 500 },
      );
    }
  }

  return NextResponse.json({
    code_id: data.id || null,
    code: data.code,
    type: data.type || null,
    promoter_id: data.promoter_id || null,
    event_id: data.event_id || null,
    is_active: data.is_active,
    expires_at: data.expires_at,
    sales_available,
    sale_status,
    sale_block_reason,
    sale_public_message,
    ticket_price,
    ticket_sale_phase,
    registered_person,
  });
}
