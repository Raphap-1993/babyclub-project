import { createHash } from "node:crypto";
import { PaymentServiceError } from "./errors";

export function getMercadoPagoConfig(checkout = false) {
  const env = process.env;
  const environment = env.MERCADOPAGO_ENVIRONMENT;
  let localDatabase = false;
  let liveDeployment = false;
  try {
    const database = new URL(env.SUPABASE_URL || "");
    localDatabase = ["localhost", "127.0.0.1", "[::1]"].includes(
      database.hostname,
    );
    const site = new URL(env.NEXT_PUBLIC_APP_URL || "");
    // Explicit targets prevent a preview or a developer laptop from charging
    // against the real merchant/database by accidentally copying an env file.
    liveDeployment =
      env.VERCEL_ENV === "production" &&
      !localDatabase &&
      database.protocol === "https:" &&
      !database.username &&
      !database.password &&
      database.origin === env.MERCADOPAGO_PRODUCTION_SUPABASE_URL &&
      site.protocol === "https:" &&
      !site.username &&
      !site.password &&
      site.origin === env.MERCADOPAGO_PRODUCTION_ORIGIN &&
      env.BABY_EMAIL_TRANSPORT !== "mailpit" &&
      Boolean(env.RESEND_API_KEY?.trim()) &&
      (env.MERCADOPAGO_WEBHOOK_SECRET?.trim().length || 0) >= 32 &&
      (env.MERCADOPAGO_WORKER_SECRET?.trim().length || 0) >= 32;
  } catch {}
  const applicationId =
    environment === "live"
      ? env.MERCADOPAGO_APPLICATION_ID?.trim()
      : env.MERCADOPAGO_TEST_APPLICATION_ID?.trim();
  if (
    !(
      (environment === "test" && localDatabase && !env.VERCEL_ENV) ||
      (environment === "live" && liveDeployment)
    ) ||
    !env.MERCADOPAGO_ACCESS_TOKEN?.trim() ||
    !env.MERCADOPAGO_PUBLIC_KEY?.trim() ||
    !env.MERCADOPAGO_COLLECTOR_ID?.trim() ||
    !applicationId ||
    (checkout && env.ENABLE_MERCADOPAGO_PAYMENTS !== "true")
  ) {
    throw new PaymentServiceError(
      "Mercado Pago no está habilitado para esta compra",
      503,
      "mercadopago_disabled",
    );
  }
  return {
    environment: environment as "test" | "live",
    accessToken: env.MERCADOPAGO_ACCESS_TOKEN.trim(),
    publicKey: env.MERCADOPAGO_PUBLIC_KEY.trim(),
    collectorId: env.MERCADOPAGO_COLLECTOR_ID.trim(),
    applicationId,
    primaryApplicationId: env.MERCADOPAGO_APPLICATION_ID?.trim() || "",
    webhookSecret: env.MERCADOPAGO_WEBHOOK_SECRET?.trim() || "",
  };
}

export function getMercadoPagoPublicStatus() {
  try {
    const config = getMercadoPagoConfig(true);
    return {
      enabled: true,
      environment: config.environment,
      publicKey: config.publicKey,
    };
  } catch {
    return { enabled: false, environment: null, publicKey: "" };
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
