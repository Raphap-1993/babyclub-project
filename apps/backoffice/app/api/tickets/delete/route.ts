import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireStaffRole } from "shared/auth/requireStaff";
import { applyNotDeleted, buildArchivePayload } from "shared/db/softDelete";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function archiveTicket(req: Request) {
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
  if (!id) return NextResponse.json({ success: false, error: "id requerido" }, { status: 400 });

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Obtener info básica antes de archivar.
  const ticketQuery = applyNotDeleted(
    supabase
      .from("tickets")
      .select("id,event_id,email,phone,code_id,table_reservation_id")
      .eq("id", id)
      .limit(1)
  );
  const { data: ticketRow, error: fetchError } = await ticketQuery.maybeSingle();

  if (fetchError) {
    return NextResponse.json({ success: false, error: fetchError.message }, { status: 500 });
  }

  const archivePayload = buildArchivePayload(guard.context?.staffId);
  const { error } = await supabase.from("tickets").update(archivePayload).eq("id", id);
  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  if (ticketRow) {
    // Decrementar uses del código y reactivarlo si corresponde
    const codeId = (ticketRow as any).code_id as string | null;
    if (codeId) {
      const { data: codeRow } = await supabase
        .from("codes")
        .select("uses,max_uses,is_active")
        .eq("id", codeId)
        .maybeSingle();
      if (codeRow) {
        const newUses = Math.max(0, (codeRow.uses ?? 1) - 1);
        const shouldReactivate =
          !codeRow.is_active &&
          codeRow.max_uses != null &&
          newUses < codeRow.max_uses;
        await supabase
          .from("codes")
          .update({
            uses: newUses,
            ...(shouldReactivate ? { is_active: true } : {}),
          })
          .eq("id", codeId);
      }
    }

    const linkedReservationId =
      typeof (ticketRow as any).table_reservation_id === "string"
        ? (ticketRow as any).table_reservation_id
        : null;

    if (linkedReservationId) {
      const reservationQuery = applyNotDeleted(
        supabase
          .from("table_reservations")
          .select("id,sale_origin,status")
          .eq("id", linkedReservationId)
          .limit(1)
      );
      const { data: linkedReservation, error: linkedReservationError } =
        await reservationQuery.maybeSingle();
      if (linkedReservationError) {
        return NextResponse.json(
          { success: false, error: linkedReservationError.message },
          { status: 500 }
        );
      }

      const reservationOrigin = String(
        (linkedReservation as any)?.sale_origin || ""
      ).toLowerCase();
      const activeStatuses = ["pending", "approved", "confirmed", "paid"];

      // Solo liberar reservas nacidas como compra de entradas.
      // Las reservas de mesa deben anularse explícitamente desde su propio CRUD.
      if (linkedReservation?.id && reservationOrigin === "ticket") {
        await supabase
          .from("table_reservations")
          .update({ status: "rejected" })
          .eq("id", linkedReservation.id)
          .in("status", activeStatuses);
      }
    }
  }

  return NextResponse.json({ success: true, archived: true });
}

export async function POST(req: Request) {
  return archiveTicket(req);
}
