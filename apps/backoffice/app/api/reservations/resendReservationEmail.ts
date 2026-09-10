import { NextResponse } from "next/server";
import { applyNotDeleted } from "shared/db/softDelete";
import {
  isValidEmailAddress,
  normalizeEmailAddress,
} from "shared/email/address";
import { getPublicLandingUrl } from "shared/publicUrl";
import { resolveReservationTicketQuantity } from "shared/reservationTicketQuantity";
import { sendApprovalEmail } from "./email";

const APPROVED_STATUSES = new Set(["approved", "confirmed", "paid"]);

function uniqueStrings(values: unknown[]) {
  return Array.from(
    new Set(
      values
        .filter((value): value is string => typeof value === "string")
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  );
}

function errorResponse(error: string, status: number) {
  return NextResponse.json(
    { success: false, error, sentCount: 0, ticketsCreated: 0 },
    { status },
  );
}

// Resending is notification only. Issuance and nomination belong to their own flows.
export async function resendReservationEmail(
  supabase: any,
  reservationId: string,
) {
  const { data: reservation, error: reservationError } = await applyNotDeleted(
    supabase
      .from("table_reservations")
      .select(
        "id,full_name,email,phone,sale_origin,status,codes,ticket_quantity,total_ticket_units,ticket_type_label,event_id,table:tables(id,name,event_id,ticket_count,event:events(id,name,starts_at,location)),event:event_id(id,name,starts_at,location)",
      ),
  )
    .eq("id", reservationId)
    .maybeSingle();
  if (reservationError)
    return errorResponse("No se pudo consultar la reserva", 500);
  if (!reservation) return errorResponse("Reserva no encontrada", 404);
  if (!APPROVED_STATUSES.has(String(reservation.status || "").toLowerCase())) {
    return errorResponse(
      "Solo puedes reenviar correos para reservas aprobadas",
      400,
    );
  }
  const recipient = normalizeEmailAddress(
    typeof reservation.email === "string" ? reservation.email : "",
  );
  if (!isValidEmailAddress(recipient)) {
    return errorResponse(
      "El correo de la reserva es inválido. Corrígelo antes de reenviar.",
      400,
    );
  }

  const table = Array.isArray(reservation.table)
    ? reservation.table[0]
    : reservation.table;
  const tableEvent = Array.isArray(table?.event)
    ? table.event[0]
    : table?.event;
  const directEvent = Array.isArray(reservation.event)
    ? reservation.event[0]
    : reservation.event;
  const event = tableEvent || directEvent || null;
  const eventId = reservation.event_id || table?.event_id || event?.id || null;
  const isTableReservation =
    reservation.sale_origin === "table" || Boolean(table?.id);
  const legacyCodes = uniqueStrings(
    Array.isArray(reservation.codes) ? reservation.codes : [],
  );
  const activeTickets = () => {
    let query = applyNotDeleted(supabase.from("tickets").select("id")).eq(
      "is_active",
      true,
    );
    if (eventId) query = query.eq("event_id", eventId);
    return query;
  };

  const [unitResult, directTickets, reservationCodes, legacyCodeRows] =
    await Promise.all([
      applyNotDeleted(
        supabase
          .from("ticket_reservation_units")
          .select("unit_index,status,ticket_id"),
      ).eq("reservation_id", reservationId),
      activeTickets().eq("table_reservation_id", reservationId),
      applyNotDeleted(supabase.from("codes").select("id,code"))
        .eq("table_reservation_id", reservationId)
        .eq("is_active", true),
      legacyCodes.length > 0
        ? applyNotDeleted(supabase.from("codes").select("id,code"))
            .in("code", legacyCodes)
            .eq("is_active", true)
        : Promise.resolve({ data: [], error: null }),
    ]);
  if (
    [unitResult, directTickets, reservationCodes, legacyCodeRows].some(
      (result) => result.error,
    )
  ) {
    return errorResponse(
      "No se pudieron consultar las entradas de la reserva. Intenta nuevamente.",
      500,
    );
  }
  const units: any[] = Array.isArray(unitResult.data) ? unitResult.data : [];
  const codeRows = [
    ...(reservationCodes.data || []),
    ...(legacyCodeRows.data || []),
  ];
  const codeIds = uniqueStrings(codeRows.map((row) => row.id));
  const unitTicketIds = uniqueStrings(
    units
      .filter((unit) => unit.status === "issued")
      .map((unit) => unit.ticket_id),
  );
  const [unitTickets, codeTickets] = await Promise.all([
    unitTicketIds.length > 0
      ? activeTickets().in("id", unitTicketIds)
      : Promise.resolve({ data: [], error: null }),
    codeIds.length > 0
      ? activeTickets().in("code_id", codeIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (unitTickets.error || codeTickets.error) {
    return errorResponse(
      "No se pudieron consultar las entradas de la reserva. Intenta nuevamente.",
      500,
    );
  }

  const ticketIds = uniqueStrings(
    [
      ...(directTickets.data || []),
      ...(unitTickets.data || []),
      ...(codeTickets.data || []),
    ].map((row) => row.id),
  );
  const codes = uniqueStrings(codeRows.map((row) => row.code));
  const ticketQuantity = resolveReservationTicketQuantity({
    totalTicketUnits: reservation.total_ticket_units,
    ticketQuantity: reservation.ticket_quantity,
    codesCount: codes.length,
    liveTableTicketCount: table?.ticket_count,
    minimum: 1,
  });
  const pendingCount = Math.max(0, ticketQuantity - ticketIds.length);

  try {
    await sendApprovalEmail({
      supabase,
      id: reservationId,
      full_name: reservation.full_name || "",
      email: recipient,
      phone: reservation.phone || null,
      codes,
      ticketIds: ticketIds.length > 0 ? ticketIds : undefined,
      tableName: table?.name || reservation.ticket_type_label || "Entrada",
      event,
      resourceLabel: isTableReservation ? "Mesa" : "Entrada",
      callToAction: {
        label: "Ver mis entradas",
        url: `${getPublicLandingUrl()}/compra?reservationId=${encodeURIComponent(reservationId)}`,
      },
    });
  } catch {
    return errorResponse(
      "No pudimos reenviar el correo. Las entradas siguen disponibles; intenta nuevamente.",
      502,
    );
  }

  return NextResponse.json({
    success: true,
    message: "Correo de la reserva reenviado al comprador",
    sentCount: 1,
    ticketsCreated: 0,
    unitsPrepared: false,
    ticketId: ticketIds[0] || null,
    ticketIds,
    codesCount: codes.length,
    pendingCount,
    skippedCount: pendingCount,
    ticketEmailError: null,
    reservationEmailError: null,
  });
}
