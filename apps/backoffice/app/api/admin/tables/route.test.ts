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

describe("GET /api/admin/tables", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.SUPABASE_URL = "http://localhost:54321";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-key";
  });

  it("retorna 400 cuando falta event_id", async () => {
    (requireStaffRole as any).mockResolvedValue({ ok: true, context: { role: "admin" } });
    const { GET } = await import("./route");

    const req = { nextUrl: new URL("http://localhost/api/admin/tables") } as any;
    const res = await GET(req);
    const payload = await res.json();

    expect(res.status).toBe(400);
    expect(payload.success).toBe(false);
  });

  it("filtra reservas por estados activos para definir mesas disponibles", async () => {
    (requireStaffRole as any).mockResolvedValue({ ok: true, context: { role: "admin" } });

    const { supabase, calls } = createSupabaseMock({
      "events.select": [{ data: { organizer_id: "org-1" }, error: null }],
      "table_availability.select": [
        {
          data: [
            { table_id: "table-1", is_available: true },
            { table_id: "table-2", is_available: true },
            { table_id: "table-3", is_available: false },
          ],
          error: null,
        },
      ],
      "tables.select": [
        {
          data: [
            { id: "table-1", name: "Mesa 1", ticket_count: 6, event_id: null, is_active: true },
            { id: "table-2", name: "Mesa 2", ticket_count: 6, event_id: null, is_active: true },
            { id: "table-3", name: "Mesa 3", ticket_count: 6, event_id: null, is_active: true },
          ],
          error: null,
        },
      ],
      "table_reservations.select": [{ data: [{ table_id: "table-1" }], error: null }],
    });

    (createClient as any).mockReturnValue(supabase);

    const { GET } = await import("./route");
    const req = { nextUrl: new URL("http://localhost/api/admin/tables?event_id=event-1") } as any;
    const res = await GET(req);
    const payload = await res.json();

    expect(res.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.tables).toHaveLength(1);
    expect(payload.tables[0].id).toBe("table-2");

    const reservationCall = calls.find((call) => call.table === "table_reservations" && call.op === "select");
    const statusFilter = reservationCall?.filters?.find(
      (filter) => filter.type === "in" && filter.args[0] === "status"
    );
    const tableCall = calls.find((call) => call.table === "tables" && call.op === "select");
    const activeFilter = tableCall?.filters?.find(
      (filter) => filter.type === "eq" && filter.args[0] === "is_active"
    );

    expect(statusFilter).toBeDefined();
    expect(statusFilter?.args[1]).toEqual(["pending", "approved", "confirmed", "paid"]);
    expect(activeFilter?.args[1]).toBe(true);
  });
});
