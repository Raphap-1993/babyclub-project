import {
  readActivePromoter,
  PurchaseAttributionError,
} from "shared/promoterAttribution";
import { evaluateEventSales } from "shared/eventSales";
import { normalizeTicketTypesFromEvent } from "shared/ticketTypes";
import { applyEventTableAvailability } from "shared/tableAvailability";

export async function getPermanentPromoterPage(
  supabase: any,
  promoterId: string,
) {
  const promoter = await readActivePromoter(supabase, promoterId);
  const { data, error } = await supabase
    .from("events")
    .select(
      "id,name,starts_at,is_active,closed_at,sale_status,sale_public_message,early_bird_enabled,early_bird_price_1,early_bird_price_2,all_night_price_1,all_night_price_2,ticket_types:event_ticket_types(id,code,label,sale_phase,ticket_quantity,price,currency_code,is_active,sort_order)",
    )
    .is("deleted_at", null)
    .order("starts_at", { ascending: true });
  if (error)
    throw new PurchaseAttributionError(
      "Los eventos no están disponibles temporalmente",
      503,
    );
  const events: Array<{
    id: string;
    name: string;
    startsAt: string | null;
    purchaseUrl: string;
  }> = [];
  for (const event of data || []) {
    if (!evaluateEventSales(event).available) continue;
    const ticketsAvailable = normalizeTicketTypesFromEvent(event).length > 0;
    if (!ticketsAvailable && !(await hasAvailableTable(supabase, event.id)))
      continue;
    const params = new URLSearchParams({
      event_id: event.id,
      promoter_ref: promoter.id,
      tab: ticketsAvailable ? "ticket" : "mesa",
    });
    events.push({
      id: event.id,
      name: event.name,
      startsAt: event.starts_at || null,
      purchaseUrl: `/compra?${params}`,
    });
  }
  return { promoterId: promoter.id as string, events };
}

async function hasAvailableTable(supabase: any, eventId: string) {
  const [tables, availability, reservations] = await Promise.all([
    supabase
      .from("tables")
      .select(
        "id,event_id,is_active,products:table_products(id,is_active,deleted_at)",
      )
      .is("deleted_at", null)
      .eq("is_active", true),
    supabase
      .from("table_availability")
      .select("table_id,is_available")
      .eq("event_id", eventId),
    supabase
      .from("table_reservations")
      .select("table_id,status")
      .eq("event_id", eventId)
      .is("deleted_at", null)
      .in("status", ["pending", "approved", "confirmed", "paid"]),
  ]);
  if (tables.error || availability.error || reservations.error)
    throw new PurchaseAttributionError(
      "La oferta no está disponible temporalmente",
      503,
    );
  const reserved = new Set(
    (reservations.data || []).map((row: any) => row.table_id),
  );
  return applyEventTableAvailability<any>(
    tables.data,
    availability.data,
    eventId,
  ).some(
    (table) =>
      !reserved.has(table.id) &&
      table.products?.some(
        (product: any) => product.is_active !== false && !product.deleted_at,
      ),
  );
}
