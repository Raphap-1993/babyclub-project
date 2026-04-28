import { NextRequest, NextResponse } from "next/server";
import { requireStaffRole } from "shared/auth/requireStaff";
import { toPaymentServiceError } from "shared/payments/errors";
import { refundPayment } from "shared/payments/service";
import { createPaymentsAdminClient } from "shared/payments/supabase";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const guard = await requireStaffRole(req, ["admin", "superadmin"]);
  if (!guard.ok) {
    return NextResponse.json(
      { success: false, error: guard.error },
      { status: guard.status },
    );
  }

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
    const response = await refundPayment({
      supabase: createPaymentsAdminClient(),
      providerName: "culqi",
      paymentId:
        typeof body?.payment_id === "string" ? body.payment_id.trim() : "",
      amount: body?.amount != null ? Number(body.amount) : null,
      reason:
        typeof body?.reason === "string"
          ? body.reason.trim()
          : "requested_by_client",
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
