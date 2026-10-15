import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { PaymentServiceError } from "shared/payments/errors";

export function mercadoPagoDatabase() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY)
    throw new PaymentServiceError("Servicio de compra no disponible", 503);
  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
export function mercadoPagoFailure(error: unknown) {
  const failure =
    error instanceof PaymentServiceError
      ? error
      : new PaymentServiceError(
          "No pudimos verificar la compra. Conserva esta página para consultar su estado.",
          503,
        );
  return NextResponse.json(
    { success: false, error: failure.message, code: failure.code },
    { status: failure.status, headers: { "Cache-Control": "no-store" } },
  );
}
export async function mercadoPagoBody(request: Request) {
  const text = await request.text();
  if (text.length > 16_384)
    throw new PaymentServiceError("Solicitud demasiado grande", 413);
  try {
    return JSON.parse(text);
  } catch {
    throw new PaymentServiceError("Solicitud inválida", 400);
  }
}
