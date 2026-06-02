import { applyNotDeleted } from "./db/softDelete";
import { getPublicAppUrl } from "./publicUrl";

type Supabase = any;

type TicketOwnerIdentity = {
  full_name?: string | null;
  email?: string | null;
  phone?: string | null;
  document?: string | null;
  dni?: string | null;
};

type ReservationOwnerIdentity = {
  full_name?: string | null;
  email?: string | null;
  phone?: string | null;
  document?: string | null;
};

type ResolveWorkspaceContextInput = {
  supabase: Supabase;
  reservationId: string | null;
  reservationSaleOrigin?: "table" | "ticket" | null;
  ticketOwner: TicketOwnerIdentity;
};

export type TicketReservationWorkspaceContext = {
  pendingAssistantCount: number;
  nominationUrl: string | null;
};

const ACTIVE_STATUSES = new Set(["approved", "confirmed", "paid"]);
const OPEN_ASSISTANT_STATUSES = new Set(["pending_nomination", "nominated"]);

function normalizeText(value: string | null | undefined) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function normalizePhone(value: string | null | undefined) {
  return String(value || "").replace(/\D/g, "");
}

export function isReservationOwner(
  ticket: TicketOwnerIdentity,
  reservation: ReservationOwnerIdentity,
) {
  const ticketDocument = normalizeText(ticket.document || ticket.dni || null);
  const reservationDocument = normalizeText(reservation.document || null);

  if (ticketDocument && reservationDocument) {
    return ticketDocument === reservationDocument;
  }

  const ticketEmail = normalizeText(ticket.email || null);
  const reservationEmail = normalizeText(reservation.email || null);
  if (ticketEmail && reservationEmail && ticketEmail === reservationEmail) {
    return true;
  }

  const ticketPhone = normalizePhone(ticket.phone || null);
  const reservationPhone = normalizePhone(reservation.phone || null);
  if (ticketPhone && reservationPhone && ticketPhone === reservationPhone) {
    return true;
  }

  const ticketName = normalizeText(ticket.full_name || null);
  const reservationName = normalizeText(reservation.full_name || null);
  if (ticketName && reservationName && ticketName === reservationName) {
    return true;
  }

  return false;
}

export async function resolveTicketReservationWorkspaceContext({
  supabase,
  reservationId,
  reservationSaleOrigin,
  ticketOwner,
}: ResolveWorkspaceContextInput): Promise<TicketReservationWorkspaceContext> {
  if (!supabase || !reservationId) {
    return { pendingAssistantCount: 0, nominationUrl: null };
  }

  const { data: reservation, error: reservationError } = await applyNotDeleted(
    supabase
      .from("table_reservations")
      .select("id,status,sale_origin,full_name,email,phone,document"),
  )
    .eq("id", reservationId)
    .limit(1)
    .maybeSingle();

  if (reservationError || !reservation) {
    return { pendingAssistantCount: 0, nominationUrl: null };
  }

  const saleOrigin =
    reservationSaleOrigin || String((reservation as any).sale_origin || "");
  const status = String((reservation as any).status || "").toLowerCase();
  if (saleOrigin !== "ticket" || !ACTIVE_STATUSES.has(status)) {
    return { pendingAssistantCount: 0, nominationUrl: null };
  }

  if (!isReservationOwner(ticketOwner, reservation as ReservationOwnerIdentity)) {
    return { pendingAssistantCount: 0, nominationUrl: null };
  }

  const { data: units, error: unitsError } = await applyNotDeleted(
    supabase.from("ticket_reservation_units").select("unit_index,status,ticket_id"),
  )
    .eq("reservation_id", reservationId)
    .order("unit_index", { ascending: true });

  if (unitsError) {
    return { pendingAssistantCount: 0, nominationUrl: null };
  }

  const pendingAssistantCount = Array.isArray(units)
    ? units.filter((unit: any) => {
        const unitIndex = Number(unit?.unit_index || 0);
        const statusValue = String(unit?.status || "").trim().toLowerCase();
        const ticketId = String(unit?.ticket_id || "").trim();
        return (
          unitIndex > 1 &&
          OPEN_ASSISTANT_STATUSES.has(statusValue) &&
          !ticketId
        );
      }).length
    : 0;

  return {
    pendingAssistantCount,
    nominationUrl:
      pendingAssistantCount > 0
        ? `${getPublicAppUrl()}/compra?reservationId=${encodeURIComponent(
            reservationId,
          )}`
        : null,
  };
}
