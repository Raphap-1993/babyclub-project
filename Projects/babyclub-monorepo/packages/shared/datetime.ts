import { DateTime } from "luxon";

export const EVENT_TZ = "America/Lima";

export function formatEventDateTime(iso: string | null | undefined, locale = "es-PE") {
  const dt = parseToLima(iso);
  return dt ? dt.setLocale(locale).toFormat("dd LLL yyyy, HH:mm") : "—";
}

export function formatEventDate(iso: string | null | undefined, locale = "es-PE") {
  const dt = parseToLima(iso);
  return dt ? dt.setLocale(locale).toFormat("dd LLL yyyy") : "—";
}

export function formatEventTime(iso: string | null | undefined, locale = "es-PE") {
  const dt = parseToLima(iso);
  return dt ? dt.setLocale(locale).toFormat("HH:mm") : "—";
}

export function toUtcIsoFromLimaParts(parts: { year: number; month: number; day: number; hour: number; minute: number }) {
  const dt = DateTime.fromObject(
    {
      year: parts.year,
      month: parts.month,
      day: parts.day,
      hour: parts.hour,
      minute: parts.minute,
    },
    { zone: EVENT_TZ }
  );
  return dt.isValid ? dt.toUTC().toISO() || "" : "";
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

function parseToLima(iso: string | null | undefined) {
  if (!iso) return null;
  const dt = DateTime.fromISO(iso, { setZone: true }).setZone(EVENT_TZ);
  return dt.isValid ? dt : null;
}
