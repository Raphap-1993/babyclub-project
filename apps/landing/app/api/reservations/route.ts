import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { validateDocument, normalizeDocument, type DocumentType } from "shared/document";
import { applyNotDeleted } from "shared/db/softDelete";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function isCodesTypeCheckError(error: any): boolean {
  if (!error) return false;
  const message = String(error?.message || "");
  const details = String(error?.details || "");
  return error?.code === "23514" && /codes_type_check/i.test(`${message} ${details}`);
}

export async function POST(req: NextRequest) {
  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json({ success: false, error: "Supabase config missing" }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  let body: any = null;
  try {
    body = await req.json();
  } catch (_err) {
    return NextResponse.json({ success: false, error: "Invalid JSON" }, { status: 400 });
  }

  const docTypeRaw = typeof body?.doc_type === "string" ? (body.doc_type as DocumentType) : "dni";
  const documentRaw = typeof body?.document === "string" ? body.document : body?.dni || "";
  const { docType, document } = normalizeDocument(docTypeRaw, documentRaw);
  const table_id = typeof body?.table_id === "string" ? body.table_id : "";
  const full_name = typeof body?.full_name === "string" ? body.full_name.trim() : "";
  const email = typeof body?.email === "string" ? body.email.trim() : "";
  const phone = typeof body?.phone === "string" ? body.phone.trim() : "";
  const voucher_url = typeof body?.voucher_url === "string" ? body.voucher_url.trim() : "";
  const product_id = typeof body?.product_id === "string" ? body.product_id : null;
  const event_id_body = typeof body?.event_id === "string" ? body.event_id : null;
  const codeValue = typeof body?.code === "string" ? body.code.trim() : "";
  const promoter_id = typeof body?.promoter_id === "string" && body.promoter_id.trim() ? body.promoter_id.trim() : null;

  if (!table_id || !full_name || !voucher_url) {
    return NextResponse.json({ success: false, error: "table_id, full_name y voucher_url son requeridos" }, { status: 400 });
  }
  if (!validateDocument(docType, document)) {
    return NextResponse.json({ success: false, error: "Documento inválido" }, { status: 400 });
  }

  const tableQuery = applyNotDeleted(
    supabase.from("tables").select("id,event_id,ticket_count,is_active,event:events(id,name)").eq("id", table_id)
  );
  const { data: table, error: tableError } = await tableQuery.maybeSingle();

  if (tableError || !table) {
    return NextResponse.json({ success: false, error: "Mesa no encontrada" }, { status: 404 });
  }
  if (table.is_active === false) {
    return NextResponse.json({ success: false, error: "Mesa inactiva" }, { status: 400 });
  }

  const ticketCount = table.ticket_count || 1;
  let effectiveEventId = table.event_id || event_id_body || null;

  // Si no hay event_id en la mesa, intentar resolverlo desde el código del registro
  if (!effectiveEventId && codeValue) {
    const codeQuery = applyNotDeleted(supabase.from("codes").select("event_id").eq("code", codeValue));
    const { data: codeRow } = await codeQuery.maybeSingle();
    if (codeRow?.event_id) effectiveEventId = codeRow.event_id;
  }
  // Fallback: tomar el evento activo más cercano si sigue vacío
  if (!effectiveEventId) {
    const fallbackEventQuery = applyNotDeleted(
      supabase
        .from("events")
        .select("id,starts_at,is_active")
        .eq("is_active", true)
        .order("starts_at", { ascending: true })
        .limit(1)
    );
    const { data: fallbackEvent } = await fallbackEventQuery.maybeSingle();
    if (fallbackEvent?.id) effectiveEventId = fallbackEvent.id;
  }

  const codesToGenerate = effectiveEventId ? Math.max((table.ticket_count || 1) - 1, 0) : 0; // solo generamos códigos si hay evento

  // Generate friendly code for the reservation
  // Primero intentar obtener el nombre del evento desde la relación de la mesa
  let eventName = Array.isArray((table as any)?.event)
    ? (table as any)?.event?.[0]?.name
    : (table as any)?.event?.name;
  
  // Si no hay nombre del evento en la mesa, buscar directamente por event_id
  if (!eventName && effectiveEventId) {
    const { data: eventData } = await supabase
      .from("events")
      .select("name")
      .eq("id", effectiveEventId)
      .maybeSingle();
    eventName = eventData?.name;
  }
  
  // Generar base del código desde el nombre del evento
  const baseName = eventName 
    ? eventName.replace(/[^a-zA-Z]/g, "").toLowerCase()
    : "reserva"; // Fallback más amigable que el UUID
  const friendlyBase = baseName.slice(0, 6).toUpperCase(); // Toma 6 caracteres para mayor reconocimiento
  
  let friendlyCode = "";
  let reservationId = "";
  let insertAttempts = 0;

  // Retry logic for unique friendly_code generation
  while (insertAttempts < 5) {
    insertAttempts++;
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    friendlyCode = `${friendlyBase}${randomNum}`;

    const { data: reservation, error: resError } = await supabase
      .from("table_reservations")
      .insert({
        table_id,
        event_id: effectiveEventId,
        product_id,
        doc_type: docType,
        document,
        full_name,
        email: email || null,
        phone: phone || null,
        voucher_url,
        status: "pending",
        friendly_code: friendlyCode,
        ticket_quantity: ticketCount,
        promoter_id,
      })
      .select("id")
      .single();

    if (!resError) {
      reservationId = reservation?.id;
      break;
    }

    // If it's a unique constraint violation, retry with a new code
    if (resError.code !== "23505" || insertAttempts >= 5) {
      return NextResponse.json({ success: false, error: resError.message }, { status: 500 });
    }
  }

  if (!reservationId) {
    return NextResponse.json({ success: false, error: "Failed to create reservation after multiple attempts" }, { status: 500 });
  }

  let codesList: string[] = [];
  if (codesToGenerate > 0 && effectiveEventId) {
    const buildCodes = (typeValue: "table" | "courtesy") =>
      Array.from({ length: codesToGenerate }, (_, idx) => {
        const randomNum = Math.floor(1000 + Math.random() * 9000);
        const codeValue = `${friendlyBase}${randomNum}`;
        return {
          code: codeValue,
          event_id: effectiveEventId,
          type: typeValue,
          promoter_id: null,
          table_reservation_id: reservationId,
          person_index: idx + 1,
          is_active: true,
          max_uses: 1,
          uses: 0,
          expires_at: null,
        };
      });

    let attempts = 0;
    let codeType: "table" | "courtesy" = "table";
    while (attempts < 5) {
      attempts++;
      const codesToInsert = buildCodes(codeType);
      const { data: codes, error: codeError } = await supabase.from("codes").insert(codesToInsert).select("code");
      if (!codeError) {
        codesList = codes?.map((c: any) => c.code) || [];
        await supabase.from("table_reservations").update({ codes: codesList }).eq("id", reservationId);
        break;
      }
      if (codeType === "table" && isCodesTypeCheckError(codeError)) {
        codeType = "courtesy";
        continue;
      }
      if (codeError.code !== "23505" || attempts >= 5) {
        const readableError = isCodesTypeCheckError(codeError)
          ? "No se pudo generar los códigos de reserva en este ambiente. Actualiza migraciones de BD."
          : codeError.message;
        return NextResponse.json({ success: false, error: readableError }, { status: 500 });
      }
    }
  }

  return NextResponse.json({
    success: true,
    reservationId: friendlyCode, // Return friendly code as reservationId for backward compatibility
    friendlyCode,
    codes: codesList,
    eventId: effectiveEventId,
    ticketCount: ticketCount,
  });
}
