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

function normalizeText(value: string | null | undefined) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function normalizePhone(value: string | null | undefined) {
  return String(value || "").replace(/\D/g, "");
}

export function isReservationOwner(ticket: TicketOwnerIdentity, reservation: ReservationOwnerIdentity) {
  const ticketDocument = normalizeText(ticket.document || ticket.dni || null);
  const reservationDocument = normalizeText(reservation.document || null);

  // If both documents exist, they are the strongest identity signal.
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
