import { afterEach, describe, expect, it, vi } from "vitest";
import { mercadoPagoDeviceSession } from "./mercadopagoDevice";
import {
  createMercadoPagoCardOrder,
  createMercadoPagoYapeOrder,
} from "./mercadopagoOrders";
import { mercadoPagoDeclineMessage } from "./mercadopagoYape";

afterEach(() => vi.unstubAllGlobals());
describe("Mercado Pago device signal", () => {
  it("rejects malformed values and header injection without fabricating an identifier", () => {
    for (const value of [
      null,
      undefined,
      {},
      "",
      "short",
      "x".repeat(513),
      "device-id\r\nAuthorization: injected",
    ])
      expect(mercadoPagoDeviceSession(value)).toBeUndefined();
    expect(mercadoPagoDeviceSession("  device-session-123456  ")).toBe(
      "device-session-123456",
    );
  });
  it.each(["card", "yape"])(
    "forwards the transient signal only in the provider header for %s",
    async (method) => {
      const send = vi
        .fn()
        .mockResolvedValue(
          Response.json({ id: "ORDTEST", status: "processed" }),
        );
      vi.stubGlobal("fetch", send);
      const common = {
        amountCents: 2500,
        externalReference: "attempt-123456789",
        idempotencyKey: "attempt-123456789",
        deviceSessionId: "device-session-123456",
      };
      if (method === "card")
        await createMercadoPagoCardOrder(
          {
            ...common,
            payer: { email: "test@example.com" },
            paymentMethod: {
              id: "visa",
              type: "credit_card",
              token: "test-token",
              installments: 1,
            },
          },
          "test-access",
        );
      else
        await createMercadoPagoYapeOrder(
          {
            ...common,
            environment: "test",
            payer: { email: "test@example.com", phoneNumber: "111111111" },
            token: "test-token",
          },
          "test-access",
        );
      expect(send).toHaveBeenCalledTimes(1);
      const request = send.mock.calls[0][1];
      expect(request.headers["X-meli-session-id"]).toBe(common.deviceSessionId);
      expect(request.headers["X-Idempotency-Key"]).toBe(common.idempotencyKey);
      expect(request.body).not.toContain(common.deviceSessionId);
      expect(JSON.parse(request.body).total_amount).toBe("25.00");
    },
  );
  it("keeps safety refusals separate from balance and 3DS failures", () => {
    expect(mercadoPagoDeclineMessage("high_risk")).toContain(
      "Evita repetir intentos seguidos",
    );
    expect(mercadoPagoDeclineMessage("cc_rejected_high_risk")).toBe(
      mercadoPagoDeclineMessage("high_risk"),
    );
    expect(mercadoPagoDeclineMessage("3ds_challenge_failed")).toContain(
      "validación del banco",
    );
    expect(mercadoPagoDeclineMessage("cc_rejected_3ds_challenge")).toBe(
      mercadoPagoDeclineMessage("3ds_challenge_failed"),
    );
    expect(mercadoPagoDeclineMessage("insufficient_amount")).toContain(
      "Saldo insuficiente",
    );
  });
});
