import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createTicketForReservation, createReservationCodes } from "../../reservations/utils";
import { sendEmail } from "shared/email/resend";
import { formatLimaFromDb } from "shared/limaTime";
import { normalizeDocument, validateDocument, type DocumentType } from "shared/document";
import { logProcessEvent } from "../../logs/logger";
import { requireStaffRole } from "shared/auth/requireStaff";
import { applyNotDeleted } from "shared/db/softDelete";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ACTIVE_STATUSES = ["pending", "approved", "confirmed", "paid"];
const ALLOWED_STATUSES = ["pending", "approved", "rejected"];

export async function POST(req: NextRequest) {
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

  const docTypeRaw = typeof body?.doc_type === "string" ? (body.doc_type as DocumentType) : "dni";
  const documentRaw = typeof body?.document === "string" ? body.document : body?.dni || "";
  const { docType: bodyDocType, document: bodyDocument } = normalizeDocument(docTypeRaw, documentRaw);

  const modeRaw = typeof body?.mode === "string" ? body.mode : "";
  const mode: "existing_ticket" | "new_customer" = modeRaw === "existing_ticket" ? "existing_ticket" : "new_customer";

  const table_id = typeof body?.table_id === "string" ? body.table_id : "";
  const product_id = typeof body?.product_id === "string" ? body.product_id : null;
  const status = ALLOWED_STATUSES.includes(body?.status) ? body.status : "approved";
  const voucher_url = typeof body?.voucher_url === "string" ? body.voucher_url.trim() : "";
  const notes = typeof body?.notes === "string" ? body.notes.trim() : "";
  const rawCodes = Array.isArray(body?.codes) ? body.codes : [];
  const providedCodes: string[] = rawCodes.map((c: any) => String(c).trim()).filter(Boolean);
  const created_by_staff_id = typeof body?.created_by_staff_id === "string" ? body.created_by_staff_id : null;
  let eventId = typeof body?.event_id === "string" ? body.event_id : null;

  if (!table_id) return NextResponse.json({ success: false, error: "table_id es requerido" }, { status: 400 });

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Mesa
  const tableQuery = applyNotDeleted(
    supabase.from("tables").select("id,name,event_id,ticket_count,is_active").eq("id", table_id)
  );
  const { data: table, error: tableError } = await tableQuery.maybeSingle();

  if (tableError || !table) {
    return NextResponse.json({ success: false, error: tableError?.message || "Mesa no encontrada" }, { status: 404 });
  }
  if (table.is_active === false) {
    return NextResponse.json({ success: false, error: "Mesa inactiva" }, { status: 400 });
  }

  if (table.event_id && eventId && table.event_id !== eventId) {
    return NextResponse.json({ success: false, error: "La mesa pertenece a otro evento" }, { status: 400 });
  }
  eventId = eventId || table.event_id || null;

  // Fetch event data with event_prefix
  let eventData: any = null;
  if (eventId) {
    const { data: evt } = await supabase
      .from("events")
      .select("id,name,event_prefix")
      .eq("id", eventId)
      .maybeSingle();
    eventData = evt;
  }

  // Validar producto pertenece a la mesa
  if (product_id) {
    const productQuery = applyNotDeleted(
      supabase.from("table_products").select("id,table_id").eq("id", product_id)
    );
    const { data: product, error: productError } = await productQuery.maybeSingle();
    if (productError) {
      return NextResponse.json({ success: false, error: productError.message }, { status: 400 });
    }
    if (!product || product.table_id !== table_id) {
      return NextResponse.json({ success: false, error: "El producto no pertenece a la mesa seleccionada" }, { status: 400 });
    }
  }

  // Evitar doble reserva
  const existingReservationQuery = applyNotDeleted(
    supabase.from("table_reservations").select("id,status").eq("table_id", table_id).in("status", ACTIVE_STATUSES).limit(1)
  );
  const { data: existingReservation } = await existingReservationQuery.maybeSingle();

    if (existingReservation) {
      return NextResponse.json({ success: false, error: "La mesa ya tiene una reserva activa" }, { status: 409 });
    }

    try {
      if (mode === "existing_ticket") {
        const ticket_id = typeof body?.ticket_id === "string" ? body.ticket_id : "";
        const email = typeof body?.email === "string" ? body.email.trim() : "";
        const phone = typeof body?.phone === "string" ? body.phone.trim() : "";
        const documentValue = bodyDocument;
        const docTypeValue = bodyDocType;
        const docSearchValid = documentValue ? validateDocument(docTypeValue, documentValue) : false;
        const codes_count =
          typeof body?.codes_count === "number" && Number.isFinite(body.codes_count) && body.codes_count >= 0
            ? Math.floor(body.codes_count)
            : Math.max(table.ticket_count || 1, 1);

        if (documentValue && !docSearchValid) {
          return NextResponse.json({ success: false, error: "Documento inválido" }, { status: 400 });
        }

        if (!ticket_id && !docSearchValid && !email && !phone) {
          return NextResponse.json(
            { success: false, error: "Proporciona ticket_id o un dato de contacto (documento/email/teléfono)" },
            { status: 400 }
          );
        }

        let ticketQuery = applyNotDeleted(
          supabase
            .from("tickets")
            .select(
              "id,event_id,full_name,email,phone,dni,doc_type,document,person:persons(first_name,last_name,email,phone,doc_type,document,dni),code:codes(code)"
            )
            .limit(1)
        );

        if (ticket_id) {
          ticketQuery = ticketQuery.eq("id", ticket_id);
        } else {
          const orFilters = [
            docSearchValid ? `document.eq.${documentValue}` : "",
            docSearchValid && docTypeValue === "dni" ? `dni.eq.${documentValue}` : "",
            email ? `email.eq.${email}` : "",
            phone ? `phone.eq.${phone}` : "",
          ].filter(Boolean);
          if (orFilters.length === 0) {
            return NextResponse.json(
            { success: false, error: "Falta ticket_id o al menos un campo para buscar el ticket" },
            { status: 400 }
          );
        }
        ticketQuery = ticketQuery.or(orFilters.join(",")).order("created_at", { ascending: false });
      }

      if (eventId) ticketQuery = ticketQuery.eq("event_id", eventId);

      const { data: ticket, error: ticketError } = await ticketQuery.maybeSingle();
      if (ticketError || !ticket) {
        return NextResponse.json({ success: false, error: ticketError?.message || "Ticket no encontrado" }, { status: 404 });
      }

          if (eventId && ticket.event_id && ticket.event_id !== eventId) {
            return NextResponse.json({ success: false, error: "El ticket pertenece a otro evento" }, { status: 400 });
          }
          eventId = eventId || ticket.event_id || null;
          if (!eventId) {
            return NextResponse.json({ success: false, error: "No se pudo determinar el evento" }, { status: 400 });
          }

          const personRel = Array.isArray((ticket as any).person) ? (ticket as any).person?.[0] : (ticket as any).person;
          const nameFromPerson = personRel ? `${personRel.first_name || ""} ${personRel.last_name || ""}`.trim() : "";
          const full_name = typeof body?.full_name === "string" && body.full_name.trim() ? body.full_name.trim() : ticket.full_name || nameFromPerson;
          const contactEmail = email || ticket.email || personRel?.email || null;
          const contactPhone = phone || ticket.phone || personRel?.phone || null;
          const ticketDocType = ((ticket as any).doc_type as DocumentType) || (personRel?.doc_type as DocumentType) || "dni";
          const ticketDocument =
            (ticket as any).document ||
            (ticketDocType === "dni" ? (ticket as any).dni : null) ||
            personRel?.document ||
            (ticketDocType === "dni" ? (personRel as any)?.dni : null) ||
            null;
          const resolvedDocType = docSearchValid ? docTypeValue : ticketDocType;
          const resolvedDocument = docSearchValid ? documentValue : ticketDocument || "";
          
          // Create reservation first to get ID for codes
          const { data: reservation, error: resError } = await supabase
            .from("table_reservations")
            .insert({
              table_id,
              event_id: eventId,
              product_id,
              full_name: full_name || "Invitado reserva",
              email: contactEmail,
              phone: contactPhone,
              doc_type: resolvedDocType,
              document: resolvedDocument || null,
              voucher_url: voucher_url || null,
              status,
              codes: [], // Will update after creating individual codes
              notes: notes || null,
              ticket_id: ticket.id,
              created_by_staff_id,
            })
            .select("id")
            .single();

      if (resError || !reservation?.id) {
        return NextResponse.json({ success: false, error: resError?.message || "No se pudo crear la reserva" }, { status: 500 });
      }

      const { error: linkExistingTicketError } = await supabase
        .from("tickets")
        .update({
          table_reservation_id: reservation.id,
          table_id,
          product_id: product_id || null,
        })
        .eq("id", ticket.id);
      if (linkExistingTicketError) {
        return NextResponse.json({ success: false, error: linkExistingTicketError.message }, { status: 500 });
      }

      // Generate individual friendly codes
      const eventPrefix = eventData?.event_prefix || "BC";
      const quantity = table.ticket_count || 1;
      const { codes } = await createReservationCodes(supabase, {
        eventId: eventId!,
        eventPrefix,
        tableName: table.name,
        reservationId: reservation.id,
        quantity,
      });

      // Update reservation with codes array (backward compatibility)
      await supabase
        .from("table_reservations")
        .update({ codes })
        .eq("id", reservation.id);

      if (status === "approved" && contactEmail) {
        await sendReservationEmail({ supabase, reservationId: reservation.id, ticketId: ticket.id, email: contactEmail });
      }

      return NextResponse.json({
        success: true,
        reservationId: reservation.id,
        ticketId: ticket.id,
        codes,
        eventId,
      });
    }

    // mode === "new_customer"
    const full_name = typeof body?.full_name === "string" ? body.full_name.trim() : "";
    const email = typeof body?.email === "string" ? body.email.trim() : "";
    const phone = typeof body?.phone === "string" ? body.phone.trim() : "";
    const docType = bodyDocType;
    const document = bodyDocument;
    const dniForTicket = docType === "dni" ? document : null;
    const ticketCount = Math.max(table.ticket_count || 1, 1);
    const codes_count =
      typeof body?.codes_count === "number" && Number.isFinite(body.codes_count) && body.codes_count >= 0
        ? Math.floor(body.codes_count)
        : Math.max(ticketCount - 1, 0);

    if (!full_name) {
      return NextResponse.json({ success: false, error: "full_name es requerido para crear ticket" }, { status: 400 });
    }
    if (!eventId) {
      return NextResponse.json({ success: false, error: "event_id es requerido para crear ticket" }, { status: 400 });
    }
    if (!validateDocument(docType, document)) {
      return NextResponse.json({ success: false, error: "Documento inválido" }, { status: 400 });
    }

    const ticketResult = await createTicketForReservation(supabase, {
      eventId,
      tableName: table.name,
      fullName: full_name,
      email: email || null,
      phone: phone || null,
      dni: dniForTicket || null,
      docType,
      document,
      reuseCodes: providedCodes,
      codeType: "table",
      tableId: table_id,
      productId: product_id || null,
    });

    // Create reservation first
    const { data: reservation, error: resError } = await supabase
      .from("table_reservations")
      .insert({
        table_id,
        event_id: eventId,
        product_id,
        full_name,
        doc_type: docType,
        document,
        email: email || null,
        phone: phone || null,
        voucher_url: voucher_url || null,
        status,
        codes: [], // Will update after creating individual codes
        notes: notes || null,
        ticket_id: ticketResult.ticketId,
        created_by_staff_id,
      })
      .select("id")
      .single();

    if (resError || !reservation?.id) {
      return NextResponse.json({ success: false, error: resError?.message || "No se pudo crear la reserva" }, { status: 500 });
    }

    const { error: linkNewTicketError } = await supabase
      .from("tickets")
      .update({ table_reservation_id: reservation.id })
      .eq("id", ticketResult.ticketId);
    if (linkNewTicketError) {
      return NextResponse.json({ success: false, error: linkNewTicketError.message }, { status: 500 });
    }

    // Generate individual friendly codes
    const eventPrefix = eventData?.event_prefix || "BC";
    const quantity = ticketCount;
    const { codes } = await createReservationCodes(supabase, {
      eventId,
      eventPrefix,
      tableName: table.name,
      reservationId: reservation.id,
      quantity,
    });

    // Update reservation with codes array (backward compatibility)
    await supabase
      .from("table_reservations")
      .update({ codes })
      .eq("id", reservation.id);

    if (status === "approved" && email) {
      await sendReservationEmail({ supabase, reservationId: reservation.id, ticketId: ticketResult.ticketId, email });
    }

    return NextResponse.json({ success: true, reservationId: reservation.id, ticketId: ticketResult.ticketId, codes, eventId });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || "Error creando reserva" }, { status: 500 });
  }
}

async function sendReservationEmail({
  supabase,
  reservationId,
  ticketId,
  email,
}: {
  supabase: any;
  reservationId: string;
  ticketId: string;
  email: string;
}) {
  try {
    const { data: resv } = await supabase
      .from("table_reservations")
      .select(
        "id,full_name,email,phone,codes,product:table_products(name),table:tables(name,event:events(name,starts_at,location)),ticket:tickets(qr_token)"
      )
      .eq("id", reservationId)
      .maybeSingle();
    if (!resv) return;

    const tableRel = Array.isArray(resv.table) ? resv.table[0] : (resv as any).table;
    const eventRel = tableRel?.event ? (Array.isArray(tableRel.event) ? tableRel.event[0] : tableRel.event) : null;
    const codes = Array.isArray(resv.codes) ? resv.codes.map((c: any) => String(c)).filter(Boolean) : [];
    const qrToken = Array.isArray(resv.ticket) ? resv.ticket[0]?.qr_token : (resv as any).ticket?.qr_token;
    const productRel = Array.isArray(resv.product) ? resv.product[0] : (resv as any).product;

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://babyclubaccess.com";
    const ticketUrl = `${appUrl}/ticket/${ticketId}`;
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&format=jpg&color=000000&bgcolor=ffffff&data=${encodeURIComponent(
      qrToken || ticketId
    )}`;
    const eventLabel = eventRel?.name || "Evento";
    const dateLabel = eventRel?.starts_at ? formatLimaFromDb(eventRel.starts_at) : "";

    const codesHtml =
      codes.length > 0
        ? codes
            .map(
              (c: string) =>
                `<div style="margin-bottom:8px;padding:10px 12px;border-radius:10px;border:1px solid rgba(255,255,255,0.08);background:#0f0f0f;font-family:'Inter','Helvetica Neue',Arial,sans-serif;color:#f5f5f5;font-weight:700;">${c}</div>`
            )
            .join("")
        : `<p style="color:#cfcfcf;font-size:14px;">Sin códigos de mesa.</p>`;

    const html = `
    <div style="margin:0;padding:0;background:#050505;font-family:'Inter','Helvetica Neue',Arial,sans-serif;">
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#050505;padding:24px 12px;">
        <tr>
          <td align="center">
            <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:680px;background:#0b0b0b;border-radius:24px;border:1px solid rgba(255,255,255,0.05);overflow:hidden;">
              <tr>
                <td style="padding:26px 32px 16px;background:linear-gradient(135deg,rgba(255,255,255,0.06),rgba(233,30,99,0.12));color:#ffffff;">
                  <div style="text-transform:uppercase;font-size:12px;letter-spacing:0.28em;color:#f2f2f2;opacity:0.8;margin-bottom:6px;">Baby</div>
                  <h1 style="margin:0;font-size:26px;line-height:1.2;color:#ffffff;">Reserva confirmada</h1>
                  <p style="margin:8px 0 0;font-size:14px;color:#d9d9d9;">Mesa ${tableRel?.name || ""} • ${eventLabel}${dateLabel ? ` • ${dateLabel}` : ""}</p>
                  ${eventRel?.location ? `<p style="margin:4px 0 0;font-size:13px;color:#c8c8c8;">${eventRel.location}</p>` : ""}
                </td>
              </tr>
              <tr>
                <td style="padding:22px 32px 26px;">
                  <p style="margin:0 0 12px;font-size:15px;color:#f5f5f5;">Hola ${resv.full_name || "invitadx"},</p>
                  <p style="margin:0 0 14px;font-size:14px;color:#d7d7d7;line-height:1.6;">Adjuntamos tu QR y los códigos de mesa asociados a tu pack.</p>
                  <div style="text-align:center;margin-bottom:16px;">
                    <img src="${qrUrl}" alt="QR" width="210" height="210" style="border-radius:16px;border:8px solid #0f0f0f;background:#fff;" />
                  </div>
                  <div style="margin-bottom:16px;text-align:center;">
                    <a href="${ticketUrl}" style="display:inline-block;padding:12px 20px;border-radius:999px;background:linear-gradient(120deg,#e91e63,#ff6fb7);color:#ffffff;font-weight:700;font-size:14px;text-decoration:none;letter-spacing:0.04em;">Ver ticket actualizado</a>
                  </div>
                  ${productRel?.name ? `<p style="font-size:14px;color:#f5f5f5;"><strong>Pack:</strong> ${productRel.name}</p>` : ""}
                  <div style="margin-top:12px;">
                    <p style="margin:0 0 6px;font-size:12px;letter-spacing:0.12em;text-transform:uppercase;color:#bcbcbc;">Códigos de mesa</p>
                    ${codesHtml}
                  </div>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </div>`;

    const textBody = [
      `Reserva confirmada - Mesa ${tableRel?.name || ""}`,
      `Evento: ${eventLabel}${dateLabel ? ` • ${dateLabel}` : ""}`,
      eventRel?.location ? `Lugar: ${eventRel.location}` : null,
      productRel?.name ? `Pack: ${productRel.name}` : null,
      "",
      "Códigos de mesa:",
      codes.length > 0 ? codes.map((c: any) => `- ${c}`).join("\n") : "- (sin códigos)",
      "",
      `Ticket: ${ticketUrl}`,
    ]
      .filter(Boolean)
      .join("\n");

    if (email) {
      const subject = `BABY - Reserva confirmada (${tableRel?.name || "Mesa"})`;
      let providerId: string | null = null;
      try {
        const result: any = await sendEmail({
          to: email,
          subject,
          html,
          text: textBody,
        });
        providerId = result?.data?.id || null;
        if (result?.error) {
          throw new Error(result.error?.message || "Error enviando correo");
        }
        await logProcessEvent({
          supabase,
          category: "email",
          action: "reservation_confirmed",
          status: "success",
          message: subject,
          toEmail: email,
          provider: "resend",
          providerId,
          reservationId,
          ticketId,
        });
      } catch (err: any) {
        await logProcessEvent({
          supabase,
          category: "email",
          action: "reservation_confirmed",
          status: "error",
          message: err?.message || "No se pudo enviar correo",
          toEmail: email,
          provider: "resend",
          providerId,
          reservationId,
          ticketId,
        });
      }
    }
  } catch (_err) {
    // ignore email errors here
  }
}
