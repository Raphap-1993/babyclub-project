import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { applyNotDeleted } from "shared/db/softDelete";
import { ensureEventSalesDefaults, evaluateEventSales, isMissingEventSalesColumnsError } from "shared/eventSales";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function GET(req: NextRequest) {
  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json({ error: "Missing Supabase config" }, { status: 500 });
  }

  const code = req.nextUrl.searchParams.get("code")?.trim();
  if (!code) return NextResponse.json({ error: "code required" }, { status: 400 });

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const codeQuery = applyNotDeleted(
    supabase.from("codes").select("code,type,promoter_id,event_id,is_active,expires_at").eq("code", code)
  );
  const { data, error } = await codeQuery.maybeSingle();

  if (error || !data) {
    return NextResponse.json({ error: "Código no encontrado" }, { status: 404 });
  }

  let sale_status: "on_sale" | "sold_out" | "paused" = "on_sale";
  let sale_block_reason: string | null = null;
  let sale_public_message: string | null = null;
  let sales_available = true;

  if (data.event_id) {
    const eventQuery = applyNotDeleted(
      supabase
        .from("events")
        .select("id,is_active,closed_at,sale_status,sale_public_message")
        .eq("id", data.event_id)
    );
    let { data: eventRow, error: eventError } = await eventQuery.maybeSingle();
    if (eventError && isMissingEventSalesColumnsError(eventError)) {
      const legacyQuery = applyNotDeleted(
        supabase.from("events").select("id,is_active,closed_at").eq("id", data.event_id)
      );
      const legacyResult = await legacyQuery.maybeSingle();
      eventRow = legacyResult.data as any;
    }
    const saleDecision = evaluateEventSales(ensureEventSalesDefaults((eventRow || {}) as any));
    sale_status = saleDecision.sale_status;
    sale_block_reason = saleDecision.block_reason;
    sale_public_message = saleDecision.public_message;
    sales_available = saleDecision.available;
  }

  return NextResponse.json({
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
  });
}
