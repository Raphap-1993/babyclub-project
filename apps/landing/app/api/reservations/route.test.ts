import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSupabaseMock } from "../../../../../tests/utils/supabaseMock";

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(),
}));

const { createClient } = await import("@supabase/supabase-js");

describe("POST /api/reservations", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env.SUPABASE_URL = "http://localhost:54321";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-key";
  });

  it("crea reserva de mesa y genera códigos individuales por persona", async () => {
    const { supabase, calls } = createSupabaseMock({
      "tables.select": [
        {
          data: {
            id: "table-1",
            event_id: "event-1",
            ticket_count: 2,
            is_active: true,
            event: { id: "event-1", name: "Evento" },
          },
          error: null,
        },
      ],
      "events.select": [
        {
          data: {
            id: "event-1",
            is_active: true,
            closed_at: null,
            sale_status: "on_sale",
            sale_public_message: null,
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
      "table_reservations.insert": [{ data: { id: "res-1" }, error: null }],
      "codes.insert": [
        {
          data: [{ code: "mesa-ABC123" }, { code: "mesa-ABC124" }],
          error: null,
        },
      ],
      "table_reservations.update": [{ data: null, error: null }],
    });

    (createClient as any).mockReturnValue(supabase);
    const { POST } = await import("./route");

    const req = new Request("http://localhost/api/reservations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        table_id: "table-1",
        doc_type: "dni",
        document: "12345678",
        full_name: "Ana Perez",
        email: "ana@example.com",
        phone: "+51999999999",
        voucher_url: "https://example.com/voucher.png",
        product_id: "prod-1",
        event_id: "event-1",
        code: "PUBLIC",
        promoter_id: "prom-1",
        promoter_link_code_id: "code-link-1",
        promoter_link_code: "PROM01",
      }),
    });

    const res = await POST(req as any);
    const payload = await res.json();

    expect(res.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(typeof payload.friendlyCode).toBe("string");
    expect(payload.friendlyCode.length).toBeGreaterThan(0);
    expect(Array.isArray(payload.codes)).toBe(true);
    expect(payload.codes.length).toBe(2);

    const reservationInsert = calls.find(
      (call) => call.table === "table_reservations" && call.op === "insert",
    );
    expect(reservationInsert?.payload).toMatchObject({
      promoter_id: "prom-1",
      promoter_link_code_id: "code-link-1",
      promoter_link_code: "PROM01",
    });

    const codesInsert = calls.find(
      (call) => call.table === "codes" && call.op === "insert",
    );
    expect(codesInsert?.payload).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          promoter_id: "prom-1",
          table_reservation_id: "res-1",
        }),
      ]),
    );
  });

  it("bloquea una nueva solicitud cuando la mesa ya tiene reserva aprobada", async () => {
    const { supabase } = createSupabaseMock({
      "tables.select": [
        {
          data: {
            id: "table-1",
            event_id: "event-1",
            ticket_count: 6,
            is_active: true,
            event: { id: "event-1", name: "Evento" },
          },
          error: null,
        },
      ],
      "events.select": [
        {
          data: {
            id: "event-1",
            is_active: true,
            closed_at: null,
            sale_status: "on_sale",
            sale_public_message: null,
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
      "table_reservations.select": [
        {
          data: { id: "res-active", status: "approved" },
          error: null,
        },
      ],
    });

    (createClient as any).mockReturnValue(supabase);
    const { POST } = await import("./route");

    const req = new Request("http://localhost/api/reservations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        table_id: "table-1",
        doc_type: "dni",
        document: "12345678",
        full_name: "Ana Perez",
        email: "ana@example.com",
        phone: "+51999999999",
        voucher_url: "https://example.com/voucher.png",
        product_id: "prod-1",
        event_id: "event-1",
      }),
    });

    const res = await POST(req as any);
    const payload = await res.json();

    expect(res.status).toBe(409);
    expect(payload.success).toBe(false);
  });

  it("requiere product_id activo para reservar mesa", async () => {
    const { supabase } = createSupabaseMock({
      "tables.select": [
        {
          data: {
            id: "table-1",
            event_id: "event-1",
            ticket_count: 6,
            is_active: true,
            event: { id: "event-1", name: "Evento" },
          },
          error: null,
        },
      ],
      "events.select": [
        {
          data: {
            id: "event-1",
            is_active: true,
            closed_at: null,
            sale_status: "on_sale",
            sale_public_message: null,
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

    const req = new Request("http://localhost/api/reservations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        table_id: "table-1",
        doc_type: "dni",
        document: "12345678",
        full_name: "Ana Perez",
        email: "ana@example.com",
        phone: "+51999999999",
        voucher_url: "https://example.com/voucher.png",
        event_id: "event-1",
      }),
    });

    const res = await POST(req as any);
    const payload = await res.json();

    expect(res.status).toBe(400);
    expect(payload.success).toBe(false);
    expect(String(payload.error || "")).toContain("product_id");
  });

  it("bloquea la reserva si el evento usa disponibilidad y la mesa no está habilitada", async () => {
    const { supabase } = createSupabaseMock({
      "tables.select": [
        {
          data: {
            id: "table-1",
            event_id: null,
            ticket_count: 6,
            is_active: true,
            event: { id: "event-1", name: "Evento" },
          },
          error: null,
        },
      ],
      "events.select": [
        {
          data: {
            id: "event-1",
            is_active: true,
            closed_at: null,
            sale_status: "on_sale",
            sale_public_message: null,
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
      "table_reservations.select": [{ data: null, error: null }],
      "table_availability.select": [
        {
          data: [{ table_id: "table-2", is_available: true }],
          error: null,
        },
      ],
    });

    (createClient as any).mockReturnValue(supabase);
    const { POST } = await import("./route");

    const req = new Request("http://localhost/api/reservations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        table_id: "table-1",
        doc_type: "dni",
        document: "12345678",
        full_name: "Ana Perez",
        email: "ana@example.com",
        phone: "+51999999999",
        voucher_url: "https://example.com/voucher.png",
        product_id: "prod-1",
        event_id: "event-1",
      }),
    });

    const res = await POST(req as any);
    const payload = await res.json();

    expect(res.status).toBe(409);
    expect(payload.success).toBe(false);
    expect(String(payload.error || "")).toContain("no está disponible");
  });

  it("bloquea reserva cuando el evento está sold out", async () => {
    const { supabase } = createSupabaseMock({
      "tables.select": [
        {
          data: {
            id: "table-1",
            event_id: "event-1",
            ticket_count: 2,
            is_active: true,
            event: { id: "event-1", name: "Evento" },
          },
          error: null,
        },
      ],
      "events.select": [
        {
          data: {
            id: "event-1",
            is_active: true,
            closed_at: null,
            sale_status: "sold_out",
            sale_public_message: "Agotado",
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

    const req = new Request("http://localhost/api/reservations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        table_id: "table-1",
        doc_type: "dni",
        document: "12345678",
        full_name: "Ana Perez",
        email: "ana@example.com",
        phone: "+51999999999",
        voucher_url: "https://example.com/voucher.png",
        product_id: "prod-1",
        event_id: "event-1",
      }),
    });

    const res = await POST(req as any);
    const payload = await res.json();

    expect(res.status).toBe(409);
    expect(payload.success).toBe(false);
    expect(payload.code).toBe("sales_blocked");
    expect(payload.sale_status).toBe("sold_out");
  });
});
