import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildMercadoPagoCardOrder,
  createMercadoPagoCardOrder,
  evaluateMercadoPagoOrder,
  formatMercadoPagoAmount,
  getMercadoPagoOrder,
  findMercadoPagoOrder,
  parseMercadoPagoAmount,
  type MercadoPagoOrder,
} from "./mercadopagoOrders";

const input = {
  amountCents: 4001,
  externalReference: "purchase-test-1",
  idempotencyKey: "attempt-1234567890123456",
  payer: { email: "buyer@example.com" },
  paymentMethod: {
    id: "visa",
    type: "credit_card" as const,
    token: "synthetic-token",
    installments: 1,
  },
};
const expected = {
  orderId: "ORD1",
  externalReference: input.externalReference,
  amountCents: 4001,
  collectorId: "123",
  applicationId: "456",
};
const paid: MercadoPagoOrder = {
  id: "ORD1",
  type: "online",
  external_reference: input.externalReference,
  user_id: 123,
  integration_data: { application_id: 456 },
  country_code: "PER",
  total_amount: "40.01",
  total_paid_amount: "40.01",
  status: "processed",
  status_detail: "accredited",
  transactions: {
    payments: [
      {
        id: "PAY1",
        amount: "40.01",
        paid_amount: "40.01",
        status: "processed",
        status_detail: "accredited",
      },
    ],
  },
};
afterEach(() => vi.unstubAllGlobals());

describe("Mercado Pago Orders", () => {
  it("recupera la orden por la referencia persistida sin volver a cobrar", async () => {
    const reference = "a0000000-0000-4000-8000-000000000001";
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({
        data: [{ id: "ORDRECOVERED", external_reference: reference }],
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    expect(
      await findMercadoPagoOrder(
        reference,
        new Date().toISOString(),
        "synthetic-access",
      ),
    ).toBe("ORDRECOVERED");
    expect(
      new URL(fetchMock.mock.calls[0][0]).searchParams.get(
        "external_reference",
      ),
    ).toBe(reference);
    expect(fetchMock.mock.calls[0][1].method).toBeUndefined();
    fetchMock.mockResolvedValue(Response.json({ data: [] }));
    expect(
      await findMercadoPagoOrder(
        reference,
        new Date().toISOString(),
        "synthetic-access",
      ),
    ).toBeNull();
    fetchMock.mockResolvedValue(
      Response.json({ data: [{ id: "wrong", external_reference: "another" }] }),
    );
    await expect(
      findMercadoPagoOrder(
        reference,
        new Date().toISOString(),
        "synthetic-access",
      ),
    ).rejects.toThrow("no coincide");
  });
  it("normaliza C.E del Brick al CE admitido por Orders Perú", () => {
    const payload = buildMercadoPagoCardOrder({
      ...input,
      payer: {
        email: input.payer.email,
        identification: { type: "C.E", number: "123456789" },
      },
    });
    expect(payload.payer.identification).toEqual({
      type: "CE",
      number: "123456789",
    });
    expect(() =>
      buildMercadoPagoCardOrder({
        ...input,
        payer: {
          email: input.payer.email,
          identification: { type: "Otro", number: "123456789" },
        },
      }),
    ).toThrow("Usa DNI, C.E o RUC");
  });
  it("convierte céntimos sin redondeos de punto flotante", () => {
    expect(formatMercadoPagoAmount(4001)).toBe("40.01");
    expect(formatMercadoPagoAmount(1)).toBe("0.01");
    expect(parseMercadoPagoAmount("40.01")).toBe(4001);
    for (const v of ["1e2", "40.001", "-1.00", 40.01, "NaN"])
      expect(parseMercadoPagoAmount(v)).toBeNull();
    for (const v of [0, -1, 1.1, NaN, Infinity])
      expect(() => formatMercadoPagoAmount(v)).toThrow();
  });
  it("usa únicamente el importe del servidor y los campos permitidos", () => {
    const payload = buildMercadoPagoCardOrder({
      ...input,
      total_amount: "0.01",
      metadata: { paid: true },
    } as any);
    expect(payload.total_amount).toBe("40.01");
    expect(payload.transactions.payments[0].amount).toBe("40.01");
    expect(payload).not.toHaveProperty("metadata");
    expect(payload.processing_mode).toBe("automatic");
    expect(payload.config.online.transaction_security).toEqual({
      validation: "on_fraud_risk",
      liability_shift: "required",
    });
    expect(() =>
      buildMercadoPagoCardOrder({
        ...input,
        paymentMethod: { ...input.paymentMethod, id: "yape" },
      }),
    ).toThrow();
  });
  it("envía idempotencia y no devuelve éxito ante error del proveedor", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify(paid)));
    vi.stubGlobal("fetch", fetchMock);
    await createMercadoPagoCardOrder(input, "synthetic-access");
    expect(fetchMock.mock.calls[0][1].headers).not.toHaveProperty(
      "X-meli-session-id",
    );
    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://api.mercadopago.com/v1/orders",
    );
    expect(fetchMock.mock.calls[0][1].headers["X-Idempotency-Key"]).toBe(
      input.idempotencyKey,
    );
    fetchMock.mockResolvedValue(
      new Response("private-provider-data", { status: 429 }),
    );
    await expect(
      createMercadoPagoCardOrder(input, "synthetic-access"),
    ).rejects.toMatchObject({ code: "mercadopago_api_error" });
  });
  it("mantiene el timeout como resultado desconocido, sin reintentar otro cobro", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValue(new Error("private transport details"));
    vi.stubGlobal("fetch", fetchMock);
    await expect(
      createMercadoPagoCardOrder(input, "synthetic-access"),
    ).rejects.toMatchObject({ code: "payment_result_unknown" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it("impide utilizar la consulta de órdenes como URL arbitraria", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(
      getMercadoPagoOrder("../../users/me", "synthetic-access"),
    ).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("solo acredita una orden íntegramente conciliada", () => {
    expect(evaluateMercadoPagoOrder(paid, expected)).toBe("paid");
    for (const patch of [
      { user_id: "other" },
      { country_code: "ARG" },
      { currency_id: "USD" },
      { external_reference: "another-purchase" },
      { total_amount: "0.01" },
      { total_paid_amount: "39.99" },
      { integration_data: { application_id: "other" } },
      { integration_data: undefined },
      { transactions: { payments: [] } },
    ])
      expect(evaluateMercadoPagoOrder({ ...paid, ...patch }, expected)).toBe(
        "review",
      );
  });
  it("no emite por autorización, espera de pago, estado desconocido o devolución parcial", () => {
    for (const status of ["created", "processing", "action_required"]) {
      expect(
        evaluateMercadoPagoOrder(
          { ...paid, status, status_detail: "waiting_capture" },
          expected,
        ),
      ).toBe("pending");
    }
    for (const detail of ["partially_refunded", "unknown"]) {
      expect(
        evaluateMercadoPagoOrder({ ...paid, status_detail: detail }, expected),
      ).toBe("review");
    }
  });
});
