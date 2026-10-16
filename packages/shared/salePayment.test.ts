import { describe, it, expect } from "vitest";
import {
  summarizeSalePayment,
  ticketPaymentLabel,
  matchesTicketSaleFilter,
} from "./salePayment";
import { getTicketKindPresentation } from "./ticketKindPresentation";
describe("commercial payment evidence", () => {
  it("exposes only receipt references from the settled payment, without provider secrets", () => {
    expect(
      summarizeSalePayment([
        { status: "failed", created_at: "2026-10-17", charge_id: "wrong" },
        {
          status: "paid",
          provider: "mercadopago",
          amount: 2500,
          created_at: "2026-10-16",
          charge_id: "pay-123",
          order_id: "order-456",
          receipt_number: "BC-MP-123",
          paid_at: "2026-10-16T17:00:00Z",
          metadata: { secret: "private" },
        },
      ]),
    ).toEqual({
      state: "paid",
      source: "Mercado Pago",
      amountCents: 2500,
      chargeId: "pay-123",
      orderId: "order-456",
      receiptNumber: "BC-MP-123",
      paidAt: "2026-10-16T17:00:00Z",
    });
  });
  it("does not equate approval with payment", () => {
    expect(summarizeSalePayment([]).state).toBe("unverified");
    expect(ticketPaymentLabel(null, "ticket")).toBe("Sin pago acreditado");
  });
  it("keeps invitation codes separate from receipts", () => {
    expect(ticketPaymentLabel(null, null)).toBe("Código de invitación");
    expect(getTicketKindPresentation({ codeType: "courtesy" }).kind).toBe(
      "courtesy",
    );
    expect(
      getTicketKindPresentation({
        codeType: "courtesy",
        reservationSaleOrigin: "ticket",
      }).kind,
    ).toBe("purchased");
  });
  it("ignores failed attempts when a paid receipt exists", () => {
    expect(
      summarizeSalePayment([
        { status: "failed", provider: "mercadopago", created_at: "2026-10-16" },
        {
          status: "paid",
          provider: "mercadopago",
          amount: 4000,
          created_at: "2026-10-15",
        },
      ]),
    ).toEqual({ state: "paid", source: "Mercado Pago", amountCents: 4000 });
  });
  it("shows refunds and identifies manually received money", () => {
    expect(
      summarizeSalePayment([
        { status: "refunded", provider: "mercadopago", amount: 4000 },
      ]).state,
    ).toBe("refunded");
    expect(
      summarizeSalePayment([
        { status: "paid", provider: "manual", amount: 60000 },
      ]).source,
    ).toBe("Venta manual");
    expect(ticketPaymentLabel("paid", "table")).toBe("Pagada");
  });
});

describe("commercial filters", () => {
  it("uses reservation/payment evidence rather than the internal courtesy code type", () => {
    expect(
      matchesTicketSaleFilter(
        { code: { type: "courtesy", table_reservation_id: "sale" } },
        "sales",
      ),
    ).toBe(true);
    expect(
      matchesTicketSaleFilter(
        { code: { type: "courtesy", table_reservation_id: "sale" } },
        "invitations",
      ),
    ).toBe(false);
    expect(
      matchesTicketSaleFilter(
        { code: { type: "courtesy" }, payment_status: null },
        "invitations",
      ),
    ).toBe(true);
    expect(
      matchesTicketSaleFilter(
        { code: { type: "promoter" }, payment_status: null },
        "sales",
      ),
    ).toBe(false);
    expect(matchesTicketSaleFilter({ payment_status: "paid" }, "sales")).toBe(
      true,
    );
  });
});
