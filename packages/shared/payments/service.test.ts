import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createSupabaseMock } from "../../../tests/utils/supabaseMock";
import { PaymentServiceError } from "./errors";
import {
  createPaymentCharge,
  createPaymentOrder,
  getPaymentReceipt,
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
    delete process.env.DISABLE_CULQI_CHECKOUT;
    delete process.env.CULQI_WEBHOOK_SECRET;
    vi.unstubAllGlobals();
  });

  it("rechaza crear orden Culqi cuando el kill switch esta activo", async () => {
    process.env.DISABLE_CULQI_CHECKOUT = "true";
    const { supabase } = createSupabaseMock({});

    await expect(
      createPaymentOrder({
        supabase: supabase as any,
        providerName: "culqi",
        body: {
          reservation_id: "res_1",
          amount: 2500,
          idempotency_key: "idem_disabled_1",
        },
      }),
    ).rejects.toMatchObject<Partial<PaymentServiceError>>({
      message: "payments_module_disabled",
      status: 503,
      code: "payments_module_disabled",
    });
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

  it("crea un cargo con token Culqi y marca la reserva como pagada", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          id: "chr_test_123",
          object: "charge",
          state: "Exitosa",
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const { supabase, calls } = createSupabaseMock({
      "payments.select": [
        {
          data: {
            id: "pay_1",
            provider: "culqi",
            status: "pending",
            amount: 4200,
            currency_code: "PEN",
            customer_email: "ana@test.com",
            customer_name: "Ana Torres",
            customer_phone: "999999999",
            reservation_id: "res_1",
            ticket_id: null,
            order_id: "ord_1",
            charge_id: null,
            receipt_number: null,
            event_id: "event_1",
            metadata: { order_number: "BC-ORDER-1" },
          },
          error: null,
        },
      ],
    });

    const response = await createPaymentCharge({
      supabase: supabase as any,
      providerName: "culqi",
      body: {
        payment_id: "pay_1",
        token_id: "tkn_test_123",
        email: "ana@test.com",
      },
    });

    expect(response.success).toBe(true);
    expect(response.chargeId).toBe("chr_test_123");
    expect(response.status).toBe("paid");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.culqi.com/v2/charges",
      expect.objectContaining({
        body: expect.stringContaining('"source_id":"tkn_test_123"'),
      }),
    );

    expect(
      calls.filter((call) => call.table === "payments" && call.op === "update"),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          payload: expect.objectContaining({
            status: "paid",
            charge_id: "chr_test_123",
          }),
        }),
        expect.objectContaining({
          payload: expect.objectContaining({
            receipt_number: expect.stringMatching(/^BC-/),
          }),
        }),
      ]),
    );
  });

  it("rechaza crear cargo Culqi cuando el kill switch esta activo", async () => {
    process.env.DISABLE_CULQI_CHECKOUT = "true";
    const { supabase } = createSupabaseMock({});

    await expect(
      createPaymentCharge({
        supabase: supabase as any,
        providerName: "culqi",
        body: {
          payment_id: "pay_1",
          token_id: "tkn_test_123",
        },
      }),
    ).rejects.toMatchObject<Partial<PaymentServiceError>>({
      message: "payments_module_disabled",
      status: 503,
      code: "payments_module_disabled",
    });
  });

  it("reutiliza un cargo ya pagado sin volver a llamar a Culqi", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const { supabase } = createSupabaseMock({
      "payments.select": [
        {
          data: {
            id: "pay_1",
            provider: "culqi",
            status: "paid",
            amount: 4200,
            currency_code: "PEN",
            customer_email: "ana@test.com",
            customer_name: "Ana Torres",
            customer_phone: "999999999",
            reservation_id: "res_1",
            ticket_id: null,
            order_id: "ord_1",
            charge_id: "chr_existing",
            receipt_number: "BC-20260601-TEST1234",
            event_id: "event_1",
            metadata: {},
          },
          error: null,
        },
      ],
    });

    const response = await createPaymentCharge({
      supabase: supabase as any,
      providerName: "culqi",
      body: {
        payment_id: "pay_1",
        token_id: "tkn_test_123",
      },
    });

    expect(response).toMatchObject({
      success: true,
      existing: true,
      chargeId: "chr_existing",
      status: "paid",
    });
    expect(fetchMock).not.toHaveBeenCalled();
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

  it("procesa webhook Culqi aunque el kill switch de checkout este activo", async () => {
    process.env.DISABLE_CULQI_CHECKOUT = "true";

    const { supabase, calls } = createSupabaseMock({
      "payment_webhook_events.insert": [
        {
          data: { id: "evt_row_1" },
          error: null,
        },
      ],
      "payments.select": [
        {
          data: {
            id: "pay_1",
            reservation_id: null,
            ticket_id: null,
            receipt_number: "BC-20260606-EXISTING1",
          },
          error: null,
        },
      ],
      "payments.update": [{ data: null, error: null }],
      "payment_webhook_events.update": [
        { data: null, error: null },
      ],
    });

    const response = await processPaymentWebhook({
      supabase: supabase as any,
      providerName: "culqi",
      rawBody: JSON.stringify({
        id: "evt_live_1",
        event_name: "order.status.changed",
        data: {
          object: {
            id: "ord_live_123",
            status: "paid",
            amount: 2500,
            currency_code: "PEN",
            client_details: {
              first_name: "Ana",
              last_name: "Torres",
              email: "ana@demo.com",
              phone_number: "999999999",
            },
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

    expect(response).toMatchObject({
      success: true,
      provider: "culqi",
      orderId: "ord_live_123",
      status: "paid",
    });
    expect(
      calls.filter((call) => call.table === "payment_webhook_events"),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ op: "insert" }),
        expect.objectContaining({ op: "update" }),
      ]),
    );
  });

  it("obtiene recibo existente aunque el kill switch de checkout este activo", async () => {
    process.env.DISABLE_CULQI_CHECKOUT = "true";

    const { supabase } = createSupabaseMock({
      "payments.select": [
        {
          data: {
            id: "pay_1",
            provider: "culqi",
            status: "paid",
            amount: 4200,
            currency_code: "PEN",
            customer_name: "Ana Torres",
            customer_email: "ana@test.com",
            customer_phone: "999999999",
            receipt_number: "BC-20260606-REC0001",
            paid_at: "2026-06-06T12:00:00.000Z",
            created_at: "2026-06-06T11:50:00.000Z",
            reservation_id: null,
            event_id: null,
          },
          error: null,
        },
      ],
    });

    const response = await getPaymentReceipt({
      supabase: supabase as any,
      paymentId: "pay_1",
      providerName: "culqi",
    });

    expect(response).toMatchObject({
      success: true,
      receipt: {
        payment_id: "pay_1",
        provider: "culqi",
        receipt_number: "BC-20260606-REC0001",
        status: "paid",
      },
    });
  });

  it("permite refund Culqi aunque el kill switch de checkout este activo", async () => {
    process.env.DISABLE_CULQI_CHECKOUT = "true";

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          id: "rfnd_test_1",
          object: "refund",
          amount: 2500,
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const { supabase, calls } = createSupabaseMock({
      "payments.select": [
        {
          data: {
            id: "pay_1",
            provider: "culqi",
            charge_id: "chr_test_123",
            amount: 2500,
            status: "paid",
            reservation_id: null,
            order_id: "ord_1",
          },
          error: null,
        },
      ],
      "payments.update": [{ data: null, error: null }],
    });

    const response = await refundPayment({
      supabase: supabase as any,
      providerName: "culqi",
      paymentId: "pay_1",
      amount: null,
      reason: "requested_by_client",
    });

    expect(response).toMatchObject({
      success: true,
      provider: "culqi",
      paymentId: "pay_1",
      orderId: "ord_1",
      status: "refunded",
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.culqi.com/v2/refunds",
      expect.objectContaining({
        method: "POST",
      }),
    );
    expect(
      calls.filter((call) => call.table === "payments" && call.op === "update"),
    ).toHaveLength(1);
  });
});
