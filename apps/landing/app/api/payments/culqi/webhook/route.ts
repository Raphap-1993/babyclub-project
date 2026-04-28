import { NextRequest, NextResponse } from "next/server";
import { toPaymentServiceError } from "shared/payments/errors";
import { processPaymentWebhook } from "shared/payments/service";
import { createPaymentsAdminClient } from "shared/payments/supabase";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const response = await processPaymentWebhook({
      supabase: createPaymentsAdminClient(),
      providerName: "culqi",
      rawBody: await req.text(),
      headers: req.headers,
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
