import { applyNotDeleted } from "shared/db/softDelete";

type SupabaseLike = {
  from: (table: string) => any;
};

export async function loadActiveTicketRefs(supabase: SupabaseLike) {
  const { data, error } = await applyNotDeleted(
    supabase
      .from("ticket_reservation_units")
      .select("reservation_id,ticket_id"),
  );

  if (error) {
    throw new Error(error.message || "No se pudieron cargar las unidades de ticket");
  }

  const activeTicketIds = new Set<string>();
  const trackedReservationIds = new Set<string>();

  (data || []).forEach((row: any) => {
    if (row?.reservation_id) trackedReservationIds.add(String(row.reservation_id));
    if (row?.ticket_id) activeTicketIds.add(String(row.ticket_id));
  });

  return { activeTicketIds, trackedReservationIds };
}

