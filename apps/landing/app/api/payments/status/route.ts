import { getMercadoPagoPublicStatus } from "shared/payments/mercadopagoConfig";
import { NextResponse } from "next/server";
import { getPaymentGateway } from "shared/payments/registry";
import { readMercadoPagoSalesControl } from "shared/payments/mercadopagoSalesControl";
import { mercadoPagoDatabase } from "../../../../lib/mercadopagoRoute";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getCulqiStatus() {
  const publicKey = process.env.NEXT_PUBLIC_CULQI_PUBLIC_KEY?.trim() || "";
  const gateway = getPaymentGateway("culqi");
  const enabled = gateway.isCheckoutEnabled() && publicKey.length > 0;

  return {
    enabled,
    publicKey: enabled ? publicKey : "",
    publicKeyConfigured: publicKey.length > 0,
  };
}

export async function GET() {
  const configured = getMercadoPagoPublicStatus();
  let salesPaused = false;
  let salesControlAvailable = true;
  if (configured.enabled) {
    try {
      salesPaused = (await readMercadoPagoSalesControl(mercadoPagoDatabase()))
        .paused;
    } catch {
      salesPaused = true;
      salesControlAvailable = false;
    }
  }
  return NextResponse.json(
    {
      success: true,
      providers: {
        culqi: getCulqiStatus(),
        mercadopago: {
          ...configured,
          configured: configured.enabled,
          enabled: configured.enabled && !salesPaused,
          salesPaused,
          salesControlAvailable,
        },
      },
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
