import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { validateDocument, normalizeDocument, type DocumentType } from "shared/document";
import { applyNotDeleted } from "shared/db/softDelete";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

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
  const event_id_body = typeof body?.event_id === "string" ? body.event_id.trim() : "";
  const codeValue = typeof body?.code === "string" ? body.code.trim() : "";

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
  const tableEventId = typeof table.event_id === "string" ? table.event_id : "";
  let codeEventId = "";

  if (codeValue) {
    const codeQuery = applyNotDeleted(supabase.from("codes").select("event_id,is_active").eq("code", codeValue));
    const { data: codeRow, error: codeError } = await codeQuery.maybeSingle();
    if (codeError || !codeRow) {
      return NextResponse.json({ success: false, error: "Código inválido para reserva" }, { status: 404 });
    }
    if (codeRow.is_active === false) {
      return NextResponse.json({ success: false, error: "Código inactivo" }, { status: 400 });
    }
    codeEventId = typeof codeRow.event_id === "string" ? codeRow.event_id : "";
  }

  const eventCandidates = [tableEventId, event_id_body, codeEventId].filter(Boolean);
  const uniqueEventIds = Array.from(new Set(eventCandidates));
  if (uniqueEventIds.length > 1) {
    return NextResponse.json(
      { success: false, error: "Conflicto de evento: mesa, código y selección no coinciden" },
      { status: 400 }
    );
  }

  const effectiveEventId = uniqueEventIds[0] || "";
  if (!effectiveEventId) {
    return NextResponse.json(
      { success: false, error: "No se pudo resolver el evento. Selecciona un evento antes de reservar." },
      { status: 400 }
    );
  }

  const eventQuery = applyNotDeleted(supabase.from("events").select("id,is_active").eq("id", effectiveEventId));
  const { data: eventRow, error: eventError } = await eventQuery.maybeSingle();
  if (eventError || !eventRow) {
    return NextResponse.json({ success: false, error: "Evento no encontrado" }, { status: 404 });
  }
  if (eventRow.is_active === false) {
    return NextResponse.json({ success: false, error: "Evento inactivo" }, { status: 400 });
  }

  const codesToGenerate = Math.max((table.ticket_count || 1) - 1, 0);

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
    })
    .select("id")
    .single();

  if (resError) {
    return NextResponse.json({ success: false, error: resError.message }, { status: 500 });
  }

  const reservationId = reservation?.id;

  const eventName = Array.isArray((table as any)?.event)
    ? (table as any)?.event?.[0]?.name
    : (table as any)?.event?.name;
  const baseName = (eventName || table_id).replace(/[^a-zA-Z]/g, "").toLowerCase() || "mesa";
  const friendlyBase = (baseName + "mesa").slice(0, 4);

  let codesList: string[] = [];
  if (codesToGenerate > 0 && effectiveEventId) {
    const buildCodes = () =>
      Array.from({ length: codesToGenerate }, () => {
        const suffix = Math.random().toString(36).slice(2, 8).toUpperCase();
        const codeValue = `${friendlyBase}-${suffix}`;
        return {
          code: codeValue,
          event_id: effectiveEventId,
          type: "courtesy",
          promoter_id: null,
          is_active: true,
          max_uses: 1,
          uses: 0,
          expires_at: null,
        };
      });

    let attempts = 0;
    while (attempts < 5) {
      attempts++;
      const codesToInsert = buildCodes();
      const { data: codes, error: codeError } = await supabase.from("codes").insert(codesToInsert).select("code");
      if (!codeError) {
        codesList = codes?.map((c: any) => c.code) || [];
        await supabase.from("table_reservations").update({ codes: codesList }).eq("id", reservationId);
        break;
      }
      if (codeError.code !== "23505" || attempts >= 5) {
        return NextResponse.json({ success: false, error: codeError.message }, { status: 500 });
      }
    }
  }

  return NextResponse.json({
    success: true,
    reservationId,
    codes: codesList,
    eventId: effectiveEventId,
    ticketCount: ticketCount,
  });
}
