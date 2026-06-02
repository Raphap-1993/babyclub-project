import { describe, expect, it } from "vitest";
import {
  buildCulqiCheckoutConfig,
  extractCulqiTokenId,
  extractCulqiTokenInstallments,
  getCulqiErrorMessage,
  shouldPollAfterCulqiClose,
} from "./culqiCheckout";

describe("culqi checkout helpers", () => {
  it("arma config de custom checkout con rsa opcional", () => {
    const config = buildCulqiCheckoutConfig({
      orderId: "ord_test_123",
      amount: 4250,
      currencyCode: "PEN",
      customerEmail: "ana@test.com",
      title: "Mesa BabyClub",
      rsaId: "rsa_123",
      rsaPublicKey: "-----BEGIN PUBLIC KEY-----demo",
    });

    expect(config.settings).toMatchObject({
      title: "Mesa BabyClub",
      currency: "PEN",
      amount: 4250,
      order: "ord_test_123",
      xculqirsaid: "rsa_123",
    });
    expect(config.client).toEqual({ email: "ana@test.com" });
    expect(config.options.paymentMethods.tarjeta).toBe(true);
    expect(config.options.installments).toBe(false);
  });

  it("solo hace polling tras cierre con objeto de pago creado", () => {
    expect(shouldPollAfterCulqiClose({ wasObjectCreated: true })).toBe(true);
    expect(shouldPollAfterCulqiClose({ wasObjectCreated: false })).toBe(false);
    expect(shouldPollAfterCulqiClose(null)).toBe(false);
  });

  it("extrae token e installments de la respuesta de Culqi", () => {
    const token = {
      id: "tkn_test_123",
      metadata: { installments: 3 },
    };

    expect(extractCulqiTokenId(token)).toBe("tkn_test_123");
    expect(extractCulqiTokenInstallments(token)).toBe(3);
    expect(extractCulqiTokenInstallments({})).toBeNull();
  });

  it("prioriza mensajes de error user_message y merchant_message", () => {
    expect(
      getCulqiErrorMessage({ user_message: "Tarjeta rechazada por el banco" }),
    ).toBe("Tarjeta rechazada por el banco");
    expect(
      getCulqiErrorMessage({ merchant_message: "Token inválido" }),
    ).toBe("Token inválido");
  });
});
