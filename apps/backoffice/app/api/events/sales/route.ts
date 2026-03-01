import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireStaffRole } from "shared/auth/requireStaff";
import { applyNotDeleted } from "shared/db/softDelete";
import { isMissingEventSalesColumnsError, normalizeEventSaleStatus } from "shared/eventSales";
import { logProcessEvent } from "../../logs/logger";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const ALLOWED_STATUSES = new Set(["on_sale", "sold_out", "paused"]);

export async function POST(req: NextRequest) {
  const guard = await requireStaffRole(req, ["admin", "superadmin"]);
  if (!guard.ok) {
    return NextResponse.json({ success: false, error: guard.error }, { status: guard.status });
  }

  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json({ success: false, error: "Supabase config missing" }, { status: 500 });
  }

  let body: any = null;
  try {
    body = await req.json();
  } catch (_err) {
    return NextResponse.json({ success: false, error: "Invalid JSON" }, { status: 400 });
  }

  const id = typeof body?.id === "string" ? body.id.trim() : "";
  const statusRaw = typeof body?.sale_status === "string" ? body.sale_status.trim() : "";
  const sale_status = normalizeEventSaleStatus(statusRaw || "on_sale");
  const sale_public_message =
    typeof body?.sale_public_message === "string" && body.sale_public_message.trim().length > 0
      ? body.sale_public_message.trim()
      : null;

  if (!id) {
    return NextResponse.json({ success: false, error: "id is required" }, { status: 400 });
  }

  if (!ALLOWED_STATUSES.has(sale_status)) {
    return NextResponse.json({ success: false, error: "sale_status inválido" }, { status: 400 });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  let eventQuery = applyNotDeleted(
    supabase.from("events").select("id,name,sale_status,sale_public_message").eq("id", id)
  );
  let { data: eventRow, error: eventError } = await eventQuery.maybeSingle();
  if (eventError && isMissingEventSalesColumnsError(eventError)) {
    eventQuery = applyNotDeleted(
      supabase.from("events").select("id,name").eq("id", id)
    );
    const legacyResult = await eventQuery.maybeSingle();
    eventRow = legacyResult.data as any;
    eventError = legacyResult.error;
    if (!eventError && eventRow) {
      return NextResponse.json(
        {
          success: false,
          error: "Debes ejecutar la migración de ventas para usar sold out/pausa comercial.",
          code: "sales_columns_missing",
        },
        { status: 409 }
      );
    }
  }
  if (eventError || !eventRow) {
    return NextResponse.json({ success: false, error: "Evento no encontrado" }, { status: 404 });
  }

  const payload = {
    sale_status,
    sale_public_message,
    sale_updated_at: new Date().toISOString(),
    sale_updated_by: guard.context?.staffId || null,
  };

  const { error: updateError } = await supabase.from("events").update(payload).eq("id", id);
  if (updateError && isMissingEventSalesColumnsError(updateError)) {
    return NextResponse.json(
      {
        success: false,
        error: "Debes ejecutar la migración de ventas para usar sold out/pausa comercial.",
        code: "sales_columns_missing",
      },
      { status: 409 }
    );
  }
  if (updateError) {
    await logProcessEvent({
      supabase,
      category: "events",
      action: "update_sale_status",
      status: "error",
      message: updateError.message,
      meta: { event_id: id, sale_status, sale_public_message },
    });
    return NextResponse.json({ success: false, error: updateError.message }, { status: 500 });
  }

  await logProcessEvent({
    supabase,
    category: "events",
    action: "update_sale_status",
    status: "success",
    message: `Estado comercial de evento ${eventRow.name || id}: ${sale_status}`,
    meta: {
      event_id: id,
      sale_status,
      sale_public_message,
      previous_sale_status: (eventRow as any)?.sale_status || null,
      previous_sale_public_message: (eventRow as any)?.sale_public_message || null,
    },
  });

  return NextResponse.json({
    success: true,
    event: {
      id,
      sale_status,
      sale_public_message,
    },
  });
}
