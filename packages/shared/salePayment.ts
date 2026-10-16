export type PaymentSummary = {
  state: string;
  source: string;
  amountCents: number | null;
  chargeId?: string;
  orderId?: string;
  receiptNumber?: string;
  paidAt?: string;
};

// Reservation approval is operational; it never proves that a payment exists.
export function summarizeSalePayment(rows: any[]): PaymentSummary {
  const ordered = [...rows].sort(
    (a, b) => Date.parse(b.created_at || "") - Date.parse(a.created_at || ""),
  );
  const settled = ordered.find(
    (row) => row.status === "paid" || row.status === "refunded",
  );
  const payment = settled || ordered[0];
  if (!payment)
    return {
      state: "unverified",
      source: "Sin pago acreditado",
      amountCents: null,
    };
  return {
    state: payment.status,
    source:
      payment.provider === "mercadopago"
        ? "Mercado Pago"
        : payment.provider === "manual"
          ? "Venta manual"
          : payment.provider === "culqi"
            ? "Culqi"
            : "Otro medio",
    amountCents: Number.isFinite(Number(payment.amount))
      ? Number(payment.amount)
      : null,
    ...(payment.charge_id ? { chargeId: String(payment.charge_id) } : {}),
    ...(payment.order_id ? { orderId: String(payment.order_id) } : {}),
    ...(payment.receipt_number
      ? { receiptNumber: String(payment.receipt_number) }
      : {}),
    ...(payment.paid_at ? { paidAt: String(payment.paid_at) } : {}),
  };
}

export function ticketPaymentLabel(
  paymentStatus?: string | null,
  saleOrigin?: string | null,
) {
  if (paymentStatus === "paid") return "Pagada";
  if (paymentStatus === "refunded") return "Pago devuelto";
  if (paymentStatus === "pending") return "Pago pendiente";
  if (paymentStatus === "failed") return "Pago fallido";
  return saleOrigin === "ticket" || saleOrigin === "table"
    ? "Sin pago acreditado"
    : "Código de invitación";
}

export function matchesTicketSaleFilter(ticket: any, kind?: string) {
  const code = Array.isArray(ticket.code) ? ticket.code[0] : ticket.code;
  const sale = Boolean(
    ticket.table_reservation_id ||
      code?.table_reservation_id ||
      ticket.payment_status,
  );
  return kind === "sales" ? sale : kind === "invitations" ? !sale : true;
}
