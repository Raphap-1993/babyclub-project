import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireStaffRole } from "shared/auth/requireStaff";
import { applyNotDeleted } from "shared/db/softDelete";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function cleanLinkCode(input: string): string {
  return input
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Z0-9_-]/g, "")
    .slice(0, 32);
}

export async function POST(req: NextRequest) {
  const guard = await requireStaffRole(req);
  if (!guard.ok) {
    return NextResponse.json({ success: false, error: guard.error }, { status: guard.status });
  }
  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json({ success: false, error: "Falta configuración de Supabase" }, { status: 500 });
  }

  let body: any = null;
  try {
    body = await req.json();
  } catch (_err) {
    return NextResponse.json({ success: false, error: "JSON inválido" }, { status: 400 });
  }

  const promoter_id = typeof body?.promoter_id === "string" ? body.promoter_id.trim() : "";
  const event_id = typeof body?.event_id === "string" ? body.event_id.trim() : "";
  const rawCode = typeof body?.code === "string" ? body.code : "";
  const code = cleanLinkCode(rawCode);
  const notes = typeof body?.notes === "string" ? body.notes.trim() : null;

  if (!promoter_id) {
    return NextResponse.json({ success: false, error: "promoter_id es requerido" }, { status: 400 });
  }
  if (!event_id) {
    return NextResponse.json({ success: false, error: "event_id es requerido" }, { status: 400 });
  }
  if (!code || code.length < 2) {
    return NextResponse.json(
      { success: false, error: "El código del link debe tener al menos 2 caracteres (letras y números)" },
      { status: 400 }
    );
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Validate promoter and event exist
  const [promoterRes, eventRes] = await Promise.all([
    applyNotDeleted(supabase.from("promoters").select("id").eq("id", promoter_id)).maybeSingle(),
    applyNotDeleted(supabase.from("events").select("id,is_active").eq("id", event_id)).maybeSingle(),
  ]);

  if (promoterRes.error) {
    return NextResponse.json({ success: false, error: promoterRes.error.message }, { status: 500 });
  }
  if (!promoterRes.data) {
    return NextResponse.json({ success: false, error: "Promotor no encontrado" }, { status: 404 });
  }
  if (eventRes.error) {
    return NextResponse.json({ success: false, error: eventRes.error.message }, { status: 500 });
  }
  if (!eventRes.data) {
    return NextResponse.json({ success: false, error: "Evento no encontrado" }, { status: 404 });
  }
  if ((eventRes.data as any).is_active === false) {
    return NextResponse.json({ success: false, error: "El evento está inactivo" }, { status: 400 });
  }

  // Check if code is already taken (case-insensitive)
  const { data: existingCode } = await supabase
    .from("codes")
    .select("id,code,deleted_at")
    .ilike("code", code)
    .maybeSingle();

  if (existingCode && !existingCode.deleted_at) {
    return NextResponse.json(
      { success: false, error: `El código "${code}" ya está en uso. Elige otro nombre.` },
      { status: 409 }
    );
  }

  const organizerId = process.env.NEXT_PUBLIC_ORGANIZER_ID || null;

  const insertPayload: Record<string, any> = {
    code,
    type: "promoter_link",
    promoter_id,
    event_id,
    is_active: true,
    max_uses: null, // unlimited
    uses: 0,
    notes: notes || null,
  };
  if (organizerId) {
    insertPayload.organizer_id = organizerId;
  }

  const { data: inserted, error: insertError } = await supabase
    .from("codes")
    .insert(insertPayload)
    .select("id,code")
    .single();

  if (insertError) {
    return NextResponse.json({ success: false, error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    id: (inserted as any).id,
    code: (inserted as any).code,
  });
}
