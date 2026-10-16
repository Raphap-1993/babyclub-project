import { sendEmail } from "./resend";
import { escapeEmailHtml as escape } from "./template";
import { ticketQrDataUrl } from "../ticketQr";
import { getPublicLandingUrl } from "../publicUrl";
import { formatLimaFromDb } from "../limaTime";

function checked(result: any) {
  if (result.error || !result.data)
    throw new Error("manual_email_data_unavailable");
  return result.data;
}

export async function notifyManualSale(
  db: any,
  paymentId: string,
): Promise<"sent" | "pending" | "failed"> {
  const claim = await db.rpc("claim_manual_sale_email", {
    p_payment: paymentId,
  });
  if (claim.error) throw new Error("manual_email_claim_failed");
  if (!claim.data) {
    const job = checked(
      await db
        .from("manual_sale_email_jobs")
        .select("status")
        .eq("payment_id", paymentId)
        .single(),
    );
    return job.status === "sent"
      ? "sent"
      : job.status === "failed"
        ? "failed"
        : "pending";
  }
  const job = claim.data;
  try {
    const payment = checked(
      await db
        .from("payments")
        .select(
          "provider,status,ticket_id,reservation_id,amount,receipt_number",
        )
        .eq("id", paymentId)
        .single(),
    );
    if (
      payment.provider !== "manual" ||
      payment.status !== "paid" ||
      payment.reservation_id !== job.reservation_id
    )
      throw new Error("manual_email_payment_invalid");
    const reservation = checked(
      await db
        .from("table_reservations")
        .select(
          "id,status,deleted_at,full_name,email,sale_origin,ticket_quantity,event:events(name,starts_at),table:tables(name)",
        )
        .eq("id", job.reservation_id)
        .single(),
    );
    const ticket = checked(
      await db
        .from("tickets")
        .select(
          "id,qr_token,is_active,deleted_at,payment_status,table_reservation_id",
        )
        .eq("id", payment.ticket_id)
        .single(),
    );
    if (
      reservation.status !== "approved" ||
      reservation.deleted_at ||
      ticket.is_active !== true ||
      ticket.deleted_at ||
      ticket.payment_status !== "paid" ||
      ticket.table_reservation_id !== reservation.id
    )
      throw new Error("manual_email_ticket_invalid");
    const qr = await ticketQrDataUrl(ticket.qr_token);
    const event = Array.isArray(reservation.event)
      ? reservation.event[0]
      : reservation.event;
    const table = Array.isArray(reservation.table)
      ? reservation.table[0]
      : reservation.table;
    const base = getPublicLandingUrl();
    const ticketUrl = `${base}/ticket/${encodeURIComponent(ticket.id)}`;
    const reservationUrl = `${base}/compra?reservationId=${encodeURIComponent(reservation.id)}`;
    const title =
      reservation.sale_origin === "table"
        ? `Mesa / box${table?.name ? ` · ${table.name}` : ""}`
        : "Entradas";
    const amount = new Intl.NumberFormat("es-PE", {
      style: "currency",
      currency: "PEN",
    }).format(payment.amount / 100);
    const date = event?.starts_at ? formatLimaFromDb(event.starts_at) : "";
    const text = `Hola ${reservation.full_name},\nTu compra está pagada y aprobada.\n${title}\n${event?.name || "BABY"}\n${date}\nTotal pagado: ${amount}\nComprobante: ${payment.receipt_number || ""}\nTu QR: ${ticketUrl}\nCompletar asistentes y ver entradas: ${reservationUrl}\nEl QR adjunto corresponde al comprador. Los acompañantes deben completar sus datos para obtener sus propios QR.`;
    const html = `<div lang="es" style="background:#080808;color:#fff;padding:24px;font-family:Arial,sans-serif;max-width:600px;margin:auto"><h1 style="color:#fff">Compra pagada y aprobada</h1><p>Hola ${escape(reservation.full_name)},</p><h2>${escape(event?.name || "BABY")}</h2><p>${escape(title)} · ${escape(date)}</p><p>Total pagado: <strong>${escape(amount)}</strong></p><p>Comprobante: ${escape(payment.receipt_number || "")}</p><p>Este es el QR del comprador:</p><img src="cid:buyer-qr" alt="QR de ingreso del comprador" width="260" height="260" style="display:block;max-width:100%;height:auto;background:#fff"/><p><a style="color:#ff4545" href="${escape(ticketUrl)}">Ver mi QR en la web</a></p><p><a style="color:#ff4545" href="${escape(reservationUrl)}">Completar asistentes y ver entradas</a></p><p>Los acompañantes deben completar sus datos para obtener sus propios QR. No compartas el mismo QR entre asistentes.</p></div>`;
    const sent = await sendEmail({
      to: reservation.email,
      subject: `BABY · Compra confirmada · ${event?.name || title}`,
      html,
      text,
      idempotencyKey: `manual-sale-${paymentId}`,
      attachments: [
        {
          filename: "entrada-baby.png",
          content: qr.split(",")[1],
          contentId: "buyer-qr",
        },
      ],
    });
    const done = await db
      .from("manual_sale_email_jobs")
      .update({
        status: "sent",
        sent_at: new Date().toISOString(),
        locked_until: null,
        provider_message_id: sent.data?.id,
      })
      .eq("payment_id", paymentId)
      .eq("lock_token", job.lock_token);
    if (done.error) throw new Error("manual_email_record_failed");
    return "sent";
  } catch {
    await db
      .from("manual_sale_email_jobs")
      .update({
        status: "error",
        locked_until: new Date(Date.now() + 60_000).toISOString(),
      })
      .eq("payment_id", paymentId)
      .eq("lock_token", job.lock_token);
    return "pending";
  }
}

export async function retryManualSaleEmails(db: any) {
  const jobs = await db
    .from("manual_sale_email_jobs")
    .select("payment_id")
    .in("status", ["pending", "error", "sending"])
    .or(`locked_until.is.null,locked_until.lte.${new Date().toISOString()}`)
    .order("created_at")
    .limit(3);
  if (jobs.error) throw new Error("manual_email_jobs_unavailable");
  return Promise.all(
    (jobs.data || []).map((job: any) => notifyManualSale(db, job.payment_id)),
  );
}
