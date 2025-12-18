import { DateTime } from "luxon";

export const EVENT_TZ = "America/Lima";

export function formatEventDateTime(iso: string | null | undefined, locale = "es-PE") {
  const dt = parseToLima(iso);
  return dt ? dt.setLocale(locale).toFormat("dd/LL/yyyy hh:mm a") : "—";
}

export function formatEventDate(iso: string | null | undefined, locale = "es-PE") {
  const dt = parseToLima(iso);
  return dt ? dt.setLocale(locale).toFormat("dd LLL yyyy") : "—";
}

export function formatEventTime(iso: string | null | undefined, locale = "es-PE") {
  const dt = parseToLima(iso);
  return dt ? dt.setLocale(locale).toFormat("HH:mm") : "—";
}

export function parseDatetimeLocalAsZone(datetimeLocal: string, zone = EVENT_TZ) {
  const re = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
  if (!re.test(datetimeLocal)) {
    throw new Error(`datetime-local inválido: ${datetimeLocal}`);
  }
  const dt = DateTime.fromISO(datetimeLocal, { zone });
  if (!dt.isValid) throw new Error(`No se pudo parsear datetime-local: ${datetimeLocal}`);
  return dt;
}

type LimaParts = { date: string; hour12: number; minute: number; ampm: "AM" | "PM" };
type DatetimeInput = { date: string; hour12: number; minute: number; ampm: "AM" | "PM" } | { datetimeLocal: string };

export function toDbTimestamptzFromLima(input: DatetimeInput): string {
  let dt: DateTime | null = null;
  if ("datetimeLocal" in input) {
    dt = parseDatetimeLocalAsZone(input.datetimeLocal, EVENT_TZ);
  } else {
    const [y, m, d] = input.date.split("-").map((n) => Number(n));
    if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) throw new Error("Fecha inválida");
    const h24 = to24h(input.hour12, input.ampm);
    dt = DateTime.fromObject(
      {
        year: y,
        month: m,
        day: d,
        hour: h24,
        minute: input.minute,
      },
      { zone: EVENT_TZ }
    );
    if (!dt.isValid) throw new Error("Fecha/hora inválida");
  }
  const iso = dt.toUTC().toISO({ suppressMilliseconds: false });
  if (!iso) throw new Error("No se pudo generar ISO");
  debugDatePipeline("toDbTimestamptzFromLima", { raw: input, dt, iso });
  return iso;
}

export function toDatetimeLocalValueFromDb(isoFromDb: string): string {
  const dt = DateTime.fromISO(isoFromDb, { zone: "utc" }).setZone(EVENT_TZ);
  if (!dt.isValid) return "";
  return dt.toFormat("yyyy-LL-dd'T'HH:mm");
}

export function toLimaPartsFromIso(iso: string | null | undefined) {
  const dt = parseToLima(iso);
  if (!dt) {
    return {
      datePart: "",
      hour12: "12",
      minute: "00",
      period: "AM" as "AM" | "PM",
    };
  }
  return {
    datePart: dt.toFormat("yyyy-MM-dd"),
    hour12: dt.toFormat("hh"),
    minute: dt.toFormat("mm"),
    period: dt.toFormat("a") as "AM" | "PM",
  };
}

export function formatForLimaDisplay(isoFromDb: string | null | undefined, locale = "es-PE") {
  const dt = parseToLima(isoFromDb);
  return dt ? dt.setLocale(locale).toFormat("dd/LL/yyyy hh:mm a") : "—";
}

export function debugDatePipeline(label: string, data: { raw?: any; dt?: DateTime; iso?: string }) {
  if (process.env.NODE_ENV === "production") return;
  // eslint-disable-next-line no-console
  console.log(`[datetime:${label}]`, {
    raw: data.raw,
    iso: data.iso,
    dt: data.dt?.toISO(),
    zone: data.dt?.zoneName,
  });
}

export function toUtcIsoFromLimaParts(parts: { year: number; month: number; day: number; hour: number; minute: number }) {
  return toDbTimestamptzFromLima({
    date: `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`,
    hour12: parts.hour > 12 ? parts.hour - 12 : parts.hour === 0 ? 12 : parts.hour,
    minute: parts.minute,
    ampm: parts.hour >= 12 ? "PM" : "AM",
  });
}

function parseToLima(iso: string | null | undefined) {
  if (!iso) return null;
  const dt = DateTime.fromISO(iso, { setZone: true }).setZone(EVENT_TZ);
  return dt.isValid ? dt : null;
}

function to24h(hour12: number, ampm: "AM" | "PM") {
  const h = Number(hour12) || 0;
  const norm = ((h % 12) + 12) % 12;
  return ampm === "PM" ? norm + 12 : norm === 12 ? 0 : norm;
}
