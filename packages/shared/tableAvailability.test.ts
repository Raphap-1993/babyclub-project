import { describe, expect, it } from "vitest";

import {
  applyEventTableAvailability,
  isTableAvailableForEvent,
} from "./tableAvailability";

describe("tableAvailability", () => {
  it("treats missing event availability rows as available unless the legacy table belongs to another event", () => {
    expect(
      isTableAvailableForEvent("table-1", [
        { table_id: "table-2", is_available: true },
      ]),
    ).toBe(true);
  });

  it("blocks only tables explicitly disabled for the event", () => {
    expect(
      isTableAvailableForEvent("table-1", [
        { table_id: "table-1", is_available: false },
      ]),
    ).toBe(false);
  });

  it("keeps active organizer tables when event availability is partially configured", () => {
    const tables = applyEventTableAvailability(
      [
        { id: "table-1", event_id: null, price: 100 },
        { id: "table-2", event_id: null, price: 200 },
        { id: "table-3", event_id: null, price: 300 },
        { id: "legacy-other", event_id: "event-2", price: 400 },
      ],
      [
        { table_id: "table-2", is_available: true, custom_price: 250 },
        { table_id: "table-3", is_available: false },
      ],
      "event-1",
    );

    expect(tables.map((table) => table.id)).toEqual(["table-1", "table-2"]);
    expect(tables.find((table) => table.id === "table-2")?.price).toBe(250);
  });
});
