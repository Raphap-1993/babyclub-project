import { createHash } from "node:crypto";
import { escapeEmailHtml } from "shared/email/template";

export const recoveryMessage =
  "Si hay entradas o reservas asociadas a este correo, recibirás un mensaje con tus accesos. Revisa también correo no deseado.";
export const emailLookup = (email: string) => email.replace(/[\\%_]/g, "\\$&");
export const recoveryKey = (email: string, now = Date.now()) =>
  `ticket-recovery/${createHash("sha256").update(email.toLowerCase()).digest("hex")}/${Math.floor(now / 1_200_000)}`;

export function recoveryEmail(links: { label: string; url: string }[]) {
  return {
    subject: "Tus accesos a BABY",
    text: `Estos son los accesos que solicitaste en Mis entradas:\n\n${links.map((link) => `${link.label}: ${link.url}`).join("\n\n")}\n\nLos enlaces son personales. No los compartas. Si no solicitaste este mensaje, puedes ignorarlo.`,
    html: `<div style="background:#080808;color:#fff;padding:32px;font-family:Arial,sans-serif;max-width:560px;margin:auto"><h1>Mis entradas</h1><p>Estos son los accesos que solicitaste en BABY.</p>${links.map((link) => `<p><a style="display:inline-block;padding:16px 20px;background:#fff;color:#111;border-radius:8px;text-decoration:none" href="${escapeEmailHtml(link.url)}">${escapeEmailHtml(link.label)}</a></p>`).join("")}<p style="color:#aaa;font-size:13px;line-height:1.6">Los enlaces son personales. No los compartas. Si no solicitaste este mensaje, puedes ignorarlo.</p></div>`,
  };
}
