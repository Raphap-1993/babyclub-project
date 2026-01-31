import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireStaffRole } from "shared/auth/requireStaff";
import { buildArchivePayload } from "shared/db/softDelete";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function archiveTicket(req: Request) {
  const guard = await requireStaffRole(req);
  if (!guard.ok) {
    return NextResponse.json({ success: false, error: guard.error }, { status: guard.status });
  }
  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json({ success: false, error: "Supabase config missing" }, { status: 500 });
  }

  let body: any = null;
  try {
    body = await req.json();
  } catch (_err) {
    return NextResponse.json({ success: false, error: "Invalid JSON" }, { status: 400 });
  }

  const id = typeof body?.id === "string" ? body.id : "";
  if (!id) return NextResponse.json({ success: false, error: "id requerido" }, { status: 400 });

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Obtener info básica antes de borrar (para liberar reservas asociadas por email/teléfono)
  const { data: ticketRow, error: fetchError } = await supabase
    .from("tickets")
    .select("id,email,phone")
    .eq("id", id)
    .maybeSingle();

  if (fetchError) {
    return NextResponse.json({ success: false, error: fetchError.message }, { status: 500 });
  }

  const archivePayload = buildArchivePayload(guard.context?.staffId);
  const { error } = await supabase.from("tickets").update(archivePayload).eq("id", id);
  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  if (ticketRow) {
    const activeStatuses = ["pending", "approved", "confirmed", "paid"];
    const email = ticketRow.email || null;
    const phone = ticketRow.phone || null;

    // Liberar reservas con mismo email/teléfono
    const filters = [
      email ? `email.eq.${email}` : "",
      phone ? `phone.eq.${phone}` : "",
    ].filter(Boolean);

    if (filters.length > 0) {
      await supabase
        .from("table_reservations")
        .update({ status: "rejected" })
        .or(filters.join(","))
        .in("status", activeStatuses);
    }
  }

  return NextResponse.json({ success: true, archived: true });
}

export async function POST(req: Request) {
  return archiveTicket(req);
}
