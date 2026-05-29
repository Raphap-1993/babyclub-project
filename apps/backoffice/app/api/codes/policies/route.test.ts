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

describe("GET /api/codes/policies", () => {
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

  it("devuelve las politicas registradas", async () => {
    const { supabase } = createSupabaseMock({
      "code_type_policies.select": [
        {
          data: [
            {
              code_type: "promoter",
              requires_expiration: true,
              updated_by_staff_id: "staff-1",
              updated_at: "2026-05-28T18:00:00.000Z",
            },
          ],
          error: null,
        },
      ],
    });
    (createClient as any).mockReturnValue(supabase);

    const { GET } = await import("./route");
    const res = await GET(
      new Request("http://localhost/api/codes/policies") as any,
    );
    const payload = await res.json();

    expect(res.status).toBe(200);
    expect(payload).toMatchObject({
      success: true,
      policies: [
        {
          code_type: "promoter",
          requires_expiration: true,
        },
      ],
    });
  });
});

describe("PUT /api/codes/policies", () => {
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

  it("upserts las politicas y adjunta metadata de auditoria", async () => {
    const { supabase, calls } = createSupabaseMock({
      "code_type_policies.upsert": [
        {
          data: [
            {
              code_type: "courtesy",
              requires_expiration: true,
              updated_by_staff_id: "staff-1",
              updated_at: "2026-05-28T18:00:00.000Z",
            },
          ],
          error: null,
        },
      ],
      "code_type_policies.select": [
        {
          data: [
            {
              code_type: "courtesy",
              requires_expiration: true,
              updated_by_staff_id: "staff-1",
              updated_at: "2026-05-28T18:00:00.000Z",
            },
          ],
          error: null,
        },
      ],
    });
    (createClient as any).mockReturnValue(supabase);

    const { PUT } = await import("./route");
    const req = new Request("http://localhost/api/codes/policies", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        policies: [{ code_type: "courtesy", requires_expiration: true }],
      }),
    });

    const res = await PUT(req as any);
    const payload = await res.json();

    expect(res.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.policies[0]).toMatchObject({
      code_type: "courtesy",
      requires_expiration: true,
    });

    const upsertCall = calls.find(
      (call) => call.table === "code_type_policies" && call.op === "upsert",
    );
    expect(upsertCall?.payload).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code_type: "courtesy",
          requires_expiration: true,
          updated_by_staff_id: "staff-1",
          updated_at: expect.any(String),
        }),
      ]),
    );
  });
});
