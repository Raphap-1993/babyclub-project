import { NextRequest, NextResponse } from "next/server";
import { toPaymentServiceError } from "shared/payments/errors";
import { getPaymentReceipt } from "shared/payments/service";
import { createPaymentsAdminClient } from "shared/payments/supabase";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  try {
    const response = await getPaymentReceipt({
      supabase: createPaymentsAdminClient(),
      paymentId: searchParams.get("payment_id")?.trim() || "",
      orderId: searchParams.get("order_id")?.trim() || "",
      providerName:
        searchParams.get("provider")?.trim().toLowerCase() || undefined,
    });

    return NextResponse.json(response);
  } catch (error) {
    const handled = toPaymentServiceError(error);
    const payload: Record<string, unknown> = {
      success: false,
      error: handled.message,
    };
    if (handled.code) payload.code = handled.code;
    return NextResponse.json(payload, { status: handled.status });
  }
}
