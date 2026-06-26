import { applyNotDeleted } from "shared/db/softDelete";
import { generateFriendlyCode } from "shared/friendlyCodes";

type ReservationLike = {
  id?: string | null;
  event_id?: string | null;
  sale_origin?: string | null;
  ticket_type_label?: string | null;
  total_ticket_units?: number | null;
  codes?: unknown;
  table?: { name?: string | null } | Array<{ name?: string | null }> | null;
  event?:
    | {
        event_prefix?: string | null;
      }
    | Array<{
        event_prefix?: string | null;
      }>
    | null;
};

type UnitLike = {
  unit_index?: number | null;
};

function uniqueStrings(values: Array<string | null | undefined>) {
  return Array.from(
    new Set(
      values
        .map((value) => (value ? String(value).trim() : ""))
        .filter(Boolean),
    ),
  );
}

function getRelation<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] || null;
  return value || null;
}

function sanitizeSegment(value: string, fallback: string) {
  const normalized = String(value || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "")
    .trim();
  return normalized || fallback;
}

function resolveUnitIndexes(
  reservation: ReservationLike,
  units: UnitLike[],
): number[] {
  const indexes = Array.from(
    new Set(
      units
        .map((unit) => Number(unit?.unit_index || 0))
        .filter((value) => Number.isInteger(value) && value > 0),
    ),
  ).sort((a, b) => a - b);
  if (indexes.length > 0) return indexes;

  const total = Number(reservation.total_ticket_units || 0);
  if (!Number.isInteger(total) || total <= 0) return [];
  return Array.from({ length: total }, (_value, index) => index + 1);
}

function resolveEventPrefix(reservation: ReservationLike) {
  const eventRel = getRelation(reservation.event);
  const rawPrefix = String(eventRel?.event_prefix || "").trim();
  if (rawPrefix) return sanitizeSegment(rawPrefix, "EVENT");
  return sanitizeSegment(String(reservation.event_id || "").slice(-6), "EVENT");
}

function resolveCodeTableName(reservation: ReservationLike) {
  const saleOrigin = String(reservation.sale_origin || "").trim().toLowerCase();
  if (saleOrigin === "table") {
    const tableRel = getRelation(reservation.table);
    return String(tableRel?.name || reservation.ticket_type_label || "Mesa").trim() || "Mesa";
  }

  return `T${sanitizeSegment(String(reservation.id || "").slice(-6), "TICKET")}`;
}

function sameCodeList(a: string[], b: string[]) {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

function isCodesTypeCheckError(error: any): boolean {
  if (!error) return false;
  const message = String(error?.message || "");
  const details = String(error?.details || "");
  return error?.code === "23514" && /codes_type_check/i.test(`${message} ${details}`);
}

async function insertReservationCodes(
  supabase: any,
  {
    eventId,
    eventPrefix,
    tableName,
    reservationId,
    codeType,
    personIndexes,
  }: {
    eventId: string;
    eventPrefix: string;
    tableName: string;
    reservationId: string;
    codeType: "table" | "courtesy";
    personIndexes: number[];
  },
) {
  const buildPayload = (typeValue: "table" | "courtesy") =>
    personIndexes.map((personIndex) => ({
      code: generateFriendlyCode(eventPrefix, tableName, personIndex),
      event_id: eventId,
      table_reservation_id: reservationId,
      person_index: personIndex,
      type: typeValue,
      is_active: true,
      max_uses: 1,
      uses: 0,
    }));

  let { data, error } = await supabase
    .from("codes")
    .insert(buildPayload(codeType))
    .select("id,code");

  if (error && codeType === "table" && isCodesTypeCheckError(error)) {
    ({ data, error } = await supabase
      .from("codes")
      .insert(buildPayload("courtesy"))
      .select("id,code"));
  }
  if (error) {
    throw new Error(error.message || "No se pudieron crear los códigos por unidad");
  }

  return Array.isArray(data) ? data : [];
}

export async function ensureReservationUnitCodes(
  supabase: any,
  {
    reservation,
    units,
  }: {
    reservation: ReservationLike;
    units: UnitLike[];
  },
): Promise<{
  codesByUnitIndex: Map<number, string>;
  orderedCodes: string[];
  mergedCodes: string[];
}> {
  const reservationId = String(reservation.id || "").trim();
  const eventId = String(reservation.event_id || "").trim();
  const unitIndexes = resolveUnitIndexes(reservation, units);
  const reservationCodes = Array.isArray(reservation.codes)
    ? reservation.codes
        .map((code) => String(code || "").trim())
        .filter(Boolean)
    : [];

  const codesByUnitIndex = new Map<number, string>();
  if (!reservationId || !eventId || unitIndexes.length === 0) {
    return {
      codesByUnitIndex,
      orderedCodes: [],
      mergedCodes: reservationCodes,
    };
  }

  const { data: existingRows, error: existingError } = await applyNotDeleted(
    supabase
      .from("codes")
      .select("id,code,person_index")
      .eq("table_reservation_id", reservationId)
      .eq("is_active", true)
      .order("person_index", { ascending: true }),
  );
  if (existingError) {
    throw new Error(
      existingError.message || "No se pudieron cargar los códigos por unidad",
    );
  }

  for (const row of Array.isArray(existingRows) ? existingRows : []) {
    const unitIndex = Number((row as any)?.person_index || 0);
    const code = String((row as any)?.code || "").trim();
    if (unitIndex > 0 && code && !codesByUnitIndex.has(unitIndex)) {
      codesByUnitIndex.set(unitIndex, code);
    }
  }

  reservationCodes.forEach((code, index) => {
    const unitIndex = index + 1;
    if (code && !codesByUnitIndex.has(unitIndex)) {
      codesByUnitIndex.set(unitIndex, code);
    }
  });

  const missingIndexes = unitIndexes.filter(
    (unitIndex) => !codesByUnitIndex.has(unitIndex),
  );
  if (missingIndexes.length > 0) {
    const saleOrigin = String(reservation.sale_origin || "").trim().toLowerCase();
    const created = await insertReservationCodes(supabase as any, {
      eventId,
      eventPrefix: resolveEventPrefix(reservation),
      tableName: resolveCodeTableName(reservation),
      reservationId,
      codeType: saleOrigin === "table" ? "table" : "courtesy",
      personIndexes: missingIndexes,
    });
    missingIndexes.forEach((unitIndex, index) => {
      const code = String(created[index]?.code || "").trim();
      if (code) codesByUnitIndex.set(unitIndex, code);
    });
  }

  const orderedCodes = unitIndexes
    .map((unitIndex) => codesByUnitIndex.get(unitIndex) || "")
    .filter(Boolean);
  const mergedCodes = uniqueStrings([...reservationCodes, ...orderedCodes]);

  if (
    missingIndexes.length > 0 ||
    !sameCodeList(reservationCodes, mergedCodes)
  ) {
    const { error: updateError } = await supabase
      .from("table_reservations")
      .update({
        codes: mergedCodes,
        updated_at: new Date().toISOString(),
      })
      .eq("id", reservationId);
    if (updateError) {
      throw new Error(
        updateError.message ||
          "No se pudieron guardar los códigos por unidad en la reserva",
      );
    }
  }

  return {
    codesByUnitIndex,
    orderedCodes,
    mergedCodes,
  };
}

export function buildUnitClaimUrl(requestUrl: string, code: string) {
  const request = new URL(requestUrl);
  const canonicalBase =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "https://babyclubaccess.com";
  const baseUrl =
    request.hostname === "localhost" || request.hostname === "127.0.0.1"
      ? canonicalBase
      : `${request.protocol}//${request.host}`;
  return new URL(
    `/registro?code=${encodeURIComponent(code)}`,
    baseUrl,
  ).toString();
}

export async function ensureReservationUnitClaimCodes({
  supabase,
  reservation,
  units,
  requestUrl = "http://localhost/",
}: {
  supabase: any;
  reservation: ReservationLike;
  units: Array<UnitLike & Record<string, any>>;
  requestUrl?: string;
}) {
  const { codesByUnitIndex } = await ensureReservationUnitCodes(supabase, {
    reservation,
    units,
  });

  return units.map((unit) => {
    const claimCode = codesByUnitIndex.get(Number(unit.unit_index || 0)) || null;
    return {
      ...unit,
      claim_code: claimCode,
      claim_url: claimCode ? buildUnitClaimUrl(requestUrl, claimCode) : null,
    };
  });
}
