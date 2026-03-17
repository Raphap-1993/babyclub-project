import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireStaffRole } from "shared/auth/requireStaff";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireStaffRole(req);
  if (!guard.ok) {
    return NextResponse.json({ success: false, error: guard.error }, { status: guard.status });
  }

  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json({ success: false, error: "Supabase config missing" }, { status: 500 });
  }

  const { id } = await params;

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Query optimizado: select solo lo necesario con joins eficientes
  const { data, error } = await supabase
    .from("table_reservations")
    .select(
      `
      id,
      friendly_code,
      full_name,
      email,
      phone,
      doc_type,
      document,
      voucher_url,
      status,
      codes,
      ticket_quantity,
      sale_origin,
      created_at,
      table_id,
      event_id,
      promoter_id
      `
    )
    .eq("id", id)
    .single();

  if (error || !data) {
    return NextResponse.json({ success: false, error: "Reserva no encontrada" }, { status: 404 });
  }

  // Fetch relacionados en paralelo solo si existen IDs
  const isTableReservation = data.sale_origin !== "ticket";
  const [tableData, eventData, conflictingTickets, promoterData] = await Promise.all([
    data.table_id
      ? supabase.from("tables").select("name").eq("id", data.table_id).single()
      : Promise.resolve({ data: null }),
    data.event_id
      ? supabase.from("events").select("name,starts_at,location").eq("id", data.event_id).single()
      : Promise.resolve({ data: null }),
    // Solo buscar conflictos si es reserva de mesa y hay documento + evento
    isTableReservation && data.document && data.event_id
      ? supabase
          .from("table_reservations")
          .select("id,friendly_code,ticket_quantity,status,created_at")
          .eq("event_id", data.event_id)
          .eq("document", data.document)
          .eq("sale_origin", "ticket")
          .neq("id", data.id)
          .not("status", "eq", "rejected")
      : Promise.resolve({ data: [] }),
    data.promoter_id
      ? supabase
          .from("promoters")
          .select("id,code,person:persons(first_name,last_name)")
          .eq("id", data.promoter_id)
          .single()
      : Promise.resolve({ data: null }),
  ]);

  const reservation = {
    id: data.id,
    friendly_code: data.friendly_code,
    full_name: data.full_name,
    email: data.email,
    phone: data.phone,
    doc_type: data.doc_type,
    document: data.document,
    voucher_url: data.voucher_url,
    status: data.status,
    codes: data.codes,
    ticket_quantity: data.ticket_quantity,
    created_at: data.created_at,
    sale_origin: data.sale_origin || null,
    table_name: tableData.data?.name || null,
    event_name: eventData.data?.name || "Evento desconocido",
    event_starts_at: eventData.data?.starts_at || null,
    event_location: eventData.data?.location || null,
    promoter: promoterData.data
      ? {
          code: (promoterData.data as any).code || null,
          name: (() => {
            const person = (promoterData.data as any).person;
            if (!person) return null;
            return `${person.first_name ?? ""} ${person.last_name ?? ""}`.trim() || null;
          })(),
        }
      : null,
    conflicting_ticket_reservations: (conflictingTickets.data || []) as Array<{
      id: string;
      friendly_code: string | null;
      ticket_quantity: number | null;
      status: string;
      created_at: string;
    }>,
  };

  return NextResponse.json({ success: true, reservation });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireStaffRole(req);
  if (!guard.ok) {
    return NextResponse.json({ success: false, error: guard.error }, { status: guard.status });
  }

  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json({ success: false, error: "Supabase config missing" }, { status: 500 });
  }

  const { id } = await params;
  let body: any;

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON" }, { status: 400 });
  }

  const { status } = body;

  if (!status || !["pending", "approved", "rejected", "confirmed"].includes(status)) {
    return NextResponse.json({ success: false, error: "Estado inválido" }, { status: 400 });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { error } = await supabase
    .from("table_reservations")
    .update({ status })
    .eq("id", id);

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, message: "Estado actualizado" });
}
