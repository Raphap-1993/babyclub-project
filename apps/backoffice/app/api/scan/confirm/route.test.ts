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

describe("POST /api/scan/confirm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.SUPABASE_URL = "http://localhost:54321";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-key";
  });

  it("confirma ticket válido y marca uso", async () => {
    (requireStaffRole as any).mockResolvedValue({ ok: true, context: { user: { id: "user-1" }, staffId: "staff-1", role: "door", staff: {} } });
    const { supabase } = createSupabaseMock({
      "tickets.select": [
        {
          data: { id: "ticket-1", code_id: "code-1", event_id: "event-1", used: false, used_at: null },
          error: null,
        },
      ],
      "codes.select": [{ data: { id: "code-1", type: "courtesy" }, error: null }],
      "tickets.update": [{ data: null, error: null }],
      "scan_logs.insert": [{ data: null, error: null }],
    });

    (createClient as any).mockReturnValue(supabase);
    const { POST } = await import("./route");

    const req = new Request("http://localhost/api/scan/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ticket_id: "ticket-1" }),
    });

    const res = await POST(req as any);
    const payload = await res.json();

    expect(res.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.result).toBe("confirmed");
    expect(payload.ticket_id).toBe("ticket-1");
  });
});
