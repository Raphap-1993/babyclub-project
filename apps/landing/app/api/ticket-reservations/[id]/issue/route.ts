import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { applyNotDeleted } from "shared/db/softDelete";
import { createTicketForReservation } from "../../../../../../backoffice/app/api/reservations/utils";
import { sendTicketEmail } from "../../../../../../backoffice/app/api/reservations/email";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const APPROVED_STATUSES = new Set(["approved", "confirmed", "paid"]);
const RESERVATION_SELECT =
  "id,event_id,sale_origin,status,promoter_id,full_name,email,phone,ticket_type_label,codes";
const UNIT_SELECT =
  "id,reservation_id,event_id,package_index,person_index,unit_index,status,full_name,doc_type,document,email,phone,ticket_id";

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

async function loadUnits(supabase: any, reservationId: string) {
  const { data, error } = await applyNotDeleted(
    supabase.from("ticket_reservation_units").select(UNIT_SELECT),
  )
    .eq("reservation_id", reservationId)
    .order("unit_index", { ascending: true });

  return {
    data: Array.isArray(data) ? data : [],
    error,
  };
}

function uniqueStrings(values: Array<string | null | undefined>) {
  return Array.from(
    new Set(
      values
        .map((value) => (value ? String(value).trim() : ""))
        .filter(Boolean),
    ),
  );
}

export async function POST(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const supabase = getSupabase();
  if (!supabase) return jsonError("Supabase config missing", 500);

  const { id } = await context.params;
  const reservation = await loadReservation(supabase, id);
  if (reservation.error) return jsonError(reservation.error.message, 500);
  if (!reservation.data) return jsonError("Reserva no encontrada", 404);
  if ((reservation.data as any).sale_origin !== "ticket") {
    return jsonError("La reserva no pertenece al flujo ticket-only", 400);
  }
  if (!APPROVED_STATUSES.has(String((reservation.data as any).status || "").toLowerCase())) {
    return jsonError("La reserva aún no está approved para emitir QRs", 400);
  }

  const units = await loadUnits(supabase, id);
  if (units.error) return jsonError(units.error.message, 500);

  const pendingNominationCount = units.data.filter(
    (unit: any) => unit.status === "pending_nomination",
  ).length;
  const issuableUnits = units.data.filter(
    (unit: any) => unit.status === "nominated" && !unit.ticket_id,
  );
  if (issuableUnits.length === 0) {
    return jsonError("No hay unidades nominadas listas para emitir", 409);
  }

  const issuedCodes: string[] = [];
  for (const unit of issuableUnits) {
    const result = await createTicketForReservation(supabase, {
      eventId: (reservation.data as any).event_id,
      tableName: (reservation.data as any).ticket_type_label || "Entrada",
      fullName: unit.full_name,
      email: unit.email || null,
      phone: unit.phone || null,
      dni: unit.doc_type === "dni" ? unit.document : null,
      docType: unit.doc_type || "dni",
      document: unit.document || "",
      promoterId: (reservation.data as any).promoter_id || null,
      reuseCodes: [],
      codeType: "courtesy",
      tableId: null,
      productId: null,
      tableReservationId: id,
    });

    issuedCodes.push(result.code);
    const { error: updateError } = await supabase
      .from("ticket_reservation_units")
      .update({
        status: "issued",
        ticket_id: result.ticketId,
        issued_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", unit.id)
      .eq("reservation_id", id);

    if (updateError) return jsonError(updateError.message, 500);

    if (unit.email) {
      await sendTicketEmail({
        supabase,
        ticketId: result.ticketId,
        toEmail: unit.email,
      });
    }
  }

  const mergedCodes = uniqueStrings([
    ...(((reservation.data as any).codes || []) as string[]),
    ...issuedCodes,
  ]);
  const { error: reservationUpdateError } = await supabase
    .from("table_reservations")
    .update({
      codes: mergedCodes,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (reservationUpdateError) {
    return jsonError(reservationUpdateError.message, 500);
  }

  const reloadedUnits = await loadUnits(supabase, id);
  if (reloadedUnits.error) return jsonError(reloadedUnits.error.message, 500);

  return NextResponse.json({
    success: true,
    issuedCount: issuableUnits.length,
    pendingNominationCount,
    codes: mergedCodes,
    units: reloadedUnits.data,
  });
}
