import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { applyNotDeleted } from "shared/db/softDelete";
import { createTicketForReservation } from "../../../../../../../../backoffice/app/api/reservations/utils";
import { sendTicketEmail } from "../../../../../../../../backoffice/app/api/reservations/email";
import {
  ReservationIssueError,
  issueReservationUnits,
} from "../../../../lib/issueReservationUnits";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const APPROVED_STATUSES = new Set(["approved", "confirmed", "paid"]);
const RESERVATION_SELECT =
  "id,event_id,table_id,product_id,sale_origin,status,promoter_id,full_name,email,phone,doc_type,document,ticket_type_label,codes,table:tables(name)";

function getSupabase() {
  if (!supabaseUrl || !supabaseServiceKey) return null;
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function jsonError(error: string, status: number) {
  return NextResponse.json({ success: false, error }, { status });
}

async function loadReservation(supabase: any, reservationId: string) {
  const { data, error } = await applyNotDeleted(
    supabase.from("table_reservations").select(RESERVATION_SELECT),
  )
    .eq("id", reservationId)
    .maybeSingle();

  return { data, error };
}

export async function POST(
  _req: NextRequest,
  context: { params: Promise<{ id: string; unitId: string }> },
) {
  const supabase = getSupabase();
  if (!supabase) return jsonError("Supabase config missing", 500);

  const { id, unitId } = await context.params;
  const reservation = await loadReservation(supabase, id);
  if (reservation.error) return jsonError(reservation.error.message, 500);
  if (!reservation.data) return jsonError("Reserva no encontrada", 404);

  const saleOrigin = String((reservation.data as any).sale_origin || "")
    .trim()
    .toLowerCase();
  if (saleOrigin !== "ticket" && saleOrigin !== "table") {
    return jsonError("La reserva no pertenece al flujo de nominación", 400);
  }
  if (
    !APPROVED_STATUSES.has(
      String((reservation.data as any).status || "").toLowerCase(),
    )
  ) {
    return jsonError("La reserva aún no está approved para emitir QRs", 400);
  }

  try {
    const payload = await issueReservationUnits({
      supabase,
      reservation: reservation.data,
      reservationId: id,
      targetUnitId: unitId,
      createTicketForReservationFn: createTicketForReservation,
      sendTicketEmailFn: sendTicketEmail,
    });
    return NextResponse.json(payload);
  } catch (err: any) {
    if (err instanceof ReservationIssueError) {
      return jsonError(err.message, err.status);
    }
    return jsonError(err?.message || "No se pudo emitir el QR de la unidad", 500);
  }
}
