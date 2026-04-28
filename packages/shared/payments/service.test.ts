import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createSupabaseMock } from "../../../tests/utils/supabaseMock";
import { PaymentServiceError } from "./errors";
import {
  createPaymentOrder,
  processPaymentWebhook,
  refundPayment,
} from "./service";

describe("payment services", () => {
  beforeEach(() => {
    process.env.ENABLE_CULQI_PAYMENTS = "true";
    process.env.CULQI_SECRET_KEY = "sk_test_ready";
  });

  afterEach(() => {
    delete process.env.ENABLE_CULQI_PAYMENTS;
    delete process.env.CULQI_SECRET_KEY;
    delete process.env.CULQI_WEBHOOK_SECRET;
    vi.unstubAllGlobals();
  });

  it("reutiliza la orden existente por idempotency key y proveedor", async () => {
    const { supabase, calls } = createSupabaseMock({
      "payments.select": [
        {
          data: {
            id: "pay_1",
            order_id: "ord_1",
            status: "pending",
            amount: 2500,
            currency_code: "PEN",
          },
          error: null,
        },
      ],
    });

    const response = await createPaymentOrder({
      supabase: supabase as any,
      providerName: "culqi",
      body: {
        reservation_id: "res_1",
        amount: 2500,
        idempotency_key: "idem_1",
      },
    });

    expect(response.success).toBe(true);
    expect(response.existing).toBe(true);
    expect(response.orderId).toBe("ord_1");

    const paymentSelectCall = calls.find(
      (call) => call.table === "payments" && call.op === "select",
    );
    expect(paymentSelectCall?.filters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "eq", args: ["provider", "culqi"] }),
        expect.objectContaining({
          type: "eq",
          args: ["idempotency_key", "idem_1"],
        }),
      ]),
    );
  });

  it("deduplica webhooks por event_key", async () => {
    const { supabase } = createSupabaseMock({
      "payment_webhook_events.insert": [
        {
          data: null,
          error: {
            code: "23505",
            message: "duplicate key value violates unique constraint",
          },
        },
      ],
    });

    const response = await processPaymentWebhook({
      supabase: supabase as any,
      providerName: "culqi",
      rawBody: JSON.stringify({
        id: "evt_1",
        event_name: "order.status.changed",
        data: {
          object: {
            id: "ord_1",
            status: "paid",
            amount: 2500,
            currency_code: "PEN",
            metadata: { reservation_id: "res_1" },
          },
        },
      }),
      headers: {
        get() {
          return null;
        },
      },
    });

    expect(response.success).toBe(true);
    expect(response.duplicated).toBe(true);
    expect(response.provider).toBe("culqi");
  });

  it("usa el snapshot de monto de la reserva ticket-only para crear la orden", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: "ord_ticket_snapshot" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const { supabase, calls } = createSupabaseMock({
      "payments.select": [{ data: null, error: null }],
      "table_reservations.select": [
        {
          data: {
            id: "res_ticket_1",
            event_id: "event_1",
            full_name: "Ana Torres",
            email: "ana@test.com",
            phone: "999999999",
            status: "pending",
            sale_origin: "ticket",
            ticket_total_amount: 42,
            ticket_type_label: "2 QR ALL NIGHT",
          },
          error: null,
        },
      ],
      "payments.insert": [
        {
          data: {
            id: "pay_1",
            status: "pending",
          },
          error: null,
        },
      ],
    });

    const response = await createPaymentOrder({
      supabase: supabase as any,
      providerName: "culqi",
      body: {
        reservation_id: "res_ticket_1",
        amount: 1,
        idempotency_key: "idem_ticket_1",
      },
    });

    expect(response.amount).toBe(4200);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.culqi.com/v2/orders",
      expect.objectContaining({
        body: expect.stringContaining('"amount":4200'),
      }),
    );

    const paymentInsert = calls.find(
      (call) => call.table === "payments" && call.op === "insert",
    );
    expect(paymentInsert?.payload).toMatchObject({
      amount: 4200,
      order_id: "ord_ticket_snapshot",
    });
  });

  it("rechaza refund si el pago pertenece a otro proveedor", async () => {
    const { supabase } = createSupabaseMock({
      "payments.select": [
        {
          data: {
            id: "pay_1",
            provider: "izipay",
            charge_id: "chg_1",
            amount: 2500,
            status: "paid",
            reservation_id: "res_1",
            order_id: "ord_1",
          },
          error: null,
        },
      ],
    });

    await expect(
      refundPayment({
        supabase: supabase as any,
        providerName: "culqi",
        paymentId: "pay_1",
        amount: null,
        reason: "requested_by_client",
      }),
    ).rejects.toMatchObject<Partial<PaymentServiceError>>({
      status: 409,
      code: "payment_provider_mismatch",
    });
  });
});
