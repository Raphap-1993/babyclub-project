import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  isValidEmailAddress,
  normalizeEmailAddress,
} from "shared/email/address";
import { parseRateLimitEnv, rateLimit, rateLimitHeaders } from "shared/security/rateLimit";
import { getTicketEmailDeliveryErrorMessage } from "shared/email/ticketEmailError";
import { sendTicketEmail } from "../../../../../backoffice/app/api/reservations/email";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_TICKETS_EMAIL_PER_MIN = parseRateLimitEnv(
  process.env.RATE_LIMIT_TICKETS_EMAIL_PER_MIN,
  10,
);

export async function POST(req: NextRequest) {
  const limiter = rateLimit(req, {
    keyPrefix: "landing:tickets:email",
    limit: RATE_LIMIT_TICKETS_EMAIL_PER_MIN,
    windowMs: RATE_LIMIT_WINDOW_MS,
  });
  if (!limiter.ok) {
    return NextResponse.json(
      { success: false, error: "rate_limited", retryAfterMs: limiter.resetMs },
      { status: 429, headers: rateLimitHeaders(limiter) },
    );
  }

  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json(
      { success: false, error: "Supabase config missing" },
      { status: 500 },
    );
  }

  let body: any = null;
  try {
    body = await req.json();
  } catch (_err) {
    return NextResponse.json(
      { success: false, error: "JSON inválido" },
      { status: 400 },
    );
  }

  const ticketId =
    typeof body?.ticketId === "string" ? body.ticketId.trim() : "";
  const toEmail = normalizeEmailAddress(
    typeof body?.email === "string" ? body.email : "",
  );

  if (!ticketId || !toEmail) {
    return NextResponse.json(
      { success: false, error: "ticketId y email requeridos" },
      { status: 400 },
    );
  }
  if (!isValidEmailAddress(toEmail)) {
    return NextResponse.json(
      { success: false, error: "Email inválido" },
      { status: 400 },
    );
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    await sendTicketEmail({ supabase, ticketId, toEmail });
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json(
      {
        success: false,
        error: getTicketEmailDeliveryErrorMessage(),
      },
      { status: 500 },
    );
  }
}
