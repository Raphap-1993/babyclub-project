import {
  isYapeAmountAllowed,
  isYapePhoneAllowed,
} from "shared/payments/mercadopagoYape";

// Browser only: send the approval code directly to Mercado Pago, never BABY.
export async function tokenizeMercadoPagoYape(
  sdk: any,
  input: {
    phoneNumber: string;
    otp: string;
    amountCents: number;
    environment: "test" | "live";
  },
) {
  if (!isYapePhoneAllowed(input.phoneNumber, input.environment))
    throw new Error("Ingresa el celular de 9 dígitos asociado a Yape.");
  if (!/^\d{6}$/.test(input.otp))
    throw new Error(
      "Ingresa el código de aprobación de 6 dígitos de tu app Yape.",
    );
  if (!isYapeAmountAllowed(input.amountCents))
    throw new Error("Para este importe, elige tarjeta como medio de pago.");
  let token;
  try {
    token = await sdk
      .yape({ phoneNumber: input.phoneNumber, otp: input.otp })
      .create();
  } catch {
    // Provider errors may contain request data. Never show/log the raw object.
    throw new Error(
      "No pudimos validar Yape. Revisa tu celular y solicita un nuevo código de aprobación en la app.",
    );
  }
  if (typeof token?.id !== "string" || !token.id || token.id.length > 512)
    throw new Error(
      "No pudimos validar Yape. Solicita un nuevo código de aprobación.",
    );
  return {
    payment_method_id: "yape",
    token: token.id,
    phone_number: input.phoneNumber,
  };
}
