import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { applyNotDeleted } from "shared/db/softDelete";
import { buildReservationUnits } from "shared/ticketReservationUnits";
import { createTicketForReservation } from "../utils";
import { sendApprovalEmail, sendTicketEmail } from "../email";
import { requireStaffRole } from "shared/auth/requireStaff";
import {
  isValidEmailAddress,
  normalizeEmailAddress,
} from "shared/email/address";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const resendApiKey = process.env.RESEND_API_KEY;

export async function POST(req: NextRequest) {
  const guard = await requireStaffRole(req);
  if (!guard.ok) {
    return NextResponse.json(
      { success: false, error: guard.error },
      { status: guard.status },
    );
  }
  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json(
      { success: false, error: "Supabase config missing" },
      { status: 500 },
    );
  }
  if (!resendApiKey) {
    return NextResponse.json(
      {
        success: false,
        error: "Correo no disponible: configura RESEND_API_KEY",
      },
      { status: 400 },
    );
  }

  let body: any = null;
  try {
    body = await req.json();
  } catch (_err) {
    return NextResponse.json(
      { success: false, error: "Invalid JSON" },
      { status: 400 },
    );
  }

  const id = typeof body?.id === "string" ? body.id : "";
  if (!id) {
    return NextResponse.json(
      { success: false, error: "Invalid id" },
      { status: 400 },
    );
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: reservation } = await supabase
    .from("table_reservations")
    .select(
      "id,full_name,email,phone,doc_type,document,status,codes,sale_origin,ticket_quantity,total_ticket_units,event_id,promoter_id,table:tables(id,name,event_id,ticket_count,event:events(id,name,starts_at,location)),event:event_id(id,name,starts_at,location)",
    )
    .eq("id", id)
    .maybeSingle();

  if (!reservation) {
    return NextResponse.json(
      { success: false, error: "Reserva no encontrada" },
      { status: 404 },
    );
  }

  const status = ((reservation as any).status || "").toLowerCase();
  if (status !== "approved") {
    return NextResponse.json(
      {
        success: false,
        error: "Solo puedes reenviar correos para reservas aprobadas",
      },
      { status: 400 },
    );
  }

  const email = normalizeEmailAddress(
    typeof (reservation as any).email === "string"
      ? (reservation as any).email
      : "",
  );
  if (!email) {
    return NextResponse.json(
      { success: false, error: "Ingresa un correo para notificar" },
      { status: 400 },
    );
  }
  if (!isValidEmailAddress(email)) {
    return NextResponse.json(
      {
        success: false,
        error:
          "El correo de la reserva es inválido. Corrígelo antes de reenviar.",
      },
      { status: 400 },
    );
  }

  const tableRel = Array.isArray((reservation as any).table)
    ? (reservation as any).table?.[0]
    : (reservation as any).table;
  const isTableReservation = Boolean(tableRel?.id);
  const tableName = tableRel?.name || "Entrada";
  const saleOrigin = String(
    (reservation as any).sale_origin || "",
  ).toLowerCase();
  const isTicketOnlyReservation =
    saleOrigin === "ticket" || !isTableReservation;
  const eventRel = tableRel?.event
    ? Array.isArray(tableRel.event)
      ? tableRel.event[0]
      : tableRel.event
    : null;
  const eventDirectRel = (reservation as any).event
    ? Array.isArray((reservation as any).event)
      ? (reservation as any).event?.[0]
      : (reservation as any).event
    : null;
  const eventData = eventRel || eventDirectRel || null;
  const eventId =
    tableRel?.event_id ||
    eventRel?.id ||
    (reservation as any).event_id ||
    eventDirectRel?.id ||
    null;
  const nominationUrl = `${process.env.NEXT_PUBLIC_APP_URL || "https://babyclubaccess.com"}/compra?reservationId=${encodeURIComponent(id)}`;
  const codesList = Array.isArray((reservation as any).codes)
    ? (reservation as any).codes.map((c: any) => String(c)).filter(Boolean)
    : [];

  const ticketQuantity = Math.max(
    Number((reservation as any).total_ticket_units || 0) > 0
      ? Math.floor(Number((reservation as any).total_ticket_units))
      : Number((reservation as any).ticket_quantity || 0) > 0
        ? Math.floor(Number((reservation as any).ticket_quantity))
        : Number(tableRel?.ticket_count || 0) > 0
          ? Math.floor(Number(tableRel?.ticket_count || 0))
          : 1,
    1,
  );

  if (isTicketOnlyReservation) {
    const { data: unitRows, error: unitsError } = await applyNotDeleted(
      supabase
        .from("ticket_reservation_units")
        .select(
          "id,reservation_id,event_id,package_index,person_index,unit_index,status,full_name,doc_type,document,email,phone,ticket_id",
        )
        .eq("reservation_id", id)
        .order("unit_index", { ascending: true }),
    );

    if (unitsError) {
      return NextResponse.json(
        { success: false, error: unitsError.message },
        { status: 500 },
      );
    }

    const units = Array.isArray(unitRows) ? unitRows : [];
    if (units.length === 0 && eventId) {
      const { error: insertUnitsError } = await supabase
        .from("ticket_reservation_units")
        .insert(
          buildReservationUnits({
            reservationId: id,
            eventId,
            packageQuantity: 1,
            unitsPerPackage: ticketQuantity,
          }),
        );
      if (insertUnitsError) {
        return NextResponse.json(
          { success: false, error: insertUnitsError.message },
          { status: 500 },
        );
      }
    }

    const issuedUnits = units.filter(
      (unit: any) =>
        String(unit?.status || "").toLowerCase() === "issued" &&
        typeof unit?.ticket_id === "string" &&
        unit.ticket_id.trim(),
    );
    const issuedTicketIds = Array.from(
      new Set(
        issuedUnits
          .map((unit: any) => String(unit.ticket_id || "").trim())
          .filter(Boolean),
      ),
    );

    let sentCount = 0;
    for (const unit of issuedUnits) {
      const toEmail =
        normalizeEmailAddress(
          typeof unit.email === "string" ? unit.email : "",
        ) || email;
      if (!toEmail) continue;
      await sendTicketEmail({
        supabase,
        ticketId: String(unit.ticket_id),
        toEmail,
      });
      sentCount += 1;
    }

    await sendApprovalEmail({
      supabase,
      id,
      full_name: (reservation as any).full_name || "",
      email,
      phone: (reservation as any).phone || null,
      codes: codesList,
      ticketIds: issuedTicketIds.length > 0 ? issuedTicketIds : undefined,
      tableName: (reservation as any).ticket_type_label || "Entrada",
      event: eventData,
      resourceLabel: "Entrada",
      callToAction: {
        label: "Completar asistentes",
        url: nominationUrl,
      },
    });

    return NextResponse.json({
      success: true,
      ticketId: issuedTicketIds[0] || null,
      ticketEmailError: null,
      reservationEmailError: null,
      sentCount,
      unitsPrepared: units.length === 0,
    });
  }

  let ticketId: string | null = null;
  let ticketCode: string | null = null;

  // Reverse lookup: tickets es dueño de la relación (tickets.table_reservation_id)
  {
    const { data: ticketByReservation } = await supabase
      .from("tickets")
      .select("id")
      .eq("table_reservation_id", id)
      .is("deleted_at", null)
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (ticketByReservation?.id) {
      ticketId = ticketByReservation.id;
    }
  }

  if (!ticketId && codesList.length > 0) {
    const { data: codeRows } = await supabase
      .from("codes")
      .select("id,code")
      .in("code", codesList);
    const codeIds = (codeRows || []).map((row: any) => row.id).filter(Boolean);
    if (codeIds.length > 0) {
      const { data: ticketRow } = await supabase
        .from("tickets")
        .select("id,code_id")
        .in("code_id", codeIds)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (ticketRow?.id) ticketId = ticketRow.id;
    }
  }

  if (ticketId) {
    const { data: ticketRow } = await supabase
      .from("tickets")
      .select("id,code:codes(code)")
      .eq("id", ticketId)
      .maybeSingle();
    const codeRel = Array.isArray(ticketRow?.code)
      ? ticketRow?.code?.[0]
      : ticketRow?.code;
    ticketCode = codeRel?.code || null;
  }

  let ticketLookupError: string | null = null;

  if (!ticketId) {
    if (!eventId) {
      ticketLookupError = "Mesa sin evento asignado; no se generó ticket/QR.";
    } else {
      try {
        const { ticketId: createdTicketId, code } =
          await createTicketForReservation(supabase, {
            eventId,
            tableName,
            fullName: (reservation as any).full_name || "Invitado reserva",
            email: email || null,
            phone: (reservation as any).phone || null,
            docType: (reservation as any).doc_type || "dni",
            document: (reservation as any).document || "",
            promoterId: (reservation as any).promoter_id || null,
            reuseCodes: codesList,
            codeType: "table",
            tableId: tableRel?.id || null,
            productId: null,
            tableReservationId: id,
          });
        ticketId = createdTicketId;
        ticketCode = code;
      } catch (err: any) {
        ticketLookupError = err?.message || "No se pudo generar ticket";
      }
    }
  }

  const codesForEmail = Array.from(
    new Set([...codesList, ticketCode].filter(Boolean)),
  );

  let ticketEmailError: string | null = ticketLookupError;
  let reservationEmailError: string | null = null;

  if (ticketId) {
    try {
      await sendTicketEmail({ supabase, ticketId, toEmail: email });
    } catch (err: any) {
      ticketEmailError =
        err?.message || "No se pudo enviar el correo del ticket";
    }
  }

  try {
    if (isTableReservation) {
      await sendApprovalEmail({
        supabase,
        id,
        full_name: (reservation as any).full_name || "",
        email,
        phone: (reservation as any).phone || null,
        codes: codesForEmail,
        ticketIds: ticketId ? [ticketId] : undefined, // ✅ Incluir ticketId si existe
        tableName,
        event: eventData,
      });
    }
  } catch (err: any) {
    reservationEmailError =
      err?.message || "No se pudo enviar el correo de la reserva";
  }

  const success = !ticketEmailError && !reservationEmailError;

  return NextResponse.json({
    success,
    ticketId,
    ticketEmailError,
    reservationEmailError,
  });
}
