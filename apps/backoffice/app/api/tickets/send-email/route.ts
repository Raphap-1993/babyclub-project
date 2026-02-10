import { NextRequest, NextResponse } from "next/server";
import { sendEmail } from "shared/email/resend";

// URL de la app landing donde está la página pública del ticket
const landingUrl = process.env.NEXT_PUBLIC_LANDING_URL || "https://babyclubaccess.com";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const ticketId = typeof body?.ticketId === "string" ? body.ticketId : "";
    const toEmail = typeof body?.email === "string" ? body.email.trim() : "";

    if (!ticketId || !toEmail) {
      return NextResponse.json(
        { success: false, error: "ticketId y email requeridos" },
        { status: 400 }
      );
    }

    // Validar formato de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(toEmail)) {
      return NextResponse.json(
        { success: false, error: "Email inválido" },
        { status: 400 }
      );
    }

    const ticketUrl = `${landingUrl}/ticket/${ticketId}`;

    const html = `
    <div style="margin:0;padding:0;background:#050505;font-family:'Inter','Helvetica Neue',Arial,sans-serif;">
      <div style="display:none;opacity:0;visibility:hidden;height:0;width:0;overflow:hidden;color:transparent;">Tu ticket de Baby Club</div>
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#050505;padding:24px 12px;">
        <tr>
          <td align="center">
            <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:640px;background:#0b0b0b;border-radius:24px;border:1px solid rgba(255,255,255,0.05);overflow:hidden;">
              <tr>
                <td style="padding:28px 32px 10px;background:linear-gradient(135deg,rgba(255,255,255,0.06),rgba(233,30,99,0.1));color:#ffffff;">
                  <div style="text-transform:uppercase;font-size:12px;letter-spacing:0.28em;color:#f2f2f2;opacity:0.8;margin-bottom:6px;">Baby Club</div>
                  <h1 style="margin:0;font-size:26px;line-height:1.2;color:#ffffff;">Tu Ticket</h1>
                  <p style="margin:8px 0 0;font-size:14px;color:#d9d9d9;">Accede a tu ticket desde el siguiente enlace</p>
                </td>
              </tr>
              <tr>
                <td style="padding:32px;">
                  <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                    <tr>
                      <td align="center" style="padding:20px 0 6px;">
                        <a href="${ticketUrl}" style="display:inline-block;padding:14px 32px;border-radius:999px;background:linear-gradient(120deg,#e91e63,#ff6fb7);color:#ffffff;font-weight:700;font-size:15px;text-decoration:none;letter-spacing:0.04em;">Ver Ticket</a>
                      </td>
                    </tr>
                    <tr>
                      <td style="text-align:center;color:#7f7f7f;font-size:13px;line-height:1.6;padding-top:16px;">
                        También puedes copiar este enlace en tu navegador:<br/>
                        <a href="${ticketUrl}" style="color:#e91e63;word-break:break-all;">${ticketUrl}</a>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding-top:24px;border-top:1px solid rgba(255,255,255,0.08);margin-top:24px;">
                        <div style="padding:12px 14px;border-radius:14px;border:1px solid rgba(255,255,255,0.08);background:linear-gradient(120deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02));color:#f5f5f5;font-size:13px;line-height:1.5;">
                          <div style="text-transform:uppercase;font-size:11px;letter-spacing:0.12em;color:#bcbcbc;font-weight:700;margin-bottom:6px;">Info</div>
                          <div style="margin-top:3px;">Presenta este ticket en la entrada del evento</div>
                          <div style="margin-top:3px;">Puedes descargarlo como PDF desde el enlace</div>
                        </div>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </div>`;

    const textBody = `Baby Club - Tu Ticket\n\nAccede a tu ticket desde este enlace:\n${ticketUrl}\n\nPresenta este ticket en la entrada del evento.\nPuedes descargarlo como PDF desde el enlace.`;

    await sendEmail({
      to: toEmail,
      subject: "Baby Club - Tu Ticket",
      html,
      text: textBody,
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("Error sending ticket email:", err);
    return NextResponse.json(
      { success: false, error: err.message || "No se pudo enviar el correo" },
      { status: 500 }
    );
  }
}
