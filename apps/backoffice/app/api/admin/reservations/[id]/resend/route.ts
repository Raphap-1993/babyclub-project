import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireStaffRole } from "shared/auth/requireStaff";
import { sendEmail } from "shared/email/resend";
import { formatLimaFromDb } from "shared/limaTime";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

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

  const { data: reservation } = await supabase
    .from("table_reservations")
    .select(
      `
      id,
      full_name,
      email,
      codes,
      table:tables(name,event:events(name,starts_at,location)),
      ticket:tickets(id,qr_token)
      `
    )
    .eq("id", id)
    .maybeSingle();

  if (!reservation || !reservation.email) {
    return NextResponse.json({ success: false, error: "Reserva no encontrada o sin email" }, { status: 404 });
  }

  const tableRel = Array.isArray((reservation as any).table) ? (reservation as any).table?.[0] : (reservation as any).table;
  const eventRel = tableRel?.event ? (Array.isArray(tableRel.event) ? tableRel.event[0] : tableRel.event) : null;
  const ticketRel = Array.isArray((reservation as any).ticket) ? (reservation as any).ticket?.[0] : (reservation as any).ticket;

  const codes = Array.isArray(reservation.codes) ? reservation.codes : [];
  const qrToken = ticketRel?.qr_token || ticketRel?.id;
  
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://babyclubaccess.com";
  const ticketUrl = `${appUrl}/ticket/${ticketRel?.id}`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&format=jpg&color=000000&bgcolor=ffffff&data=${encodeURIComponent(
    qrToken || ticketRel?.id || ""
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
                <p style="margin:0 0 12px;font-size:15px;color:#f5f5f5;">Hola ${reservation.full_name || "invitadx"},</p>
                <p style="margin:0 0 14px;font-size:14px;color:#d7d7d7;line-height:1.6;">Adjuntamos tu QR y los códigos de mesa asociados a tu pack.</p>
                <div style="text-align:center;margin-bottom:16px;">
                  <img src="${qrUrl}" alt="QR" width="210" height="210" style="border-radius:16px;border:8px solid #0f0f0f;background:#fff;" />
                </div>
                <div style="margin-bottom:16px;text-align:center;">
                  <a href="${ticketUrl}" style="display:inline-block;padding:12px 20px;border-radius:999px;background:linear-gradient(120deg,#e91e63,#ff6fb7);color:#ffffff;font-weight:700;font-size:14px;text-decoration:none;letter-spacing:0.04em;">Ver ticket actualizado</a>
                </div>
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

  try {
    await sendEmail({
      to: reservation.email,
      subject: `BABY - Reserva confirmada (${tableRel?.name || "Mesa"})`,
      html,
      text: `Reserva confirmada - Mesa ${tableRel?.name || ""}\n\nTicket: ${ticketUrl}`,
    });

    return NextResponse.json({ success: true, message: "Correo reenviado" });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
