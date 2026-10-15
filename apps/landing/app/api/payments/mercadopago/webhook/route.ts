import { NextResponse } from "next/server";
import { processMercadoPagoWebhook } from "lib/mercadopagoCheckoutServer";
import {
  mercadoPagoDatabase,
  mercadoPagoFailure,
  mercadoPagoBody,
} from "lib/mercadopagoRoute";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    const result = await processMercadoPagoWebhook(mercadoPagoDatabase(), {
      body: await mercadoPagoBody(request),
      headers: request.headers,
      search: new URL(request.url).searchParams,
    });
    return NextResponse.json(result);
  } catch (error) {
    return mercadoPagoFailure(error);
  }
}
