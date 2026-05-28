import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(),
}));

vi.mock("shared/auth/requireStaff", () => ({
  requireStaffRole: vi.fn(),
}));

const { createClient } = await import("@supabase/supabase-js");
const { requireStaffRole } = await import("shared/auth/requireStaff");

type Response = { data: any; error: any };
type ResponseMap = Record<string, Response | Response[]>;

type QueryCall = {
  table: string;
  op: "select" | "update" | "upsert";
  payload?: any;
  options?: any;
  filters?: { type: string; args: any[] }[];
};

const defaultResponse: Response = { data: null, error: null };

function nextResponse(map: ResponseMap, key: string): Response {
  const value = map[key];
  if (Array.isArray(value)) {
    return (value.shift() as Response) || defaultResponse;
  }
  return (value as Response) || defaultResponse;
}

function createRouteSupabaseMock(responses: ResponseMap) {
  const calls: QueryCall[] = [];

  const makeChain = (state: QueryCall) => {
    const chain: any = {
      _addFilter: (type: string, args: any[]) => {
        state.filters = state.filters || [];
        state.filters.push({ type, args });
        return chain;
      },
      select: () => {
        state.op = "select";
        return chain;
      },
      update: (payload: any) => {
        state.op = "update";
        state.payload = payload;
        return chain;
      },
      upsert: (payload: any, options?: any) => {
        state.op = "upsert";
        state.payload = payload;
        state.options = options;
        return chain;
      },
      eq: (...args: any[]) => chain._addFilter("eq", args),
      in: (...args: any[]) => chain._addFilter("in", args),
      is: (...args: any[]) => chain._addFilter("is", args),
      order: () => chain,
      maybeSingle: () => {
        calls.push({ ...state });
        return Promise.resolve(nextResponse(responses, `${state.table}.${state.op}`));
      },
      single: () => {
        calls.push({ ...state });
        return Promise.resolve(nextResponse(responses, `${state.table}.${state.op}`));
      },
    };

    chain.then = (resolve: any, reject: any) => {
      calls.push({ ...state });
      return Promise.resolve(nextResponse(responses, `${state.table}.${state.op}`)).then(
        resolve,
        reject,
      );
    };

    return chain;
  };

  return {
    supabase: {
      from: (table: string) => makeChain({ table, op: "select" }),
    },
    calls,
  };
}

describe("GET/PUT /api/events/[id]/ticket-types", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    process.env.SUPABASE_URL = "http://localhost:54321";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-key";
    (requireStaffRole as any).mockResolvedValue({
      ok: true,
      context: {
        user: { id: "user-1" },
        staffId: "staff-1",
        role: "admin",
        staff: {},
      },
    });
  });

  it("expone tipos custom con sale_phase null", async () => {
    const { supabase } = createRouteSupabaseMock({
      "events.select": [
        {
          data: {
            id: "event-1",
            name: "Baby Club",
            starts_at: "2099-02-01T04:00:00.000Z",
            early_bird_enabled: true,
            early_bird_price_1: 16,
            early_bird_price_2: 28,
            all_night_price_1: 24,
            all_night_price_2: 40,
          },
          error: null,
        },
      ],
      "event_ticket_types.select": [
        {
          data: [
            {
              id: "type-custom",
              code: "vip_trio",
              label: "VIP Trio",
              description: "Incluye 3 accesos",
              sale_phase: null,
              ticket_quantity: 3,
              price: 90,
              currency_code: "USD",
              is_active: true,
              sort_order: 15,
            },
          ],
          error: null,
        },
      ],
    });

    (createClient as any).mockReturnValue(supabase);
    const { GET } = await import("./route");

    const res = await GET(new Request("http://localhost/api/events/event-1/ticket-types") as any, {
      params: Promise.resolve({ id: "event-1" }),
    });
    const payload = await res.json();

    expect(res.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.ticket_types).toEqual([
      expect.objectContaining({
        code: "vip_trio",
        sale_phase: null,
        ticket_quantity: 3,
        price: 90,
        currency_code: "USD",
      }),
    ]);
  });

  it("mantiene fallback legacy cuando el evento aun no tiene rows persistidas", async () => {
    const { supabase } = createRouteSupabaseMock({
      "events.select": [
        {
          data: {
            id: "event-legacy",
            name: "Legacy Event",
            starts_at: "2099-02-01T04:00:00.000Z",
            early_bird_enabled: false,
            early_bird_price_1: 17,
            early_bird_price_2: 29,
            all_night_price_1: 26,
            all_night_price_2: 41,
          },
          error: null,
        },
      ],
      "event_ticket_types.select": [{ data: [], error: null }],
    });

    (createClient as any).mockReturnValue(supabase);
    const { GET } = await import("./route");

    const res = await GET(new Request("http://localhost/api/events/event-legacy/ticket-types") as any, {
      params: Promise.resolve({ id: "event-legacy" }),
    });
    const payload = await res.json();

    expect(res.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.ticket_types.map((ticketType: any) => ticketType.code)).toEqual([
      "early_bird_1",
      "early_bird_2",
      "all_night_1",
      "all_night_2",
    ]);
    expect(payload.ticket_types[0]).toMatchObject({
      code: "early_bird_1",
      sale_phase: "early_bird",
      price: 17,
      is_active: false,
    });
  });

  it("upserta filas presentes, acepta custom rows y hace soft-delete de removidas", async () => {
    const { supabase, calls } = createRouteSupabaseMock({
      "events.select": [
        {
          data: {
            id: "event-1",
            name: "Baby Club",
            starts_at: "2099-02-01T04:00:00.000Z",
            early_bird_enabled: true,
            early_bird_price_1: 16,
            early_bird_price_2: 25,
            all_night_price_1: 20,
            all_night_price_2: 35,
          },
          error: null,
        },
        {
          data: {
            id: "event-1",
            name: "Baby Club",
            starts_at: "2099-02-01T04:00:00.000Z",
            early_bird_enabled: true,
            early_bird_price_1: 18,
            early_bird_price_2: 25,
            all_night_price_1: 20,
            all_night_price_2: 35,
          },
          error: null,
        },
      ],
      "event_ticket_types.select": [
        {
          data: [
            {
              id: "type-early-1",
              code: "early_bird_1",
              label: "1 QR EARLY BABY",
              description: "Legacy",
              sale_phase: "early_bird",
              ticket_quantity: 1,
              price: 16,
              currency_code: "PEN",
              is_active: true,
              sort_order: 10,
            },
            {
              id: "type-old-custom",
              code: "old_combo",
              label: "Old Combo",
              description: "Debe borrarse",
              sale_phase: null,
              ticket_quantity: 3,
              price: 75,
              currency_code: "PEN",
              is_active: true,
              sort_order: 40,
            },
          ],
          error: null,
        },
        {
          data: [
            {
              id: "type-early-1",
              code: "early_bird_1",
              label: "Early Solo",
              description: "Precio actualizado",
              sale_phase: "early_bird",
              ticket_quantity: 1,
              price: 18,
              currency_code: "PEN",
              is_active: true,
              sort_order: 10,
            },
            {
              id: "type-vip-trio",
              code: "vip_trio",
              label: "VIP Trio",
              description: "Incluye 3 accesos",
              sale_phase: null,
              ticket_quantity: 3,
              price: 99,
              currency_code: "USD",
              is_active: true,
              sort_order: 60,
            },
          ],
          error: null,
        },
      ],
      "event_ticket_types.upsert": [{ data: null, error: null }],
      "event_ticket_types.update": [{ data: null, error: null }],
      "events.update": [{ data: null, error: null }],
    });

    (createClient as any).mockReturnValue(supabase);
    const { PUT } = await import("./route");

    const res = await PUT(
      new Request("http://localhost/api/events/event-1/ticket-types", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticket_types: [
            {
              code: "early_bird_1",
              label: "Early Solo",
              description: "Precio actualizado",
              price: 18,
              is_active: true,
            },
            {
              code: "vip_trio",
              label: "VIP Trio",
              description: "Incluye 3 accesos",
              sale_phase: null,
              ticket_quantity: 3,
              price: 99,
              currency_code: "USD",
              is_active: true,
              sort_order: 60,
            },
          ],
        }),
      }) as any,
      {
        params: Promise.resolve({ id: "event-1" }),
      },
    );
    const payload = await res.json();

    const upsertCall = calls.find(
      (call) => call.table === "event_ticket_types" && call.op === "upsert",
    );
    const deleteCall = calls.find(
      (call) =>
        call.table === "event_ticket_types" &&
        call.op === "update" &&
        call.payload?.deleted_at,
    );
    const eventUpdateCall = calls.find(
      (call) => call.table === "events" && call.op === "update",
    );

    expect(res.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.ticket_types.map((ticketType: any) => ticketType.code)).toEqual([
      "early_bird_1",
      "vip_trio",
    ]);
    expect(upsertCall?.payload).toEqual([
      expect.objectContaining({
        event_id: "event-1",
        code: "early_bird_1",
        sale_phase: "early_bird",
        ticket_quantity: 1,
        price: 18,
        currency_code: "PEN",
        deleted_at: null,
      }),
      expect.objectContaining({
        event_id: "event-1",
        code: "vip_trio",
        sale_phase: null,
        ticket_quantity: 3,
        price: 99,
        currency_code: "USD",
        deleted_at: null,
      }),
    ]);
    expect(deleteCall?.payload).toEqual(
      expect.objectContaining({
        is_active: false,
      }),
    );
    expect(
      deleteCall?.filters?.find(
        (filter) => filter.type === "in" && filter.args[0] === "code",
      )?.args[1],
    ).toEqual(["old_combo"]);
    expect(eventUpdateCall?.payload).toEqual({
      early_bird_enabled: true,
      early_bird_price_1: 18,
      early_bird_price_2: 25,
      all_night_price_1: 20,
      all_night_price_2: 35,
    });
  });
});
