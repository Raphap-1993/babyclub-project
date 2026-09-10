import { describe, expect, it } from "vitest";
import { getTicketAccessState } from "./ticketAccess";

const event = {
  starts_at: "2026-09-11T03:00:00Z",
  entry_limit: "23:30",
  is_active: true,
};
const now = new Date("2026-09-11T04:31:00Z");

describe("ticket access validity", () => {
  it("expires a general ticket at the event's Lima cutoff", () => {
    expect(
      getTicketAccessState({
        ticket: {},
        event,
        code: { type: "general" },
        now,
      }),
    ).toMatchObject({
      state: "expired",
      reason: "entry_cutoff",
      expiredAt: "2026-09-11T04:30:00.000Z",
    });
  });
  it("uses an invitation's own expiry", () => {
    expect(
      getTicketAccessState({
        ticket: {},
        event,
        code: { type: "courtesy", expires_at: "2026-09-11T04:00:00Z" },
        now,
      }).state,
    ).toBe("expired");
    expect(
      getTicketAccessState({
        ticket: {},
        event,
        code: { type: "courtesy", expires_at: "2026-09-11T06:00:00Z" },
        now,
      }).state,
    ).toBe("ready");
  });
  it("keeps an issued ticket usable when its source code has exhausted issuance", () => {
    const code = { type: "courtesy", is_active: false, uses: 1, max_uses: 1 };
    expect(
      getTicketAccessState({ ticket: { is_active: true }, event, code, now })
        .state,
    ).toBe("ready");
  });
  it.each(["cancelled", "pending_nomination", "nominated", "expired"])(
    "does not present a %s unit as ready",
    (status) => {
      expect(
        getTicketAccessState({ ticket: {}, event, unit: { status }, now })
          .state,
      ).not.toBe("ready");
    },
  );
  it("preserves used state after the event closes", () => {
    expect(
      getTicketAccessState({
        ticket: { used: true },
        event: { ...event, closed_at: now.toISOString() },
        now,
      }).state,
    ).toBe("used");
  });
  it("blocks inactive tickets, missing events and pending payment", () => {
    expect(
      getTicketAccessState({ ticket: { is_active: false }, event, now }).state,
    ).toBe("inactive");
    expect(getTicketAccessState({ ticket: {}, event: null, now }).state).toBe(
      "inactive",
    );
    expect(
      getTicketAccessState({
        ticket: { payment_status: "pending" },
        event,
        now,
      }).state,
    ).toBe("pending");
  });
});
