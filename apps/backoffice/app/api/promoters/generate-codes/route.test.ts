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

describe("POST /api/promoters/generate-codes", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env.SUPABASE_URL = "http://localhost:54321";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-key";
    process.env.SUPABASE_ANON_KEY = "test-anon-key";
    (requireStaffRole as any).mockResolvedValue({
      ok: true,
      context: {
        role: "admin",
        staffId: "staff-1",
      },
    });
  });

  it("bloquea generar códigos si el promotor está inactivo", async () => {
    const { supabase: serviceSupabase } = createSupabaseMock({
      "promoters.select": [
        {
          data: {
            id: "prom-1",
            code: "PROMO-1",
            is_active: false,
            person: { first_name: "Luz", last_name: "Perez" },
          },
          error: null,
        },
      ],
      "events.select": [
        {
          data: {
            id: "event-1",
            name: "Baby Friday",
            event_prefix: "BF",
            is_active: true,
          },
          error: null,
        },
      ],
    });
    const rpcSupabase = {
      rpc: vi.fn().mockResolvedValue({
        data: [{ batch_id: "batch-1", generated_code: "bf-prom-01" }],
        error: null,
      }),
    };
    (createClient as any)
      .mockReturnValueOnce(serviceSupabase)
      .mockReturnValueOnce(rpcSupabase);

    const { POST } = await import("./route");
    const req = new Request("http://localhost/api/promoters/generate-codes", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer token",
      },
      body: JSON.stringify({
        promoter_id: "prom-1",
        event_id: "event-1",
        quantity: 10,
        max_uses: 1,
      }),
    });

    const res = await POST(req as any);
    const payload = await res.json();

    expect(res.status).toBe(409);
    expect(payload.success).toBe(false);
    expect(String(payload.error || "")).toContain("inactivo");
    expect(rpcSupabase.rpc).not.toHaveBeenCalled();
  });
});
