import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { normalizeDocument, type DocumentType } from "shared/document";
import {
  buildEventTicketConflictMessage,
  findActiveEventTicketConflict,
} from "shared/eventTicketIdentity";
import { applyNotDeleted } from "shared/db/softDelete";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function GET(req: NextRequest) {
  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json({ success: false, error: "Supabase config missing" }, { status: 500 });
  }

  const event_id = req.nextUrl.searchParams.get("event_id")?.trim() || "";
  const docTypeRaw =
    (req.nextUrl.searchParams.get("doc_type")?.trim().toLowerCase() as DocumentType | null) ||
    "dni";
  const rawDocument = req.nextUrl.searchParams.get("document")?.trim() || "";
  const { docType, document } = normalizeDocument(docTypeRaw, rawDocument);
  const fullName = req.nextUrl.searchParams.get("full_name")?.trim() || "";
  const email = req.nextUrl.searchParams.get("email")?.trim() || "";
  const phone = req.nextUrl.searchParams.get("phone")?.trim() || "";

  if (!event_id || !document) {
    return NextResponse.json({ success: false, error: "event_id y document son requeridos" }, { status: 400 });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data, error } = await applyNotDeleted(
    supabase
    .from("table_reservations")
    .select("id,friendly_code,ticket_quantity,status,created_at")
    .eq("event_id", event_id)
    .eq("document", document)
    .eq("sale_origin", "ticket")
    .not("status", "eq", "rejected")
    .order("created_at", { ascending: false }),
  );

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  const reservations = Array.isArray(data) ? data : [];
  const total_tickets = reservations.reduce(
    (sum: number, r: any) => sum + (r.ticket_quantity || 0),
    0,
  );
  const conflict = await findActiveEventTicketConflict(supabase as any, {
    eventId: event_id,
    fullName: fullName || null,
    email: email || null,
    phone: phone || null,
    docType,
    document,
    dni: docType === "dni" ? document : null,
  });

  return NextResponse.json({
    success: true,
    has_ticket_reservations: reservations.length > 0,
    total_tickets,
    reservations,
    has_active_ticket: Boolean(conflict?.ticketId),
    conflict: conflict || null,
    conflict_message: conflict
      ? buildEventTicketConflictMessage(conflict.reason)
      : null,
  });
}
