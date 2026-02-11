import { randomUUID } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeDocument, type DocumentType } from "shared/document";
import { generateReservationCodes } from "shared/friendlyCodes";

type Supabase = SupabaseClient<any, "public", any>;

function isCodesTypeCheckError(error: any): boolean {
  if (!error) return false;
  const message = String(error?.message || "");
  const details = String(error?.details || "");
  return error?.code === "23514" && /codes_type_check/i.test(`${message} ${details}`);
}

const sanitizeBase = (value: string) => {
  const normalized = (value || "").toLowerCase().trim();
  const cleaned = normalized.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return cleaned || "mesa";
};

const splitName = (fullName: string) => {
  const parts = (fullName || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { first: "Invitado", last: "Reserva" };
  const [first, ...rest] = parts;
  return { first, last: rest.join(" ") || "Reserva" };
};

async function ensurePerson(
  supabase: Supabase,
  {
    fullName,
    email,
    phone,
    dni,
    docType,
    document,
  }: { fullName: string; email?: string | null; phone?: string | null; dni?: string | null; docType?: DocumentType; document?: string | null }
): Promise<string> {
  const cleanDni = dni?.trim() || null;
  const cleanEmail = email?.trim() || null;
  const cleanPhone = phone?.trim() || null;
  const { docType: safeDocType, document: safeDocument } = normalizeDocument(docType, document);
  const { first, last } = splitName(fullName);

  const searchOrder: Array<{ field: "document" | "dni" | "email" | "phone"; value: string }> = [];
  if (safeDocument) searchOrder.push({ field: "document", value: safeDocument });
  if (cleanDni) searchOrder.push({ field: "dni", value: cleanDni });
  if (cleanEmail) searchOrder.push({ field: "email", value: cleanEmail });
  if (cleanPhone) searchOrder.push({ field: "phone", value: cleanPhone });

  for (const item of searchOrder) {
    const { data, error } = await supabase
      .from("persons")
      .select("id")
      .eq(item.field, item.value)
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (data?.id) return data.id;
  }

  const { data, error } = await supabase
    .from("persons")
    .insert({
      dni: cleanDni || null,
      doc_type: safeDocType,
      document: safeDocument || null,
      first_name: first,
      last_name: last,
      email: cleanEmail,
      phone: cleanPhone,
    })
    .select("id")
    .single();

  if (error || !data?.id) throw new Error(error?.message || "No se pudo crear persona");
  return data.id;
}

async function ensureCodeForTicket(
  supabase: Supabase,
  {
    eventId,
    tableName,
    reuseCodes,
    codeType = "courtesy",
    tableReservationId,
  }: {
    eventId: string;
    tableName: string;
    reuseCodes?: string[];
    codeType?: "courtesy" | "table" | "general";
    tableReservationId?: string | null;
  }
): Promise<{ codeId: string; code: string }> {
  if (reuseCodes && reuseCodes.length > 0) {
    const candidate = reuseCodes.map((c) => String(c).trim()).find(Boolean);
    if (candidate) {
      const { data } = await supabase
        .from("codes")
        .select("id,table_reservation_id,type")
        .eq("code", candidate)
        .is("deleted_at", null)
        .eq("is_active", true)
        .limit(1)
        .maybeSingle();
      if (data?.id) {
        const patch: Record<string, any> = {};
        if (tableReservationId && data.table_reservation_id !== tableReservationId) {
          patch.table_reservation_id = tableReservationId;
        }
        if (codeType === "table" && data.type !== "table") {
          patch.type = "table";
        }

        if (Object.keys(patch).length > 0) {
          let { error: patchError } = await supabase.from("codes").update(patch).eq("id", data.id);
          if (patchError && patch.type && isCodesTypeCheckError(patchError)) {
            // Compatibilidad con BDs que aún no aceptan type='table'
            delete patch.type;
            if (Object.keys(patch).length > 0) {
              const retry = await supabase.from("codes").update(patch).eq("id", data.id);
              patchError = retry.error;
            } else {
              patchError = null;
            }
          }
          if (patchError) {
            throw new Error(patchError.message || "No se pudo actualizar el código de reserva");
          }
        }
        return { codeId: data.id, code: candidate };
      }
    }
  }

  const base = sanitizeBase(tableName);
  const codeValue = `${base}-${Math.floor(Math.random() * 900000 + 100000)}`;
  const insertCode = async (typeValue: "courtesy" | "table" | "general") =>
    supabase
      .from("codes")
      .insert({
        code: codeValue,
        event_id: eventId,
        table_reservation_id: tableReservationId || null,
        type: typeValue,
        is_active: true,
        max_uses: 1,
        uses: 0,
      })
      .select("id,code")
      .single();

  let { data, error } = await insertCode(codeType);

  // Compatibilidad con BDs que aún no aceptan type='table'
  if (error && codeType === "table" && isCodesTypeCheckError(error)) {
    ({ data, error } = await insertCode("courtesy"));
  }

  if (error || !data?.id) throw new Error(error?.message || "No se pudo generar código");
  return { codeId: data.id, code: data.code };
}

export async function createTicketForReservation(
  supabase: Supabase,
  {
    eventId,
    tableName,
    fullName,
    email,
    phone,
    dni,
    reuseCodes,
    docType,
    document,
    promoterId,
    codeType,
    tableId,
    productId,
    tableReservationId,
  }: {
    eventId: string;
    tableName: string;
    fullName: string;
    email?: string | null;
    phone?: string | null;
    dni?: string | null;
    reuseCodes?: string[];
    docType?: DocumentType;
    document?: string | null;
    promoterId?: string | null;
    codeType?: "courtesy" | "table" | "general";
    tableId?: string | null;
    productId?: string | null;
    tableReservationId?: string | null;
  }
): Promise<{ ticketId: string; code: string }> {
  const personId = await ensurePerson(supabase, { fullName, email, phone, dni, docType, document });
  const { codeId, code } = await ensureCodeForTicket(supabase, {
    eventId,
    tableName,
    reuseCodes,
    codeType,
    tableReservationId,
  });
  const qr_token = randomUUID();

  const { data, error } = await supabase
    .from("tickets")
    .insert({
      event_id: eventId,
      code_id: codeId,
      person_id: personId,
      promoter_id: promoterId || null,
      qr_token,
      full_name: fullName || null,
      email: email || null,
      phone: phone || null,
      dni: dni || null,
      document: document || null,
      doc_type: (docType as any) || "dni",
      table_id: tableId || null,
      product_id: productId || null,
      table_reservation_id: tableReservationId || null,
    })
    .select("id")
    .single();

  if (error || !data?.id) throw new Error(error?.message || "No se pudo crear ticket");
  return { ticketId: data.id, code };
}

export async function generateCourtesyCodes(
  supabase: Supabase,
  { eventId, tableName, count }: { eventId: string | null; tableName: string; count: number }
): Promise<string[]> {
  if (!eventId || count <= 0) return [];
  const base = sanitizeBase(tableName);

  const payload = Array.from({ length: count }).map(() => ({
    code: `${base}-${randomUUID().slice(0, 6)}`,
    event_id: eventId,
    type: "courtesy",
    is_active: true,
    max_uses: 1,
    uses: 0,
  }));

  const { data, error } = await supabase.from("codes").insert(payload).select("code");
  if (error) throw new Error(error.message);
  return (data || []).map((row: any) => row.code).filter(Boolean);
}

/**
 * Create individual friendly codes for a table reservation
 * Each code is linked to the reservation and has a person_index
 * Format: BC-{EVENT_PREFIX}-{TABLE}-{PERSON_INDEX}
 * Example: BC-LOVE-M1-001, BC-LOVE-M1-002, etc.
 */
export async function createReservationCodes(
  supabase: Supabase,
  {
    eventId,
    eventPrefix,
    tableName,
    reservationId,
    quantity,
  }: {
    eventId: string;
    eventPrefix: string;
    tableName: string;
    reservationId: string;
    quantity: number;
  }
): Promise<{ codes: string[]; codeIds: string[] }> {
  if (quantity <= 0) return { codes: [], codeIds: [] };

  // Generate friendly codes
  const friendlyCodes = generateReservationCodes(eventPrefix, tableName, quantity);

  const buildPayload = (typeValue: "table" | "courtesy") =>
    friendlyCodes.map((code, index) => ({
      code,
      event_id: eventId,
      table_reservation_id: reservationId,
      person_index: index + 1,
      type: typeValue,
      is_active: true,
      max_uses: 1,
      uses: 0,
    }));

  let { data, error } = await supabase
    .from("codes")
    .insert(buildPayload("table"))
    .select("id,code");

  // Compatibilidad con BDs que aún no aceptan type='table'
  if (error && isCodesTypeCheckError(error)) {
    ({ data, error } = await supabase.from("codes").insert(buildPayload("courtesy")).select("id,code"));
  }

  if (error) throw new Error(`Error creating codes: ${error.message}`);

  const codes = (data || []).map((row: any) => row.code);
  const codeIds = (data || []).map((row: any) => row.id);

  return { codes, codeIds };
}
