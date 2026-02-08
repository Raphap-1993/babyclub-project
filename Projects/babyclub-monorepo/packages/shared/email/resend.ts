import { Resend, type CreateEmailOptions } from "resend";

const DEFAULT_FROM_RAW = process.env.RESEND_FROM ?? "BabyClub Access <no-reply@babyclubaccess.com>";
const EXPECTED_DOMAIN = "@babyclubaccess.com";

function validateFromAddress(from: string) {
  if (!from.includes(EXPECTED_DOMAIN)) {
    throw new Error(`RESEND_FROM must be an address at ${EXPECTED_DOMAIN}`);
  }
}

export function getResendClient() {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("Missing RESEND_API_KEY");
  if (process.env.NODE_ENV !== "production") {
    console.log("[resend] key prefix:", apiKey.slice(0, 6));
    console.log("[resend] from:", DEFAULT_FROM_RAW);
  }
  validateFromAddress(DEFAULT_FROM_RAW);
  return new Resend(apiKey);
}

export async function sendEmail({
  to,
  subject,
  html,
  text,
  replyTo,
}: {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  replyTo?: string;
}) {
  const resend = getResendClient();
  validateFromAddress(DEFAULT_FROM_RAW);
  const payload: any = {
    from: DEFAULT_FROM_RAW,
    to,
    subject,
  };
  if (html) payload.html = html;
  if (text) payload.text = text;
  if (replyTo) (payload as any).reply_to = replyTo;
  return resend.emails.send(payload);
}
