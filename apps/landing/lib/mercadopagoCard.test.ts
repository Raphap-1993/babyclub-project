import { describe, expect, it, vi } from "vitest";
import { tokenizeMercadoPagoCard } from "./mercadopagoCard";
describe("Mercado Pago hosted fields boundary", () => {
  const input = {
    holder: "APRO",
    documentType: "C.E",
    document: "123456789",
    email: "buyer@testuser.com",
    bin: "50317557",
    amountCents: 4000,
  };
  it("normalizes CE before tokenization as well as order creation, without receiving PAN/CVV", async () => {
    const sdk = {
      getPaymentMethods: vi
        .fn()
        .mockResolvedValue({
          results: [{ id: "master", payment_type_id: "credit_card" }],
        }),
      fields: {
        createCardToken: vi.fn().mockResolvedValue({ id: "synthetic-token" }),
      },
    };
    const result = await tokenizeMercadoPagoCard(sdk, input);
    expect(sdk.fields.createCardToken).toHaveBeenCalledWith({
      cardholderName: "APRO",
      identificationType: "CE",
      identificationNumber: "123456789",
    });
    expect(result.payer).toEqual({ email: input.email });
    expect(result.payment_type_id).toBe("credit_card");
    expect(result).not.toHaveProperty("amount");
    expect(result).not.toHaveProperty("card_number");
  });
  it("rejects unsupported documents and methods before creating a token", async () => {
    const sdk = {
      getPaymentMethods: vi
        .fn()
        .mockResolvedValue({
          results: [{ id: "cash", payment_type_id: "ticket" }],
        }),
      fields: { createCardToken: vi.fn() },
    };
    await expect(
      tokenizeMercadoPagoCard(sdk, { ...input, documentType: "Otro" }),
    ).rejects.toThrow("documento");
    await expect(tokenizeMercadoPagoCard(sdk, input)).rejects.toThrow(
      "tarjeta",
    );
    expect(sdk.fields.createCardToken).not.toHaveBeenCalled();
  });
});
