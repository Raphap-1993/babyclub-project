import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSupabaseMock } from "../../../../../../tests/utils/supabaseMock";

const createClientMock = vi.hoisted(() => vi.fn());
const requireStaffRoleMock = vi.hoisted(() => vi.fn());

vi.mock("@supabase/supabase-js", () => ({
  createClient: createClientMock,
}));

vi.mock("shared/auth/requireStaff", () => ({
  requireStaffRole: requireStaffRoleMock,
}));

describe("POST /api/tables/delete", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    process.env.SUPABASE_URL = "http://localhost:54321";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-key";
  });

  it("archiva la mesa y sus disponibilidades relacionadas", async () => {
    requireStaffRoleMock.mockResolvedValue({
      ok: true,
      context: { user: { id: "user-1" }, staffId: "staff-1", role: "admin", staff: {} },
    });

    const { supabase, calls } = createSupabaseMock({
      "tables.update": [{ data: { id: "table-1" }, error: null }],
      "table_availability.update": [{ data: null, error: null }],
    });

    createClientMock.mockReturnValue(supabase);

    const { POST } = await import("./route");
    const req = new Request("http://localhost/api/tables/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: "table-1" }),
    });

    const res = await POST(req as any);
    const payload = await res.json();

    const tableUpdate = calls.find((call) => call.table === "tables" && call.op === "update");
    const availabilityUpdate = calls.find(
      (call) => call.table === "table_availability" && call.op === "update"
    );

    expect(res.status).toBe(200);
    expect(payload).toEqual({ success: true, archived: true });
    expect(tableUpdate?.selectClause).toBe("id");
    expect(tableUpdate?.payload?.is_active).toBe(false);
    expect(tableUpdate?.payload?.deleted_by).toBe("staff-1");
    expect(tableUpdate?.payload?.deleted_at).toEqual(expect.any(String));
    expect(
      tableUpdate?.filters?.some(
        (filter) =>
          filter.type === "eq" && filter.args[0] === "id" && filter.args[1] === "table-1"
      )
    ).toBe(true);
    expect(
      tableUpdate?.filters?.some(
        (filter) =>
          filter.type === "is" && filter.args[0] === "deleted_at" && filter.args[1] === null
      )
    ).toBe(true);

    expect(availabilityUpdate?.payload?.is_available).toBe(false);
    expect(availabilityUpdate?.payload?.deleted_at).toEqual(expect.any(String));
    expect(availabilityUpdate?.payload?.updated_at).toEqual(expect.any(String));
    expect(
      availabilityUpdate?.filters?.some(
        (filter) =>
          filter.type === "eq" && filter.args[0] === "table_id" && filter.args[1] === "table-1"
      )
    ).toBe(true);
    expect(
      availabilityUpdate?.filters?.some(
        (filter) =>
          filter.type === "is" && filter.args[0] === "deleted_at" && filter.args[1] === null
      )
    ).toBe(true);
  });

  it("retorna 404 cuando la mesa no existe o ya fue archivada", async () => {
    requireStaffRoleMock.mockResolvedValue({
      ok: true,
      context: { user: { id: "user-1" }, staffId: "staff-1", role: "admin", staff: {} },
    });

    const { supabase, calls } = createSupabaseMock({
      "tables.update": [{ data: null, error: null }],
    });

    createClientMock.mockReturnValue(supabase);

    const { POST } = await import("./route");
    const req = new Request("http://localhost/api/tables/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: "missing-table" }),
    });

    const res = await POST(req as any);
    const payload = await res.json();

    expect(res.status).toBe(404);
    expect(payload).toEqual({
      success: false,
      error: "Mesa no encontrada o ya archivada",
    });
    expect(calls.some((call) => call.table === "table_availability" && call.op === "update")).toBe(
      false
    );
  });
});
