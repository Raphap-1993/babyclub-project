import { describe, expect, it, vi, afterEach } from "vitest";
import {
  buildMercadoPagoYapeOrder,
  createMercadoPagoYapeOrder,
} from "./mercadopagoOrders";
import {
  isYapePhoneAllowed,
  isYapeReservationAllowed,
  mercadoPagoDeclineMessage,
} from "./mercadopagoYape";

const input = {
  amountCents: 60000,
  externalReference: "reservation-yape",
  idempotencyKey: "attempt-yape-123456",
  environment: "test" as const,
  payer: { email: "sandbox@testuser.com", phoneNumber: "111111111" },
  token: "synthetic-yape-token",
};
afterEach(() => vi.unstubAllGlobals());
describe("Yape Orders Peru", () => {
  it("offers Yape only for ticket reservations; tables, boxes and unknown origins require card", () => {
    expect(
      isYapeReservationAllowed({ sale_origin: "ticket", table_id: null }),
    ).toBe(true);
    for (const reservation of [
      { sale_origin: "table", table_id: "table-1" },
      { sale_origin: "ticket", table_id: "table-1" },
      { sale_origin: "table", table_id: null },
      {},
      { sale_origin: "legacy" },
    ])
      expect(isYapeReservationAllowed(reservation)).toBe(false);
  });
  it("uses the server amount, phone and single-use token, without OTP, installments or 3DS", () => {
    const payload = buildMercadoPagoYapeOrder({
      ...input,
      otp: "123456",
      total_amount: "0.01",
      config: { online: {} },
    } as any);
    expect(payload.total_amount).toBe("600.00");
    expect(payload.payer.phone).toEqual({
      area_code: "51",
      number: "111111111",
    });
    expect(payload.transactions.payments).toEqual([
      {
        amount: "600.00",
        payment_method: { id: "yape", type: "debit_card", token: input.token },
      },
    ]);
    expect(payload).not.toHaveProperty("otp");
    expect(payload).not.toHaveProperty("config");
  });
  it("rejects amounts outside Yape limits before a provider request", () => {
    for (const amountCents of [0, 99, 200001, 1.1, NaN, Infinity])
      expect(() =>
        buildMercadoPagoYapeOrder({ ...input, amountCents }),
      ).toThrow("Yape admite");
    for (const amountCents of [100, 200000])
      expect(
        buildMercadoPagoYapeOrder({ ...input, amountCents }).total_amount,
      ).toBe((amountCents / 100).toFixed(2));
  });
  it("never permits sandbox phones in live, validates Peruvian mobile numbers", () => {
    for (const phoneNumber of [
      "111111111",
      "111111118",
      "51111111111",
      "99999999",
      "x99999999",
      null,
    ]) {
      expect(isYapePhoneAllowed(phoneNumber, "live")).toBe(false);
      expect(() =>
        buildMercadoPagoYapeOrder({
          ...input,
          environment: "live",
          payer: { ...input.payer, phoneNumber: phoneNumber as any },
        }),
      ).toThrow("celular");
    }
    expect(isYapePhoneAllowed("999000111", "live")).toBe(true);
    expect(isYapePhoneAllowed("111111118", "test")).toBe(true);
    expect(isYapePhoneAllowed("111111119", "test")).toBe(false);
  });
  it("validates token, payer and idempotency", () => {
    for (const patch of [
      { token: "" },
      { token: "a".repeat(513) },
      { payer: { ...input.payer, email: "invalid" } },
      { idempotencyKey: "bad" },
      { externalReference: "../bad" },
    ])
      expect(() => buildMercadoPagoYapeOrder({ ...input, ...patch })).toThrow();
  });
  it("preserves the persisted attempt key and treats transport failures as ambiguous", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(Response.json({ id: "ORDYAPE", status: "processed" }));
    vi.stubGlobal("fetch", fetchMock);
    await createMercadoPagoYapeOrder(input, "synthetic-access");
    expect(fetchMock.mock.calls[0][1].headers["X-Idempotency-Key"]).toBe(
      input.idempotencyKey,
    );
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).external_reference).toBe(
      input.externalReference,
    );
    fetchMock.mockRejectedValue(new Error("private transport details"));
    await expect(
      createMercadoPagoYapeOrder(input, "synthetic-access"),
    ).rejects.toMatchObject({ code: "payment_result_unknown" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
  it("explains Yape declines without suggesting the same expired approval code", () => {
    expect(mercadoPagoDeclineMessage("insufficient_amount")).toContain(
      "Saldo insuficiente",
    );
    expect(mercadoPagoDeclineMessage("invalid_card_token")).toContain(
      "nuevo código",
    );
    expect(mercadoPagoDeclineMessage("max_attempts_exceeded")).toContain(
      "Espera",
    );
  });
});
