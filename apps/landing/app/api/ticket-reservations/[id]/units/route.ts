import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  normalizeDocument,
  validateDocument,
  type DocumentType,
} from "shared/document";
import { applyNotDeleted } from "shared/db/softDelete";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const RESERVATION_SELECT =
  "id,event_id,sale_origin,status,ticket_type_label,package_quantity,total_ticket_units,full_name,email,phone,event:events(name,starts_at,location)";
const UNIT_SELECT =
  "id,reservation_id,event_id,package_index,person_index,unit_index,status,full_name,doc_type,document,email,phone,ticket_id,nominated_at,issued_at,used_at,cancelled_at";

function getSupabase() {
  if (!supabaseUrl || !supabaseServiceKey) return null;
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function jsonError(error: string, status: number) {
  return NextResponse.json({ success: false, error }, { status });
}

async function loadReservation(supabase: any, reservationId: string) {
  const { data, error } = await applyNotDeleted(
    supabase.from("table_reservations").select(RESERVATION_SELECT),
  )
    .eq("id", reservationId)
    .maybeSingle();

  if (error) return { error };
  if (!data) return { notFound: true };
  if ((data as any).sale_origin !== "ticket") return { wrongType: true, data };
  return { data };
}

async function loadUnits(supabase: any, reservationId: string) {
  const { data, error } = await applyNotDeleted(
    supabase.from("ticket_reservation_units").select(UNIT_SELECT),
  )
    .eq("reservation_id", reservationId)
    .order("unit_index", { ascending: true });

  return {
    data: Array.isArray(data)
      ? [...data].sort(
          (a: any, b: any) => Number(a?.unit_index || 0) - Number(b?.unit_index || 0),
        )
      : [],
    error,
  };
}

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const supabase = getSupabase();
  if (!supabase) return jsonError("Supabase config missing", 500);

  const { id } = await context.params;
  const reservation = await loadReservation(supabase, id);
  if (reservation.notFound) return jsonError("Reserva no encontrada", 404);
  if (reservation.wrongType) {
    return jsonError("La reserva no pertenece al flujo ticket-only", 400);
  }
  if (reservation.error) return jsonError(reservation.error.message, 500);

  const units = await loadUnits(supabase, id);
  if (units.error) return jsonError(units.error.message, 500);

  return NextResponse.json({
    success: true,
    reservation: reservation.data,
    units: units.data,
  });
}

export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const supabase = getSupabase();
  if (!supabase) return jsonError("Supabase config missing", 500);

  let body: any = null;
  try {
    body = await req.json();
  } catch (_err) {
    return jsonError("Invalid JSON", 400);
  }

  const inputs = Array.isArray(body?.units) ? body.units : [];
  if (inputs.length === 0) {
    return jsonError("units debe incluir al menos una unidad", 400);
  }

  const { id } = await context.params;
  const reservation = await loadReservation(supabase, id);
  if (reservation.notFound) return jsonError("Reserva no encontrada", 404);
  if (reservation.wrongType) {
    return jsonError("La reserva no pertenece al flujo ticket-only", 400);
  }
  if (reservation.error) return jsonError(reservation.error.message, 500);

  const units = await loadUnits(supabase, id);
  if (units.error) return jsonError(units.error.message, 500);
  const unitsById = new Map(
    units.data.map((unit: any) => [String(unit.id), unit]),
  );

  for (const raw of inputs) {
    const unitId = typeof raw?.id === "string" ? raw.id.trim() : "";
    const existingUnit = unitsById.get(unitId);
    if (!unitId || !existingUnit) {
      return jsonError("Unidad no encontrada para esta reserva", 404);
    }
    const unitLabel = `unidad ${existingUnit.unit_index || "?"}`;
    if (existingUnit.status === "issued" || existingUnit.status === "used") {
      return jsonError(`No puedes editar ${unitLabel} ya emitida o usada`, 409);
    }

    const fullName =
      typeof raw?.full_name === "string" ? raw.full_name.trim() : "";
    const docTypeRaw =
      typeof raw?.doc_type === "string"
        ? (raw.doc_type as DocumentType)
        : "dni";
    const documentRaw =
      typeof raw?.document === "string" ? raw.document.trim() : "";
    const { docType, document } = normalizeDocument(docTypeRaw, documentRaw);
    const email = typeof raw?.email === "string" ? raw.email.trim() : "";
    const phone = typeof raw?.phone === "string" ? raw.phone.trim() : "";

    if (!fullName) {
      return jsonError(`${unitLabel} necesita nombre completo`, 400);
    }
    if (!validateDocument(docType, document)) {
      return jsonError(`Documento inválido para ${unitLabel}`, 400);
    }

    const patch = {
      full_name: fullName,
      doc_type: docType,
      document,
      email: email || null,
      phone: phone || null,
      status: "nominated",
      nominated_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from("ticket_reservation_units")
      .update(patch)
      .eq("id", unitId)
      .eq("reservation_id", id);

    if (error) return jsonError(error.message, 500);
  }

  const reloadedUnits = await loadUnits(supabase, id);
  if (reloadedUnits.error) return jsonError(reloadedUnits.error.message, 500);

  return NextResponse.json({
    success: true,
    updatedCount: inputs.length,
    reservation: reservation.data,
    units: reloadedUnits.data,
  });
}
