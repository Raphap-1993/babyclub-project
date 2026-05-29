export function getNominationReservationId(searchParams: URLSearchParams) {
  return searchParams.get("reservationId") || searchParams.get("reserva");
}
