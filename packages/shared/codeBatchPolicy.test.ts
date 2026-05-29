import { describe, expect, it } from "vitest";
import {
  requiresExpirationForCodeType,
  resolveBatchCloseReason,
  resolveBatchState,
} from "./codeBatchPolicy";

describe("codeBatchPolicy", () => {
  it("detecta si un tipo de codigo requiere expiracion segun la politica", () => {
    expect(
      requiresExpirationForCodeType("promoter", [
        { code_type: "courtesy", requires_expiration: false },
        { code_type: "promoter", requires_expiration: true },
      ]),
    ).toBe(true);

    expect(
      requiresExpirationForCodeType("table", [
        { code_type: "table", requires_expiration: false },
      ]),
    ).toBe(false);
  });

  it("conserva el motivo almacenado cuando el lote ya esta cerrado", () => {
    expect(
      resolveBatchCloseReason(
        {
          closed_at: "2026-05-28T18:00:00.000Z",
          closed_reason: "quota",
          expires_at: "2026-05-28T17:00:00.000Z",
          remaining_usable_codes: 0,
        },
        new Date("2026-05-28T19:00:00.000Z"),
      ),
    ).toBe("quota");
  });

  it("resuelve expired cuando expires_at ya vencio", () => {
    expect(
      resolveBatchCloseReason(
        {
          expires_at: "2026-05-28T18:00:00.000Z",
          remaining_usable_codes: 3,
        },
        new Date("2026-05-28T19:00:00.000Z"),
      ),
    ).toBe("expired");
  });

  it("resuelve quota cuando no quedan codigos usables", () => {
    expect(
      resolveBatchCloseReason(
        {
          expires_at: "2026-05-28T21:00:00.000Z",
          remaining_usable_codes: 0,
        },
        new Date("2026-05-28T19:00:00.000Z"),
      ),
    ).toBe("quota");
  });

  it("devuelve null cuando el lote sigue abierto", () => {
    expect(
      resolveBatchCloseReason(
        {
          expires_at: "2026-05-28T21:00:00.000Z",
          remaining_usable_codes: 4,
        },
        new Date("2026-05-28T19:00:00.000Z"),
      ),
    ).toBeNull();
  });

  it("deriva el estado del lote a partir de su motivo de cierre", () => {
    expect(
      resolveBatchState(
        {
          closed_at: "2026-05-28T18:00:00.000Z",
          closed_reason: "expired",
        },
        new Date("2026-05-28T19:00:00.000Z"),
      ),
    ).toEqual({
      batch_state: "closed",
      batch_close_reason: "expired",
    });
  });
});
