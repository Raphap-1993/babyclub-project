export type CulqiCheckoutConfigInput = {
  orderId: string;
  amount: number;
  currencyCode?: string | null;
  customerEmail?: string | null;
  title?: string | null;
  rsaId?: string | null;
  rsaPublicKey?: string | null;
};

export type CulqiCloseEvent = {
  type?: string | null;
  wasObjectCreated?: boolean | null;
};

const PAYMENT_METHODS = {
  tarjeta: true,
  yape: true,
  billetera: true,
  bancaMovil: true,
  agente: true,
  cuotealo: true,
} as const;

export function buildCulqiCheckoutConfig(input: CulqiCheckoutConfigInput) {
  const settings: Record<string, unknown> = {
    title: input.title?.trim() || "BabyClub",
    currency: input.currencyCode === "USD" ? "USD" : "PEN",
    amount: Math.max(0, Math.round(input.amount)),
    order: input.orderId,
  };

  if (input.rsaId?.trim() && input.rsaPublicKey?.trim()) {
    settings.xculqirsaid = input.rsaId.trim();
    settings.rsapublickey = input.rsaPublicKey.trim();
  }

  return {
    settings,
    client:
      input.customerEmail?.trim()
        ? { email: input.customerEmail.trim() }
        : undefined,
    options: {
      lang: "auto",
      installments: false,
      modal: true,
      paymentMethods: PAYMENT_METHODS,
      paymentMethodsSort: Object.keys(PAYMENT_METHODS),
    },
    appearance: {
      theme: "default",
      menuType: "sidebar",
      buttonCardPayText: "Pagar ahora",
    },
  };
}

export function shouldPollAfterCulqiClose(closeEvent: unknown) {
  if (!closeEvent || typeof closeEvent !== "object") return false;
  return Boolean((closeEvent as CulqiCloseEvent).wasObjectCreated);
}

export function extractCulqiTokenId(token: unknown) {
  return typeof (token as any)?.id === "string" ? (token as any).id.trim() : "";
}

export function extractCulqiTokenInstallments(token: unknown) {
  const installments = Number((token as any)?.metadata?.installments);
  return Number.isInteger(installments) && installments > 0 ? installments : null;
}

export function getCulqiErrorMessage(error: unknown) {
  if (typeof (error as any)?.user_message === "string") {
    return (error as any).user_message;
  }
  if (typeof (error as any)?.merchant_message === "string") {
    return (error as any).merchant_message;
  }
  if (typeof (error as any)?.message === "string") {
    return (error as any).message;
  }
  return "No se pudo procesar el pago en Culqi.";
}
