type ConfirmationAction = {
  label: string;
  href: string;
};

type ConfirmationUnit = {
  unit_index?: number | null;
  status?: string | null;
  ticket_id?: string | null;
};

export type TicketPurchaseConfirmationState = {
  buyerTicketId: string | null;
  pendingNominationCount: number;
  eyebrow: string;
  title: string;
  description: string;
  supportCodeLabel: string;
  supportCodeHint: string;
  primaryAction: ConfirmationAction;
  secondaryAction: ConfirmationAction | null;
};

export function deriveTicketPurchaseConfirmation({
  reservationId,
  units,
}: {
  reservationId: string;
  units: ConfirmationUnit[];
}): TicketPurchaseConfirmationState {
  const workspaceHref = `/compra?reservationId=${encodeURIComponent(
    reservationId,
  )}`;
  const buyerUnit =
    units.find((unit) => Number(unit.unit_index || 0) === 1) || null;
  const buyerTicketId =
    typeof buyerUnit?.ticket_id === "string" && buyerUnit.ticket_id.trim()
      ? buyerUnit.ticket_id
      : null;
  const pendingNominationCount = units.filter(
    (unit) =>
      Number(unit.unit_index || 0) > 1 &&
      String(unit.status || "").trim() === "pending_nomination",
  ).length;

  if (!buyerTicketId) {
    return {
      buyerTicketId: null,
      pendingNominationCount,
      eyebrow: "✓ Compra registrada",
      title: "Tu compra quedó guardada",
      description:
        "No pudimos emitir el ticket del comprador en este momento. Entra a tu compra para revisar el estado, abrir el workspace y retomar la nominación cuando corresponda.",
      supportCodeLabel: "Código de compra",
      supportCodeHint:
        "Guarda este código para consultar el estado de la compra y retomar el proceso si lo necesitas.",
      primaryAction: {
        label: "Ir a mi compra",
        href: workspaceHref,
      },
      secondaryAction: null,
    };
  }

  const secondaryAction =
    pendingNominationCount > 0
      ? {
          label: "Completar asistentes",
          href: workspaceHref,
        }
      : null;
  const description =
    pendingNominationCount > 0
      ? `Emitimos el ticket del comprador y dejamos el workspace listo para el resto del grupo. Completa la nominación de ${pendingNominationCount} asistente${pendingNominationCount === 1 ? "" : "s"} pendiente${pendingNominationCount === 1 ? "" : "s"} cuando quieras.`
      : "Emitimos el ticket del comprador y cerramos la compra. Puedes abrir tu QR desde aquí y usar el código de compra si luego necesitas consultar el detalle.";

  return {
    buyerTicketId,
    pendingNominationCount,
    eyebrow: "✓ Compra confirmada",
    title: "Tu entrada ya fue emitida",
    description,
    supportCodeLabel: "Código de compra",
    supportCodeHint:
      pendingNominationCount > 0
        ? "Guarda este código para consultar la compra y completar la nominación pendiente."
        : "Guarda este código por si luego necesitas consultar el detalle de tu compra.",
    primaryAction: {
      label: "Ver mi ticket",
      href: `/ticket/${encodeURIComponent(buyerTicketId)}`,
    },
    secondaryAction,
  };
}
