import { describe, expect, it } from "vitest";

import { filterVisibleAdminTicketRows } from "./ticketListModel";

describe("filterVisibleAdminTicketRows", () => {
  it("does not collapse distinct free/general tickets that share the same code", () => {
    const rows = [
      {
        id: "ticket-1",
        code_id: "general-code",
        table_reservation_id: null,
        code: { id: "general-code", type: "general" },
      },
      {
        id: "ticket-2",
        code_id: "general-code",
        table_reservation_id: null,
        code: { id: "general-code", type: "general" },
      },
    ];

    const visible = filterVisibleAdminTicketRows(rows, {
      activeTicketIds: new Set<string>(),
      trackedReservationIds: new Set<string>(),
    });

    expect(visible.map((row) => row.id)).toEqual(["ticket-1", "ticket-2"]);
  });

  it("still hides stale reservation tickets when a tracked replacement ticket is active", () => {
    const rows = [
      {
        id: "old-ticket",
        code_id: "table-code",
        table_reservation_id: "reservation-1",
        code: { id: "table-code", table_reservation_id: "reservation-1" },
      },
      {
        id: "active-ticket",
        code_id: "table-code-2",
        table_reservation_id: "reservation-1",
        code: { id: "table-code-2", table_reservation_id: "reservation-1" },
      },
    ];

    const visible = filterVisibleAdminTicketRows(rows, {
      activeTicketIds: new Set(["active-ticket"]),
      trackedReservationIds: new Set(["reservation-1"]),
    });

    expect(visible.map((row) => row.id)).toEqual(["active-ticket"]);
  });
});
