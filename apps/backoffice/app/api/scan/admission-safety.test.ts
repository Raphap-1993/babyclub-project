import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSupabaseMock } from "../../../../../tests/utils/supabaseMock";
import { resetRateLimitStore } from "shared/security/rateLimit";

vi.mock("@supabase/supabase-js", () => ({ createClient: vi.fn() }));
vi.mock("shared/auth/requireStaff", () => ({ requireStaffRole: vi.fn() }));
const { createClient } = await import("@supabase/supabase-js");
const { requireStaffRole } = await import("shared/auth/requireStaff");
const event = {
  id: "event-1",
  starts_at: "2099-01-01T03:00:00Z",
  is_active: true,
};
const ticket = {
  id: "ticket-1",
  code_id: "code-1",
  event_id: "event-1",
  used: false,
  is_active: true,
  qr_token: "individual-token",
};
const request = (body: object) =>
  new Request("http://localhost/api/scan", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

describe("individual admission safety", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetRateLimitStore();
    process.env.SUPABASE_URL = "http://localhost:54321";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-key";
    (requireStaffRole as any).mockResolvedValue({
      ok: true,
      context: { staffId: "staff-1", role: "door" },
    });
  });
  it("rejects a shared issuance code without selecting its latest customer", async () => {
    const { supabase, calls } = createSupabaseMock({
      "events.select": [{ data: event, error: null }],
      "codes.select": [
        {
          data: { id: "code-1", type: "general", is_active: true },
          error: null,
        },
      ],
      "tickets.select": [{ data: ticket, error: null }],
    });
    (createClient as any).mockReturnValue(supabase);
    const { POST } = await import("./route");
    const response = await POST(
      request({ code: "SHARED-CODE", event_id: "event-1" }) as any,
    );
    expect(await response.json()).toMatchObject({
      result: "invalid",
      reason: "individual_qr_required",
      ticket_id: null,
    });
    expect(calls.filter((call) => call.table === "tickets")).toHaveLength(0);
  });
  it("rejects an expired invitation token during precheck", async () => {
    const { supabase } = createSupabaseMock({
      "events.select": [{ data: event, error: null }],
      "codes.select": [{ data: null, error: null }],
      "tickets.select": [
        {
          data: {
            ...ticket,
            code: { type: "courtesy", expires_at: "2020-01-01T00:00:00Z" },
          },
          error: null,
        },
      ],
    });
    (createClient as any).mockReturnValue(supabase);
    const { POST } = await import("./route");
    expect(
      await (
        await POST(
          request({ code: "individual-token", event_id: "event-1" }) as any,
        )
      ).json(),
    ).toMatchObject({ result: "expired" });
  });
  it("requires an individual ticket and selected event at confirmation", async () => {
    const { supabase, calls } = createSupabaseMock({});
    (createClient as any).mockReturnValue(supabase);
    const { POST } = await import("./confirm/route");
    const response = await POST(
      request({ code_id: "code-1", event_id: "event-1" }) as any,
    );
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      success: false,
      reason: "individual_qr_required",
    });
    expect(calls).toHaveLength(0);
  });
  it("rejects the QR displayed before a holder change", async () => {
    const { supabase, calls } = createSupabaseMock({
      "tickets.select": [
        { data: { ...ticket, qr_token: "replacement-token" }, error: null },
      ],
    });
    (createClient as any).mockReturnValue(supabase);
    const { POST } = await import("./confirm/route");
    const response = await POST(
      request({
        ticket_id: "ticket-1",
        event_id: "event-1",
        qr_token: "individual-token",
      }) as any,
    );
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      success: false,
      reason: "rescan_required",
    });
    expect(
      calls.filter((call) => call.op === "update" || call.op === "insert"),
    ).toHaveLength(0);
  });
  it.each([
    {
      label: "expired invitation",
      code: { type: "courtesy", expires_at: "2020-01-01T00:00:00Z" },
      unit: null,
      result: "expired",
    },
    {
      label: "cancelled nomination",
      code: { type: "courtesy" },
      unit: { id: "unit-1", status: "cancelled" },
      result: "inactive",
    },
    {
      label: "not issued nomination",
      code: { type: "courtesy" },
      unit: { id: "unit-1", status: "nominated" },
      result: "invalid",
    },
  ])("rechecks $label before confirming", async ({ code, unit, result }) => {
    const { supabase, calls } = createSupabaseMock({
      "tickets.select": [{ data: ticket, error: null }],
      "codes.select": [{ data: { id: "code-1", ...code }, error: null }],
      "events.select": [{ data: event, error: null }],
      "ticket_reservation_units.select": [{ data: unit, error: null }],
      "tickets.update": [{ data: { id: "ticket-1" }, error: null }],
    });
    (createClient as any).mockReturnValue(supabase);
    const { POST } = await import("./confirm/route");
    const response = await POST(
      request({
        ticket_id: "ticket-1",
        event_id: "event-1",
        qr_token: "individual-token",
      }) as any,
    );
    expect(await response.json()).toMatchObject({ success: false, result });
    expect(
      calls.filter((call) => call.op === "update" || call.op === "insert"),
    ).toHaveLength(0);
  });
});
