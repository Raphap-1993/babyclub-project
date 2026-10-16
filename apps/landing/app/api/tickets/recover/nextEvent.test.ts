import { describe, expect, it } from "vitest";
import { nextEventAccesses } from "./recovery";

describe("next event accesses", () => {
  const event = (id: string, starts_at: string) => ({
    id,
    name: id,
    starts_at,
  });
  it("shows all the customer's accesses for only the nearest event", () => {
    const next = event("next", "2026-10-17T03:00:00Z");
    const later = event("later", "2026-10-31T03:00:00Z");
    const result = nextEventAccesses(
      [
        { id: "later-ticket", event: later },
        { id: "first", event: next },
        { id: "second", event: next },
      ],
      [
        { id: "mesa", event: [next] },
        { id: "later-mesa", event: [later] },
      ],
    );
    expect(result.tickets.map((row) => row.id)).toEqual(["first", "second"]);
    expect(result.reservations.map((row) => row.id)).toEqual(["mesa"]);
  });
  it("does not return a later event's tickets when the closest booking is a table", () => {
    const result = nextEventAccesses(
      [{ id: "later", event: event("later", "2026-10-31T03:00:00Z") }],
      [{ id: "next-mesa", event: event("next", "2026-10-17T03:00:00Z") }],
    );
    expect(result.tickets).toEqual([]);
    expect(result.reservations.map((row) => row.id)).toEqual(["next-mesa"]);
  });
  it("ignores missing or undated events", () => {
    expect(
      nextEventAccesses(
        [
          { id: "a", event: null },
          { id: "b", event: event("bad", "invalid") },
        ],
        [],
      ),
    ).toEqual({ tickets: [], reservations: [] });
  });
});
