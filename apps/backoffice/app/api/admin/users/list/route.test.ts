import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSupabaseMock } from "../../../../../../../tests/utils/supabaseMock";

vi.mock("shared/auth/requireStaff", () => ({
  requireStaffRole: vi.fn(),
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(),
}));

const { createClient } = await import("@supabase/supabase-js");
const { requireStaffRole } = await import("shared/auth/requireStaff");

describe("GET /api/admin/users/list", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.SUPABASE_URL = "http://localhost:54321";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-key";
  });

  it("retorna 401 sin auth", async () => {
    (requireStaffRole as any).mockResolvedValue({ ok: false, status: 401, error: "Auth requerido" });
    const { GET } = await import("./route");
    const req = new Request("http://localhost/api/admin/users/list");
    const res = await GET(req as any);
    const payload = await res.json();
    expect(res.status).toBe(401);
    expect(payload.success).toBe(false);
  });

  it("retorna 403 con rol incorrecto", async () => {
    (requireStaffRole as any).mockResolvedValue({ ok: false, status: 403, error: "Rol sin permisos" });
    const { supabase } = createSupabaseMock({
      "staff.select": [
        {
          data: { id: "staff-1", is_active: true, role: { code: "viewer" } },
          error: null,
        },
      ],
    });
    (createClient as any).mockReturnValue(supabase);

    const { GET } = await import("./route");
    const req = new Request("http://localhost/api/admin/users/list", {
      headers: { Authorization: "Bearer token-123" },
    });
    const res = await GET(req as any);
    const payload = await res.json();
    expect(res.status).toBe(403);
    expect(payload.success).toBe(false);
  });

  it("retorna 200 con rol permitido", async () => {
    (requireStaffRole as any).mockResolvedValue({ ok: true, context: { user: { id: "user-1" }, staffId: "staff-1", role: "admin", staff: {} } });
    const { supabase } = createSupabaseMock({
      "staff.select": [
        {
          data: [
            {
              id: "staff-1",
              is_active: true,
              created_at: "2025-01-01T00:00:00Z",
              auth_user_id: "user-1",
              role: { id: "role-1", code: "admin", name: "Admin" },
              person: { id: "person-1", first_name: "Ana", last_name: "Perez", dni: "12345678", email: "ana@example.com", phone: null },
            },
          ],
          error: null,
        },
      ],
    });
    (createClient as any).mockReturnValue(supabase);

    const { GET } = await import("./route");
    const req = new Request("http://localhost/api/admin/users/list", {
      headers: { Authorization: "Bearer token-123" },
    });
    const res = await GET(req as any);
    const payload = await res.json();
    expect(res.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(Array.isArray(payload.data)).toBe(true);
  });
});
