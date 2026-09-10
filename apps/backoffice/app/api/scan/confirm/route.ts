import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getTicketAccessState } from "shared/ticketAccess";
import { requireStaffRole } from "shared/auth/requireStaff";
import {
  getClientIp,
  parseRateLimitEnv,
  rateLimit,
  rateLimitHeaders,
} from "shared/security/rateLimit";
import { applyNotDeleted } from "shared/db/softDelete";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_SCAN_PER_MIN = parseRateLimitEnv(
  process.env.RATE_LIMIT_SCAN_PER_MIN,
  120,
);

export async function POST(req: NextRequest) {
  const guard = await requireStaffRole(req, ["door", "admin", "superadmin"]);
  if (!guard.ok) {
    return NextResponse.json(
      { success: false, error: guard.error },
      { status: guard.status },
    );
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

  const ticket_id =
    typeof body?.ticket_id === "string" ? body.ticket_id.trim() : null;
  const qr_token =
    typeof body?.qr_token === "string" ? body.qr_token.trim() : null;
  const event_id =
    typeof body?.event_id === "string" ? body.event_id.trim() : null;

  if (!ticket_id) {
    return NextResponse.json(
      {
        success: false,
        error: "Presenta el QR individual de la entrada",
        reason: "individual_qr_required",
      },
      { status: 400 },
    );
  }
  if (!qr_token) {
    return NextResponse.json(
      {
        success: false,
        error: "Vuelve a escanear el QR de la entrada",
        reason: "rescan_required",
      },
      { status: 400 },
    );
  }
  if (!event_id) {
    return NextResponse.json(
      { success: false, error: "Selecciona el evento" },
      { status: 400 },
    );
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Buscar ticket si existe
  const ticketQuery = applyNotDeleted(
    supabase
      .from("tickets")
      .select(
        "id,code_id,event_id,used,used_at,is_active,payment_status,qr_token,doc_type,document,dni",
      )
      .eq("id", ticket_id)
      .order("created_at", { ascending: false })
      .limit(1),
  );
  const { data: ticket, error: ticketErr } = await ticketQuery.maybeSingle();

  if (ticketErr) {
    return NextResponse.json(
      { success: false, error: ticketErr.message },
      { status: 400 },
    );
  }

  if (ticket) {
    if (ticket.qr_token !== qr_token) {
      return NextResponse.json(
        {
          success: false,
          error: "La entrada fue actualizada. Escanea el QR actual",
          result: "invalid",
          reason: "rescan_required",
        },
        { status: 409 },
      );
    }
    if (
      ticket.is_active === false ||
      String(ticket.payment_status || "").toLowerCase() === "pending"
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Este ticket está inactivo",
          result: "inactive",
        },
        { status: 409 },
      );
    }
    if (event_id && ticket.event_id !== event_id) {
      return NextResponse.json(
        {
          success: false,
          error: "El ticket pertenece a otro evento",
          result: "invalid",
          reason: "event_mismatch",
        },
        { status: 409 },
      );
    }
    if (ticket.used) {
      return NextResponse.json(
        {
          success: false,
          error: "Este ticket ya fue usado",
          result: "duplicate",
        },
        { status: 400 },
      );
    }

    const codeLookup = applyNotDeleted(
      supabase
        .from("codes")
        .select("id,type,expires_at")
        .eq("id", ticket.code_id),
    );
    const { data: codeRow, error: codeError } = await codeLookup.maybeSingle();
    if (codeError || (ticket.code_id && !codeRow)) {
      return NextResponse.json(
        { success: false, error: "No se pudo validar la entrada" },
        { status: 409 },
      );
    }
    const eventQuery = applyNotDeleted(
      supabase
        .from("events")
        .select("starts_at,entry_limit,is_active,closed_at")
        .eq("id", ticket.event_id),
    );
    const { data: eventRow, error: eventError } =
      await eventQuery.maybeSingle();
    if (eventError) {
      return NextResponse.json(
        { success: false, error: eventError.message },
        { status: 400 },
      );
    }
    const { data: unit, error: unitError } = await supabase
      .from("ticket_reservation_units")
      .select("id,status,deleted_at")
      .eq("ticket_id", ticket.id)
      .maybeSingle();
    if (unitError)
      return NextResponse.json(
        { success: false, error: "No se pudo validar al asistente" },
        { status: 409 },
      );
    const access = getTicketAccessState({
      ticket,
      code: codeRow,
      event: eventRow,
      unit,
    });
    if (access.state !== "ready") {
      const result =
        access.state === "used"
          ? "duplicate"
          : access.state === "pending"
            ? "invalid"
            : access.state;
      const error =
        access.state === "expired"
          ? "La entrada ha vencido"
          : access.reason === "nomination_required"
            ? "Completa los datos del asistente antes de ingresar"
            : "La entrada no está disponible para ingresar";
      return NextResponse.json(
        {
          success: false,
          error,
          result,
          reason: access.reason,
          expired_at: access.expiredAt,
        },
        { status: 409 },
      );
    }

    const now = new Date().toISOString();
    const { data: updatedTicket, error: updErr } = await supabase
      .from("tickets")
      .update({ used: true, used_at: now })
      .eq("id", ticket.id)
      .eq("used", false)
      .eq("qr_token", qr_token)
      .eq("is_active", true)
      .is("deleted_at", null)
      .select("id")
      .maybeSingle();
    if (updErr) {
      return NextResponse.json(
        { success: false, error: updErr.message },
        { status: 400 },
      );
    }
    if (!updatedTicket?.id) {
      return NextResponse.json(
        {
          success: false,
          error: "La entrada cambió. Vuelve a escanear el QR",
          result: "invalid",
          reason: "rescan_required",
        },
        { status: 409 },
      );
    }

    const { error: unitUpdateError } = await supabase
      .from("ticket_reservation_units")
      .update({
        status: "used",
        used_at: now,
        updated_at: now,
      })
      .eq("ticket_id", ticket.id)
      .neq("status", "cancelled");
    if (unitUpdateError) {
      return NextResponse.json(
        { success: false, error: unitUpdateError.message },
        { status: 400 },
      );
    }

    await supabase.from("scan_logs").insert({
      event_id: ticket.event_id,
      code_id: ticket.code_id,
      ticket_id: ticket.id,
      raw_value: ticket.id,
      result: "valid",
      scanned_by_staff_id: guard.context?.staffId || null,
    });

    return NextResponse.json({
      success: true,
      result: "confirmed",
      ticket_id: ticket.id,
      code_id: ticket.code_id ?? null,
      ticket_used: true,
    });
  }

  return NextResponse.json(
    { success: false, error: "Ticket no encontrado", result: "not_found" },
    { status: 404 },
  );
}
