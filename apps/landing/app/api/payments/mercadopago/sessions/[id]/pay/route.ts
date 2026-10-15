import { NextResponse } from "next/server";
import {
  authorizeMercadoPagoCheckout,
  readMercadoPagoCheckout,
  submitMercadoPagoPayment,
} from "lib/mercadopagoCheckoutServer";
import {
  mercadoPagoDatabase,
  mercadoPagoFailure,
  mercadoPagoBody,
} from "lib/mercadopagoRoute";
export const runtime = "nodejs";
export async function POST(
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
    await submitMercadoPagoPayment(db, session, await mercadoPagoBody(request));
    return NextResponse.json(
      {
        success: true,
        checkout: await readMercadoPagoCheckout(db, session, false),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return mercadoPagoFailure(error);
  }
}
