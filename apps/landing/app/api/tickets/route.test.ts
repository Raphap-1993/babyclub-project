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
      "events.select": [
        {
          data: {
            id: "event-1",
            is_active: true,
            closed_at: null,
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

  it("rechaza crear ticket si el evento está cerrado", async () => {
    const { supabase } = createSupabaseMock({
      "codes.select": [
        {
          data: {
            id: "code-1",
            code: "CLOSED-123",
            event_id: "event-closed",
            promoter_id: null,
            is_active: true,
            max_uses: 999,
            uses: 0,
            expires_at: null,
          },
          error: null,
        },
      ],
      "events.select": [
        {
          data: {
            id: "event-closed",
            is_active: false,
            closed_at: "2026-02-07T10:00:00Z",
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
        code: "CLOSED-123",
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

    expect(res.status).toBe(400);
    expect(payload.success).toBe(false);
    expect(payload.error).toContain("Evento cerrado");
  });
});
