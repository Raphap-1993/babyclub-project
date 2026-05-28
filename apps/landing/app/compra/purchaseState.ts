type PurchaseEventOption = {
  id: string;
  name?: string | null;
};

export function resolveInitialTicketEventId(
  currentTicketEventId: string,
  ticketEventOptions: PurchaseEventOption[],
) {
  if (currentTicketEventId) return currentTicketEventId;
  if (ticketEventOptions.length === 1) {
    return ticketEventOptions[0]?.id || "";
  }
  return "";
}

export function getTicketSubmitLabel({
  loading,
  ticketSaleBlocked,
  ticketRequiresEvent,
  ticketEventId,
  hasSelectedTicketType,
}: {
  loading: boolean;
  ticketSaleBlocked: boolean;
  ticketRequiresEvent: boolean;
  ticketEventId: string;
  hasSelectedTicketType: boolean;
}) {
  if (loading) return "Procesando...";
  if (ticketSaleBlocked) return "Venta bloqueada";
  if (ticketRequiresEvent && !ticketEventId) return "Selecciona evento";
  if (!hasSelectedTicketType) return "Sin entradas disponibles";
  return "Revisar compra";
}
