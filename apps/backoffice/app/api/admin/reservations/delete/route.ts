import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireStaffRole } from "shared/auth/requireStaff";
import { applyNotDeleted, buildArchivePayload } from "shared/db/softDelete";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DELETE_CONFIRM_TEXT = "eliminar";

function uniqueStrings(values: Array<string | null | undefined>): string[] {
  return Array.from(new Set(values.map((value) => (value ? String(value).trim() : "")).filter(Boolean)));
}

export async function archiveReservation(req: NextRequest) {
  const guard = await requireStaffRole(req);
  if (!guard.ok) {
    return NextResponse.json({ success: false, error: guard.error }, { status: guard.status });
  }
  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json({ success: false, error: "Supabase config missing" }, { status: 500 });
  }

  let body: any = null;
  try {
    body = await req.json();
  } catch (_err) {
    return NextResponse.json({ success: false, error: "Invalid JSON" }, { status: 400 });
  }

  const id = typeof body?.id === "string" ? body.id : "";
  const confirmation =
    typeof body?.confirmation === "string"
      ? body.confirmation
      : typeof body?.confirm === "string"
        ? body.confirm
        : "";

  if (!id) return NextResponse.json({ success: false, error: "id es requerido" }, { status: 400 });
  if (confirmation.trim().toLowerCase() !== DELETE_CONFIRM_TEXT) {
    return NextResponse.json(
      { success: false, error: `Confirmación inválida. Escribe "${DELETE_CONFIRM_TEXT}" para eliminar.` },
      { status: 400 }
    );
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const reservationQuery = applyNotDeleted(
    supabase.from("table_reservations").select("id,codes").eq("id", id).limit(1)
  );
  const { data: reservation, error: reservationError } = await reservationQuery.maybeSingle();
  if (reservationError) {
    return NextResponse.json({ success: false, error: reservationError.message }, { status: 500 });
  }
  if (!reservation) {
    return NextResponse.json({ success: false, error: "Reserva no encontrada" }, { status: 404 });
  }

  const legacyCodes = Array.isArray((reservation as any).codes)
    ? (reservation as any).codes.map((value: any) => String(value || "").trim()).filter(Boolean)
    : [];

  const [codesByReservation, codesByLegacyCodes] = await Promise.all([
    supabase
      .from("codes")
      .select("id,code")
      .eq("table_reservation_id", id)
      .is("deleted_at", null),
    legacyCodes.length > 0
      ? supabase.from("codes").select("id,code").in("code", legacyCodes).is("deleted_at", null)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (codesByReservation.error) {
    return NextResponse.json({ success: false, error: codesByReservation.error.message }, { status: 500 });
  }
  if (codesByLegacyCodes.error) {
    return NextResponse.json({ success: false, error: codesByLegacyCodes.error.message }, { status: 500 });
  }

  const codeIds = uniqueStrings([
    ...((codesByReservation.data || []).map((row: any) => row.id) as string[]),
    ...((codesByLegacyCodes.data || []).map((row: any) => row.id) as string[]),
  ]);

  if (codeIds.length > 0) {
    const { error: deactivateCodesError } = await supabase
      .from("codes")
      .update({ is_active: false })
      .in("id", codeIds);
    if (deactivateCodesError) {
      return NextResponse.json({ success: false, error: deactivateCodesError.message }, { status: 500 });
    }
  }

  const ticketIds: string[] = [];
  const [ticketsByReservation, ticketsByCodes] = await Promise.all([
    supabase.from("tickets").select("id").eq("table_reservation_id", id).is("deleted_at", null),
    codeIds.length > 0
      ? supabase.from("tickets").select("id").in("code_id", codeIds).is("deleted_at", null)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (ticketsByReservation.error) {
    return NextResponse.json({ success: false, error: ticketsByReservation.error.message }, { status: 500 });
  }
  if (ticketsByCodes.error) {
    return NextResponse.json({ success: false, error: ticketsByCodes.error.message }, { status: 500 });
  }

  ticketIds.push(...uniqueStrings((ticketsByReservation.data || []).map((row: any) => row.id)));
  ticketIds.push(...uniqueStrings((ticketsByCodes.data || []).map((row: any) => row.id)));

  const uniqueTicketIds = uniqueStrings(ticketIds);
  if (uniqueTicketIds.length > 0) {
    const { error: deactivateTicketsError } = await supabase
      .from("tickets")
      .update({ is_active: false })
      .in("id", uniqueTicketIds);
    if (deactivateTicketsError) {
      return NextResponse.json({ success: false, error: deactivateTicketsError.message }, { status: 500 });
    }
  }

  const archivePayload = buildArchivePayload(guard.context?.staffId);
  const archiveQuery = applyNotDeleted(supabase.from("table_reservations").update(archivePayload).eq("id", id));
  const { error: archiveError } = await archiveQuery;
  if (archiveError) {
    return NextResponse.json({ success: false, error: archiveError.message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    archived: true,
    deactivated_codes: codeIds.length,
    deactivated_tickets: uniqueTicketIds.length,
  });
}

export async function POST(req: NextRequest) {
  return archiveReservation(req);
}
