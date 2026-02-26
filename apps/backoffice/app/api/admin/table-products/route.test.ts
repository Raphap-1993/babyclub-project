import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSupabaseMock } from "../../../../../../tests/utils/supabaseMock";

vi.mock("shared/auth/requireStaff", () => ({
  requireStaffRole: vi.fn(),
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(),
}));

const { createClient } = await import("@supabase/supabase-js");
const { requireStaffRole } = await import("shared/auth/requireStaff");

describe("GET /api/admin/table-products", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.SUPABASE_URL = "http://localhost:54321";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-key";
  });

  it("lista productos activos por mesa", async () => {
    (requireStaffRole as any).mockResolvedValue({ ok: true, context: { role: "admin" } });

    const { supabase, calls } = createSupabaseMock({
      "table_products.select": [
        {
          data: [{ id: "prod-1", table_id: "table-1", name: "Pack 1", is_active: true }],
          error: null,
        },
      ],
    });
    (createClient as any).mockReturnValue(supabase);

    const { GET } = await import("./route");
    const req = { nextUrl: new URL("http://localhost/api/admin/table-products?table_id=table-1") } as any;
    const res = await GET(req);
    const payload = await res.json();

    expect(res.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.products).toHaveLength(1);

    const selectCall = calls.find((call: any) => call.table === "table_products" && call.op === "select");
    const tableFilter = selectCall?.filters?.find((filter: any) => filter.type === "eq" && filter.args[0] === "table_id");
    const activeFilter = selectCall?.filters?.find((filter: any) => filter.type === "eq" && filter.args[0] === "is_active");
    const notDeletedFilter = selectCall?.filters?.find(
      (filter: any) => filter.type === "is" && filter.args[0] === "deleted_at" && filter.args[1] === null
    );

    expect(tableFilter?.args[1]).toBe("table-1");
    expect(activeFilter?.args[1]).toBe(true);
    expect(notDeletedFilter).toBeDefined();
  });

  it("permite incluir productos inactivos cuando include_inactive=1", async () => {
    (requireStaffRole as any).mockResolvedValue({ ok: true, context: { role: "admin" } });

    const { supabase, calls } = createSupabaseMock({
      "table_products.select": [
        {
          data: [
            { id: "prod-1", table_id: "table-1", name: "Pack 1", is_active: true },
            { id: "prod-2", table_id: "table-1", name: "Pack 2", is_active: false },
          ],
          error: null,
        },
      ],
    });
    (createClient as any).mockReturnValue(supabase);

    const { GET } = await import("./route");
    const req = {
      nextUrl: new URL("http://localhost/api/admin/table-products?table_id=table-1&include_inactive=1"),
    } as any;
    const res = await GET(req);
    const payload = await res.json();

    expect(res.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.products).toHaveLength(2);

    const selectCall = calls.find((call: any) => call.table === "table_products" && call.op === "select");
    const activeFilter = selectCall?.filters?.find((filter: any) => filter.type === "eq" && filter.args[0] === "is_active");
    expect(activeFilter).toBeUndefined();
  });
});
