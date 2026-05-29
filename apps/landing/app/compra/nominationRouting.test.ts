import { describe, expect, it } from "vitest";
import { getNominationReservationId } from "./nominationRouting";

describe("getNominationReservationId", () => {
  it("prefers reservationId and falls back to reserva", () => {
    expect(
      getNominationReservationId(
        new URLSearchParams("reservationId=res-123&reserva=res-456"),
      ),
    ).toBe("res-123");

    expect(getNominationReservationId(new URLSearchParams("reserva=res-456"))).toBe(
      "res-456",
    );
  });
});
