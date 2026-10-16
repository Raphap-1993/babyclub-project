import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("shared/payments/mercadopagoConfig", () => ({
  getMercadoPagoPublicStatus: vi.fn(),
}));
vi.mock("shared/payments/registry", () => ({
  getPaymentGateway: () => ({ isCheckoutEnabled: () => false }),
}));
vi.mock("shared/payments/mercadopagoSalesControl", () => ({
  readMercadoPagoSalesControl: vi.fn(),
}));
vi.mock("../../../../lib/mercadopagoRoute", () => ({
  mercadoPagoDatabase: () => ({}),
}));
const { getMercadoPagoPublicStatus } = await import(
  "shared/payments/mercadopagoConfig"
);
const { readMercadoPagoSalesControl } = await import(
  "shared/payments/mercadopagoSalesControl"
);
const { GET } = await import("./route");
describe("public payment availability", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(getMercadoPagoPublicStatus).mockReturnValue({
      enabled: true,
      environment: "test",
      publicKey: "public",
    });
  });
  it.each([false, true])(
    "keeps Mercado Pago selected while reflecting pause=%s",
    async (paused) => {
      vi.mocked(readMercadoPagoSalesControl).mockResolvedValue({
        paused,
        version: 0,
        updated_at: "",
        updated_by: null,
      });
      const response = await GET();
      expect((await response.json()).providers.mercadopago).toMatchObject({
        configured: true,
        enabled: !paused,
        salesPaused: paused,
        salesControlAvailable: true,
      });
      expect(response.headers.get("Cache-Control")).toBe("no-store");
    },
  );
  it("fails closed on an unavailable control without falling back to manual payments", async () => {
    vi.mocked(readMercadoPagoSalesControl).mockRejectedValue(
      new Error("database down"),
    );
    expect((await (await GET()).json()).providers.mercadopago).toMatchObject({
      configured: true,
      enabled: false,
      salesPaused: true,
      salesControlAvailable: false,
    });
  });
});
