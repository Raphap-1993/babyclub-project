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
    supabase.from("codes").select("id,code,type,promoter_id,event_id,is_active,expires_at").eq("code", code)
  );
  const { data, error } = await codeQuery.maybeSingle();

  if (error || !data) {
    return NextResponse.json({ error: "Código no encontrado" }, { status: 404 });
  }

  let sale_status: "on_sale" | "sold_out" | "paused" = "on_sale";
  let sale_block_reason: string | null = null;
  let sale_public_message: string | null = null;
  let sales_available = true;
  let registered_person: {
    first_name: string | null;
    last_name: string | null;
    email: string | null;
    phone: string | null;
    doc_type: string | null;
    document: string | null;
    ticket_id: string | null;
    ticket_event_id: string | null;
  } | null = null;

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

  if (data.id) {
    const ticketsQuery = applyNotDeleted(
      supabase
        .from("tickets")
        .select(
          "id,event_id,status,doc_type,document,dni,full_name,email,phone,person:persons(first_name,last_name,email,phone,doc_type,document,dni)"
        )
        .eq("code_id", data.id)
        // Legacy rows may have status = null and must still be treated as active.
        .or("status.is.null,status.neq.cancelled")
        .order("created_at", { ascending: false })
        .limit(2)
    );
    const { data: ticketsData } = await ticketsQuery;

    // Only prefill when the code has exactly one active ticket owner.
    if (Array.isArray(ticketsData) && ticketsData.length === 1) {
      const ticketRow: any = ticketsData[0];
      const personRel = Array.isArray(ticketRow?.person) ? ticketRow.person[0] : ticketRow?.person;
      const fullName = String(ticketRow?.full_name || "").trim();
      const nameParts = fullName.split(/\s+/).filter(Boolean);
      const fallbackFirstName = nameParts.length > 0 ? nameParts[0] : null;
      const fallbackLastName = nameParts.length > 1 ? nameParts.slice(1).join(" ") : null;

      registered_person = {
        first_name: personRel?.first_name ?? fallbackFirstName,
        last_name: personRel?.last_name ?? fallbackLastName,
        email: ticketRow?.email ?? personRel?.email ?? null,
        phone: ticketRow?.phone ?? personRel?.phone ?? null,
        doc_type: ticketRow?.doc_type ?? personRel?.doc_type ?? ((ticketRow?.document || ticketRow?.dni) ? "dni" : null),
        document: ticketRow?.document ?? ticketRow?.dni ?? personRel?.document ?? personRel?.dni ?? null,
        ticket_id: ticketRow?.id ?? null,
        ticket_event_id: ticketRow?.event_id ?? null,
      };
    }
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
    registered_person,
  });
}
