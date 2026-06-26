import { describe, expect, it } from "vitest";

import {
  collectVisibleAdminTicketRows,
  filterVisibleAdminTicketRows,
} from "./ticketListModel";

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

  it("loads visible rows across multiple batches beyond the default PostgREST window", async () => {
    const firstBatch = Array.from({ length: 1000 }, (_, index) => ({
      id: `purchased-${index + 1}`,
      code_id: `general-${index + 1}`,
      table_reservation_id: null,
      code: { id: `general-${index + 1}`, type: "general" },
    }));
    const secondBatch = Array.from({ length: 205 }, (_, index) => ({
      id: `courtesy-${index + 1}`,
      code_id: `courtesy-${index + 1}`,
      table_reservation_id: null,
      code: { id: `courtesy-${index + 1}`, type: "courtesy" },
    }));

    const visible = await collectVisibleAdminTicketRows({
      batchSize: 1000,
      refs: {
        activeTicketIds: new Set<string>(),
        trackedReservationIds: new Set<string>(),
      },
      loadBatch: async (offset) => {
        if (offset === 0) return firstBatch;
        if (offset === 1000) return secondBatch;
        return [];
      },
    });

    expect(visible).toHaveLength(1205);
    expect(visible[0]?.id).toBe("purchased-1");
    expect(visible[1000]?.id).toBe("courtesy-1");
    expect(visible.at(-1)?.id).toBe("courtesy-205");
  });
});
