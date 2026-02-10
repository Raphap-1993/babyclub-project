import type { SupabaseClient } from "@supabase/supabase-js";
import { sendEmail } from "shared/email/resend";
import { formatLimaFromDb, toLimaPartsFromDb } from "shared/limaTime";
import { logProcessEvent } from "../logs/logger";

type Supabase = SupabaseClient<any, "public", any>;

export async function sendApprovalEmail({
  supabase,
  id,
  full_name,
  email,
  phone,
  codes,
  ticketIds,
  tableName,
  event,
}: {
  supabase?: Supabase | null;
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  codes: string[];
  ticketIds?: string[]; // ✅ IDs de tickets generados
  tableName?: string | null;
  event?: { name?: string | null; starts_at?: string | null; location?: string | null } | null;
}) {
  const escape = (value: string) =>
    value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

  const safeName = full_name ? escape(full_name) : "";
  const safeTable = tableName ? escape(tableName) : "—";
  const safeEventName = event?.name ? escape(event.name) : "";
  const safeLocation = event?.location ? escape(event.location) : "";

  const dateLabel = (() => {
    if (!event?.starts_at) return null;
    try {
      return formatLimaFromDb(event.starts_at);
    } catch {
      return null;
    }
  })();

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://babyclubaccess.com";

  // ✅ NUEVO: Generar HTML con tickets individuales (cada uno con su QR único)
  const ticketsHtml =
    ticketIds && ticketIds.length > 0 && supabase
      ? (
          await Promise.all(
            ticketIds.map(async (ticketId, index) => {
              // Obtener datos del ticket para mostrar qr_token, event_id, organizer
              const { data: ticketData } = await supabase
                .from("tickets")
                .select("qr_token,event:events(id,name,organizer:organizers(name))")
                .eq("id", ticketId)
                .maybeSingle();

              const qrToken = ticketData?.qr_token || ticketId;
              const eventRel = Array.isArray(ticketData?.event) ? ticketData.event[0] : ticketData?.event;
              const organizerRel = Array.isArray(eventRel?.organizer) ? eventRel.organizer[0] : eventRel?.organizer;
              
              const ticketUrl = `${appUrl}/ticket/${ticketId}`;
              const qrImg = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&format=jpg&color=000000&bgcolor=ffffff&data=${encodeURIComponent(qrToken)}`;

              return `
        <div style="padding:16px;border-radius:14px;border:1px solid rgba(255,255,255,0.1);background:#0f0f0f;margin-bottom:14px;">
          <div style="font-family:'Inter','Helvetica Neue',Arial,sans-serif;font-size:15px;color:#f5f5f5;font-weight:700;margin-bottom:4px;">Entrada ${index + 1} de ${ticketIds.length}</div>
          ${eventRel?.name ? `<div style="font-size:12px;color:#d0d0d0;margin-bottom:2px;">Evento: ${escape(eventRel.name)}</div>` : ""}
          ${organizerRel?.name ? `<div style="font-size:11px;color:#b8b8b8;margin-bottom:8px;">Organizador: ${escape(organizerRel.name)}</div>` : ""}
          ${codes[index] ? `<div style="font-size:13px;color:#e0e0e0;margin-bottom:8px;font-family:monospace;">Código: ${escape(codes[index])}</div>` : ""}
          <img src="${qrImg}" alt="QR Entrada ${index + 1}" width="200" height="200" style="border-radius:12px;border:6px solid #0b0b0b;background:#fff;display:block;margin:8px 0;" />
          <a href="${ticketUrl}" style="display:inline-block;margin-top:8px;padding:10px 18px;border-radius:999px;background:linear-gradient(120deg,#e91e63,#ff6fb7);color:#ffffff;font-weight:600;font-size:13px;text-decoration:none;letter-spacing:0.02em;">Ver QR completo</a>
          <div style="font-size:11px;color:#a8a8a8;margin-top:8px;line-height:1.4;">
            Este QR contiene evento y organizador. Solo es válido para este evento específico.
          </div>
        </div>
      `;
            })
          )
        ).join("")
      : codes.length > 0
      ? `<p style="color:#f5f5f5;font-size:14px;">Códigos generados: ${codes.join(", ")}</p>`
      : `<p style="color:#f5f5f5;font-size:14px;">No se generaron códigos para esta reserva.</p>`;

  const html = `
  <div style="margin:0;padding:0;background:#050505;font-family:'Inter','Helvetica Neue',Arial,sans-serif;">
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#050505;padding:24px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:720px;background:#0b0b0b;border-radius:24px;border:1px solid rgba(255,255,255,0.05);overflow:hidden;">
            <tr>
              <td style="padding:28px 32px 16px;background:linear-gradient(135deg,rgba(255,255,255,0.06),rgba(233,30,99,0.12));color:#ffffff;">
                <div style="text-transform:uppercase;font-size:12px;letter-spacing:0.28em;color:#f2f2f2;opacity:0.8;margin-bottom:6px;">Baby</div>
                <h1 style="margin:0;font-size:26px;line-height:1.2;color:#ffffff;">Reserva aprobada</h1>
                <p style="margin:8px 0 0;font-size:14px;color:#d9d9d9;">Mesa ${safeTable}${safeEventName ? ` • ${safeEventName}` : ""}${dateLabel ? ` • ${dateLabel}` : ""}</p>
                ${safeLocation ? `<p style="margin:4px 0 0;font-size:13px;color:#c8c8c8;">${safeLocation}</p>` : ""}
              </td>
            </tr>
            <tr>
              <td style="padding:22px 32px 28px;">
                <p style="margin:0 0 10px;font-size:15px;color:#f5f5f5;">Hola ${safeName || "invitadx"},</p>
                <p style="margin:0 0 14px;font-size:14px;color:#d7d7d7;line-height:1.6;">
                  Confirmamos tu reserva. Cada QR es individual y contiene el evento y organizador específico.
                  ${phone ? `<br/>Teléfono registrado: ${phone}` : ""}
                </p>
                ${ticketsHtml}
                <div style="margin-top:16px;padding:12px 14px;border-radius:14px;background:linear-gradient(120deg,rgba(233,30,99,0.14),rgba(255,111,183,0.08));color:#ffddea;font-size:13px;line-height:1.5;">
                  Si algún código no funciona, muestra este correo en puerta o responde a este mensaje para que podamos ayudarte.
                </div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </div>`;

  const textBody = [
    `Reserva aprobada`,
    `Mesa: ${tableName || "-"}`,
    event?.name ? `Evento: ${event.name}` : null,
    dateLabel ? `Fecha: ${dateLabel}` : null,
    phone ? `Teléfono: ${phone}` : null,
    "",
    "Códigos:",
    codes.length > 0 ? codes.map((c) => `- ${c}`).join("\n") : "- (sin códigos)",
  ]
    .filter(Boolean)
    .join("\n");

  const subject = "Reserva aprobada - códigos y QR";
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
      supabase: supabase || null,
      category: "email",
      action: "reservation_approved",
      status: "success",
      message: subject,
      toEmail: email,
      provider: "resend",
      providerId,
      reservationId: id,
      meta: { codes_count: codes.length },
    });
  } catch (err: any) {
    await logProcessEvent({
      supabase: supabase || null,
      category: "email",
      action: "reservation_approved",
      status: "error",
      message: err?.message || "No se pudo enviar correo",
      toEmail: email,
      provider: "resend",
      providerId,
      reservationId: id,
    });
    throw err;
  }
}

export async function sendCancellationEmail({
  supabase,
  id,
  full_name,
  email,
  tableName,
  event,
}: {
  supabase?: Supabase | null;
  id: string;
  full_name: string;
  email: string;
  tableName?: string | null;
  event?: { name?: string | null; starts_at?: string | null; location?: string | null } | null;
}) {
  const escape = (value: string) =>
    value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

  const safeName = full_name ? escape(full_name) : "";
  const safeTable = tableName ? escape(tableName) : "—";
  const safeEventName = event?.name ? escape(event.name) : "";
  const safeLocation = event?.location ? escape(event.location) : "";

  const dateLabel = (() => {
    if (!event?.starts_at) return null;
    try {
      return formatLimaFromDb(event.starts_at);
    } catch {
      return null;
    }
  })();

  const html = `
  <div style="margin:0;padding:0;background:#050505;font-family:'Inter','Helvetica Neue',Arial,sans-serif;">
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#050505;padding:24px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:720px;background:#0b0b0b;border-radius:24px;border:1px solid rgba(255,255,255,0.05);overflow:hidden;">
            <tr>
              <td style="padding:28px 32px 16px;background:linear-gradient(135deg,rgba(255,255,255,0.06),rgba(255,95,95,0.12));color:#ffffff;">
                <div style="text-transform:uppercase;font-size:12px;letter-spacing:0.28em;color:#f2f2f2;opacity:0.8;margin-bottom:6px;">Baby</div>
                <h1 style="margin:0;font-size:26px;line-height:1.2;color:#ffffff;">Reserva cancelada</h1>
                <p style="margin:8px 0 0;font-size:14px;color:#d9d9d9;">Mesa ${safeTable}${safeEventName ? ` • ${safeEventName}` : ""}${dateLabel ? ` • ${dateLabel}` : ""}</p>
                ${safeLocation ? `<p style="margin:4px 0 0;font-size:13px;color:#c8c8c8;">${safeLocation}</p>` : ""}
              </td>
            </tr>
            <tr>
              <td style="padding:22px 32px 28px;">
                <p style="margin:0 0 10px;font-size:15px;color:#f5f5f5;">Hola ${safeName || "invitadx"},</p>
                <p style="margin:0 0 14px;font-size:14px;color:#d7d7d7;line-height:1.6;">
                  Lamentamos informarte que tu reserva ha sido <strong>cancelada</strong>.
                </p>
                <p style="margin:0 0 14px;font-size:14px;color:#d7d7d7;line-height:1.6;">
                  Si crees que esto fue un error o tienes alguna pregunta, por favor contáctanos respondiendo este correo o a través de nuestras redes sociales. Estaremos encantados de ayudarte.
                </p>
                <div style="margin-top:16px;padding:12px 14px;border-radius:14px;background:linear-gradient(120deg,rgba(255,95,95,0.14),rgba(255,111,111,0.08));color:#ffdddd;font-size:13px;line-height:1.5;">
                  💔 Esperamos verte pronto en nuestros próximos eventos. ¡Gracias por tu comprensión!
                </div>
                <p style="margin:16px 0 0;font-size:13px;color:#bcbcbc;">
                  Si deseas hacer una nueva reserva, visita nuestra página web o contáctanos directamente.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </div>`;

  const textBody = [
    `Reserva cancelada`,
    `Mesa: ${tableName || "-"}`,
    event?.name ? `Evento: ${event.name}` : null,
    dateLabel ? `Fecha: ${dateLabel}` : null,
    "",
    "Lamentamos informarte que tu reserva ha sido cancelada.",
    "Si crees que esto fue un error, contáctanos respondiendo este correo.",
  ]
    .filter(Boolean)
    .join("\n");

  const subject = "Reserva cancelada - Baby";
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
      supabase: supabase || null,
      category: "email",
      action: "reservation_cancelled",
      status: "success",
      message: subject,
      toEmail: email,
      provider: "resend",
      providerId,
      reservationId: id,
    });
  } catch (err: any) {
    await logProcessEvent({
      supabase: supabase || null,
      category: "email",
      action: "reservation_cancelled",
      status: "error",
      message: err?.message || "No se pudo enviar correo",
      toEmail: email,
      provider: "resend",
      providerId,
      reservationId: id,
    });
    throw err;
  }
}

export async function sendTicketEmail({
  supabase,
  ticketId,
  toEmail,
}: {
  supabase: Supabase;
  ticketId: string;
  toEmail: string;
}) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://babyclubaccess.com";

  const { data, error } = await supabase
    .from("tickets")
    .select(
      "id,qr_token,full_name,doc_type,document,dni,email,phone,code:codes(code,type,expires_at,promoter_id),event:events(name,starts_at,location)"
    )
    .eq("id", ticketId)
    .maybeSingle();
  if (error || !data) throw new Error("Ticket no encontrado para enviar correo");

  const eventRel = Array.isArray((data as any).event) ? (data as any).event?.[0] : (data as any).event;
  const codeRel = Array.isArray((data as any).code) ? (data as any).code?.[0] : (data as any).code;
  const docValue = (data as any).document || (data as any).dni || "";
  const docTypeRaw = (data as any).doc_type || ((data as any).dni ? "dni" : "");
  const docTypeLabel = docTypeRaw ? String(docTypeRaw).toUpperCase() : "";
  const documentLabel = docValue ? `${docTypeLabel ? `${docTypeLabel} ` : ""}${docValue}`.trim() : "—";
  const dateLabel = eventRel?.starts_at ? formatLimaFromDb(eventRel.starts_at) : "";
  const ticketUrl = `${appUrl}/ticket/${ticketId}`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&format=jpg&color=000000&bgcolor=ffffff&data=${encodeURIComponent(
    data.qr_token
  )}`;
  const qrImg = qrUrl;
  const isFreeCode = (codeRel?.type || "").toLowerCase() === "free";
  const isPromoterCode = Boolean(codeRel?.promoter_id);
  const expiresLabel = (() => {
    if (!codeRel?.expires_at) return null;
    try {
      const parts = toLimaPartsFromDb(codeRel.expires_at);
      return `${String(parts.hour12).padStart(2, "0")}:${String(parts.minute).padStart(2, "0")} ${parts.ampm}`;
    } catch {
      return null;
    }
  })();

  const warnings: string[] = [];
  if (isFreeCode) {
    warnings.push(
      expiresLabel
        ? `QR libre con hora límite: puedes ingresar hasta las ${expiresLabel}.`
        : "QR libre con hora límite configurable. Llega temprano para asegurar tu ingreso."
    );
  }
  if (isPromoterCode && !isFreeCode) {
    warnings.push("QR de promotor: no tiene límite de hora de ingreso. Coordina con tu promotor.");
  }

  const warningsHtml = warnings
    .map(
      (w) =>
        `<div style="margin-top:12px;padding:10px 12px;border-radius:12px;border:1px solid rgba(233,30,99,0.35);background:linear-gradient(120deg,rgba(233,30,99,0.12),rgba(233,30,99,0.04));color:#ffddea;font-size:13px;line-height:1.4;">${w}</div>`
    )
    .join("");

  const html = `
  <div style="margin:0;padding:0;background:#050505;font-family:'Inter','Helvetica Neue',Arial,sans-serif;">
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#050505;padding:24px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:640px;background:#0b0b0b;border-radius:24px;border:1px solid rgba(255,255,255,0.05);overflow:hidden;">
            <tr>
              <td style="padding:28px 32px 10px;background:linear-gradient(135deg,rgba(255,255,255,0.06),rgba(233,30,99,0.1));color:#ffffff;">
                <div style="text-transform:uppercase;font-size:12px;letter-spacing:0.28em;color:#f2f2f2;opacity:0.8;margin-bottom:6px;">Baby</div>
                <h1 style="margin:0;font-size:26px;line-height:1.2;color:#ffffff;">Entrada generada</h1>
                <p style="margin:8px 0 0;font-size:14px;color:#d9d9d9;">${eventRel?.name || "Evento"}${dateLabel ? ` • ${dateLabel}` : ""}</p>
                ${eventRel?.location ? `<p style="margin:4px 0 0;font-size:13px;color:#c8c8c8;">${eventRel.location}</p>` : ""}
              </td>
            </tr>
            <tr>
              <td style="padding:20px 32px 28px;">
                <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                  <tr>
                    <td align="center" style="padding:12px 0 18px;">
                      <img src="${qrImg}" alt="QR" width="220" height="220" style="border-radius:18px;border:8px solid #0f0f0f;background:#fff;display:block;" />
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:0;">
                      <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border:1px solid rgba(255,255,255,0.08);border-radius:16px;overflow:hidden;background:#0f0f0f;">
                        <tr>
                          <td style="padding:16px 18px;">
                            <p style="margin:0 0 8px;font-size:12px;letter-spacing:0.12em;text-transform:uppercase;color:#bcbcbc;">Datos</p>
                            <p style="margin:0;font-size:14px;color:#f5f5f5;line-height:1.6;">
                              <strong>Nombre:</strong> ${data.full_name || "-"}<br/>
                              <strong>Documento:</strong> ${documentLabel}<br/>
                              <strong>Código:</strong> ${codeRel?.code || "-"}
                              ${data.phone ? `<br/><strong>Teléfono:</strong> ${data.phone}` : ""}
                            </p>
                          </td>
                          <td style="padding:16px 18px;border-left:1px solid rgba(255,255,255,0.06);" width="42%">
                            <p style="margin:0 0 8px;font-size:12px;letter-spacing:0.12em;text-transform:uppercase;color:#bcbcbc;">Evento</p>
                            <p style="margin:0;font-size:14px;color:#f5f5f5;line-height:1.6;">
                              ${eventRel?.name || "Evento"}<br/>
                              ${dateLabel ? dateLabel : ""}
                              ${eventRel?.location ? `<br/>${eventRel.location}` : ""}
                            </p>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  ${warningsHtml ? `<tr><td style="padding-top:12px;">${warningsHtml}</td></tr>` : ""}
                  <tr>
                    <td align="center" style="padding:20px 0 6px;">
                      <a href="${ticketUrl}" style="display:inline-block;padding:12px 20px;border-radius:999px;background:linear-gradient(120deg,#e91e63,#ff6fb7);color:#ffffff;font-weight:700;font-size:14px;text-decoration:none;letter-spacing:0.04em;">Ver ticket</a>
                    </td>
                  </tr>
                  <tr>
                    <td style="text-align:center;color:#7f7f7f;font-size:12px;line-height:1.5;padding-bottom:4px;">Muestra este QR en puerta para validar tu ingreso.</td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </div>`;

  const textWarnings = warnings.length > 0 ? `\n\nAvisos:\n- ${warnings.join("\n- ")}` : "";
  const textBody = `Tu QR para ${eventRel?.name || "el evento"}\nNombre: ${data.full_name || "-"}\nDocumento: ${documentLabel}\nCódigo: ${codeRel?.code || "-"}\nEvento: ${eventRel?.name || ""}${dateLabel ? ` • ${dateLabel}` : ""}${eventRel?.location ? ` • ${eventRel.location}` : ""}\nEnlace del ticket: ${ticketUrl}${textWarnings}`;

  const subject = `BABY - Entrada ${eventRel?.name || "evento"}`;
  let providerId: string | null = null;

  try {
    if (!process.env.RESEND_API_KEY) throw new Error("Correo no disponible: configura RESEND_API_KEY");
    const result: any = await sendEmail({
      to: toEmail,
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
      action: "ticket_send",
      status: "success",
      message: subject,
      toEmail,
      provider: "resend",
      providerId,
      ticketId,
      meta: { event: eventRel?.name || null },
    });
  } catch (err: any) {
    await logProcessEvent({
      supabase,
      category: "email",
      action: "ticket_send",
      status: "error",
      message: err?.message || "No se pudo enviar correo",
      toEmail,
      provider: "resend",
      providerId,
      ticketId,
      meta: { event: eventRel?.name || null },
    });
    throw err;
  }
}
