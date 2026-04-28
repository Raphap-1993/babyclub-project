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
    expect(payload.code_id).toBe("code-1");
    expect(payload.code).toBe("LOVEIS7897");
    expect(payload.registered_person?.ticket_id).toBe("ticket-1");
    expect(payload.registered_person?.document).toBe("72158650");
    expect(payload.registered_person?.first_name).toBe("Gabriela");
  });

  it("si hay duplicados históricos para un código, toma el ticket más reciente como titular visible", async () => {
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
            {
              id: "ticket-reciente",
              event_id: "event-1",
              doc_type: "dni",
              document: "99999999",
              dni: "99999999",
              full_name: "Persona Reciente",
              email: "reciente@example.com",
              phone: "900000001",
              is_active: true,
              person: {
                first_name: "Persona",
                last_name: "Reciente",
                email: "reciente@example.com",
                phone: "900000001",
                doc_type: "dni",
                document: "99999999",
                dni: "99999999",
              },
            },
            {
              id: "ticket-antiguo",
              event_id: "event-1",
              doc_type: "dni",
              document: "11111111",
              dni: "11111111",
              full_name: "Persona Antigua",
              email: "antigua@example.com",
              phone: "900000002",
              is_active: true,
              person: {
                first_name: "Persona",
                last_name: "Antigua",
                email: "antigua@example.com",
                phone: "900000002",
                doc_type: "dni",
                document: "11111111",
                dni: "11111111",
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
      nextUrl: new URL("http://localhost/api/codes/info?code=MULTI1234"),
    } as any;
    const res = await GET(req);
    const payload = await res.json();

    expect(res.status).toBe(200);
    expect(payload.code).toBe("MULTI1234");
    expect(payload.registered_person?.ticket_id).toBe("ticket-reciente");
    expect(payload.registered_person?.document).toBe("99999999");
  });

  it("incluye tickets legacy sin columna is_active para autocompletar datos del titular", async () => {
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
          data: null,
          error: {
            message: "column tickets.is_active does not exist",
            details: "",
          },
        },
        {
          data: [
            {
              id: "ticket-legacy",
              event_id: "event-1",
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

    const ticketsCall = calls.find(
      (call) => call.table === "tickets" && call.op === "select",
    );
    expect(
      ticketsCall?.filters?.some(
        (f) => f.type === "eq" && f.args[0] === "is_active",
      ),
    ).toBe(true);
  });
});
