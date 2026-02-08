import { describe, expect, it } from "vitest";
import {
  buildReceiptNumber,
  buildWebhookEventKey,
  normalizeCulqiStatus,
  resolveCulqiOrder,
} from "./culqi";

describe("culqi payment helpers", () => {
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
    const value = buildReceiptNumber("ord_live_abc123", new Date("2026-02-07T12:00:00.000Z"));
    expect(value).toMatch(/^BC-20260207-/);
  });
});
