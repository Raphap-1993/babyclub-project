import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { normalizeDocument, validateDocument, type DocumentType } from "shared/document";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function GET(req: NextRequest) {
  const docTypeRaw = (req.nextUrl.searchParams.get("doc_type") || "dni") as DocumentType;
  const documentRaw = req.nextUrl.searchParams.get("document") || req.nextUrl.searchParams.get("dni") || "";
  const { docType, document } = normalizeDocument(docTypeRaw, documentRaw);
  const dni = docType === "dni" ? document : "";
  const code = req.nextUrl.searchParams.get("code")?.trim() || "";
  if (!validateDocument(docType, document)) {
    return NextResponse.json({ person: null, error: "Documento inválido" }, { status: 400 });
  }

  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json({ person: null, error: "Supabase config missing" }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const docQuery =
    docType === "dni"
      ? `document.eq.${document},dni.eq.${document}`
      : `document.eq.${document}`;

  const { data, error } = await supabase
    .from("persons")
    .select("id,doc_type,document,dni,first_name,last_name,email,phone,birthdate")
    .or(docQuery)
    .maybeSingle();

  let personRecord = data;

  // Si no existe en BD, intentamos API Perú
  if (!personRecord) {
    const apiToken = process.env.API_PERU_TOKEN;
    if (apiToken) {
      try {
        const resp = await fetch(`https://apiperu.dev/api/dni/${dni}`, {
          headers: { Authorization: `Bearer ${apiToken}` },
        });
        const payload = await resp.json();
        if (resp.ok && payload?.data) {
          personRecord = {
            id: null,
            doc_type: "dni",
            document: dni,
            dni,
            first_name: payload.data.nombres || "",
            last_name: `${payload.data.apellido_paterno || ""} ${payload.data.apellido_materno || ""}`.trim(),
            email: null,
            phone: null,
            birthdate: null,
          };
        }
      } catch (_err) {
        // ignoramos fallos de API Perú
      }
    }
  }

  if (!personRecord && error) {
    return NextResponse.json({ person: null, error: error?.message || "No encontrado" }, { status: 404 });
  }

  let ticketPromoterId: string | null = null;
  let ticketId: string | null = null;

  if (code && (personRecord?.dni || personRecord?.document)) {
    const { data: codeRow } = await supabase.from("codes").select("event_id").eq("code", code).maybeSingle();
    const eventId = codeRow?.event_id;
    if (eventId) {
      const docFilter = personRecord.document ? { document: personRecord.document } : { dni: personRecord.dni };
      const { data: ticketRow } = await supabase
        .from("tickets")
        .select("id,promoter_id")
        .eq("event_id", eventId)
        .match(docFilter)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      ticketPromoterId = (ticketRow as any)?.promoter_id ?? null;
      ticketId = (ticketRow as any)?.id ?? null;
    }
  }

  return NextResponse.json({ person: { ...personRecord, ticket_promoter_id: ticketPromoterId, ticket_id: ticketId } });
}
