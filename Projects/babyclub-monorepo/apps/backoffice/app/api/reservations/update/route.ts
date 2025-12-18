import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { formatLimaFromDb, toLimaPartsFromDb } from "shared/limaTime";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const resendApiKey = process.env.RESEND_API_KEY;
const fromEmail = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";

const supabase =
  supabaseUrl && supabaseServiceKey
    ? createClient(supabaseUrl, supabaseServiceKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      })
    : null;

export async function POST(req: NextRequest) {
  if (!supabase) {
    return NextResponse.json({ success: false, error: "Supabase config missing" }, { status: 500 });
  }

  let body: any = null;
  try {
    body = await req.json();
  } catch (_err) {
    return NextResponse.json({ success: false, error: "Invalid JSON" }, { status: 400 });
  }

  const id = typeof body?.id === "string" ? body.id : "";
  const status = typeof body?.status === "string" ? body.status : "";
  const full_name = typeof body?.full_name === "string" ? body.full_name.trim() : undefined;
  const email = typeof body?.email === "string" ? body.email.trim() : undefined;
  const phone = typeof body?.phone === "string" ? body.phone.trim() : undefined;

  if (!id) {
    return NextResponse.json({ success: false, error: "Invalid id" }, { status: 400 });
  }

  const updateData: Record<string, any> = {};
  if (status && ["pending", "approved", "rejected"].includes(status)) updateData.status = status;
  if (full_name !== undefined && full_name.length > 0) updateData.full_name = full_name;
  if (email !== undefined) {
    const emailValid = email === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    if (!emailValid) return NextResponse.json({ success: false, error: "Email inválido" }, { status: 400 });
    updateData.email = email || null;
  }
  if (phone !== undefined) updateData.phone = phone || null;

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ success: false, error: "Nada para actualizar" }, { status: 400 });
  }

  const { error } = await supabase.from("table_reservations").update(updateData).eq("id", id);
  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  let emailSent = false;
  let emailError: string | null = null;

  if (updateData.status === "approved") {
    try {
      const { data: reservation } = await supabase
        .from("table_reservations")
        .select("id,full_name,email,phone,codes,table:tables(id,name,event_id,event:events(id,name,starts_at,location))")
        .eq("id", id)
        .maybeSingle();

      if (!resendApiKey) {
        emailError = "Correo no disponible: configura RESEND_API_KEY";
      } else if (!reservation) {
        emailError = "Reserva no encontrada para enviar correo";
      } else if (!reservation.email) {
        emailError = "Reserva aprobada sin correo del cliente";
      } else {
        const codes = Array.isArray((reservation as any).codes)
          ? (reservation as any).codes.map((c: any) => String(c)).filter(Boolean)
          : [];
        const tableRel = Array.isArray((reservation as any).table) ? (reservation as any).table?.[0] : (reservation as any).table;
        const eventRel = tableRel?.event ? (Array.isArray(tableRel.event) ? tableRel.event[0] : tableRel.event) : null;
        const eventId = tableRel?.event_id || eventRel?.id || null;

        let ticketId: string | null = null;
        if (eventId) {
          ticketId = await createTicketForReservation({
            eventId,
            tableName: tableRel?.name || "",
            full_name: (reservation as any).full_name || "",
            email: (reservation as any).email || "",
            phone: (reservation as any).phone || "",
            codes,
          });
        } else {
          emailError = "Mesa sin evento asignado; no se generó ticket/QR.";
        }

        if (ticketId) {
          await sendTicketEmail(ticketId, (reservation as any).email || "");
          emailSent = true;
        }
      }
    } catch (err: any) {
      emailError = err?.message || "No se pudo enviar el correo";
    }
  }

  return NextResponse.json({ success: true, emailSent, emailError });
}

async function sendApprovalEmail({
  id,
  full_name,
  email,
  phone,
  codes,
  tableName,
  event,
}: {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  codes: string[];
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

  const qrImg = async (code: string) => {
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(code)}`;
    const quickChart = `https://quickchart.io/qr?size=240&text=${encodeURIComponent(code)}`;
    try {
      const res = await fetch(quickChart, { cache: "no-store" });
      if (res.ok) {
        const buffer = Buffer.from(await res.arrayBuffer());
        return `data:image/png;base64,${buffer.toString("base64")}`;
      }
      const res2 = await fetch(qrUrl, { cache: "no-store" });
      if (res2.ok) {
        const buffer = Buffer.from(await res2.arrayBuffer());
        return `data:image/png;base64,${buffer.toString("base64")}`;
      }
    } catch (_err) {
      // ignore y usa URL remota
    }
    return qrUrl;
  };

  const codesHtml =
    codes.length > 0
      ? (
          await Promise.all(
            codes.map(async (code) => {
              const img = await qrImg(code);
              return `
        <div style="padding:12px;border-radius:12px;border:1px solid rgba(255,255,255,0.08);background:#0f0f0f;margin-bottom:12px;">
          <div style="font-family:'Inter','Helvetica Neue',Arial,sans-serif;font-size:14px;color:#f5f5f5;font-weight:700;">${escape(code)}</div>
          <div style="font-size:12px;color:#cfcfcf;margin:6px 0 8px;">Comparte este código con tu grupo.</div>
          <img src="${img}" alt="QR ${code}" width="180" height="180" style="border-radius:12px;border:6px solid #0b0b0b;background:#fff;" />
        </div>
      `;
            })
          )
        ).join("")
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
                  Confirmamos tu reserva. Valida estos códigos en puerta; el QR de cada código contiene el mismo valor.
                  ${phone ? `<br/>Teléfono registrado: ${phone}` : ""}
                </p>
                ${codesHtml}
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

  const payload = {
    from: fromEmail,
    to: email,
    subject: "Reserva aprobada - códigos y QR",
    html,
    text: textBody,
  };

  const sendRes = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!sendRes.ok) {
    const errText = await sendRes.text().catch(() => "");
    throw new Error(errText || "No se pudo enviar el correo de reserva");
  }
}

async function createTicketForReservation({
  eventId,
  tableName,
  full_name,
  email,
  phone,
  codes,
}: {
  eventId: string;
  tableName: string;
  full_name: string;
  email: string;
  phone: string | null;
  codes: string[];
}): Promise<string | null> {
  if (!supabase) return null;
  const [firstName, ...rest] = (full_name || "").trim().split(" ");
  const lastName = rest.join(" ").trim() || "Invitado";

  // 1. Buscar o crear persona (por email/phone)
  let personId: string | null = null;
  if (email) {
    const { data: person } = await supabase.from("persons").select("id").eq("email", email).maybeSingle();
    personId = person?.id || null;
  }
  if (!personId && phone) {
    const { data: person } = await supabase.from("persons").select("id").eq("phone", phone).maybeSingle();
    personId = person?.id || null;
  }
  if (!personId) {
    const { data: inserted, error } = await supabase
      .from("persons")
      .insert({
        first_name: firstName || "Invitado",
        last_name: lastName || "Reserva",
        email: email || null,
        phone: phone || null,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    personId = inserted?.id;
  }
  if (!personId) throw new Error("No se pudo crear persona");

  // 2. Crear código único para la mesa si no hay códigos existentes
  let codeId: string | null = null;
  let codeValue: string | null = null;
  if (codes && codes.length > 0) {
    const { data: codeRow } = await supabase.from("codes").select("id").eq("code", codes[0]).maybeSingle();
    codeId = codeRow?.id || null;
    codeValue = codes[0];
  }
  if (!codeId) {
    // generar código tipo mesa
    const base = `mesa-${tableName || "res"}`.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 12);
    let attempts = 0;
    while (!codeId && attempts < 5) {
      attempts++;
      const value = `${base}-${Math.floor(Math.random() * 900000 + 100000)}`;
      const { data: insertedCode, error: codeErr } = await supabase
        .from("codes")
        .insert({
          code: value,
          event_id: eventId,
          type: "table",
          is_active: true,
          max_uses: 1,
          uses: 0,
        })
        .select("id,code")
        .single();
      if (!codeErr && insertedCode?.id) {
        codeId = insertedCode.id;
        codeValue = insertedCode.code;
        break;
      }
    }
  }
  if (!codeId) throw new Error("No se pudo generar código para el ticket");

  // 3. Crear ticket
  const qr_token = crypto.randomUUID();
  const { data: ticket, error: ticketErr } = await supabase
    .from("tickets")
    .insert({
      event_id: eventId,
      code_id: codeId,
      person_id: personId,
      qr_token,
      full_name: full_name || null,
      email: email || null,
      phone: phone || null,
    })
    .select("id")
    .single();
  if (ticketErr) throw new Error(ticketErr.message);

  return ticket?.id || null;
}

async function sendTicketEmail(ticketId: string, toEmail: string) {
  if (!supabase) throw new Error("Supabase no disponible");
  if (!resendApiKey) throw new Error("Correo no disponible: configura RESEND_API_KEY");

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  const { data, error } = await supabase
    .from("tickets")
    .select(
      "id,qr_token,full_name,dni,email,phone,code:codes(code,type,expires_at,promoter_id),event:events(name,starts_at,location)"
    )
    .eq("id", ticketId)
    .maybeSingle();
  if (error || !data) throw new Error("Ticket no encontrado para enviar correo");

  const eventRel = Array.isArray((data as any).event) ? (data as any).event?.[0] : (data as any).event;
  const codeRel = Array.isArray((data as any).code) ? (data as any).code?.[0] : (data as any).code;
  const dateLabel = eventRel?.starts_at ? formatLimaFromDb(eventRel.starts_at) : "";
  const ticketUrl = `${appUrl}/ticket/${ticketId}`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(data.qr_token)}`;
  let qrImg = qrUrl;
  try {
    const qrRes = await fetch(qrUrl);
    if (qrRes.ok) {
      const buffer = Buffer.from(await qrRes.arrayBuffer());
      qrImg = `data:image/png;base64,${buffer.toString("base64")}`;
    }
  } catch (_err) {
    qrImg = qrUrl;
  }
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
                              <strong>DNI:</strong> ${data.dni || "-"}<br/>
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
  const textBody = `Tu QR para ${eventRel?.name || "el evento"}\nNombre: ${data.full_name || "-"}\nDNI: ${data.dni || "-"}\nCódigo: ${codeRel?.code || "-"}\nEvento: ${eventRel?.name || ""}${dateLabel ? ` • ${dateLabel}` : ""}${eventRel?.location ? ` • ${eventRel.location}` : ""}\nEnlace del ticket: ${ticketUrl}${textWarnings}`;

  const emailPayload = {
    from: fromEmail,
    to: toEmail,
    subject: `BABY - Entrada ${eventRel?.name || "evento"}`,
    html,
    text: textBody,
  };

  const sendRes = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(emailPayload),
  });

  if (!sendRes.ok) {
    const errText = await sendRes.text().catch(() => "");
    throw new Error(errText || "No se pudo enviar el correo");
  }
}
