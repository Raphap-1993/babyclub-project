import type { SupabaseClient } from "@supabase/supabase-js";
import { isValidEmailAddress } from "shared/email/address";
import { getTicketAccessState } from "shared/ticketAccess";
import { ticketQrDataUrl } from "shared/ticketQr";
import type { CustomerIdentity } from "./customerAccessCrypto";

const one = (value: any) => (Array.isArray(value) ? value[0] : value);
export function matchesCustomerDocument(row: any, dni: string) {
  if (row.doc_type && String(row.doc_type).toLowerCase() !== "dni")
    return false;
  return String(row.document || row.dni || "").trim() === dni;
}
const validEmail = (value: unknown) =>
  typeof value === "string" &&
  isValidEmailAddress(value) &&
  !/[,;<>\\\r\n]/.test(value);

export async function customerRecords(
  db: SupabaseClient,
  dni: string,
  email?: string,
) {
  const cutoff = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();
  const eventFields =
    "id,name,starts_at,location,entry_limit,is_active,closed_at,deleted_at";
  let ticketsQuery = db
    .from("tickets")
    .select(
      `id,event_id,email,doc_type,document,dni,full_name,qr_token,used,is_active,deleted_at,payment_status,event:events!inner(${eventFields}),code:codes(type,expires_at)`,
    )
    .or(
      `and(or(document.eq.${dni},dni.eq.${dni}),or(payment_status.is.null,payment_status.eq.paid))`,
    )
    .eq("is_active", true)
    .is("deleted_at", null);
  let reservationsQuery = db
    .from("table_reservations")
    .select(
      `id,event_id,email,doc_type,document,full_name,status,sale_origin,ticket_quantity,event:events!inner(${eventFields}),table:tables(name)`,
    )
    .eq("document", dni)
    .eq("status", "approved")
    .eq("is_active", true)
    .is("deleted_at", null);
  // SQL filters shrink the result; identity comparisons below enforce exact ownership.
  if (email) {
    const escaped = email.replace(/[\\%_]/g, "\\$&");
    ticketsQuery = ticketsQuery.ilike("email", escaped);
    reservationsQuery = reservationsQuery.ilike("email", escaped);
  }
  const upcoming = (query: any) =>
    query
      .eq("event.is_active", true)
      .is("event.deleted_at", null)
      .is("event.closed_at", null)
      .gte("event.starts_at", cutoff)
      .order("event(starts_at)", { ascending: true })
      .limit(100);
  const [tickets, reservations] = await Promise.all([
    upcoming(ticketsQuery),
    upcoming(reservationsQuery),
  ]);
  if (tickets.error || reservations.error)
    throw new Error("Customer lookup unavailable");
  const owned = (row: any) =>
    matchesCustomerDocument(row, dni) &&
    validEmail(row.email) &&
    (!email || row.email.trim().toLowerCase() === email);
  return {
    tickets: (tickets.data || []).filter(owned),
    reservations: (reservations.data || []).filter(owned),
  };
}

export async function findCustomerIdentity(
  db: SupabaseClient,
  dni: string,
): Promise<CustomerIdentity | null> {
  const rows = await customerRecords(db, dni);
  const ordered = [...rows.tickets, ...rows.reservations].sort(
    (a, b) =>
      Date.parse(one(a.event).starts_at) - Date.parse(one(b.event).starts_at),
  );
  return ordered[0]
    ? { dni, email: ordered[0].email.trim().toLowerCase() }
    : null;
}

export async function readCustomerWallet(
  db: SupabaseClient,
  identity: CustomerIdentity,
) {
  const rows = await customerRecords(db, identity.dni, identity.email);
  const events = [...rows.tickets, ...rows.reservations]
    .map((row) => one(row.event))
    .sort(
      (a, b) =>
        Date.parse(a.starts_at) - Date.parse(b.starts_at) ||
        a.id.localeCompare(b.id),
    );
  const event = events[0];
  if (!event) return { event: null, tickets: [], reservations: [] };
  const tickets = rows.tickets.filter((row: any) => row.event_id === event.id);
  const reservations = rows.reservations.filter(
    (row: any) => row.event_id === event.id,
  );
  const ids = tickets.map((row: any) => row.id);
  const units = ids.length
    ? await db
        .from("ticket_reservation_units")
        .select("ticket_id,status,deleted_at")
        .in("ticket_id", ids)
    : { data: [], error: null };
  if (units.error) throw new Error("Ticket status unavailable");
  const walletTickets = await Promise.all(
    tickets.map(async (ticket: any) => {
      const matchingUnits = (units.data || []).filter(
        (row: any) => row.ticket_id === ticket.id,
      );
      const unit = matchingUnits[0];
      const access =
        matchingUnits.length > 1
          ? { state: "pending" as const }
          : getTicketAccessState({
              ticket,
              event,
              code: one(ticket.code),
              unit,
            });
      return {
        id: ticket.id,
        name: ticket.full_name || "Tu entrada",
        state: access.state,
        qr:
          access.state === "ready" && ticket.qr_token
            ? await ticketQrDataUrl(ticket.qr_token)
            : null,
      };
    }),
  );
  return {
    event: {
      name: event.name,
      startsAt: event.starts_at,
      location: event.location,
    },
    tickets: walletTickets,
    reservations: reservations.map((row: any) => ({
      id: row.id,
      label:
        one(row.table)?.name ||
        (row.sale_origin === "table"
          ? "Tu mesa o box"
          : "Tu compra de entradas"),
      href: `/compra?reservationId=${encodeURIComponent(row.id)}`,
    })),
  };
}
