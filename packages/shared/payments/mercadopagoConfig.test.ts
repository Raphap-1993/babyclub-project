import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getMercadoPagoConfig,
  getMercadoPagoPublicStatus,
  hashCheckoutToken,
  readOnlineCheckoutRequest,
} from "./mercadopagoConfig";
describe("Mercado Pago environment boundary", () => {
  beforeEach(() => {
    for (const [key, value] of Object.entries({
      SUPABASE_URL: "http://127.0.0.1:64321",
      MERCADOPAGO_ENVIRONMENT: "test",
      MERCADOPAGO_ACCESS_TOKEN: "APP_USR-sandbox-fixture",
      MERCADOPAGO_PUBLIC_KEY: "APP_USR-public-fixture",
      MERCADOPAGO_COLLECTOR_ID: "123",
      MERCADOPAGO_TEST_APPLICATION_ID: "456",
      ENABLE_MERCADOPAGO_PAYMENTS: "true",
      VERCEL_ENV: "",
    }))
      vi.stubEnv(key, value);
  });
  afterEach(() => vi.unstubAllEnvs());
  it("accepts sandbox APP_USR credentials without relying on the token prefix", () => {
    expect(getMercadoPagoConfig(true).applicationId).toBe("456");
  });
  it("blocks any remote database even with test credentials", () => {
    vi.stubEnv("SUPABASE_URL", "https://production.supabase.co");
    expect(() => getMercadoPagoConfig()).toThrow();
    expect(getMercadoPagoPublicStatus().enabled).toBe(false);
  });
  it("blocks live mode against the local database", () => {
    vi.stubEnv("MERCADOPAGO_ENVIRONMENT", "live");
    expect(() => getMercadoPagoConfig()).toThrow();
  });
  function live() {
    for (const [key, value] of Object.entries({
      SUPABASE_URL: "https://baby-fixture.supabase.co",
      NEXT_PUBLIC_APP_URL: "https://baby.example",
      MERCADOPAGO_PRODUCTION_SUPABASE_URL: "https://baby-fixture.supabase.co",
      MERCADOPAGO_PRODUCTION_ORIGIN: "https://baby.example",
      MERCADOPAGO_ENVIRONMENT: "live",
      VERCEL_ENV: "production",
      MERCADOPAGO_APPLICATION_ID: "789",
      MERCADOPAGO_WEBHOOK_SECRET: "s".repeat(64),
      MERCADOPAGO_WORKER_SECRET: "w".repeat(64),
      RESEND_API_KEY: "fixture",
      BABY_EMAIL_TRANSPORT: "resend",
    }))
      vi.stubEnv(key, value);
  }
  it("uses the real application only for an explicitly bound production deployment", () => {
    live();
    expect(getMercadoPagoConfig(true).applicationId).toBe("789");
    expect(getMercadoPagoPublicStatus()).toMatchObject({
      enabled: true,
      environment: "live",
    });
  });
  it.each([
    ["VERCEL_ENV", "preview"],
    ["VERCEL_ENV", ""],
    ["SUPABASE_URL", "https://wrong.supabase.co"],
    ["NEXT_PUBLIC_APP_URL", "http://baby.example"],
    ["NEXT_PUBLIC_APP_URL", "https://preview.example"],
    ["MERCADOPAGO_WEBHOOK_SECRET", ""],
    ["MERCADOPAGO_WORKER_SECRET", "short"],
    ["RESEND_API_KEY", ""],
    ["BABY_EMAIL_TRANSPORT", "mailpit"],
  ])("fails closed when production config %s is invalid", (key, value) => {
    live();
    vi.stubEnv(key, value);
    expect(() => getMercadoPagoConfig(true)).toThrow();
  });
  it("stops live new sales without disabling settlement of previously paid purchases", () => {
    live();
    vi.stubEnv("ENABLE_MERCADOPAGO_PAYMENTS", "false");
    expect(() => getMercadoPagoConfig(true)).toThrow();
    expect(getMercadoPagoConfig().environment).toBe("live");
  });
  it("kill switch disables new checkout but permits reconciliation", () => {
    vi.stubEnv("ENABLE_MERCADOPAGO_PAYMENTS", "false");
    expect(() => getMercadoPagoConfig(true)).toThrow();
    expect(getMercadoPagoConfig().environment).toBe("test");
  });
  it("requires an unguessable token and stores only its hash", () => {
    const token = "a".repeat(64);
    const result = readOnlineCheckoutRequest({
      checkout_request_id: "a0000000-0000-4000-8000-000000000001",
      checkout_token: token,
      email: "local@example.com",
    });
    expect(result.online_checkout_token_hash).toBe(hashCheckoutToken(token));
    expect(JSON.stringify(result)).not.toContain(token);
    expect(() =>
      readOnlineCheckoutRequest({
        checkout_request_id: "bad",
        checkout_token: token,
        email: "local@example.com",
      }),
    ).toThrow();
  });
});
