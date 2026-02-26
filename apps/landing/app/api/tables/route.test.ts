import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSupabaseMock } from "../../../../../tests/utils/supabaseMock";

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(),
}));

const { createClient } = await import("@supabase/supabase-js");

describe("GET /api/tables", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env.SUPABASE_URL = "http://localhost:54321";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-key";
  });

  it("marca mesa reservada para el evento aunque la reserva sea antigua", async () => {
    const { supabase } = createSupabaseMock({
      "tables.select": [
        {
          data: [
            {
              id: "table-1",
              name: "Mesa 1",
              event_id: "event-1",
              organizer_id: "org-1",
              ticket_count: 6,
              min_consumption: 160,
              price: 160,
              products: [],
            },
          ],
          error: null,
        },
      ],
      "table_availability.select": [{ data: [], error: null }],
      "table_reservations.select": [
        {
          data: [
            {
              table_id: "table-1",
              status: "approved",
              event_id: "event-1",
            },
          ],
          error: null,
        },
      ],
    });
    (createClient as any).mockReturnValue(supabase);

    const { GET } = await import("./route");
    const req = { nextUrl: new URL("http://localhost/api/tables?event_id=event-1") };
    const res = await GET(req as any);
    const payload = await res.json();

    expect(res.status).toBe(200);
    expect(payload.tables[0]?.is_reserved).toBe(true);
  });

  it("no marca como reservada una mesa con reservas rechazadas", async () => {
    const { supabase } = createSupabaseMock({
      "tables.select": [
        {
          data: [
            {
              id: "table-1",
              name: "Mesa 1",
              event_id: "event-1",
              organizer_id: "org-1",
              ticket_count: 6,
              min_consumption: 160,
              price: 160,
              products: [],
            },
          ],
          error: null,
        },
      ],
      "table_availability.select": [{ data: [], error: null }],
      "table_reservations.select": [
        {
          data: [
            {
              table_id: "table-1",
              status: "rejected",
              event_id: "event-1",
            },
          ],
          error: null,
        },
      ],
    });
    (createClient as any).mockReturnValue(supabase);

    const { GET } = await import("./route");
    const req = { nextUrl: new URL("http://localhost/api/tables?event_id=event-1") };
    const res = await GET(req as any);
    const payload = await res.json();

    expect(res.status).toBe(200);
    expect(payload.tables[0]?.is_reserved).toBe(false);
  });

  it("retorna 200 con lista vacia si Supabase falla por timeout transitorio", async () => {
    const timeoutHtml = "<!DOCTYPE html><title>error code 522</title><body>Connection timed out</body>";
    const { supabase } = createSupabaseMock({
      "tables.select": [
        { data: null, error: { message: timeoutHtml } },
        { data: null, error: { message: timeoutHtml } },
      ],
    });
    (createClient as any).mockReturnValue(supabase);

    const { GET } = await import("./route");
    const req = { nextUrl: new URL("http://localhost/api/tables") };
    const res = await GET(req as any);
    const payload = await res.json();

    expect(res.status).toBe(200);
    expect(payload.tables).toEqual([]);
    expect(payload.warning).toBe("temporarily_unavailable");
  });
});
