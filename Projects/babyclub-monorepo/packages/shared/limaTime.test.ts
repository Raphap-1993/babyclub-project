import { describe, expect, it } from "vitest";
import { formatLimaFromDb, toDatetimeLocalFromDb, toLimaPartsFromDb, toUTCISOFromLimaParts } from "./limaTime";

describe("limaTime helpers", () => {
  it("convierte 20/12/2025 10:00 PM Lima a UTC", () => {
    const iso = toUTCISOFromLimaParts({ date: "20/12/2025", hour12: 10, minute: 0, ampm: "PM" });
    expect(iso).toBe("2025-12-21T03:00:00.000Z");
  });

  it("roundtrip display en Lima", () => {
    const display = formatLimaFromDb("2025-12-21T03:00:00.000Z");
    expect(display).toBe("20/12/2025 10:00 PM");
  });

  it("partes para edición desde DB", () => {
    const parts = toLimaPartsFromDb("2025-12-21T03:00:00.000Z");
    expect(parts).toEqual({ date: "20/12/2025", hour12: 10, minute: 0, ampm: "PM" });
  });

  it("12AM y 12PM se convierten bien", () => {
    const amIso = toUTCISOFromLimaParts({ date: "01/01/2025", hour12: 12, minute: 0, ampm: "AM" });
    const pmIso = toUTCISOFromLimaParts({ date: "01/01/2025", hour12: 12, minute: 0, ampm: "PM" });
    expect(amIso).toMatch(/T05:00:00\.000Z$/);
    expect(pmIso).toMatch(/T17:00:00\.000Z$/);
  });

  it("datetime-local para inputs", () => {
    const dtLocal = toDatetimeLocalFromDb("2025-12-21T03:00:00.000Z");
    expect(dtLocal).toBe("2025-12-20T22:00");
  });

  it("lanza error si ISO inválido", () => {
    expect(() => toLimaPartsFromDb("fecha-rara")).toThrowError();
  });
});
