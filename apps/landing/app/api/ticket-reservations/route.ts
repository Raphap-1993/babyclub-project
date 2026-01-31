import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { normalizeDocument, validateDocument, type DocumentType } from "shared/document";
import { applyNotDeleted } from "shared/db/softDelete";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

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
  const ticket_quantity = Number.isFinite(quantityRaw) ? Math.max(1, Math.min(2, Math.floor(quantityRaw))) : 1;

  if (!event_id) {
    return NextResponse.json({ success: false, error: "event_id es requerido" }, { status: 400 });
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

  const eventQuery = applyNotDeleted(supabase.from("events").select("id,is_active").eq("id", event_id));
  const { data: eventRow, error: eventError } = await eventQuery.maybeSingle();

  if (eventError || !eventRow) {
    return NextResponse.json({ success: false, error: "Evento no encontrado" }, { status: 404 });
  }
  if (eventRow.is_active === false) {
    return NextResponse.json({ success: false, error: "Evento inactivo" }, { status: 400 });
  }

  const { data: reservation, error: resError } = await supabase
    .from("table_reservations")
    .insert({
      table_id: null,
      event_id: event_id,
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

  return NextResponse.json({ success: true, reservationId: reservation?.id });
}
