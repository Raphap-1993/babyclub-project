import { after, NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isValidEmailAddress } from "shared/email/address";
import { sendEmail } from "shared/email/resend";
import { getPublicAppUrl } from "shared/publicUrl";
import { rateLimit, rateLimitHeaders } from "shared/security/rateLimit";
import {
  emailLookup,
  recoveryEmail,
  recoveryKey,
  recoveryMessage,
} from "./recovery";

export const maxDuration = 30;

export async function POST(req: NextRequest) {
  const limit = rateLimit(req, {
    keyPrefix: "ticket-recovery-ip",
    limit: 5,
    windowMs: 900_000,
  });
  if (!limit.ok)
    return NextResponse.json(
      { error: "Espera unos minutos antes de volver a intentarlo." },
      { status: 429, headers: rateLimitHeaders(limit) },
    );
  let email = "";
  try {
    const raw = await req.text();
    if (raw.length > 1024) throw new Error("body");
    const body = JSON.parse(raw);
    email =
      typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  } catch {
    return NextResponse.json(
      { error: "Ingresa un correo válido." },
      { status: 400 },
    );
  }
  if (
    email.length > 254 ||
    !isValidEmailAddress(email) ||
    /[,;<>\\\r\n]/.test(email)
  ) {
    return NextResponse.json(
      { error: "Ingresa un correo válido." },
      { status: 400 },
    );
  }
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key)
    return NextResponse.json(
      { error: "El servicio no está disponible. Inténtalo más tarde." },
      { status: 503 },
    );
  const idempotencyKey = recoveryKey(email);
  const recipientLimit = rateLimit(req, {
    keyPrefix: "ticket-recovery-recipient",
    limit: 1,
    windowMs: 1_200_000,
    getKey: () => idempotencyKey.split("/")[1],
  });
  if (recipientLimit.ok)
    after(async () => {
      try {
        const db = createClient(url, key, {
          auth: { persistSession: false, autoRefreshToken: false },
        });
        const [tickets, reservations] = await Promise.all([
          db
            .from("tickets")
            .select("id,event:events(name)")
            .ilike("email", emailLookup(email))
            .is("deleted_at", null)
            .eq("is_active", true)
            .or("payment_status.is.null,payment_status.eq.paid")
            .order("created_at", { ascending: false })
            .limit(20),
          db
            .from("table_reservations")
            .select("id,event:events(name)")
            .ilike("email", emailLookup(email))
            .is("deleted_at", null)
            .eq("status", "approved")
            .order("created_at", { ascending: false })
            .limit(20),
        ]);
        if (tickets.error || reservations.error)
          throw new Error("lookup_failed");
        const base = getPublicAppUrl();
        const eventName = (
          event: { name: string } | { name: string }[] | null,
        ) => {
          const name = Array.isArray(event) ? event[0]?.name : event?.name;
          return name ? ` · ${name}` : "";
        };
        const links = [
          ...(tickets.data || []).map((ticket, index) => ({
            label: `Ver entrada ${index + 1}${eventName(ticket.event)}`,
            url: `${base}/ticket/${encodeURIComponent(ticket.id)}`,
          })),
          ...(reservations.data || []).map((reservation, index) => ({
            label: `Ver compra o reserva ${index + 1}${eventName(reservation.event)}`,
            url: `${base}/compra?reservationId=${encodeURIComponent(reservation.id)}`,
          })),
        ];
        if (links.length)
          await sendEmail({
            to: email,
            ...recoveryEmail(links),
            idempotencyKey,
          });
      } catch {
        console.error("[ticket-recovery] delivery_failed");
      }
    });
  return NextResponse.json(
    { message: recoveryMessage },
    { status: 202, headers: { "Cache-Control": "no-store" } },
  );
}
