type PurchaseEventOption = {
  id: string;
  name?: string | null;
};

export function getTicketEmptyStateMessage({
  hasTicketEvents,
  ticketEventId,
  hasSelectedTicketType,
}: {
  hasTicketEvents: boolean;
  ticketEventId: string;
  hasSelectedTicketType: boolean;
}) {
  if (!hasTicketEvents) {
    return "No hay eventos con entradas disponibles ahora.";
  }
  if (!ticketEventId) {
    return "Selecciona el evento para ver entradas disponibles.";
  }
  if (!hasSelectedTicketType) {
    return "No hay entradas disponibles para este evento.";
  }
  return "Entradas disponibles";
}

export function shouldShowTicketTypeEmptyState({
  hasTicketEvents,
  hasSelectedTicketType,
}: {
  hasTicketEvents: boolean;
  hasSelectedTicketType: boolean;
}) {
  return hasTicketEvents && !hasSelectedTicketType;
}

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
  hasTicketEvents,
  ticketEventId,
  hasSelectedTicketType,
}: {
  loading: boolean;
  ticketSaleBlocked: boolean;
  ticketRequiresEvent: boolean;
  hasTicketEvents: boolean;
  ticketEventId: string;
  hasSelectedTicketType: boolean;
}) {
  if (loading) return "Procesando...";
  if (ticketSaleBlocked) return "Venta bloqueada";
  if (!hasTicketEvents) return "Sin eventos disponibles";
  if (ticketRequiresEvent && !ticketEventId) return "Selecciona evento";
  if (!hasSelectedTicketType) return "Sin entradas disponibles";
  return "Revisar compra";
}
