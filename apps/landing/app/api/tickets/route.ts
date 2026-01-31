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

  const codeValue = typeof body?.code === "string" ? body.code.trim() : "";
  const docTypeRaw = typeof body?.doc_type === "string" ? (body.doc_type as DocumentType) : "dni";
  const documentRaw = typeof body?.document === "string" ? body.document : "";
  const { docType, document } = normalizeDocument(docTypeRaw, documentRaw);
  const normalizedDocument = document.toLowerCase();
  const dni = docType === "dni" ? document : "";
  const first_name = typeof body?.nombre === "string" ? body.nombre.trim() : "";
  const last_name_p = typeof body?.apellido_paterno === "string" ? body.apellido_paterno.trim() : "";
  const last_name_m = typeof body?.apellido_materno === "string" ? body.apellido_materno.trim() : "";
  const last_name = [last_name_p, last_name_m].filter(Boolean).join(" ").trim();
  const email = typeof body?.email === "string" ? body.email.trim() : "";
  const phone = typeof body?.telefono === "string" ? body.telefono.trim() : "";
  const promoter_id = typeof body?.promoter_id === "string" && body.promoter_id ? body.promoter_id : null;
  const birthdateStr = typeof body?.birthdate === "string" ? body.birthdate : "";
  const birthdate = birthdateStr ? new Date(birthdateStr) : null;
  const hasBirthdate = Boolean(birthdateStr);

  if (!validateDocument(docType, document)) {
    return NextResponse.json({ success: false, error: "Documento inválido" }, { status: 400 });
  }
  if (!first_name || !last_name)
    return NextResponse.json({ success: false, error: "nombre y apellido son requeridos" }, { status: 400 });
  if (hasBirthdate && Number.isNaN(birthdate!.getTime())) {
    return NextResponse.json({ success: false, error: "birthdate inválida" }, { status: 400 });
  }
  if (hasBirthdate && !isAdult(birthdate!)) {
    return NextResponse.json({ success: false, error: "Solo mayores de 18" }, { status: 403 });
  }

  if (!codeValue) return NextResponse.json({ success: false, error: "code is required" }, { status: 400 });

  const codeQuery = applyNotDeleted(
    supabase
      .from("codes")
      .select("id,code,event_id,promoter_id,is_active,max_uses,uses,expires_at")
      .eq("code", codeValue)
  );
  const { data: codeRow, error: codeError } = await codeQuery.maybeSingle();

  if (codeError || !codeRow) {
    return NextResponse.json({ success: false, error: "Código inválido" }, { status: 404 });
  }

  if (codeRow.is_active === false) {
    return NextResponse.json({ success: false, error: "Código inactivo" }, { status: 400 });
  }

  const now = Date.now();
  if (codeRow.expires_at && new Date(codeRow.expires_at).getTime() < now) {
    return NextResponse.json({ success: false, error: "Código expirado" }, { status: 400 });
  }

  if (typeof codeRow.uses === "number" && typeof codeRow.max_uses === "number" && codeRow.uses >= codeRow.max_uses) {
    return NextResponse.json({ success: false, error: "Código sin cupos" }, { status: 400 });
  }

  const eventId = codeRow.event_id || "";

  // Persona
  const personPayload = {
    dni: docType === "dni" ? dni : null,
    doc_type: docType,
    document: normalizedDocument,
    first_name,
    last_name,
    email: email || null,
    phone: phone || null,
    birthdate: hasBirthdate && birthdate ? birthdate.toISOString().slice(0, 10) : null,
  };

  // Buscamos primero por document/dni para no depender de un índice único en "document"
  const { data: existingPerson, error: findPersonError } = await supabase
    .from("persons")
    .select("id")
    .or(
      [
        docType === "dni" && dni ? `dni.eq.${dni}` : "",
        normalizedDocument ? `document.ilike.${normalizedDocument}` : "",
      ]
        .filter(Boolean)
        .join(",")
    )
    .limit(1)
    .maybeSingle();

  if (findPersonError && findPersonError.code !== "PGRST116") {
    return NextResponse.json({ success: false, error: findPersonError.message }, { status: 500 });
  }

  let person_id = existingPerson?.id;

  if (person_id) {
    const { error: updatePersonError } = await supabase.from("persons").update(personPayload).eq("id", person_id);
    if (updatePersonError) {
      return NextResponse.json({ success: false, error: updatePersonError.message }, { status: 500 });
    }
  } else {
    const { data: createdPerson, error: insertPersonError } = await supabase
      .from("persons")
      .insert(personPayload)
      .select("id")
      .single();

    if (insertPersonError) {
      return NextResponse.json({ success: false, error: insertPersonError.message }, { status: 500 });
    }

    person_id = createdPerson?.id;
  }
  const finalPromoterId = promoter_id || codeRow?.promoter_id || null;
  const full_name = `${first_name} ${last_name}`.trim();
  const qr_token = crypto.randomUUID();

  // Si ya tiene ticket para este evento, devolvemos el mismo QR/id
  const { data: existingTicket, error: existingError } = await supabase
    .from("tickets")
    .select("id,qr_token")
    .eq("event_id", eventId)
    .eq("person_id", person_id)
    .limit(1)
    .maybeSingle();

  if (existingError && existingError.code !== "PGRST116") {
    return NextResponse.json({ success: false, error: existingError.message }, { status: 500 });
  }

  if (existingTicket?.id && existingTicket.qr_token) {
    return NextResponse.json({
      success: true,
      existing: true,
      ticketId: existingTicket.id,
      qr: existingTicket.qr_token,
    });
  }

  const { data: ticketData, error: ticketError } = await supabase
    .from("tickets")
    .insert({
      event_id: eventId,
      code_id: codeRow?.id || null,
      person_id,
      promoter_id: finalPromoterId,
      qr_token,
      dni: docType === "dni" ? dni : null,
      document: normalizedDocument,
      doc_type: docType,
      full_name,
      email: email || null,
      phone: phone || null,
    })
    .select("id")
    .single();

  if (ticketError) {
    return NextResponse.json({ success: false, error: ticketError.message }, { status: 500 });
  }

  // incrementar uses del código
  if (codeRow?.id) {
    await supabase
      .from("codes")
      .update({ uses: (codeRow.uses || 0) + 1 })
      .eq("id", codeRow.id);
  }

  return NextResponse.json({
    success: true,
    ticketId: ticketData?.id,
    qr: qr_token,
    code: codeRow?.code || null,
    eventId,
  });
}

function isAdult(birthdate: Date) {
  const now = new Date();
  let age = now.getFullYear() - birthdate.getFullYear();
  const m = now.getMonth() - birthdate.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birthdate.getDate())) age--;
  return age >= 18;
}
