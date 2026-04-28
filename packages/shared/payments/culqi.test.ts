import { afterEach, describe, expect, it } from "vitest";
import {
  buildReceiptNumber,
  buildWebhookEventKey,
  culqiGateway,
  normalizeCulqiStatus,
  resolveCulqiOrder,
} from "./culqi";

const ORIGINAL_ENV = {
  ENABLE_CULQI_PAYMENTS: process.env.ENABLE_CULQI_PAYMENTS,
  CULQI_SECRET_KEY: process.env.CULQI_SECRET_KEY,
};

function restoreEnv(name: keyof typeof ORIGINAL_ENV) {
  const value = ORIGINAL_ENV[name];
  if (value === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }
}

describe("culqi payment helpers", () => {
  afterEach(() => {
    restoreEnv("ENABLE_CULQI_PAYMENTS");
    restoreEnv("CULQI_SECRET_KEY");
  });

  it("solo habilita el gateway cuando flag y secret key estan configurados", () => {
    delete process.env.ENABLE_CULQI_PAYMENTS;
    delete process.env.CULQI_SECRET_KEY;
    expect(culqiGateway.isEnabled()).toBe(false);

    process.env.ENABLE_CULQI_PAYMENTS = "true";
    expect(culqiGateway.isEnabled()).toBe(false);

    process.env.CULQI_SECRET_KEY = "sk_test_ready";
    expect(culqiGateway.isEnabled()).toBe(true);
  });

  it("normaliza estados de pago", () => {
    expect(normalizeCulqiStatus("paid")).toBe("paid");
    expect(normalizeCulqiStatus("refunded")).toBe("refunded");
    expect(normalizeCulqiStatus("declined")).toBe("failed");
    expect(normalizeCulqiStatus("expired")).toBe("expired");
    expect(normalizeCulqiStatus("canceled")).toBe("canceled");
    expect(normalizeCulqiStatus("")).toBe("pending");
  });

  it("resuelve datos de orden desde payload webhook", () => {
    const data = resolveCulqiOrder({
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
    });

    expect(data.orderId).toBe("ord_live_123");
    expect(data.statusRaw).toBe("paid");
    expect(data.amount).toBe(2500);
    expect(data.customerEmail).toBe("ana@demo.com");
    expect(data.customerName).toBe("Ana Torres");
  });

  it("genera event_key deterministico sin event_id", () => {
    const key1 = buildWebhookEventKey("culqi", '{"a":1}', null);
    const key2 = buildWebhookEventKey("culqi", '{"a":1}', null);
    expect(key1).toBe(key2);
  });

  it("genera numero de comprobante", () => {
    const value = buildReceiptNumber(
      "ord_live_abc123",
      new Date("2026-02-07T12:00:00.000Z"),
    );
    expect(value).toMatch(/^BC-20260207-/);
  });

  it("expone gateway Culqi con parseo normalizado de webhook", () => {
    const parsed = culqiGateway.parseWebhook({
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

    expect(parsed.eventName).toBe("order.status.changed");
    expect(parsed.eventKey).toBe("culqi:evt_live_1");
    expect(parsed.orderId).toBe("ord_live_123");
    expect(parsed.status).toBe("paid");
    expect(parsed.customerEmail).toBe("ana@demo.com");
  });
});
