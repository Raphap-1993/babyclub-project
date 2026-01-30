import { DateTime } from "luxon";

export const EVENT_ZONE = "America/Lima" as const;

export type LimaParts = {
  date: string; // dd/LL/yyyy
  hour12: number; // 1..12
  minute: number; // 0..59
  ampm: "AM" | "PM";
};

export function toUTCISOFromLimaParts(parts: LimaParts): string {
  const { date, hour12, minute, ampm } = parts;
  const [day, month, year] = date.split("/").map((n) => Number(n));
  if (!year || !month || !day) throw new Error(`Fecha inválida: ${date}`);
  const h24 = to24h(hour12, ampm);
  const dt = DateTime.fromObject(
    { year, month, day, hour: h24, minute },
    { zone: EVENT_ZONE }
  );
  if (!dt.isValid) throw new Error(`Fecha/hora inválida: ${dt.invalidExplanation || "desconocido"}`);
  const iso = dt.toUTC().toISO({ suppressMilliseconds: false });
  if (!iso) throw new Error("No se pudo generar ISO");
  debugDatePipeline("toUTCISOFromLimaParts", { raw: parts, dt, iso });
  return iso;
}

export function formatLimaFromDb(isoFromDb: string): string {
  const dt = parseDbToLima(isoFromDb);
  return dt.toFormat("dd/LL/yyyy hh:mm a");
}

export function toLimaPartsFromDb(isoFromDb: string): LimaParts {
  const dt = parseDbToLima(isoFromDb);
  const hour12 = Number(dt.toFormat("hh"));
  const minute = Number(dt.toFormat("mm"));
  const ampm = dt.toFormat("a") as "AM" | "PM";
  return {
    date: dt.toFormat("dd/LL/yyyy"),
    hour12,
    minute,
    ampm,
  };
}

export function toDatetimeLocalFromDb(isoFromDb: string): string {
  const dt = parseDbToLima(isoFromDb);
  return dt.toFormat("yyyy-LL-dd'T'HH:mm");
}

function parseDbToLima(isoFromDb: string) {
  const dt = DateTime.fromISO(isoFromDb, { zone: "utc" }).setZone(EVENT_ZONE);
  if (!dt.isValid) {
    throw new Error(`Fecha inválida desde DB: ${isoFromDb}`);
  }
  return dt;
}

function to24h(hour12: number, ampm: "AM" | "PM") {
  const h = Number(hour12);
  if (!Number.isFinite(h) || h < 1 || h > 12) throw new Error(`Hora inválida: ${hour12}`);
  if (ampm === "AM") return h === 12 ? 0 : h;
  return h === 12 ? 12 : h + 12;
}

export function debugDatePipeline(label: string, data: { raw?: any; dt?: DateTime; iso?: string }) {
  if (process.env.NODE_ENV === "production") return;
  // eslint-disable-next-line no-console
  console.log(`[limaTime:${label}]`, {
    raw: data.raw,
    iso: data.iso,
    dt: data.dt?.toISO(),
    zone: data.dt?.zoneName,
  });
}
