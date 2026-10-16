// Peru / Checkout API Orders. The customer's own Yape limit may be lower.
export const YAPE_MIN_CENTS = 100;
export const YAPE_MAX_CENTS = 200_000;

// Commercial rule: tables and boxes are paid by card, regardless of amount.
export function isYapeReservationAllowed(reservation: {
  table_id?: string | null;
  sale_origin?: string | null;
}) {
  return reservation.sale_origin === "ticket" && !reservation.table_id;
}

export function isYapeAmountAllowed(amountCents: number) {
  return (
    Number.isSafeInteger(amountCents) &&
    amountCents >= YAPE_MIN_CENTS &&
    amountCents <= YAPE_MAX_CENTS
  );
}

export function isYapePhoneAllowed(
  phone: unknown,
  environment: "test" | "live",
) {
  return (
    typeof phone === "string" &&
    (/^9\d{8}$/.test(phone) ||
      (environment === "test" && /^11111111[1-8]$/.test(phone)))
  );
}

export function mercadoPagoDeclineMessage(detail?: string | null) {
  switch (detail) {
    case "insufficient_amount":
      return "Saldo insuficiente. Revisa tu saldo en Yape o elige otro medio de pago.";
    case "invalid_card_token":
    case "bad_filled_card_data":
      return "No pudimos validar los datos. Si pagas con Yape, solicita un nuevo código de aprobación en la app.";
    case "max_attempts_exceeded":
      return "Se alcanzó el límite de intentos. Espera antes de volver a pagar o elige otro medio de pago.";
    case "required_call_for_authorize":
      return "El pago necesita autorización. Consulta con tu entidad o elige otro medio de pago.";
    case "cc_rejected_3ds_challenge":
      return "El banco no pudo verificar tu tarjeta. Inténtalo de nuevo o elige otro medio de pago.";
    case "expired":
      return "La verificación venció. El intento anterior quedó cerrado.";
    default:
      return "El pago no fue aprobado. Revisa los datos o elige otro medio de pago.";
  }
}
