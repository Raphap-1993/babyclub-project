import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSupabaseMock } from "../../../../../tests/utils/supabaseMock";

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(),
}));

const { createClient } = await import("@supabase/supabase-js");

describe("POST /api/tickets", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env.SUPABASE_URL = "http://localhost:54321";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-key";
  });

  it("crea ticket free con código válido", async () => {
    const { supabase } = createSupabaseMock({
      "codes.select": [
        {
          data: {
            id: "code-1",
            code: "FREE-123",
            event_id: "event-1",
            promoter_id: null,
            is_active: true,
            max_uses: 999,
            uses: 0,
            expires_at: null,
          },
          error: null,
        },
      ],
      "persons.select": [{ data: null, error: null }],
      "persons.insert": [{ data: { id: "person-1" }, error: null }],
      "tickets.select": [{ data: null, error: null }],
      "tickets.insert": [{ data: { id: "ticket-1" }, error: null }],
      "codes.update": [{ data: null, error: null }],
    });

    (createClient as any).mockReturnValue(supabase);
    const { POST } = await import("./route");

    const req = new Request("http://localhost/api/tickets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: "FREE-123",
        doc_type: "dni",
        document: "12345678",
        nombre: "Ana",
        apellido_paterno: "Perez",
        apellido_materno: "Lopez",
        email: "ana@example.com",
        telefono: "+51999999999",
        birthdate: "1999-01-01",
      }),
    });

    const res = await POST(req as any);
    const payload = await res.json();

    expect(res.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.ticketId).toBe("ticket-1");
    expect(typeof payload.qr).toBe("string");
  });

  it("bloquea código de mesa si la reserva aún no está aprobada", async () => {
    const { supabase } = createSupabaseMock({
      "codes.select": [
        {
          data: {
            id: "code-table-1",
            code: "LOVEI53396",
            event_id: "event-1",
            promoter_id: null,
            is_active: true,
            max_uses: 1,
            uses: 0,
            expires_at: null,
            table_reservation_id: "res-1",
            type: "table",
          },
          error: null,
        },
      ],
      "table_reservations.select": [
        {
          data: {
            id: "res-1",
            event_id: "event-1",
            table_id: "table-1",
            product_id: "prod-1",
            status: "pending",
          },
          error: null,
        },
      ],
    });

    (createClient as any).mockReturnValue(supabase);
    const { POST } = await import("./route");

    const req = new Request("http://localhost/api/tickets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: "LOVEI53396",
        doc_type: "dni",
        document: "12345678",
        nombre: "Diego",
        apellido_paterno: "Huansi",
        apellido_materno: "Ruiz",
        email: "diego@example.com",
        telefono: "+51940503791",
        birthdate: "1999-01-01",
      }),
    });

    const res = await POST(req as any);
    const payload = await res.json();

    expect(res.status).toBe(400);
    expect(payload.success).toBe(false);
    expect(String(payload.error || "")).toContain("aún no está aprobada");
  });

  it("crea ticket de mesa heredando table_id y product_id de la reserva", async () => {
    const { supabase, calls } = createSupabaseMock({
      "codes.select": [
        {
          data: {
            id: "code-table-2",
            code: "LOVEI1764",
            event_id: "event-1",
            promoter_id: null,
            is_active: true,
            max_uses: 1,
            uses: 0,
            expires_at: null,
            table_reservation_id: "res-2",
            type: "table",
          },
          error: null,
        },
      ],
      "table_reservations.select": [
        {
          data: {
            id: "res-2",
            event_id: "event-1",
            table_id: "table-22",
            product_id: "prod-22",
            status: "approved",
          },
          error: null,
        },
      ],
      "persons.select": [{ data: null, error: null }],
      "persons.insert": [{ data: { id: "person-22" }, error: null }],
      "tickets.select": [{ data: null, error: null }],
      "tickets.insert": [{ data: { id: "ticket-22" }, error: null }],
      "codes.update": [{ data: null, error: null }],
    });

    (createClient as any).mockReturnValue(supabase);
    const { POST } = await import("./route");

    const req = new Request("http://localhost/api/tickets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: "LOVEI1764",
        doc_type: "dni",
        document: "87654321",
        nombre: "Lorena",
        apellido_paterno: "Pelaez",
        apellido_materno: "Bardales",
        email: "lorena@example.com",
        telefono: "+51968284152",
        birthdate: "1998-02-10",
      }),
    });

    const res = await POST(req as any);
    const payload = await res.json();
    const ticketInsertCall = calls.find((call) => call.table === "tickets" && call.op === "insert");

    expect(res.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.ticketId).toBe("ticket-22");
    expect(ticketInsertCall?.payload?.table_id).toBe("table-22");
    expect(ticketInsertCall?.payload?.product_id).toBe("prod-22");
    expect(ticketInsertCall?.payload?.table_reservation_id).toBe("res-2");
  });
});
