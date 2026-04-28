import { NextResponse } from "next/server";
import { getPaymentGateway } from "shared/payments/registry";

export const runtime = "nodejs";

function getCulqiStatus() {
  const publicKey = process.env.NEXT_PUBLIC_CULQI_PUBLIC_KEY?.trim() || "";
  const gateway = getPaymentGateway("culqi");
  const enabled = gateway.isEnabled() && publicKey.length > 0;

  return {
    enabled,
    publicKey: enabled ? publicKey : "",
    publicKeyConfigured: publicKey.length > 0,
  };
}

export async function GET() {
  return NextResponse.json({
    success: true,
    providers: {
      culqi: getCulqiStatus(),
    },
  });
}
