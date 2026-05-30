import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeDocument, type DocumentType } from "./document";
import { applyNotDeleted } from "./db/softDelete";
import { normalizeEmailAddress } from "./email/address";

type Supabase = SupabaseClient<any, "public", any>;

export type EventTicketIdentityInput = {
  eventId: string;
  personId?: string | null;
  fullName?: string | null;
  email?: string | null;
  phone?: string | null;
  docType?: DocumentType | null;
  document?: string | null;
  dni?: string | null;
};

export type EventTicketConflictReason =
  | "person_id"
  | "document"
  | "full_name_email"
  | "full_name_phone";

export type EventTicketConflict = {
  ticketId: string;
  personId: string | null;
  tableReservationId: string | null;
  qrToken: string | null;
  fullName: string | null;
  email: string | null;
  phone: string | null;
  docType: string | null;
  document: string | null;
  dni: string | null;
  code: string | null;
  codeType: string | null;
  reason: EventTicketConflictReason;
};

const ACTIVE_TICKET_SELECT =
  "id,person_id,table_reservation_id,qr_token,full_name,email,phone,doc_type,document,dni,code:codes(code,type)";

export class EventTicketConflictError extends Error {
  conflict: EventTicketConflict;

  constructor(conflict: EventTicketConflict) {
    super(buildEventTicketConflictMessage(conflict.reason));
    this.name = "EventTicketConflictError";
    this.conflict = conflict;
  }
}

export function normalizeFullNameForIdentity(value: string | null | undefined) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .replace(/\s+/g, " ")
    .toUpperCase();
}

export function normalizePhoneForIdentity(value: string | null | undefined) {
  return String(value || "").replace(/\D+/g, "");
}

export function buildEventTicketIdentityKeys(
  input: Pick<
    EventTicketIdentityInput,
    "fullName" | "email" | "phone" | "docType" | "document" | "dni"
  >,
) {
  const keys: string[] = [];
  const { docType, document } = normalizeDocument(
    input.docType || "dni",
    input.document || input.dni || null,
  );
  const normalizedDocument = String(document || "").trim().toLowerCase();
  const normalizedName = normalizeFullNameForIdentity(input.fullName);
  const normalizedEmail = normalizeEmailAddress(String(input.email || ""));
  const normalizedPhone = normalizePhoneForIdentity(input.phone);

  if (normalizedDocument) {
    keys.push(`document:${docType}:${normalizedDocument}`);
  }
  if (normalizedName && normalizedEmail) {
    keys.push(`name_email:${normalizedName}:${normalizedEmail}`);
  }
  if (normalizedName && normalizedPhone) {
    keys.push(`name_phone:${normalizedName}:${normalizedPhone}`);
  }

  return keys;
}

export function buildEventTicketConflictMessage(
  reason: EventTicketConflictReason,
) {
  if (reason === "full_name_email" || reason === "full_name_phone") {
    return "Ya existe un QR activo para este evento con datos coincidentes. Verifica el documento antes de continuar.";
  }
  return "Esta persona ya tiene un QR activo para este evento.";
}

function mapConflictTicket(
  row: any,
  reason: EventTicketConflictReason,
): EventTicketConflict | null {
  if (!row?.id) return null;
  const codeRel = Array.isArray(row.code) ? row.code[0] : row.code;
  return {
    ticketId: String(row.id),
    personId: typeof row.person_id === "string" ? row.person_id : null,
    tableReservationId:
      typeof row.table_reservation_id === "string"
        ? row.table_reservation_id
        : null,
    qrToken: typeof row.qr_token === "string" ? row.qr_token : null,
    fullName: typeof row.full_name === "string" ? row.full_name : null,
    email: typeof row.email === "string" ? row.email : null,
    phone: typeof row.phone === "string" ? row.phone : null,
    docType: typeof row.doc_type === "string" ? row.doc_type : null,
    document: typeof row.document === "string" ? row.document : null,
    dni: typeof row.dni === "string" ? row.dni : null,
    code: typeof codeRel?.code === "string" ? codeRel.code : null,
    codeType: typeof codeRel?.type === "string" ? codeRel.type : null,
    reason,
  };
}

function buildPhoneCandidates(phone: string | null | undefined) {
  const digits = normalizePhoneForIdentity(phone);
  if (!digits) return [];
  const candidates = new Set<string>([String(phone || "").trim(), digits]);
  if (digits.length === 9) {
    candidates.add(`+51${digits}`);
    candidates.add(`51${digits}`);
  }
  if (digits.length === 11 && digits.startsWith("51")) {
    candidates.add(`+${digits}`);
    candidates.add(digits.slice(2));
  }
  return Array.from(candidates).filter(Boolean);
}

export async function findActiveEventTicketConflict(
  supabase: Supabase,
  input: EventTicketIdentityInput,
): Promise<EventTicketConflict | null> {
  const eventId = String(input.eventId || "").trim();
  if (!eventId) return null;

  const { docType, document } = normalizeDocument(
    input.docType || "dni",
    input.document || input.dni || null,
  );
  const normalizedDocument = String(document || "").trim().toLowerCase();
  const normalizedName = normalizeFullNameForIdentity(input.fullName);
  const normalizedEmail = normalizeEmailAddress(String(input.email || ""));
  const phoneCandidates = buildPhoneCandidates(input.phone);
  const normalizedPhone = normalizePhoneForIdentity(input.phone);
  const personId = String(input.personId || "").trim();

  const filters: string[] = [];
  if (personId) filters.push(`person_id.eq.${personId}`);
  if (normalizedDocument) {
    filters.push(`document.eq.${normalizedDocument}`);
    if (docType === "dni") {
      filters.push(`dni.eq.${normalizedDocument}`);
    }
  }
  if (normalizedEmail) filters.push(`email.eq.${normalizedEmail}`);
  for (const candidate of phoneCandidates) {
    filters.push(`phone.eq.${candidate}`);
  }

  if (filters.length === 0) return null;

  const { data, error } = await applyNotDeleted(
    supabase
      .from("tickets")
      .select(ACTIVE_TICKET_SELECT)
      .eq("event_id", eventId)
      .eq("is_active", true)
      .or(Array.from(new Set(filters)).join(","))
      .order("created_at", { ascending: true })
      .limit(20),
  );

  if (error) {
    throw new Error(error.message || "No se pudo validar duplicados por evento");
  }

  const rows = Array.isArray(data) ? data : [];
  for (const row of rows) {
    if (personId && row?.person_id === personId) {
      return mapConflictTicket(row, "person_id");
    }
  }
  for (const row of rows) {
    const rowDocument = String(row?.document || row?.dni || "")
      .trim()
      .toLowerCase();
    if (normalizedDocument && rowDocument === normalizedDocument) {
      return mapConflictTicket(row, "document");
    }
  }
  for (const row of rows) {
    const rowName = normalizeFullNameForIdentity(row?.full_name);
    const rowEmail = normalizeEmailAddress(String(row?.email || ""));
    if (normalizedName && normalizedEmail && rowName === normalizedName && rowEmail === normalizedEmail) {
      return mapConflictTicket(row, "full_name_email");
    }
  }
  for (const row of rows) {
    const rowName = normalizeFullNameForIdentity(row?.full_name);
    const rowPhone = normalizePhoneForIdentity(row?.phone);
    if (normalizedName && normalizedPhone && rowName === normalizedName && rowPhone === normalizedPhone) {
      return mapConflictTicket(row, "full_name_phone");
    }
  }

  return null;
}
