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
        "Aún no pudimos abrir tu QR. Entra a tu compra para revisar el estado, usar tus códigos y continuar con tu grupo cuando quieras.",
      primaryAction: {
        label: "Gestionar grupo",
        href: workspaceHref,
      },
      secondaryAction: null,
    };
  }

  const secondaryAction =
    pendingNominationCount > 0
      ? {
          label: "Gestionar grupo",
          href: workspaceHref,
        }
      : null;
  const description =
    pendingNominationCount > 0
      ? `Tu entrada ya está emitida. Abre tu QR cuando quieras y deja ${pendingNominationCount} asistente${pendingNominationCount === 1 ? "" : "s"} pendiente${pendingNominationCount === 1 ? "" : "s"} para después.`
      : "Tu entrada ya está emitida. Abre tu QR cuando quieras y también puedes usar tu código si luego necesitas volver al registro.";

  return {
    buyerTicketId,
    pendingNominationCount,
    eyebrow: "✓ Compra confirmada",
    title: "Tu QR ya está listo",
    description,
    primaryAction: {
      label: "Abrir mi QR",
      href: `/ticket/${encodeURIComponent(buyerTicketId)}`,
    },
    secondaryAction,
  };
}
