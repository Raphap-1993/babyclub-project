import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSupabaseMock } from "../../../../../../../tests/utils/supabaseMock";

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(),
}));
vi.mock("shared/auth/requireStaff", () => ({
  requireStaffRole: vi.fn(),
}));

const { createClient } = await import("@supabase/supabase-js");
const { requireStaffRole } = await import("shared/auth/requireStaff");

describe("POST /api/codes/batches/close-due", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env.SUPABASE_URL = "http://localhost:54321";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role";
    (requireStaffRole as any).mockResolvedValue({
      ok: true,
      context: {
        role: "admin",
        staffId: "staff-1",
      },
    });
  });

  it("cierra los lotes vencidos o sin cupos usando la rpc central", async () => {
    const { supabase, calls } = createSupabaseMock({
      "close_due_code_batches.rpc": [
        {
          data: [
            {
              batch_id: "batch-1",
              closed_reason: "quota",
              closed_codes: 4,
            },
          ],
          error: null,
        },
      ],
    });
    (createClient as any).mockReturnValue(supabase);

    const { POST } = await import("./route");
    const res = await POST(new Request("http://localhost/api/codes/batches/close-due", { method: "POST" }) as any);
    const payload = await res.json();

    expect(res.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.closed_batches).toBe(1);
    expect(payload.batches[0]).toMatchObject({
      batch_id: "batch-1",
      closed_reason: "quota",
    });
    expect(
      calls.find((call) => call.table === "close_due_code_batches" && call.op === "rpc"),
    ).toBeTruthy();
  });
});
