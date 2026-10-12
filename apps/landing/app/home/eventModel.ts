import { evaluateEventSales, type EventSalesSnapshot } from "shared/eventSales";
import type { TicketTypeOption } from "shared/ticketTypes";
import { DateTime } from "luxon";

export type HomeEvent = EventSalesSnapshot & {
  id: string;
  name?: string | null;
  starts_at?: string | null;
  location?: string | null;
  cover_image?: string | null;
  ticket_types?: TicketTypeOption[];
};

export function eventDate(value?: string | null) {
  if (!value) return null;
  const date = DateTime.fromISO(value, { zone: "utc" });
  return date.isValid ? date.toJSDate() : null;
}

export function formatEventDate(value?: string | null) {
  const date = eventDate(value);
  if (!date) return { label: "Fecha por confirmar", iso: undefined };
  const day = new Intl.DateTimeFormat("es-PE", {
    timeZone: "America/Lima",
    day: "2-digit",
    month: "short",
  })
    .format(date)
    .replaceAll(".", "")
    .toUpperCase();
  const time = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Lima",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);
  return { label: `${day} · ${time}`, iso: date.toISOString() };
}

export function eventPresentation(event: HomeEvent) {
  const sale = evaluateEventSales(event);
  const options = (event.ticket_types || []).filter(
    (type) =>
      type.isActive &&
      Number.isFinite(type.price) &&
      type.price > 0 &&
      type.ticketQuantity > 0 &&
      (!type.currencyCode || type.currencyCode === "PEN"),
  );
  const lowest = [...options].sort((a, b) => a.price - b.price)[0];
  const canBuy = sale.available && Boolean(lowest);
  const status =
    sale.block_reason === "sold_out"
      ? "Agotado"
      : sale.block_reason === "event_closed" ||
          sale.block_reason === "event_inactive"
        ? "Venta cerrada"
        : sale.block_reason === "sales_paused"
          ? "Venta pausada"
          : canBuy
            ? "Entradas disponibles"
            : "Próximamente";
  const price = lowest
    ? `Desde S/ ${new Intl.NumberFormat("es-PE", { maximumFractionDigits: 2 }).format(lowest.price)}${lowest.ticketQuantity > 1 ? ` · pack de ${lowest.ticketQuantity}` : ""}`
    : null;
  return { status, price, canBuy, message: sale.public_message };
}

export function sortHomeEvents(events: HomeEvent[]) {
  return [...events].sort(
    (a, b) =>
      (eventDate(a.starts_at)?.getTime() ?? Infinity) -
      (eventDate(b.starts_at)?.getTime() ?? Infinity),
  );
}
