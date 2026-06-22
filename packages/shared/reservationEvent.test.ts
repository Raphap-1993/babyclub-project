import { describe, expect, it } from "vitest";

import { resolveReservationEventId } from "./reservationEvent";

describe("resolveReservationEventId", () => {
  it("prioritizes the explicitly selected event over legacy tables.event_id", () => {
    expect(resolveReservationEventId("legacy-event", "selected-event")).toBe(
      "selected-event",
    );
  });

  it("falls back to the table event when no event was explicitly selected", () => {
    expect(resolveReservationEventId("legacy-event", null)).toBe("legacy-event");
  });
});
