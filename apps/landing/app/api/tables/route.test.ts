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
      "events.select": [
        {
          data: {
            organizer_id: "org-1",
          },
          error: null,
        },
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
      "events.select": [
        {
          data: {
            organizer_id: "org-1",
          },
          error: null,
        },
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

  it("mantiene visibles todas las mesas del organizador aunque solo una tenga override para el evento", async () => {
    const { supabase } = createSupabaseMock({
      "tables.select": [
        {
          data: [
            {
              id: "table-1",
              name: "Mesa 1",
              event_id: null,
              organizer_id: "org-1",
              ticket_count: 6,
              min_consumption: 160,
              price: 160,
              products: [],
            },
            {
              id: "table-2",
              name: "Mesa 2",
              event_id: null,
              organizer_id: "org-1",
              ticket_count: 8,
              min_consumption: 240,
              price: 240,
              products: [],
            },
          ],
          error: null,
        },
      ],
      "events.select": [
        {
          data: {
            organizer_id: "org-1",
          },
          error: null,
        },
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
      "table_availability.select": [
        {
          data: [
            {
              table_id: "table-1",
              is_available: true,
              custom_price: 180,
              custom_min_consumption: 180,
            },
          ],
          error: null,
        },
      ],
      "table_reservations.select": [{ data: [], error: null }],
    });
    (createClient as any).mockReturnValue(supabase);

    const { GET } = await import("./route");
    const req = {
      nextUrl: new URL("http://localhost/api/tables?event_id=event-1"),
    };
    const res = await GET(req as any);
    const payload = await res.json();

    expect(res.status).toBe(200);
    expect(payload.tables).toHaveLength(2);
    expect(payload.tables.map((table: any) => table.id)).toEqual([
      "table-1",
      "table-2",
    ]);
    expect(payload.tables[0]).toMatchObject({
      id: "table-1",
      price: 180,
      min_consumption: 180,
    });
    expect(payload.tables[1]).toMatchObject({
      id: "table-2",
      price: 240,
      min_consumption: 240,
    });
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
