import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSupabaseMock } from "../../../../../../tests/utils/supabaseMock";

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(),
}));
vi.mock("shared/auth/requireStaff", () => ({
  requireStaffRole: vi.fn(),
}));

const { createClient } = await import("@supabase/supabase-js");
const { requireStaffRole } = await import("shared/auth/requireStaff");

describe("POST /api/promoters/create-link", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env.SUPABASE_URL = "http://localhost:54321";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-key";
    (requireStaffRole as any).mockResolvedValue({
      ok: true,
      context: {
        role: "admin",
        staffId: "staff-1",
      },
    });
  });

  it("bloquea crear links nuevos si el promotor está inactivo", async () => {
    const { supabase, calls } = createSupabaseMock({
      "promoters.select": [
        {
          data: {
            id: "prom-1",
            is_active: false,
          },
          error: null,
        },
      ],
      "events.select": [
        {
          data: {
            id: "event-1",
            is_active: true,
          },
          error: null,
        },
      ],
      "codes.select": [{ data: null, error: null }],
      "codes.insert": [{ data: { id: "code-1", code: "PROMO-LINK" }, error: null }],
    });
    (createClient as any).mockReturnValue(supabase);

    const { POST } = await import("./route");
    const req = new Request("http://localhost/api/promoters/create-link", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        promoter_id: "prom-1",
        event_id: "event-1",
        code: "PROMO-LINK",
      }),
    });

    const res = await POST(req as any);
    const payload = await res.json();

    expect(res.status).toBe(409);
    expect(payload.success).toBe(false);
    expect(String(payload.error || "")).toContain("inactivo");
    expect(
      calls.some((call) => call.table === "codes" && call.op === "insert"),
    ).toBe(false);
  });
});
