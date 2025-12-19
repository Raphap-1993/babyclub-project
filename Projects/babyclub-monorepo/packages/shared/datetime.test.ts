import { describe, expect, it } from "vitest";
import {
  EVENT_TZ,
  formatEventDateTime,
  toDbTimestamptzFromLima,
  toDatetimeLocalValueFromDb,
  parseDatetimeLocalAsZone,
} from "./datetime";

describe("datetime helpers", () => {
  it("converts Lima local datetime to UTC ISO", () => {
    const iso = toDbTimestamptzFromLima({ datetimeLocal: "2025-12-20T22:00" });
    expect(iso).toBe("2025-12-21T03:00:00.000Z");
  });

  it("roundtrip display Lima", () => {
    const display = formatEventDateTime("2025-12-21T03:00:00.000Z");
    const normalized = display.replace(/\u00a0/g, " ").replace(/[:.\s]/g, "").toUpperCase();
    expect(normalized).toBe("20/12/20251000PM");
  });

  it("datetime-local parsing rejects invalid", () => {
    expect(() => parseDatetimeLocalAsZone("20/12/2025 22:00", EVENT_TZ)).toThrowError();
  });

  it("datetime-local from db iso (for inputs)", () => {
    const val = toDatetimeLocalValueFromDb("2025-12-21T03:00:00.000Z");
    expect(val).toBe("2025-12-20T22:00");
  });
});
