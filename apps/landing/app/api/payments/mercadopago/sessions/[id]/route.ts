import { NextResponse } from "next/server";
import {
  authorizeMercadoPagoCheckout,
  readMercadoPagoCheckout,
} from "lib/mercadopagoCheckoutServer";
import { mercadoPagoDatabase, mercadoPagoFailure } from "lib/mercadopagoRoute";
export const runtime = "nodejs";
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const db = mercadoPagoDatabase();
    const session = await authorizeMercadoPagoCheckout(
      db,
      (await context.params).id,
      request.headers.get("authorization"),
    );
    return NextResponse.json(
      { success: true, checkout: await readMercadoPagoCheckout(db, session) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return mercadoPagoFailure(error);
  }
}
