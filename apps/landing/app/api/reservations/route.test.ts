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

  it("crea reserva de mesa y genera códigos de cortesía", async () => {
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
      "events.select": [{ data: { id: "event-1", is_active: true }, error: null }],
      "codes.select": [{ data: { event_id: "event-1", is_active: true }, error: null }],
      "table_reservations.insert": [{ data: { id: "res-1" }, error: null }],
      "codes.insert": [{ data: [{ code: "mesa-ABC123" }], error: null }],
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
        product_id: null,
        event_id: "event-1",
        code: "PUBLIC",
      }),
    });

    const res = await POST(req as any);
    const payload = await res.json();

    expect(res.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.reservationId).toBe("res-1");
    expect(Array.isArray(payload.codes)).toBe(true);
    expect(payload.codes.length).toBe(1);
  });

  it("rechaza la reserva cuando no se puede resolver event_id", async () => {
    const { supabase } = createSupabaseMock({
      "tables.select": [
        {
          data: {
            id: "table-1",
            event_id: null,
            ticket_count: 2,
            is_active: true,
            event: null,
          },
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
        voucher_url: "https://example.com/voucher.png",
      }),
    });

    const res = await POST(req as any);
    const payload = await res.json();

    expect(res.status).toBe(400);
    expect(payload.success).toBe(false);
    expect(payload.error).toContain("No se pudo resolver el evento");
  });

  it("rechaza la reserva cuando mesa y evento seleccionado no coinciden", async () => {
    const { supabase } = createSupabaseMock({
      "tables.select": [
        {
          data: {
            id: "table-1",
            event_id: "event-1",
            ticket_count: 2,
            is_active: true,
            event: { id: "event-1", name: "Evento 1" },
          },
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
        event_id: "event-2",
        doc_type: "dni",
        document: "12345678",
        full_name: "Ana Perez",
        voucher_url: "https://example.com/voucher.png",
      }),
    });

    const res = await POST(req as any);
    const payload = await res.json();

    expect(res.status).toBe(400);
    expect(payload.success).toBe(false);
    expect(payload.error).toContain("Conflicto de evento");
  });
});
