import { afterEach, describe, expect, it } from "vitest";
import { GET } from "./route";

const ORIGINAL_ENV = {
  ENABLE_CULQI_PAYMENTS: process.env.ENABLE_CULQI_PAYMENTS,
  CULQI_SECRET_KEY: process.env.CULQI_SECRET_KEY,
  NEXT_PUBLIC_CULQI_PUBLIC_KEY: process.env.NEXT_PUBLIC_CULQI_PUBLIC_KEY,
  DISABLE_CULQI_CHECKOUT: process.env.DISABLE_CULQI_CHECKOUT,
};

function restoreEnv(name: keyof typeof ORIGINAL_ENV) {
  const value = ORIGINAL_ENV[name];
  if (value === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }
}

describe("GET /api/payments/status", () => {
  afterEach(() => {
    restoreEnv("ENABLE_CULQI_PAYMENTS");
    restoreEnv("CULQI_SECRET_KEY");
    restoreEnv("NEXT_PUBLIC_CULQI_PUBLIC_KEY");
    restoreEnv("DISABLE_CULQI_CHECKOUT");
  });

  it("mantiene Culqi deshabilitado cuando falta la secret key", async () => {
    process.env.ENABLE_CULQI_PAYMENTS = "true";
    delete process.env.CULQI_SECRET_KEY;
    process.env.NEXT_PUBLIC_CULQI_PUBLIC_KEY = "pk_test_ready";

    const response = await GET();
    const payload = await response.json();

    expect(payload.providers.culqi).toMatchObject({
      enabled: false,
      publicKey: "",
      publicKeyConfigured: true,
    });
  });

  it("expone Culqi solo cuando backend y public key estan listos", async () => {
    process.env.ENABLE_CULQI_PAYMENTS = "true";
    process.env.CULQI_SECRET_KEY = "sk_test_ready";
    process.env.NEXT_PUBLIC_CULQI_PUBLIC_KEY = "pk_test_ready";

    const response = await GET();
    const payload = await response.json();

    expect(payload.providers.culqi).toMatchObject({
      enabled: true,
      publicKey: "pk_test_ready",
      publicKeyConfigured: true,
    });
  });

  it("mantiene Culqi oculto cuando el kill switch esta activo", async () => {
    process.env.ENABLE_CULQI_PAYMENTS = "true";
    process.env.CULQI_SECRET_KEY = "sk_test_ready";
    process.env.NEXT_PUBLIC_CULQI_PUBLIC_KEY = "pk_test_ready";
    process.env.DISABLE_CULQI_CHECKOUT = "true";

    const response = await GET();
    const payload = await response.json();

    expect(payload.providers.culqi).toMatchObject({
      enabled: false,
      publicKey: "",
      publicKeyConfigured: true,
    });
  });
});
