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

describe("POST /api/tickets/delete", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.SUPABASE_URL = "http://localhost:54321";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-key";
  });

  it("retorna 401 sin auth", async () => {
    (requireStaffRole as any).mockResolvedValue({ ok: false, status: 401, error: "Auth requerido" });
    const { POST } = await import("./route");
    const req = new Request("http://localhost/api/tickets/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: "ticket-1" }),
    });
    const res = await POST(req as any);
    expect(res.status).toBe(401);
  });

  it("archiva en lugar de borrar", async () => {
    (requireStaffRole as any).mockResolvedValue({
      ok: true,
      context: { user: { id: "user-1" }, staffId: "staff-1", role: "admin", staff: {} },
    });

    const { supabase, calls } = createSupabaseMock({
      "tickets.select": [{ data: { id: "ticket-1", email: "a@b.com", phone: null }, error: null }],
      "tickets.update": [{ data: null, error: null }],
      "table_reservations.update": [{ data: null, error: null }],
    });

    (createClient as any).mockReturnValue(supabase);

    const { POST } = await import("./route");
    const req = new Request("http://localhost/api/tickets/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: "ticket-1" }),
    });

    const res = await POST(req as any);
    const payload = await res.json();

    const ticketUpdate = calls.find((c) => c.table === "tickets" && c.op === "update");
    const ticketDelete = calls.find((c) => c.table === "tickets" && c.op === "delete");

    expect(res.status).toBe(200);
    expect(payload.archived).toBe(true);
    expect(ticketUpdate).toBeTruthy();
    expect(ticketDelete).toBeFalsy();
    expect(ticketUpdate?.payload?.is_active).toBe(false);
    expect(ticketUpdate?.payload?.deleted_at).toBeTruthy();
  });
});
