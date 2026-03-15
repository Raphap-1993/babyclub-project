import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { normalizeDocument, validateDocument, type DocumentType } from "shared/document";
import { applyNotDeleted } from "shared/db/softDelete";
import { ensureEventSalesDefaults, evaluateEventSales, isMissingEventSalesColumnsError } from "shared/eventSales";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
type TicketSalePhase = "early_bird" | "all_night";

const TICKET_PRICES_FALLBACK: Record<TicketSalePhase, Record<1 | 2, number>> = {
  early_bird: { 1: 15, 2: 25 },
  all_night: { 1: 20, 2: 35 },
};

const resolveActiveTicketSalePhase = (): TicketSalePhase => {
  const raw = (process.env.TICKET_SALE_PHASE || process.env.NEXT_PUBLIC_TICKET_SALE_PHASE || "early_bird")
    .trim()
    .toLowerCase();
  return raw === "all_night" ? "all_night" : "early_bird";
};

export async function POST(req: NextRequest) {
  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json({ success: false, error: "Supabase config missing" }, { status: 500 });
  }

  let body: any = null;
  try {
    body = await req.json();
  } catch (_err) {
    return NextResponse.json({ success: false, error: "Invalid JSON" }, { status: 400 });
  }

  const event_id = typeof body?.event_id === "string" ? body.event_id.trim() : "";
  const docTypeRaw = typeof body?.doc_type === "string" ? (body.doc_type as DocumentType) : "dni";
  const documentRaw = typeof body?.document === "string" ? body.document : "";
  const { docType, document } = normalizeDocument(docTypeRaw, documentRaw);
  const first_name = typeof body?.nombre === "string" ? body.nombre.trim() : "";
  const last_name_p = typeof body?.apellido_paterno === "string" ? body.apellido_paterno.trim() : "";
  const last_name_m = typeof body?.apellido_materno === "string" ? body.apellido_materno.trim() : "";
  const full_name = [first_name, last_name_p, last_name_m].filter(Boolean).join(" ").trim();
  const email = typeof body?.email === "string" ? body.email.trim() : "";
  const phone = typeof body?.telefono === "string" ? body.telefono.trim() : "";
  const voucher_url = typeof body?.voucher_url === "string" ? body.voucher_url.trim() : "";
  const quantityRaw = typeof body?.ticket_quantity === "number" ? body.ticket_quantity : parseInt(body?.ticket_quantity, 10);
  const ticket_quantity = Number.isFinite(quantityRaw) ? Math.floor(quantityRaw) : NaN;
  const pricingPhaseRaw =
    typeof body?.pricing_phase === "string" ? body.pricing_phase.trim().toLowerCase() : "";
  const activeTicketSalePhase = resolveActiveTicketSalePhase();
  const requestedTicketSalePhase: TicketSalePhase =
    pricingPhaseRaw === "all_night" ? "all_night" : pricingPhaseRaw === "early_bird" ? "early_bird" : activeTicketSalePhase;

  if (!event_id) {
    return NextResponse.json({ success: false, error: "event_id es requerido" }, { status: 400 });
  }
  if (ticket_quantity !== 1 && ticket_quantity !== 2) {
    return NextResponse.json({ success: false, error: "ticket_quantity debe ser 1 o 2" }, { status: 400 });
  }
  if (pricingPhaseRaw && pricingPhaseRaw !== "early_bird" && pricingPhaseRaw !== "all_night") {
    return NextResponse.json({ success: false, error: "pricing_phase inválido" }, { status: 400 });
  }
  if (!voucher_url) {
    return NextResponse.json({ success: false, error: "voucher_url es requerido" }, { status: 400 });
  }
  if (!validateDocument(docType, document)) {
    return NextResponse.json({ success: false, error: "Documento inválido" }, { status: 400 });
  }
  if (!first_name || !last_name_p || !last_name_m) {
    return NextResponse.json({ success: false, error: "Nombre y apellidos requeridos" }, { status: 400 });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const eventQuery = applyNotDeleted(
    supabase
      .from("events")
      .select("id,is_active,closed_at,sale_status,sale_public_message,early_bird_price_1,early_bird_price_2,all_night_price_1,all_night_price_2")
      .eq("id", event_id)
  );
  let { data: eventRow, error: eventError } = await eventQuery.maybeSingle();
  if (eventError && isMissingEventSalesColumnsError(eventError)) {
    const legacyQuery = applyNotDeleted(
      supabase.from("events").select("id,is_active,closed_at").eq("id", event_id)
    );
    const legacyResult = await legacyQuery.maybeSingle();
    eventRow = legacyResult.data as any;
    eventError = legacyResult.error;
  }

  if (eventError || !eventRow) {
    return NextResponse.json({ success: false, error: "Evento no encontrado" }, { status: 404 });
  }
  const saleDecision = evaluateEventSales(ensureEventSalesDefaults(eventRow as any));
  if (!saleDecision.available) {
    return NextResponse.json(
      {
        success: false,
        error: saleDecision.public_message || "La venta online no está disponible para este evento",
        code: "sales_blocked",
        sale_status: saleDecision.sale_status,
        sale_block_reason: saleDecision.block_reason,
        sale_public_message: saleDecision.public_message,
      },
      { status: 409 }
    );
  }

  const { data: reservation, error: resError } = await supabase
    .from("table_reservations")
    .insert({
      table_id: null,
      event_id: event_id,
      sale_origin: "ticket",
      ticket_pricing_phase: requestedTicketSalePhase,
      full_name,
      doc_type: docType,
      document,
      email: email || null,
      phone: phone || null,
      voucher_url,
      status: "pending",
      ticket_quantity,
    })
    .select("id")
    .single();

  if (resError) {
    return NextResponse.json({ success: false, error: resError.message }, { status: 500 });
  }

  const priceMap: Record<TicketSalePhase, Record<1 | 2, number>> = {
    early_bird: {
      1: Number((eventRow as any)?.early_bird_price_1) || TICKET_PRICES_FALLBACK.early_bird[1],
      2: Number((eventRow as any)?.early_bird_price_2) || TICKET_PRICES_FALLBACK.early_bird[2],
    },
    all_night: {
      1: Number((eventRow as any)?.all_night_price_1) || TICKET_PRICES_FALLBACK.all_night[1],
      2: Number((eventRow as any)?.all_night_price_2) || TICKET_PRICES_FALLBACK.all_night[2],
    },
  };

  return NextResponse.json({
    success: true,
    reservationId: reservation?.id,
    pricing_phase: requestedTicketSalePhase,
    amount: priceMap[requestedTicketSalePhase][ticket_quantity as 1 | 2],
  });
}
