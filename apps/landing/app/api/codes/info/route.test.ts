import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSupabaseMock } from "../../../../../../tests/utils/supabaseMock";

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(),
}));

const { createClient } = await import("@supabase/supabase-js");

describe("GET /api/codes/info", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env.SUPABASE_URL = "http://localhost:54321";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-key";
  });

  it("retorna registered_person cuando el código tiene un único ticket activo", async () => {
    const { supabase } = createSupabaseMock({
      "codes.select": [
        {
          data: {
            id: "code-1",
            code: "LOVEIS7897",
            type: "table",
            promoter_id: null,
            event_id: "event-1",
            is_active: true,
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
            sale_status: "sold_out",
            sale_public_message: "Entradas agotadas",
          },
          error: null,
        },
      ],
      "tickets.select": [
        {
          data: [
            {
              id: "ticket-1",
              event_id: "event-1",
              status: "active",
              doc_type: "dni",
              document: "72158650",
              dni: "72158650",
              full_name: "Gabriela Noelia Pablo Perez",
              email: "gabriela.pablo.p@gmail.com",
              phone: "932532541",
              person: {
                first_name: "Gabriela",
                last_name: "Noelia Pablo Perez",
                email: "gabriela.pablo.p@gmail.com",
                phone: "932532541",
                doc_type: "dni",
                document: "72158650",
                dni: "72158650",
              },
            },
          ],
          error: null,
        },
      ],
    });

    (createClient as any).mockReturnValue(supabase);
    const { GET } = await import("./route");

    const req = {
      nextUrl: new URL("http://localhost/api/codes/info?code=LOVEIS7897"),
    } as any;
    const res = await GET(req);
    const payload = await res.json();

    expect(res.status).toBe(200);
    expect(payload.code).toBe("LOVEIS7897");
    expect(payload.registered_person?.ticket_id).toBe("ticket-1");
    expect(payload.registered_person?.document).toBe("72158650");
    expect(payload.registered_person?.first_name).toBe("Gabriela");
  });

  it("no retorna registered_person cuando hay más de un ticket activo para el mismo código", async () => {
    const { supabase } = createSupabaseMock({
      "codes.select": [
        {
          data: {
            id: "code-2",
            code: "MULTI1234",
            type: "general",
            promoter_id: null,
            event_id: "event-1",
            is_active: true,
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
            sale_status: "on_sale",
            sale_public_message: null,
          },
          error: null,
        },
      ],
      "tickets.select": [
        {
          data: [
            { id: "ticket-a", event_id: "event-1", status: "active" },
            { id: "ticket-b", event_id: "event-1", status: "active" },
          ],
          error: null,
        },
      ],
    });

    (createClient as any).mockReturnValue(supabase);
    const { GET } = await import("./route");

    const req = {
      nextUrl: new URL("http://localhost/api/codes/info?code=MULTI1234"),
    } as any;
    const res = await GET(req);
    const payload = await res.json();

    expect(res.status).toBe(200);
    expect(payload.code).toBe("MULTI1234");
    expect(payload.registered_person).toBeNull();
  });

  it("incluye tickets legacy con status null para autocompletar datos del titular", async () => {
    const { supabase, calls } = createSupabaseMock({
      "codes.select": [
        {
          data: {
            id: "code-legacy",
            code: "LEGACY001",
            type: "table",
            promoter_id: null,
            event_id: "event-1",
            is_active: true,
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
            sale_status: "sold_out",
            sale_public_message: "Entradas agotadas",
          },
          error: null,
        },
      ],
      "tickets.select": [
        {
          data: [
            {
              id: "ticket-legacy",
              event_id: "event-1",
              status: null,
              doc_type: "dni",
              document: "12345678",
              dni: "12345678",
              full_name: "Ana Perez",
              email: "ana@example.com",
              phone: "999888777",
              person: {
                first_name: "Ana",
                last_name: "Perez",
                email: "ana@example.com",
                phone: "999888777",
                doc_type: "dni",
                document: "12345678",
                dni: "12345678",
              },
            },
          ],
          error: null,
        },
      ],
    });

    (createClient as any).mockReturnValue(supabase);
    const { GET } = await import("./route");

    const req = {
      nextUrl: new URL("http://localhost/api/codes/info?code=LEGACY001"),
    } as any;
    const res = await GET(req);
    const payload = await res.json();

    expect(res.status).toBe(200);
    expect(payload.registered_person?.ticket_id).toBe("ticket-legacy");
    expect(payload.registered_person?.document).toBe("12345678");

    const ticketsCall = calls.find((call) => call.table === "tickets" && call.op === "select");
    expect(ticketsCall?.filters?.some((f) => f.type === "or")).toBe(true);
  });
});
