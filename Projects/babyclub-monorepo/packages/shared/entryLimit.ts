import { DateTime } from "luxon";
import { EVENT_TZ } from "./datetime";

export const DEFAULT_ENTRY_LIMIT = "23:30";

type EntryLimitParts = { hour: number; minute: number };

export function parseEntryLimit(value?: string | null): EntryLimitParts | null {
  if (!value) return null;
  const match = value.trim().match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return { hour, minute };
}

export function normalizeEntryLimit(value?: string | null): string | null {
  const parsed = parseEntryLimit(value);
  if (!parsed) return null;
  return `${String(parsed.hour).padStart(2, "0")}:${String(parsed.minute).padStart(2, "0")}`;
}

export type EntryCutoffInfo = {
  cutoff: DateTime;
  isNextDay: boolean;
};

export function getEntryCutoff(
  eventStartsAtIso: string,
  entryLimit?: string | null,
  fallback = DEFAULT_ENTRY_LIMIT
): EntryCutoffInfo | null {
  if (!eventStartsAtIso) return null;
  const eventStart = DateTime.fromISO(eventStartsAtIso, { setZone: true }).setZone(EVENT_TZ);
  if (!eventStart.isValid) return null;

  const normalized = normalizeEntryLimit(entryLimit) ?? normalizeEntryLimit(fallback);
  const parts = parseEntryLimit(normalized);
  if (!parts) return null;

  const startMinutes = eventStart.hour * 60 + eventStart.minute;
  const limitMinutes = parts.hour * 60 + parts.minute;

  let cutoff = eventStart.set({
    hour: parts.hour,
    minute: parts.minute,
    second: 0,
    millisecond: 0,
  });
  const isNextDay = limitMinutes < startMinutes;
  if (isNextDay) cutoff = cutoff.plus({ days: 1 });

  return { cutoff, isNextDay };
}

export type EntryCutoffDisplay = {
  timeLabel: string;
  dateLabel: string;
  isNextDay: boolean;
  cutoffIso: string;
};

export function getEntryCutoffDisplay(
  eventStartsAtIso: string,
  entryLimit?: string | null,
  fallback = DEFAULT_ENTRY_LIMIT
): EntryCutoffDisplay | null {
  const info = getEntryCutoff(eventStartsAtIso, entryLimit, fallback);
  if (!info) return null;
  const cutoffIso = info.cutoff.toUTC().toISO();
  if (!cutoffIso) return null;
  return {
    timeLabel: info.cutoff.toFormat("hh:mm a"),
    dateLabel: info.cutoff.toFormat("dd/LL"),
    isNextDay: info.isNextDay,
    cutoffIso,
  };
}
