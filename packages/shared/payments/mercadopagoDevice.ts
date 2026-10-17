// Device information is a risk signal, never proof of identity or payment.
// Keep it transient: forward to Mercado Pago without persisting or logging it.
export function mercadoPagoDeviceSession(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const id = value.trim();
  return /^[A-Za-z0-9_-]{8,512}$/.test(id) ? id : undefined;
}
