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

describe("POST /api/promoters/create", () => {
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

  it("reactiva un promotor archivado para la misma persona y organizer", async () => {
    const { supabase, calls } = createSupabaseMock({
      "persons.upsert": [{ data: { id: "person-1" }, error: null }],
      "organizers.select": [{ data: { id: "org-1" }, error: null }],
      "promoters.select": [
        {
          data: {
            id: "prom-archived-1",
            deleted_at: "2026-05-01T10:00:00.000Z",
            is_active: false,
          },
          error: null,
        },
      ],
      "promoters.update": [{ data: { id: "prom-archived-1" }, error: null }],
    });
    (createClient as any).mockReturnValue(supabase);

    const { POST } = await import("./route");
    const req = new Request("http://localhost/api/promoters/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        first_name: "Ana",
        last_name: "Torres",
        dni: "12345678",
        email: "ana@test.com",
        phone: "999999999",
        code: "ANA",
        instagram: "@ana",
        tiktok: "@ana",
        notes: "reactivar",
        is_active: true,
      }),
    });

    const res = await POST(req as any);
    const payload = await res.json();

    expect(res.status).toBe(200);
    expect(payload).toMatchObject({ success: true, id: "prom-archived-1" });

    const updateCall = calls.find(
      (call) => call.table === "promoters" && call.op === "update",
    );
    expect(updateCall?.payload).toMatchObject({
      code: "ANA",
      instagram: "@ana",
      tiktok: "@ana",
      notes: "reactivar",
      is_active: true,
      organizer_id: "org-1",
      deleted_at: null,
      deleted_by: null,
    });
    expect(
      calls.some((call) => call.table === "promoters" && call.op === "insert"),
    ).toBe(false);
  });

  it("rechaza crear un duplicado si el promotor ya está activo", async () => {
    const { supabase, calls } = createSupabaseMock({
      "persons.upsert": [{ data: { id: "person-1" }, error: null }],
      "organizers.select": [{ data: { id: "org-1" }, error: null }],
      "promoters.select": [
        {
          data: {
            id: "prom-active-1",
            deleted_at: null,
            is_active: true,
          },
          error: null,
        },
      ],
    });
    (createClient as any).mockReturnValue(supabase);

    const { POST } = await import("./route");
    const req = new Request("http://localhost/api/promoters/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        first_name: "Ana",
        last_name: "Torres",
        dni: "12345678",
      }),
    });

    const res = await POST(req as any);
    const payload = await res.json();

    expect(res.status).toBe(409);
    expect(payload.success).toBe(false);
    expect(String(payload.error || "")).toContain("ya existe");
    expect(
      calls.some((call) => call.table === "promoters" && call.op === "insert"),
    ).toBe(false);
    expect(
      calls.some((call) => call.table === "promoters" && call.op === "update"),
    ).toBe(false);
  });
});
