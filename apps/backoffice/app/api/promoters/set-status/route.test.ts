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

describe("POST /api/promoters/set-status", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env.SUPABASE_URL = "http://localhost:54321";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-key";
    (requireStaffRole as any).mockResolvedValue({
      ok: true,
      context: {
        role: "admin",
        staffId: "staff-1",
      },
    });
  });

  it("marca un promotor como inactivo sin archivarlo", async () => {
    const { supabase, calls } = createSupabaseMock({
      "promoters.update": [{ data: { id: "prom-1", is_active: false }, error: null }],
    });
    (createClient as any).mockReturnValue(supabase);

    const { POST } = await import("./route");
    const req = new Request("http://localhost/api/promoters/set-status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: "prom-1", is_active: false }),
    });

    const res = await POST(req as any);
    const payload = await res.json();

    expect(res.status).toBe(200);
    expect(payload).toMatchObject({ success: true, id: "prom-1", is_active: false });

    const updateCall = calls.find(
      (call) => call.table === "promoters" && call.op === "update",
    );
    expect(updateCall?.payload).toEqual({ is_active: false });
  });

  it("rechaza la petición si falta un booleano explícito de estado", async () => {
    const { supabase } = createSupabaseMock({});
    (createClient as any).mockReturnValue(supabase);

    const { POST } = await import("./route");
    const req = new Request("http://localhost/api/promoters/set-status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: "prom-1" }),
    });

    const res = await POST(req as any);
    const payload = await res.json();

    expect(res.status).toBe(400);
    expect(payload.success).toBe(false);
  });
});
