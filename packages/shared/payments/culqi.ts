import { createHash } from "node:crypto";
import type {
  CreateGatewayOrderInput,
  CreateGatewayRefundInput,
  ParsedGatewayWebhook,
  PaymentGateway,
  PaymentStatus,
} from "./types";
import { PaymentServiceError } from "./errors";
import { buildWebhookEventKey, buildReceiptNumber } from "./utils";

export type CulqiPaymentStatus = PaymentStatus;
export type CulqiCreateOrderInput = CreateGatewayOrderInput;

type CulqiApiErrorShape = {
  merchant_message?: string;
  user_message?: string;
  object?: string;
  type?: string;
};

export function getCulqiConfig() {
  const secretKey = process.env.CULQI_SECRET_KEY || "";
  const apiBaseUrl =
    process.env.CULQI_API_BASE_URL || "https://api.culqi.com/v2";
  if (!secretKey) {
    throw new Error("Missing CULQI_SECRET_KEY");
  }
  return { secretKey, apiBaseUrl };
}

export function buildCulqiOrderPayload(input: CulqiCreateOrderInput) {
  return {
    amount: input.amount,
    currency_code: input.currencyCode || "PEN",
    description: input.description,
    order_number: input.orderNumber,
    client_details: {
      first_name: input.customer.firstName,
      last_name: input.customer.lastName,
      email: input.customer.email,
      phone_number: input.customer.phoneNumber,
    },
    expiration_date: input.expirationDateUnix,
    confirm: false,
    metadata: input.metadata || {},
  };
}

export async function createCulqiOrder(input: CulqiCreateOrderInput) {
  const { secretKey, apiBaseUrl } = getCulqiConfig();
  const payload = buildCulqiOrderPayload(input);
  const res = await fetch(`${apiBaseUrl}/orders`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
    cache: "no-store",
  });
  const data = await safeJson(res);
  if (!res.ok) {
    const errorData = (data || {}) as CulqiApiErrorShape;
    throw new Error(
      errorData.merchant_message ||
        errorData.user_message ||
        `Culqi order error (${res.status})`,
    );
  }
  return data;
}

export async function createCulqiRefund(input: {
  chargeId: string;
  amount: number;
  reason: string;
  metadata?: Record<string, unknown>;
}) {
  const { secretKey, apiBaseUrl } = getCulqiConfig();
  const res = await fetch(`${apiBaseUrl}/refunds`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      charge_id: input.chargeId,
      amount: input.amount,
      reason: input.reason,
      metadata: input.metadata || {},
    }),
    cache: "no-store",
  });
  const data = await safeJson(res);
  if (!res.ok) {
    const errorData = (data || {}) as CulqiApiErrorShape;
    throw new Error(
      errorData.merchant_message ||
        errorData.user_message ||
        `Culqi refund error (${res.status})`,
    );
  }
  return data;
}

async function safeJson(res: Response) {
  try {
    return await res.json();
  } catch (_err) {
    return null;
  }
}

export function normalizeCulqiStatus(
  rawValue: string | null | undefined,
): CulqiPaymentStatus {
  const raw = `${rawValue || ""}`.toLowerCase();
  if (raw.includes("paid")) return "paid";
  if (raw.includes("refund")) return "refunded";
  if (raw.includes("fail") || raw.includes("declin")) return "failed";
  if (raw.includes("expir")) return "expired";
  if (raw.includes("cancel")) return "canceled";
  return "pending";
}

export function resolveCulqiEventName(payload: any): string {
  return payload?.event_name || payload?.event || payload?.type || "";
}

export function resolveCulqiEventId(payload: any): string | null {
  return (
    payload?.id ||
    payload?.event_id ||
    payload?.data?.id ||
    payload?.data?.object?.id ||
    null
  );
}

export function resolveCulqiOrder(payload: any) {
  const obj = payload?.data?.object || payload?.data || payload || {};
  const metadata =
    obj?.metadata && typeof obj.metadata === "object" ? obj.metadata : {};
  return {
    orderId: obj?.id || obj?.order_id || payload?.order_id || null,
    chargeId: obj?.charge_id || payload?.charge_id || null,
    statusRaw: obj?.status || payload?.status || "",
    amount: typeof obj?.amount === "number" ? obj.amount : null,
    currencyCode:
      typeof obj?.currency_code === "string" ? obj.currency_code : "PEN",
    customerEmail: obj?.client_details?.email || obj?.email || null,
    customerName:
      obj?.client_details?.first_name && obj?.client_details?.last_name
        ? `${obj.client_details.first_name} ${obj.client_details.last_name}`.trim()
        : obj?.full_name || null,
    customerPhone:
      obj?.client_details?.phone_number || obj?.phone_number || null,
    metadata: metadata as Record<string, unknown>,
  };
}

/**
 * Verifies the Culqi webhook signature using HMAC-SHA256.
 * Culqi signs the raw body with CULQI_WEBHOOK_SECRET and sends it
 * in the x-culqi-signature header.
 *
 * Returns true if valid, false if invalid.
 * Returns null if CULQI_WEBHOOK_SECRET is not configured (skip verification).
 */
export function verifyCulqiWebhookSignature(
  rawBody: string,
  signature: string | null,
): boolean | null {
  const secret = process.env.CULQI_WEBHOOK_SECRET || "";
  if (!secret) return null; // not configured — skip
  if (!signature) return false;
  const expected = createHash("sha256")
    .update(secret)
    .update(rawBody)
    .digest("hex");
  return signature === expected;
}

function parseCulqiWebhook(
  rawBody: string,
  headers: { get(name: string): string | null },
): ParsedGatewayWebhook {
  let payload: any = null;
  try {
    payload = JSON.parse(rawBody);
  } catch (_error) {
    throw new PaymentServiceError("Invalid webhook payload", 400);
  }

  const eventName = resolveCulqiEventName(payload) || "unknown";
  const eventId = resolveCulqiEventId(payload);
  const signature = headers.get("x-culqi-signature") || null;
  const signatureValid = verifyCulqiWebhookSignature(rawBody, signature);
  const orderData = resolveCulqiOrder(payload);

  return {
    eventName,
    eventId,
    eventKey: buildWebhookEventKey("culqi", rawBody, eventId),
    signature,
    signatureValid,
    orderId: orderData.orderId,
    chargeId: orderData.chargeId,
    status: normalizeCulqiStatus(orderData.statusRaw),
    amount: orderData.amount,
    currencyCode: orderData.currencyCode || "PEN",
    customerEmail: orderData.customerEmail,
    customerName: orderData.customerName,
    customerPhone: orderData.customerPhone,
    metadata: orderData.metadata,
    raw: payload,
  };
}

export const culqiGateway: PaymentGateway = {
  provider: "culqi",
  isEnabled() {
    return (
      process.env.ENABLE_CULQI_PAYMENTS?.toLowerCase() === "true" &&
      Boolean(process.env.CULQI_SECRET_KEY?.trim())
    );
  },
  async createOrder(input: CreateGatewayOrderInput) {
    const raw = await createCulqiOrder(input);
    const orderId = typeof (raw as any)?.id === "string" ? (raw as any).id : "";
    if (!orderId) {
      throw new PaymentServiceError(
        "Respuesta invalida de Culqi (sin order id)",
        502,
      );
    }
    return { orderId, raw };
  },
  async createRefund(input: CreateGatewayRefundInput) {
    const raw = await createCulqiRefund(input);
    return { raw };
  },
  parseWebhook(input) {
    return parseCulqiWebhook(input.rawBody, input.headers);
  },
};

export { buildReceiptNumber, buildWebhookEventKey };
