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

  it("bloquea la reserva manual si la mesa no está habilitada para el evento", async () => {
    (requireStaffRole as any).mockResolvedValue({ ok: true, context: { role: "admin" } });

    const { supabase } = createSupabaseMock({
      "tables.select": [
        {
          data: {
            id: "table-1",
            name: "Mesa 1",
            event_id: null,
            ticket_count: 6,
            is_active: true,
          },
          error: null,
        },
      ],
      "events.select": [{ data: { id: "event-1", name: "Evento", event_prefix: "EVT" }, error: null }],
      "table_products.select": [
        {
          data: [{ id: "prod-1", table_id: "table-1", is_active: true }],
          error: null,
        },
      ],
      "table_availability.select": [
        {
          data: [{ table_id: "table-2", is_available: true }],
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
        product_id: "prod-1",
        full_name: "Ana Perez",
        email: "ana@example.com",
        doc_type: "dni",
        document: "12345678",
        voucher_url: "https://example.com/voucher.png",
      }),
    } as any;

    const res = await POST(req);
    const payload = await res.json();

    expect(res.status).toBe(409);
    expect(payload.success).toBe(false);
    expect(String(payload.error || "")).toContain("no está disponible");
  });

  it("busca dobles reservas dentro del mismo evento", async () => {
    (requireStaffRole as any).mockResolvedValue({ ok: true, context: { role: "admin" } });

    const { supabase, calls } = createSupabaseMock({
      "tables.select": [
        {
          data: {
            id: "table-1",
            name: "Mesa 1",
            event_id: null,
            ticket_count: 6,
            is_active: true,
          },
          error: null,
        },
      ],
      "events.select": [{ data: { id: "event-1", name: "Evento", event_prefix: "EVT" }, error: null }],
      "table_products.select": [
        {
          data: [{ id: "prod-1", table_id: "table-1", is_active: true }],
          error: null,
        },
      ],
      "table_availability.select": [{ data: [], error: null }],
      "table_reservations.select": [{ data: { id: "res-1", status: "approved", event_id: "event-1" }, error: null }],
    });

    (createClient as any).mockReturnValue(supabase);

    const { POST } = await import("./route");
    const req = {
      json: async () => ({
        mode: "new_customer",
        table_id: "table-1",
        event_id: "event-1",
        product_id: "prod-1",
        full_name: "Ana Perez",
        email: "ana@example.com",
        phone: "999999999",
        doc_type: "dni",
        document: "12345678",
        voucher_url: "https://example.com/voucher.png",
      }),
    } as any;

    const res = await POST(req);
    const payload = await res.json();

    expect(res.status).toBe(409);
    expect(payload.success).toBe(false);

    const reservationSelect = calls.find((call) => call.table === "table_reservations" && call.op === "select");
    const eventFilter = reservationSelect?.filters?.find(
      (filter) => filter.type === "eq" && filter.args[0] === "event_id"
    );

    expect(eventFilter?.args[1]).toBe("event-1");
  });
});
