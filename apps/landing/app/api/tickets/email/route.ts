import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { formatLimaFromDb, toLimaPartsFromDb } from "shared/limaTime";
import { sendEmail } from "shared/email/resend";
import { getEntryCutoffDisplay } from "shared/entryLimit";
import { parseRateLimitEnv, rateLimit, rateLimitHeaders } from "shared/security/rateLimit";
import { applyNotDeleted } from "shared/db/softDelete";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_TICKETS_EMAIL_PER_MIN = parseRateLimitEnv(process.env.RATE_LIMIT_TICKETS_EMAIL_PER_MIN, 10);

export async function POST(req: NextRequest) {
  const limiter = rateLimit(req, {
    keyPrefix: "landing:tickets:email",
    limit: RATE_LIMIT_TICKETS_EMAIL_PER_MIN,
    windowMs: RATE_LIMIT_WINDOW_MS,
  });
  if (!limiter.ok) {
    return NextResponse.json(
      { success: false, error: "rate_limited", retryAfterMs: limiter.resetMs },
      { status: 429, headers: rateLimitHeaders(limiter) }
    );
  }

  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json({ success: false, error: "Supabase config missing" }, { status: 500 });
  }
  let body: any = null;
  try {
    body = await req.json();
  } catch (err) {
    return NextResponse.json({ success: false, error: "JSON inválido" }, { status: 400 });
  }

  const ticketId = typeof body?.ticketId === "string" ? body.ticketId : "";
  const toEmail = typeof body?.email === "string" ? body.email.trim() : "";

  if (!ticketId || !toEmail) {
    return NextResponse.json({ success: false, error: "ticketId y email requeridos" }, { status: 400 });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const ticketQuery = applyNotDeleted(
    supabase
      .from("tickets")
      .select(
        "id,qr_token,full_name,doc_type,document,dni,email,phone,code:codes(code,type,expires_at,promoter_id),event:events(name,starts_at,location,entry_limit)"
      )
      .eq("id", ticketId)
  );
  const { data, error } = await ticketQuery.maybeSingle();

  if (error || !data) {
    return NextResponse.json({ success: false, error: "Ticket no encontrado" }, { status: 404 });
  }

  const eventRel = Array.isArray((data as any).event) ? (data as any).event?.[0] : (data as any).event;
  const codeRel = Array.isArray((data as any).code) ? (data as any).code?.[0] : (data as any).code;
  const docValue = (data as any).document || (data as any).dni || "";
  const docTypeRaw = (data as any).doc_type || ((data as any).dni ? "dni" : "");
  const docTypeLabel = docTypeRaw ? String(docTypeRaw).toUpperCase() : "";
  const documentLabel = docValue ? `${docTypeLabel ? `${docTypeLabel} ` : ""}${docValue}`.trim() : "—";
  const dateLabel = eventRel?.starts_at ? formatLimaFromDb(eventRel.starts_at) : "";
  const eventTimeLabel = (() => {
    if (!eventRel?.starts_at) return null;
    try {
      const parts = toLimaPartsFromDb(eventRel.starts_at);
      return `${String(parts.hour12).padStart(2, "0")}:${String(parts.minute).padStart(2, "0")} ${parts.ampm}`;
    } catch {
      return null;
    }
  })();
  const ticketUrl = `${appUrl}/ticket/${ticketId}`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&format=jpg&color=000000&bgcolor=ffffff&data=${encodeURIComponent(data.qr_token)}`;
  const qrImg = qrUrl;
  const codeType = (codeRel?.type || "").toLowerCase();
  const isFreeCode = codeType === "free";
  const isGeneralCode = codeType === "general";
  const isCourtesyCode = codeType === "courtesy" || codeType === "table";
  const isPromoterCode = Boolean(codeRel?.promoter_id);
  const entryCutoff = eventRel?.starts_at ? getEntryCutoffDisplay(eventRel.starts_at, eventRel?.entry_limit) : null;
  const entryLimitLabel = entryCutoff
    ? entryCutoff.isNextDay
      ? `${entryCutoff.timeLabel} (${entryCutoff.dateLabel})`
      : entryCutoff.timeLabel
    : null;
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
  if (isCourtesyCode) {
    warnings.push("QR de cortesía: no tiene límite de hora de ingreso.");
  }
  if (isGeneralCode && !isPromoterCode) {
    if (entryLimitLabel) {
      warnings.push(
        eventTimeLabel
          ? `Hora límite de ingreso: ${entryLimitLabel}. Horario del evento: ${eventTimeLabel}.`
          : `Hora límite de ingreso: ${entryLimitLabel}.`
      );
    } else if (eventTimeLabel) {
      warnings.push(`Hora de ingreso del evento: ${eventTimeLabel}.`);
    } else {
      warnings.push("Hora límite de ingreso configurable.");
    }
  }

  const warningsHtml = warnings
    .map(
      (w) =>
        `<div style="margin-top:12px;padding:10px 12px;border-radius:12px;border:1px solid rgba(233,30,99,0.35);background:linear-gradient(120deg,rgba(233,30,99,0.12),rgba(233,30,99,0.04));color:#ffddea;font-size:13px;line-height:1.4;">${w}</div>`
    )
    .join("");

  const infoLines = [
    "(+18) Presentando DNI",
    "¿Llegas tarde? Adquiere tu entrada!",
    "Si te registras y no asistes, no tendras acceso al link de registro o seras filtrado para proximos eventos.",
  ];

  const infoHtml = `<div style="margin-top:12px;padding:12px 14px;border-radius:14px;border:1px solid rgba(255,255,255,0.08);background:linear-gradient(120deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02));color:#f5f5f5;font-size:13px;line-height:1.5;">
    <div style="text-transform:uppercase;font-size:11px;letter-spacing:0.12em;color:#bcbcbc;font-weight:700;margin-bottom:6px;">Info</div>
    ${infoLines.map((line) => `<div style="margin-top:3px;">${line}</div>`).join("")}
  </div>`;

  const html = `
  <div style="margin:0;padding:0;background:#050505;font-family:'Inter','Helvetica Neue',Arial,sans-serif;">
    <div style="display:none;opacity:0;visibility:hidden;height:0;width:0;overflow:hidden;color:transparent;">Tu QR para ${eventRel?.name || "el evento"}</div>
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
                      <div style="font-size:11px;color:#bcbcbc;margin-top:6px;">Si no ves el QR, ábrelo aquí: <a href="${qrUrl}" style="color:#e91e63;">ver imagen</a></div>
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
                  <tr><td style="padding-top:12px;">${infoHtml}</td></tr>
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
  const textInfo = `\n\nInfo:\n- ${infoLines.join("\n- ")}`;
  const textBody = `Tu QR para ${eventRel?.name || "el evento"}\nNombre: ${data.full_name || "-"}\nDocumento: ${documentLabel}\nCódigo: ${codeRel?.code || "-"}\nEvento: ${eventRel?.name || ""}${dateLabel ? ` • ${dateLabel}` : ""}${eventRel?.location ? ` • ${eventRel.location}` : ""}\nEnlace del ticket: ${ticketUrl}${textWarnings}${textInfo}`;

  try {
    await sendEmail({
      to: toEmail,
      subject: `BABY - Entrada ${eventRel?.name || "evento"}`,
      html,
      text: textBody,
    });
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("Error sending email via Resend", err);
    return NextResponse.json({ success: false, error: "No se pudo enviar el correo. Intenta nuevamente." }, { status: 500 });
  }
}
