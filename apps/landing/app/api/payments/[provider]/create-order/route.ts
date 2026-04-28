import { NextRequest, NextResponse } from "next/server";
import { toPaymentServiceError } from "shared/payments/errors";
import { createPaymentOrder } from "shared/payments/service";
import { createPaymentsAdminClient } from "shared/payments/supabase";

export const runtime = "nodejs";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ provider: string }> },
) {
  let body: any = null;
  try {
    body = await req.json();
  } catch (_error) {
    return NextResponse.json(
      { success: false, error: "Invalid JSON" },
      { status: 400 },
    );
  }

  try {
    const { provider } = await params;
    const response = await createPaymentOrder({
      supabase: createPaymentsAdminClient(),
      providerName: provider,
      body,
      idempotencyKey: req.headers.get("idempotency-key")?.trim() || undefined,
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
