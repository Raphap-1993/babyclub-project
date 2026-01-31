import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { normalizeDocument, validateDocument, type DocumentType } from "shared/document";
import { parseRateLimitEnv, rateLimit, rateLimitHeaders } from "shared/security/rateLimit";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_PERSONS_PER_MIN = parseRateLimitEnv(process.env.RATE_LIMIT_PERSONS_PER_MIN, 20);

export async function GET(req: NextRequest) {
  const limiter = rateLimit(req, {
    keyPrefix: "landing:persons",
    limit: RATE_LIMIT_PERSONS_PER_MIN,
    windowMs: RATE_LIMIT_WINDOW_MS,
  });
  if (!limiter.ok) {
    return NextResponse.json(
      { error: "rate_limited", retryAfterMs: limiter.resetMs },
      { status: 429, headers: rateLimitHeaders(limiter) }
    );
  }

  const docTypeRaw = (req.nextUrl.searchParams.get("doc_type") || "dni") as DocumentType;
  const documentRaw = req.nextUrl.searchParams.get("document") || req.nextUrl.searchParams.get("dni") || "";
  const { docType, document } = normalizeDocument(docTypeRaw, documentRaw);
  const dni = docType === "dni" ? document : "";
  const normalizedDocument = document.toLowerCase();
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

  const docQuery = [
    normalizedDocument ? `document.ilike.${normalizedDocument}` : "",
    docType === "dni" && dni ? `dni.eq.${dni}` : "",
  ]
    .filter(Boolean)
    .join(",");

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
  let ticketEventId: string | null = null;

  if (code && (personRecord?.dni || personRecord?.document)) {
    const { data: codeRow } = await supabase.from("codes").select("event_id").eq("code", code).maybeSingle();
    const eventId = codeRow?.event_id;
    if (eventId) {
      const ticketDocQuery = [
        personRecord.document ? `document.ilike.${(personRecord.document as string).toLowerCase()}` : "",
        personRecord.dni ? `dni.eq.${personRecord.dni}` : "",
      ]
        .filter(Boolean)
        .join(",");

      const { data: ticketRow } = await supabase
        .from("tickets")
        .select("id,promoter_id,event_id")
        .eq("event_id", eventId)
        .or(ticketDocQuery)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      ticketPromoterId = (ticketRow as any)?.promoter_id ?? null;
      ticketId = (ticketRow as any)?.id ?? null;
      ticketEventId = (ticketRow as any)?.event_id ?? null;
    }
  }

  // Fallback: si no se pasó code o no se encontró ticket con el evento del code, busca el último ticket por documento/dni
  if (!ticketId && (personRecord?.document || personRecord?.dni)) {
    const fallbackTicketQuery = [
      personRecord.document ? `document.ilike.${(personRecord.document as string).toLowerCase()}` : "",
      personRecord.dni ? `dni.eq.${personRecord.dni}` : "",
    ]
      .filter(Boolean)
      .join(",");

    const { data: latestTicket } = await supabase
      .from("tickets")
      .select("id,promoter_id,event_id")
      .or(fallbackTicketQuery)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (latestTicket) {
      ticketPromoterId = (latestTicket as any)?.promoter_id ?? ticketPromoterId;
      ticketId = (latestTicket as any)?.id ?? ticketId;
      ticketEventId = (latestTicket as any)?.event_id ?? ticketEventId;
    }
  }

  return NextResponse.json({
    person: {
      ...personRecord,
      ticket_promoter_id: ticketPromoterId,
      ticket_id: ticketId,
      ticket_event_id: ticketEventId,
    },
  });
}
