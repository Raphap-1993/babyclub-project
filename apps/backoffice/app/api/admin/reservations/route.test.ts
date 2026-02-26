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

describe("POST /api/admin/reservations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.SUPABASE_URL = "http://localhost:54321";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-key";
  });

  it("requiere product_id para crear reserva de mesa", async () => {
    (requireStaffRole as any).mockResolvedValue({ ok: true, context: { role: "admin" } });

    const { supabase } = createSupabaseMock({
      "tables.select": [
        {
          data: {
            id: "table-1",
            name: "Mesa 1",
            event_id: "event-1",
            ticket_count: 6,
            is_active: true,
          },
          error: null,
        },
      ],
      "table_products.select": [
        {
          data: [{ id: "prod-1", table_id: "table-1", is_active: true }],
          error: null,
        },
      ],
    });

    (createClient as any).mockReturnValue(supabase);

    const { POST } = await import("./route");
    const req = {
      json: async () => ({
        mode: "new_customer",
        table_id: "table-1",
        event_id: "event-1",
        full_name: "Ana Perez",
        email: "ana@example.com",
        doc_type: "dni",
        document: "12345678",
      }),
    } as any;

    const res = await POST(req);
    const payload = await res.json();

    expect(res.status).toBe(400);
    expect(payload.success).toBe(false);
    expect(String(payload.error || "")).toContain("product_id");
  });

  it("rechaza product_id que no pertenece a la mesa o está inactivo", async () => {
    (requireStaffRole as any).mockResolvedValue({ ok: true, context: { role: "admin" } });

    const { supabase } = createSupabaseMock({
      "tables.select": [
        {
          data: {
            id: "table-1",
            name: "Mesa 1",
            event_id: "event-1",
            ticket_count: 6,
            is_active: true,
          },
          error: null,
        },
      ],
      "table_products.select": [
        {
          data: [{ id: "prod-1", table_id: "table-1", is_active: true }],
          error: null,
        },
      ],
    });

    (createClient as any).mockReturnValue(supabase);

    const { POST } = await import("./route");
    const req = {
      json: async () => ({
        mode: "new_customer",
        table_id: "table-1",
        event_id: "event-1",
        product_id: "prod-x",
        full_name: "Ana Perez",
        email: "ana@example.com",
        doc_type: "dni",
        document: "12345678",
      }),
    } as any;

    const res = await POST(req);
    const payload = await res.json();

    expect(res.status).toBe(400);
    expect(payload.success).toBe(false);
    expect(String(payload.error || "")).toContain("producto");
  });
});
