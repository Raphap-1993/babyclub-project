import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetRateLimitStore } from "shared/security/rateLimit";
import { createSupabaseMock } from "../../../../../../tests/utils/supabaseMock";

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(),
}));

const { createClient } = await import("@supabase/supabase-js");

describe("GET /api/codes/info", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    resetRateLimitStore();
    process.env.SUPABASE_URL = "http://localhost:54321";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-key";
  });

  afterEach(() => {
    resetRateLimitStore();
    delete process.env.RATE_LIMIT_CODES_INFO_PER_MIN;
  });

  it("retorna solo metadata mínima cuando el código legacy ya tiene un ticket activo", async () => {
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
              qr_token: "qr-1",
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
      headers: new Headers({ "x-forwarded-for": "1.1.1.1" }),
    } as any;
    const res = await GET(req);
    const payload = await res.json();

    expect(res.status).toBe(200);
    expect(payload.code_id).toBe("code-1");
    expect(payload.code).toBe("LOVEIS7897");
    expect(payload.registered_person?.ticket_id).toBe("ticket-1");
    expect(payload.registered_person?.ticket_event_id).toBe("event-1");
    expect(payload.registered_person?.document).toBeUndefined();
    expect(payload.registered_person?.first_name).toBeUndefined();
    expect(payload.registered_person?.email).toBeUndefined();
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
              is_active: true,
            },
            {
              id: "ticket-antiguo",
              event_id: "event-1",
              is_active: true,
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
      headers: new Headers({ "x-forwarded-for": "2.2.2.2" }),
    } as any;
    const res = await GET(req);
    const payload = await res.json();

    expect(res.status).toBe(200);
    expect(payload.code).toBe("MULTI1234");
    expect(payload.registered_person?.ticket_id).toBe("ticket-reciente");
    expect(payload.registered_person?.ticket_event_id).toBe("event-1");
    expect(payload.registered_person?.document).toBeUndefined();
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
      headers: new Headers({ "x-forwarded-for": "3.3.3.3" }),
    } as any;
    const res = await GET(req);
    const payload = await res.json();

    expect(res.status).toBe(200);
    expect(payload.registered_person?.ticket_id).toBe("ticket-legacy");
    expect(payload.registered_person?.ticket_event_id).toBe("event-1");
    expect(payload.registered_person?.document).toBeUndefined();

    const ticketsCall = calls.find(
      (call) => call.table === "tickets" && call.op === "select",
    );
    expect(
      ticketsCall?.filters?.some(
        (f) => f.type === "eq" && f.args[0] === "is_active",
      ),
    ).toBe(true);
  });

  it("bloquea códigos free mientras el release flag no esté habilitado", async () => {
    delete process.env.ENABLE_FREE_QR_CODES;

    const { supabase } = createSupabaseMock({
      "codes.select": [
        {
          data: {
            id: "code-free-1",
            code: "FREE-LOCKED",
            type: "free",
            promoter_id: null,
            event_id: "event-1",
            is_active: true,
            expires_at: null,
          },
          error: null,
        },
      ],
    });

    (createClient as any).mockReturnValue(supabase);
    const { GET } = await import("./route");

    const req = {
      nextUrl: new URL("http://localhost/api/codes/info?code=FREE-LOCKED"),
      headers: new Headers({ "x-forwarded-for": "4.4.4.4" }),
    } as any;
    const res = await GET(req);
    const payload = await res.json();

    expect(res.status).toBe(409);
    expect(payload.code).toBe("free_qr_disabled");
  });

  it("retorna el ticket emitido de la unidad de reserva vinculada al código", async () => {
    const { supabase, calls } = createSupabaseMock({
      "codes.select": [
        {
          data: {
            id: "code-unit-1",
            code: "TABLE-UNIT-1",
            type: "table",
            promoter_id: null,
            event_id: "event-unit-1",
            is_active: true,
            expires_at: null,
            table_reservation_id: "reservation-1",
            person_index: 2,
          },
          error: null,
        },
      ],
      "events.select": [
        {
          data: {
            id: "event-unit-1",
            is_active: true,
            closed_at: null,
            sale_status: "sold_out",
            sale_public_message: "Entradas agotadas",
          },
          error: null,
        },
      ],
      "ticket_reservation_units.select": [
        {
          data: {
            id: "unit-2",
            reservation_id: "reservation-1",
            unit_index: 2,
            status: "issued",
            ticket_id: "ticket-unit-2",
          },
          error: null,
        },
      ],
      "tickets.select": [
        {
          data: {
            id: "ticket-unit-2",
            event_id: "event-unit-1",
          },
          error: null,
        },
      ],
    });

    (createClient as any).mockReturnValue(supabase);
    const { GET } = await import("./route");

    const req = {
      nextUrl: new URL("http://localhost/api/codes/info?code=TABLE-UNIT-1"),
      headers: new Headers({ "x-forwarded-for": "8.8.8.8" }),
    } as any;
    const res = await GET(req);
    const payload = await res.json();

    expect(res.status).toBe(200);
    expect(payload.registered_person).toEqual({
      ticket_id: "ticket-unit-2",
      ticket_event_id: "event-unit-1",
    });
    expect(
      calls.find(
        (call) =>
          call.table === "ticket_reservation_units" && call.op === "select",
      )?.filters,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "eq",
          args: ["reservation_id", "reservation-1"],
        }),
        expect.objectContaining({
          type: "eq",
          args: ["unit_index", 2],
        }),
      ]),
    );
  });

  it("retorna 429 al exceder el rate limit público", async () => {
    process.env.RATE_LIMIT_CODES_INFO_PER_MIN = "1";

    const { supabase } = createSupabaseMock({
      "codes.select": [
        {
          data: {
            id: "code-rate-limit",
            code: "LIMIT-1",
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
      "tickets.select": [{ data: [], error: null }],
    });

    (createClient as any).mockReturnValue(supabase);
    const { GET } = await import("./route");

    const req = {
      nextUrl: new URL("http://localhost/api/codes/info?code=LIMIT-1"),
      headers: new Headers({ "x-forwarded-for": "7.7.7.7" }),
    } as any;

    const first = await GET(req);
    expect(first.status).toBe(200);

    const second = await GET(req);
    const payload = await second.json();
    expect(second.status).toBe(429);
    expect(payload.error).toBe("rate_limited");
  });
});
