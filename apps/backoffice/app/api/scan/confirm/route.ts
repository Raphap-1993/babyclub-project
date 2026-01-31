import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { DateTime } from "luxon";
import { EVENT_TZ } from "shared/datetime";
import { getEntryCutoff } from "shared/entryLimit";
import { requireStaffRole } from "shared/auth/requireStaff";
import { getClientIp, parseRateLimitEnv, rateLimit, rateLimitHeaders } from "shared/security/rateLimit";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_SCAN_PER_MIN = parseRateLimitEnv(process.env.RATE_LIMIT_SCAN_PER_MIN, 120);

export async function POST(req: NextRequest) {
  const guard = await requireStaffRole(req, ["door", "admin", "superadmin"]);
  if (!guard.ok) {
    return NextResponse.json({ success: false, error: guard.error }, { status: guard.status });
  }
  const limiter = rateLimit(req, {
    keyPrefix: "backoffice:scan:confirm",
    limit: RATE_LIMIT_SCAN_PER_MIN,
    windowMs: RATE_LIMIT_WINDOW_MS,
    getKey: () => {
      const ip = getClientIp(req);
      const staffId = guard.context?.staffId;
      return staffId ? `${ip}:${staffId}` : ip;
    },
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
  } catch (_err) {
    return NextResponse.json({ success: false, error: "JSON inválido" }, { status: 400 });
  }

  const code_id = typeof body?.code_id === "string" ? body.code_id.trim() : null;
  const ticket_id = typeof body?.ticket_id === "string" ? body.ticket_id.trim() : null;

  if (!code_id && !ticket_id) {
    return NextResponse.json({ success: false, error: "code_id o ticket_id es requerido" }, { status: 400 });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Buscar ticket si existe
  const { data: ticket, error: ticketErr } = await supabase
    .from("tickets")
    .select("id,code_id,event_id,used,used_at")
    .match(ticket_id ? { id: ticket_id } : { code_id })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (ticketErr) {
    return NextResponse.json({ success: false, error: ticketErr.message }, { status: 400 });
  }

  if (ticket) {
    if (ticket.used) {
      return NextResponse.json({ success: false, error: "Este ticket ya fue usado", result: "duplicate" }, { status: 400 });
    }

    const { data: codeRow } = await supabase
      .from("codes")
      .select("id,type")
      .eq("id", ticket.code_id)
      .maybeSingle();
    const codeType = (codeRow?.type || "").toLowerCase();
    if (codeType === "general") {
      const { data: eventRow, error: eventError } = await supabase
        .from("events")
        .select("starts_at,entry_limit")
        .eq("id", ticket.event_id)
        .maybeSingle();
      if (eventError) {
        return NextResponse.json({ success: false, error: eventError.message }, { status: 400 });
      }
      if (eventRow) {
        const entryCutoff = getEntryCutoff(eventRow.starts_at, eventRow.entry_limit);
        if (entryCutoff && DateTime.now().setZone(EVENT_TZ) > entryCutoff.cutoff) {
          return NextResponse.json(
            {
              success: false,
              error: "Fuera de hora de ingreso",
              result: "expired",
              reason: "entry_cutoff",
              expired_at: entryCutoff.cutoff.toUTC().toISO(),
            },
            { status: 400 }
          );
        }
      }
    }

    const now = new Date().toISOString();
    const { error: updErr } = await supabase
      .from("tickets")
      .update({ used: true, used_at: now })
      .eq("id", ticket.id);
    if (updErr) {
      return NextResponse.json({ success: false, error: updErr.message }, { status: 400 });
    }

    await supabase.from("scan_logs").insert({
      event_id: ticket.event_id,
      code_id: ticket.code_id,
      ticket_id: ticket.id,
      raw_value: ticket.id,
      result: "valid",
      scanned_by_staff_id: null,
    });

    return NextResponse.json({
      success: true,
      result: "confirmed",
      ticket_id: ticket.id,
      code_id: ticket.code_id ?? null,
      ticket_used: true,
    });
  }

  if (!code_id) {
    return NextResponse.json({ success: false, error: "Ticket no encontrado", result: "not_found" }, { status: 404 });
  }

  const { data: codeRow, error: codeErr } = await supabase
    .from("codes")
    .select("id,event_id,type,is_active,max_uses,uses,expires_at")
    .eq("id", code_id)
    .maybeSingle();

  if (codeErr) {
    return NextResponse.json({ success: false, error: codeErr.message }, { status: 400 });
  }
  if (!codeRow) {
    return NextResponse.json({ success: false, error: "Código no encontrado", result: "not_found" }, { status: 404 });
  }
  if (!codeRow.is_active) {
    return NextResponse.json({ success: false, error: "Código inactivo", result: "inactive" }, { status: 400 });
  }
  if ((codeRow.type || "").toLowerCase() === "general") {
    const { data: eventRow, error: eventError } = await supabase
      .from("events")
      .select("starts_at,entry_limit")
      .eq("id", codeRow.event_id)
      .maybeSingle();
    if (eventError) {
      return NextResponse.json({ success: false, error: eventError.message }, { status: 400 });
    }
    if (eventRow) {
      const entryCutoff = getEntryCutoff(eventRow.starts_at, eventRow.entry_limit);
      if (entryCutoff && DateTime.now().setZone(EVENT_TZ) > entryCutoff.cutoff) {
        return NextResponse.json(
          {
            success: false,
            error: "Fuera de hora de ingreso",
            result: "expired",
            reason: "entry_cutoff",
            expired_at: entryCutoff.cutoff.toUTC().toISO(),
          },
          { status: 400 }
        );
      }
    }
  }
  const expired = codeRow.expires_at ? new Date(codeRow.expires_at) < new Date() : false;
  if (expired) {
    return NextResponse.json({ success: false, error: "Código expirado", result: "expired" }, { status: 400 });
  }
  if (codeRow.max_uses !== null && codeRow.max_uses !== undefined && (codeRow.uses ?? 0) >= codeRow.max_uses) {
    return NextResponse.json({ success: false, error: "Código sin cupos", result: "exhausted" }, { status: 400 });
  }

  const nextUses = (codeRow.uses ?? 0) + 1;
  const { error: updateErr } = await supabase.from("codes").update({ uses: nextUses }).eq("id", codeRow.id);
  if (updateErr) {
    return NextResponse.json({ success: false, error: updateErr.message }, { status: 400 });
  }

  await supabase.from("scan_logs").insert({
    event_id: codeRow.event_id,
    code_id: codeRow.id,
    ticket_id: null,
    raw_value: codeRow.id,
    result: "valid",
    scanned_by_staff_id: null,
  });

  return NextResponse.json({
    success: true,
    result: "confirmed",
    code_id: codeRow.id,
    uses: nextUses,
    max_uses: codeRow.max_uses ?? null,
  });
}
