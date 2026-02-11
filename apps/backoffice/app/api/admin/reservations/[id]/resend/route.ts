import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireStaffRole } from "shared/auth/requireStaff";
import { applyNotDeleted } from "shared/db/softDelete";
import { createTicketForReservation } from "../../../../reservations/utils";
import { sendApprovalEmail } from "../../../../reservations/email";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const APPROVED_STATUSES = new Set(["approved", "confirmed", "paid"]);

function uniqueStrings(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.map((value) => (value ? String(value).trim() : "")).filter(Boolean)));
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireStaffRole(req);
  if (!guard.ok) {
    return NextResponse.json({ success: false, error: guard.error }, { status: guard.status });
  }

  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json({ success: false, error: "Supabase config missing" }, { status: 500 });
  }

  const { id } = await params;
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const reservationQuery = applyNotDeleted(
    supabase
      .from("table_reservations")
      .select(
        `
        id,
        table_id,
        product_id,
        full_name,
        email,
        phone,
        doc_type,
        document,
        status,
        codes,
        ticket_id,
        ticket_quantity,
        event_id,
        promoter_id,
        table:tables(id,name,event_id,event:events(id,name,starts_at,location))
        `
      )
      .eq("id", id)
  );
  const { data: reservation, error: reservationError } = await reservationQuery.maybeSingle();
  if (reservationError || !reservation) {
    return NextResponse.json(
      { success: false, error: reservationError?.message || "Reserva no encontrada" },
      { status: 404 }
    );
  }

  const status = String((reservation as any).status || "").toLowerCase();
  if (!APPROVED_STATUSES.has(status)) {
    return NextResponse.json(
      { success: false, error: "Solo puedes reenviar correos para reservas aprobadas" },
      { status: 400 }
    );
  }

  const email = typeof (reservation as any).email === "string" ? (reservation as any).email.trim() : "";
  if (!email) {
    return NextResponse.json({ success: false, error: "Reserva sin correo de contacto" }, { status: 400 });
  }

  const tableRel = Array.isArray((reservation as any).table) ? (reservation as any).table?.[0] : (reservation as any).table;
  const eventRel = tableRel?.event ? (Array.isArray(tableRel.event) ? tableRel.event[0] : tableRel.event) : null;
  const eventData = eventRel || null;
  const eventId = tableRel?.event_id || eventRel?.id || (reservation as any).event_id || null;
  const tableName = tableRel?.name || "Entrada";
  const ticketQuantity =
    typeof (reservation as any).ticket_quantity === "number" && (reservation as any).ticket_quantity > 0
      ? Math.floor((reservation as any).ticket_quantity)
      : 1;

  const reservationCodes = Array.isArray((reservation as any).codes)
    ? (reservation as any).codes.map((c: any) => String(c || "").trim()).filter(Boolean)
    : [];

  const [codesByReservation, codesByLegacyList] = await Promise.all([
    supabase
      .from("codes")
      .select("id,code")
      .eq("table_reservation_id", id)
      .is("deleted_at", null)
      .eq("is_active", true),
    reservationCodes.length > 0
      ? supabase.from("codes").select("id,code").in("code", reservationCodes).is("deleted_at", null).eq("is_active", true)
      : Promise.resolve({ data: [], error: null }),
  ]);

  const resolvedCodeRows = [...(codesByReservation.data || []), ...(codesByLegacyList.data || [])];
  const resolvedCodes = uniqueStrings([
    ...resolvedCodeRows.map((row: any) => row.code),
    ...reservationCodes,
  ]);
  const codeIds = uniqueStrings(resolvedCodeRows.map((row: any) => row.id));

  const existingTicketIds = uniqueStrings([(reservation as any).ticket_id || null]);
  const { data: ticketsByReservation } = await supabase
    .from("tickets")
    .select("id")
    .eq("table_reservation_id", id)
    .is("deleted_at", null)
    .eq("is_active", true);
  existingTicketIds.push(...uniqueStrings((ticketsByReservation || []).map((row: any) => row.id)));
  if (codeIds.length > 0) {
    const { data: ticketsByCodes } = await supabase
      .from("tickets")
      .select("id")
      .in("code_id", codeIds)
      .is("deleted_at", null)
      .eq("is_active", true);
    existingTicketIds.push(...uniqueStrings((ticketsByCodes || []).map((row: any) => row.id)));
  }

  const ticketIds = uniqueStrings(existingTicketIds);
  const createdTicketIds: string[] = [];
  const createdTicketCodes: string[] = [];

  if (ticketIds.length === 0) {
    if (!eventId) {
      return NextResponse.json(
        { success: false, error: "No se encontró evento para regenerar los tickets de esta reserva" },
        { status: 400 }
      );
    }

    for (let i = 0; i < ticketQuantity; i++) {
      const reuseCodes = resolvedCodes[i] ? [resolvedCodes[i]] : [];
      const ticketResult = await createTicketForReservation(supabase, {
        eventId,
        tableName,
        fullName: (reservation as any).full_name || "Invitado reserva",
        email: email || null,
        phone: (reservation as any).phone || null,
        docType: (reservation as any).doc_type || "dni",
        document: (reservation as any).document || "",
        promoterId: (reservation as any).promoter_id || null,
        reuseCodes,
        codeType: tableRel?.id ? "table" : "courtesy",
        tableId: (reservation as any).table_id || tableRel?.id || null,
        productId: (reservation as any).product_id || null,
        tableReservationId: id,
      });
      createdTicketIds.push(ticketResult.ticketId);
      if (ticketResult.code) {
        createdTicketCodes.push(ticketResult.code);
      }
    }
  }

  const finalTicketIds = uniqueStrings([...ticketIds, ...createdTicketIds]);
  const finalCodes = uniqueStrings([...resolvedCodes, ...createdTicketCodes]);
  if (finalTicketIds.length === 0) {
    return NextResponse.json(
      { success: false, error: "No se pudo encontrar ni generar tickets para reenviar el correo" },
      { status: 500 }
    );
  }

  const reservationPatch: Record<string, any> = {};
  if (!(reservation as any).ticket_id) {
    reservationPatch.ticket_id = finalTicketIds[0];
  }
  if (finalCodes.length > 0) {
    reservationPatch.codes = finalCodes;
  }
  if (Object.keys(reservationPatch).length > 0) {
    const { error: reservationPatchError } = await supabase
      .from("table_reservations")
      .update(reservationPatch)
      .eq("id", id);
    if (reservationPatchError) {
      return NextResponse.json({ success: false, error: reservationPatchError.message }, { status: 500 });
    }
  }

  try {
    await sendApprovalEmail({
      supabase,
      id,
      full_name: (reservation as any).full_name || "",
      email,
      phone: (reservation as any).phone || null,
      codes: finalCodes,
      ticketIds: finalTicketIds,
      tableName,
      event: eventData,
    });
    return NextResponse.json({
      success: true,
      message: "Correo reenviado",
      ticketIds: finalTicketIds,
      codesCount: finalCodes.length,
      ticketsCreated: createdTicketIds.length,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message || "No se pudo reenviar el correo" }, { status: 500 });
  }
}
