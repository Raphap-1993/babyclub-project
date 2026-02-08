import { describe, expect, it } from "vitest";
import { DateTime } from "luxon";
import { EVENT_TZ } from "./datetime";
import { DEFAULT_ENTRY_LIMIT, getEntryCutoff, normalizeEntryLimit, parseEntryLimit } from "./entryLimit";

describe("entry limit helpers", () => {
  it("parses and normalizes entry limit strings", () => {
    expect(parseEntryLimit("23:30")).toEqual({ hour: 23, minute: 30 });
    expect(parseEntryLimit("01:05:00")).toEqual({ hour: 1, minute: 5 });
    expect(normalizeEntryLimit("1:05")).toBe("01:05");
    expect(normalizeEntryLimit("bad")).toBeNull();
  });

  it("defaults to the configured fallback", () => {
    expect(normalizeEntryLimit(DEFAULT_ENTRY_LIMIT)).toBe("23:30");
  });

  it("keeps cutoff on same day when limit is after start time", () => {
    const eventStart = DateTime.fromObject(
      { year: 2025, month: 3, day: 15, hour: 22, minute: 0 },
      { zone: EVENT_TZ }
    ).toUTC().toISO();
    expect(eventStart).toBeTruthy();
    const cutoff = getEntryCutoff(eventStart!, "23:30");
    expect(cutoff?.isNextDay).toBe(false);
    expect(cutoff?.cutoff.toUTC().toISO()).toBe("2025-03-16T04:30:00.000Z");
  });

  it("moves cutoff to next day when limit is before start time", () => {
    const eventStart = DateTime.fromObject(
      { year: 2025, month: 3, day: 15, hour: 22, minute: 0 },
      { zone: EVENT_TZ }
    ).toUTC().toISO();
    expect(eventStart).toBeTruthy();
    const cutoff = getEntryCutoff(eventStart!, "00:30");
    expect(cutoff?.isNextDay).toBe(true);
    expect(cutoff?.cutoff.toUTC().toISO()).toBe("2025-03-16T05:30:00.000Z");
  });
});
