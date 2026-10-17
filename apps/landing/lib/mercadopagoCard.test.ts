import { describe, expect, it } from "vitest";
import { mercadoPagoCardPayment } from "./mercadopagoCard";

describe("Mercado Pago Card Payment / Orders boundary", () => {
  const form = {
    token: "synthetic-token",
    payment_method_id: "debvisa",
    installments: 1,
    transaction_amount: 0.01,
    payer: {
      email: "buyer@testuser.com",
      identification: { type: "C.E", number: "123456789" },
      address: "untrusted",
    },
    card_number: "must-not-forward",
    security_code: "must-not-forward",
  };
  it("preserves the SDK's actual debit method and titular document, without amount/PAN/CVV", () => {
    const payment = mercadoPagoCardPayment(form, {
      paymentTypeId: "debit_card",
      lastFourDigits: "1234",
    });
    expect(payment).toEqual({
      token: "synthetic-token",
      payment_method_id: "debvisa",
      payment_type_id: "debit_card",
      installments: 1,
      payer: {
        email: form.payer.email,
        identification: { type: "C.E", number: "123456789" },
      },
    });
  });
  it("accepts credit cards without inventing a document not returned by the SDK", () => {
    expect(
      mercadoPagoCardPayment(
        {
          ...form,
          payment_method_id: "master",
          payer: { email: form.payer.email },
        },
        { paymentTypeId: "credit_card" },
      ).payer,
    ).toEqual({ email: form.payer.email });
  });
  it("fails closed for unknown/prepaid methods or missing tokens, before charging", () => {
    for (const type of [undefined, "prepaid_card", "ticket", "yape"])
      expect(() =>
        mercadoPagoCardPayment(form, { paymentTypeId: type }),
      ).toThrow("tarjeta");
    expect(() =>
      mercadoPagoCardPayment(
        { ...form, token: "" },
        { paymentTypeId: "credit_card" },
      ),
    ).toThrow("validar");
  });
});
