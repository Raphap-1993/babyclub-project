import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireStaffRole } from "shared/auth/requireStaff";
import { applyNotDeleted } from "shared/db/softDelete";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const VALID_STATUSES = new Set([
  "draft",
  "pending",
  "paid",
  "delivered",
  "closed",
  "void",
]);

type SettlementItemInput = {
  source_type?: string;
  source_id?: string;
  event_id?: string;
  promoter_id?: string;
  attendee_name?: string | null;
  attendee_document?: string | null;
  access_kind?: string | null;
  reward_kind?: string;
  cash_amount_cents?: number;
  drink_units?: number;
  used_at?: string | null;
  metadata?: Record<string, unknown>;
};

function asString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function asNonNegativeInt(value: unknown, fallback = 0) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) return fallback;
  return Math.round(numeric);
}

function asNonNegativeNumber(value: unknown, fallback = 0) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) return fallback;
  return numeric;
}

function normalizeStatus(value: unknown) {
  const status = asString(value) || "pending";
  return VALID_STATUSES.has(status) ? status : "";
}

function normalizeRewardKind(value: unknown) {
  const rewardKind = asString(value) || "cash";
  return ["cash", "drink", "mixed", "manual"].includes(rewardKind)
    ? rewardKind
    : "cash";
}

function normalizeSourceType(value: unknown) {
  const sourceType = asString(value) || "manual";
  return ["ticket", "reservation", "manual"].includes(sourceType)
    ? sourceType
    : "";
}

function normalizeItems(
  rawItems: unknown,
  fallbackEventId: string,
  fallbackPromoterId: string,
) {
  if (!Array.isArray(rawItems)) return [];
  return rawItems
    .map((item: SettlementItemInput) => {
      const sourceType = normalizeSourceType(item?.source_type);
      const sourceId = asString(item?.source_id);
      if (!sourceType || !sourceId) return null;
      return {
        source_type: sourceType,
        source_id: sourceId,
        event_id: asString(item?.event_id) || fallbackEventId,
        promoter_id: asString(item?.promoter_id) || fallbackPromoterId,
        attendee_name: asString(item?.attendee_name) || null,
        attendee_document: asString(item?.attendee_document) || null,
        access_kind: asString(item?.access_kind) || null,
        reward_kind: normalizeRewardKind(item?.reward_kind),
        cash_amount_cents: asNonNegativeInt(item?.cash_amount_cents),
        drink_units: asNonNegativeNumber(item?.drink_units),
        used_at: asString(item?.used_at) || null,
        metadata:
          item?.metadata && typeof item.metadata === "object"
            ? item.metadata
            : {},
      };
    })
    .filter(Boolean) as Array<Required<SettlementItemInput>>;
}

async function findExistingItems(supabase: any, items: SettlementItemInput[]) {
  const groups = new Map<string, string[]>();
  for (const item of items) {
    const sourceType = asString(item.source_type);
    const sourceId = asString(item.source_id);
    if (!sourceType || sourceType === "manual" || !sourceId) continue;
    groups.set(sourceType, [...(groups.get(sourceType) || []), sourceId]);
  }

  const existing: Array<{ source_type: string; source_id: string }> = [];
  for (const [sourceType, sourceIds] of groups.entries()) {
    const uniqueIds = Array.from(new Set(sourceIds));
    if (uniqueIds.length === 0) continue;
    const { data, error } = await applyNotDeleted(
      supabase
        .from("promoter_settlement_items")
        .select("source_type,source_id")
        .eq("source_type", sourceType)
        .in("source_id", uniqueIds)
        .limit(100),
    );
    if (error) throw new Error(error.message);
    existing.push(...((data || []) as any[]));
  }
  return existing;
}

export async function GET(req: NextRequest) {
  const guard = await requireStaffRole(req);
  if (!guard.ok) {
    return NextResponse.json(
      { success: false, error: guard.error },
      { status: guard.status },
    );
  }
  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json(
      { success: false, error: "Supabase config missing" },
      { status: 500 },
    );
  }

  const search = req.nextUrl.searchParams;
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const limit = Math.min(asNonNegativeInt(search.get("limit"), 100), 1000);
  const includeVoid = ["1", "true", "yes"].includes(
    asString(search.get("include_void")).toLowerCase(),
  );

  const baseQuery = supabase
    .from("promoter_settlements")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  const eventId = asString(search.get("event_id"));
  const promoterId = asString(search.get("promoter_id"));
  const status = asString(search.get("status"));
  let query =
    includeVoid || status === "void" ? baseQuery : applyNotDeleted(baseQuery);
  if (eventId) query = query.eq("event_id", eventId);
  if (promoterId) query = query.eq("promoter_id", promoterId);
  if (status) query = query.eq("status", status);

  const { data, error } = await query;
  if (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 400 },
    );
  }
  return NextResponse.json({ success: true, settlements: data || [] });
}

export async function POST(req: NextRequest) {
  const guard = await requireStaffRole(req);
  if (!guard.ok) {
    return NextResponse.json(
      { success: false, error: guard.error },
      { status: guard.status },
    );
  }
  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json(
      { success: false, error: "Supabase config missing" },
      { status: 500 },
    );
  }

  const body = await req.json().catch(() => ({}));
  const eventId = asString(body?.event_id);
  const promoterId = asString(body?.promoter_id);
  const status = normalizeStatus(body?.status);
  if (!eventId || !promoterId) {
    return NextResponse.json(
      { success: false, error: "event_id y promoter_id son requeridos" },
      { status: 400 },
    );
  }
  if (!status) {
    return NextResponse.json(
      { success: false, error: "status inválido" },
      { status: 400 },
    );
  }

  const items = normalizeItems(body?.items, eventId, promoterId);
  const cashUnits = asNonNegativeInt(
    body?.cash_units,
    items.filter((item) => Number(item.cash_amount_cents || 0) > 0).length,
  );
  const cashUnitAmountCents = asNonNegativeInt(body?.cash_unit_amount_cents);
  const itemCashTotalCents = items.reduce(
    (total, item) => total + asNonNegativeInt(item.cash_amount_cents),
    0,
  );
  const cashTotalCents = asNonNegativeInt(
    body?.cash_total_cents,
    itemCashTotalCents || cashUnits * cashUnitAmountCents,
  );
  const drinkUnits = asNonNegativeNumber(
    body?.drink_units,
    items.reduce(
      (total, item) => total + asNonNegativeNumber(item.drink_units),
      0,
    ),
  );

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    const existingItems = await findExistingItems(supabase, items);
    if (existingItems.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Uno o más tickets/reservas ya fueron liquidados",
          duplicates: existingItems,
        },
        { status: 409 },
      );
    }
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error?.message || "No se pudo validar duplicados",
      },
      { status: 400 },
    );
  }

  const now = new Date().toISOString();
  const settlementPayload = {
    event_id: eventId,
    promoter_id: promoterId,
    organizer_id: asString(body?.organizer_id) || null,
    event_name: asString(body?.event_name) || null,
    promoter_name: asString(body?.promoter_name) || null,
    promoter_code: asString(body?.promoter_code) || null,
    status,
    currency_code: asString(body?.currency_code) || "PEN",
    cash_unit_amount_cents: cashUnitAmountCents,
    cash_units: cashUnits,
    cash_total_cents: cashTotalCents,
    drink_units: drinkUnits,
    notes: asString(body?.notes) || null,
    metadata:
      body?.metadata && typeof body.metadata === "object" ? body.metadata : {},
    created_by_staff_id: guard.context?.staffId || null,
    settled_by_staff_id: ["paid", "delivered", "closed"].includes(status)
      ? guard.context?.staffId || null
      : null,
    settled_at: ["paid", "delivered", "closed"].includes(status) ? now : null,
  };

  const { data: settlement, error: settlementError } = await supabase
    .from("promoter_settlements")
    .insert(settlementPayload)
    .select("*")
    .single();
  if (settlementError || !settlement?.id) {
    return NextResponse.json(
      {
        success: false,
        error: settlementError?.message || "No se pudo crear la liquidación",
      },
      { status: 400 },
    );
  }

  if (items.length > 0) {
    const itemRows = items.map((item) => ({
      ...item,
      settlement_id: settlement.id,
    }));
    const { error: itemsError } = await supabase
      .from("promoter_settlement_items")
      .insert(itemRows);
    if (itemsError) {
      await supabase
        .from("promoter_settlements")
        .update({
          status: "void",
          voided_at: now,
          voided_by_staff_id: guard.context?.staffId || null,
          updated_at: now,
          metadata: {
            ...(settlementPayload.metadata as Record<string, unknown>),
            void_reason: "items_insert_failed",
          },
        })
        .eq("id", settlement.id);
      const duplicate =
        itemsError.code === "23505" ||
        String(itemsError.message || "")
          .toLowerCase()
          .includes("duplicate");
      return NextResponse.json(
        {
          success: false,
          error: duplicate
            ? "Uno o más tickets/reservas ya fueron liquidados"
            : itemsError.message,
        },
        { status: duplicate ? 409 : 400 },
      );
    }
  }

  return NextResponse.json({ success: true, settlement }, { status: 201 });
}
