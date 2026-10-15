import { createHash } from "node:crypto";
import { PaymentServiceError } from "./errors";

export function getMercadoPagoConfig(checkout = false) {
  const env = process.env;
  // This release is deliberately limited to sandbox + the isolated database.
  let localDatabase = false;
  try {
    localDatabase = ["localhost", "127.0.0.1", "[::1]"].includes(
      new URL(env.SUPABASE_URL || "").hostname,
    );
  } catch {}
  if (
    !localDatabase ||
    env.MERCADOPAGO_ENVIRONMENT !== "test" ||
    !env.MERCADOPAGO_ACCESS_TOKEN?.trim() ||
    !env.MERCADOPAGO_PUBLIC_KEY?.trim() ||
    !env.MERCADOPAGO_COLLECTOR_ID?.trim() ||
    !env.MERCADOPAGO_TEST_APPLICATION_ID?.trim() ||
    (checkout && env.ENABLE_MERCADOPAGO_PAYMENTS !== "true")
  ) {
    throw new PaymentServiceError(
      "Mercado Pago no está habilitado para esta compra",
      503,
      "mercadopago_disabled",
    );
  }
  return {
    environment: "test" as const,
    accessToken: env.MERCADOPAGO_ACCESS_TOKEN.trim(),
    publicKey: env.MERCADOPAGO_PUBLIC_KEY.trim(),
    collectorId: env.MERCADOPAGO_COLLECTOR_ID.trim(),
    applicationId: env.MERCADOPAGO_TEST_APPLICATION_ID.trim(),
    primaryApplicationId: env.MERCADOPAGO_APPLICATION_ID?.trim() || "",
    webhookSecret: env.MERCADOPAGO_WEBHOOK_SECRET?.trim() || "",
  };
}

export function getMercadoPagoPublicStatus() {
  try {
    const config = getMercadoPagoConfig(true);
    return { enabled: true, environment: "test", publicKey: config.publicKey };
  } catch {
    return { enabled: false, environment: "test", publicKey: "" };
  }
}

export function hashCheckoutToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function readOnlineCheckoutRequest(body: any) {
  getMercadoPagoConfig(true);
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      body?.checkout_request_id || "",
    ) ||
    !/^[a-f0-9]{64}$/.test(body?.checkout_token || "")
  ) {
    throw new PaymentServiceError(
      "No se pudo identificar la sesión de compra. Vuelve a intentarlo.",
      400,
    );
  }
  if (!body.email?.trim())
    throw new PaymentServiceError(
      "Ingresa tu correo para recibir las entradas",
      400,
    );
  return {
    online_checkout_key: body.checkout_request_id,
    online_checkout_token_hash: hashCheckoutToken(body.checkout_token),
    online_checkout_expires_at: new Date(
      Date.now() + 20 * 60_000,
    ).toISOString(),
  };
}
