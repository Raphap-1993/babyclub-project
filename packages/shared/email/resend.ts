import { Resend, type CreateEmailResponse } from "resend";
import {
  isValidEmailAddress,
  normalizeEmailAddress,
  normalizeEmailRecipients,
} from "./address";

const DEFAULT_FROM_RAW = (
  process.env.RESEND_FROM?.trim() ||
  "BabyClub Access <no-reply@babyclubaccess.com>"
).trim();
const EXPECTED_DOMAIN = "@babyclubaccess.com";

function validateFromAddress(from: string) {
  if (!from.includes(EXPECTED_DOMAIN)) {
    throw new Error(`RESEND_FROM must be an address at ${EXPECTED_DOMAIN}`);
  }
}

export function getResendClient() {
  const apiKey = (process.env.RESEND_API_KEY || "").trim();
  if (!apiKey) throw new Error("Missing RESEND_API_KEY");
  validateFromAddress(DEFAULT_FROM_RAW);
  return new Resend(apiKey);
}

export async function sendEmail({
  to,
  subject,
  html,
  text,
  replyTo,
  idempotencyKey,
}: {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  replyTo?: string;
  idempotencyKey?: string;
}): Promise<CreateEmailResponse> {
  validateFromAddress(DEFAULT_FROM_RAW);
  const normalizedTo = normalizeEmailRecipients(to);
  const recipientList = Array.isArray(normalizedTo)
    ? normalizedTo
    : [normalizedTo];
  if (recipientList.length === 0) {
    throw new Error("Recipient email missing");
  }
  if (!recipientList.every((email) => isValidEmailAddress(email))) {
    throw new Error("Email inválido");
  }
  const payload: any = {
    from: DEFAULT_FROM_RAW,
    to: normalizedTo,
    subject,
  };
  if (html) payload.html = html;
  if (text) payload.text = text;
  if (replyTo) {
    const normalizedReplyTo = normalizeEmailAddress(replyTo);
    if (!isValidEmailAddress(normalizedReplyTo)) {
      throw new Error("Reply-to inválido");
    }
    (payload as any).reply_to = normalizedReplyTo;
  }
  if (process.env.BABY_EMAIL_TRANSPORT === "mailpit") {
    const url = new URL(process.env.MAILPIT_URL || "http://127.0.0.1:64324");
    const dbUrl = new URL(process.env.SUPABASE_URL || "http://invalid");
    const local = (host: string) =>
      ["localhost", "127.0.0.1", "[::1]"].includes(host);
    if (!local(url.hostname) || !local(dbUrl.hostname))
      throw new Error("Mailpit requires local services");
    const recipients = Array.isArray(normalizedTo)
      ? normalizedTo
      : [normalizedTo];
    const response = await fetch(new URL("/api/v1/send", url), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        From: { Email: "no-reply@babyclubaccess.com", Name: "BabyClub local" },
        To: recipients.map((Email) => ({ Email })),
        Subject: subject,
        HTML: html,
        Text: text,
        ...(idempotencyKey
          ? { Headers: { "Message-ID": `<${idempotencyKey}@babyclub.local>` } }
          : {}),
      }),
      signal: AbortSignal.timeout(10_000),
      redirect: "error",
    });
    if (!response.ok)
      throw new Error("Mailpit did not accept the local message");
    const sent = await response.json();
    if (!sent.ID) throw new Error("Mailpit did not confirm the local message");
    return { data: { id: sent.ID }, error: null, headers: null };
  }
  const resend = getResendClient();
  const result = await resend.emails.send(
    payload,
    idempotencyKey ? { idempotencyKey } : undefined,
  );
  if (result.error) {
    throw new Error(result.error.message || "No se pudo enviar el correo");
  }
  if (!result.data?.id) {
    throw new Error("El proveedor no confirmó el envío del correo");
  }
  return result;
}
