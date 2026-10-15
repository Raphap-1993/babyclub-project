import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getMercadoPagoConfig,
  getMercadoPagoPublicStatus,
  hashCheckoutToken,
  readOnlineCheckoutRequest,
} from "./mercadopagoConfig";
describe("Mercado Pago sandbox boundary", () => {
  beforeEach(() => {
    for (const [key, value] of Object.entries({
      SUPABASE_URL: "http://127.0.0.1:64321",
      MERCADOPAGO_ENVIRONMENT: "test",
      MERCADOPAGO_ACCESS_TOKEN: "APP_USR-sandbox-fixture",
      MERCADOPAGO_PUBLIC_KEY: "APP_USR-public-fixture",
      MERCADOPAGO_COLLECTOR_ID: "123",
      MERCADOPAGO_TEST_APPLICATION_ID: "456",
      ENABLE_MERCADOPAGO_PAYMENTS: "true",
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
  it("blocks live mode in this local-only release", () => {
    vi.stubEnv("MERCADOPAGO_ENVIRONMENT", "live");
    expect(() => getMercadoPagoConfig()).toThrow();
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
