import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireStaffRole } from "shared/auth/requireStaff";
import { ADMIN_ROLES } from "shared/auth/roles";
import {
  DOCUMENT_TYPES,
  normalizeDocument,
  validateDocument,
} from "shared/document";
import { isValidEmailAddress } from "shared/email/address";

const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const errors: Record<string, string> = {
  manual_sale_forbidden:
    "Tu usuario no tiene permiso para registrar ventas manuales. Solicita la revisión de tu rol de administrador.",
  buyer_checkout_exists:
    "El comprador tiene un pago online en curso. Revisa esa compra antes de registrar otra venta.",
  buyer_ticket_exists:
    "El comprador ya tiene un QR activo para este evento. No se modificó su entrada existente.",
  reservation_table_active: "La mesa ya fue reservada. Elige otra mesa.",
  table_unavailable: "La mesa no está disponible para este evento.",
  product_unavailable: "El pack ya no está disponible.",
  event_unavailable: "El evento no está disponible.",
  ticket_type_unavailable: "El tipo de entrada ya no está disponible.",
  invalid_sale_price: "La venta necesita un precio válido configurado.",
  sale_price_changed:
    "El precio cambió. Actualiza la selección antes de registrar la venta.",
  event_capacity_exceeded: "El evento no tiene capacidad disponible.",
  manual_request_conflict:
    "Esta solicitud ya se utilizó con otros datos. Recarga y revisa la venta registrada.",
};
export async function POST(req: NextRequest) {
  const guard = await requireStaffRole(req, ADMIN_ROLES);
  if (!guard.ok)
    return NextResponse.json(
      { success: false, error: guard.error },
      { status: guard.status },
    );
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "Datos inválidos." },
      { status: 400 },
    );
  }
  const { docType, document } = normalizeDocument(
    body?.doc_type,
    body?.document,
  );
  const name = String(body?.full_name || "").trim();
  const email = String(body?.email || "")
    .trim()
    .toLowerCase();
  const method = body?.payment_method;
  if (
    !uuid.test(body?.request_id || "") ||
    !uuid.test(body?.event_id || "") ||
    (body?.table_id && !uuid.test(body.table_id)) ||
    (body?.product_id && !uuid.test(body.product_id)) ||
    !DOCUMENT_TYPES.some((t) => t.value === docType) ||
    !validateDocument(docType, document) ||
    name.length < 3 ||
    name.length > 150 ||
    !isValidEmailAddress(email) ||
    email.length > 254 ||
    !["cash", "yape", "transfer", "card_external"].includes(method) ||
    body?.received !== true ||
    !Number.isInteger(body?.package_quantity) ||
    body.package_quantity < 1 ||
    body.package_quantity > 10 ||
    !Number.isSafeInteger(body?.expected_amount_cents) ||
    body.expected_amount_cents <= 0 ||
    (method !== "cash" && String(body?.reference || "").trim().length < 3) ||
    String(body?.reference || "").length > 150 ||
    String(body?.notes || "").length > 1000 ||
    String(body?.phone || "").length > 30 ||
    (!body?.table_id &&
      (!body?.ticket_type_code || String(body.ticket_type_code).length > 80))
  ) {
    return NextResponse.json(
      {
        success: false,
        error:
          "Completa los datos, el importe y la confirmación del cobro recibido.",
      },
      { status: 400 },
    );
  }
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY)
    return NextResponse.json(
      { success: false, error: "Configuración no disponible." },
      { status: 503 },
    );
  const db = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } },
  );
  const payload = {
    event_id: body.event_id,
    table_id: body.table_id || null,
    product_id: body.product_id || null,
    ticket_type_code: body.table_id ? null : body.ticket_type_code,
    package_quantity: body.package_quantity,
    expected_amount_cents: body.expected_amount_cents,
    full_name: name,
    email,
    phone: String(body.phone || "").trim(),
    doc_type: docType,
    document,
    payment_method: method,
    reference: String(body.reference || "").trim(),
    notes: String(body.notes || "").trim(),
    received: true,
  };
  const result = await db.rpc("record_manual_sale", {
    p_request: body.request_id,
    p_staff: guard.context.staffId,
    p_payload: payload,
  });
  if (result.error) {
    const message = result.error.message.includes(
      "payments_manual_reference_uidx",
    )
      ? "Esta referencia de cobro ya fue registrada. Revisa la venta existente."
      : errors[result.error.message];
    if (!message)
      console.error("[manual-sales] transaction_failed", {
        code: result.error.code,
      });
    return NextResponse.json(
      {
        success: false,
        error:
          message ||
          "No se pudo registrar la venta. Reintenta con la misma solicitud; no se duplicará el cobro registrado.",
      },
      {
        status:
          result.error.message === "manual_sale_forbidden"
            ? 403
            : message
              ? 409
              : 500,
      },
    );
  }
  return NextResponse.json({ success: true, ...result.data });
}
