import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSupabaseMock } from "../../../../../../tests/utils/supabaseMock";

vi.mock("shared/auth/requireStaff", () => ({
  requireStaffRole: vi.fn(),
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(),
}));

const { createClient } = await import("@supabase/supabase-js");
const { requireStaffRole } = await import("shared/auth/requireStaff");

describe("POST /api/admin/promoter-settlements", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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

  it("crea cabecera e items de liquidacion flexible", async () => {
    const { supabase, calls } = createSupabaseMock({
      "promoter_settlement_items.select": [{ data: [], error: null }],
      "promoter_settlements.insert": [
        {
          data: {
            id: "settlement-1",
            event_id: "event-1",
            promoter_id: "prom-1",
            status: "paid",
            cash_total_cents: 650,
          },
          error: null,
        },
      ],
      "promoter_settlement_items.insert": [{ data: null, error: null }],
    });
    (createClient as any).mockReturnValue(supabase);
    const { POST } = await import("./route");

    const req = new Request("http://localhost/api/admin/promoter-settlements", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event_id: "event-1",
        promoter_id: "prom-1",
        event_name: "LOVE IS A DRUG",
        promoter_name: "Luis Perez",
        status: "paid",
        cash_total_cents: 650,
        items: [
          {
            source_type: "reservation",
            source_id: "res-ticket",
            access_kind: "paid_ticket",
            cash_amount_cents: 500,
          },
          {
            source_type: "ticket",
            source_id: "ticket-free",
            access_kind: "promoter_link",
            cash_amount_cents: 150,
          },
        ],
      }),
    }) as any;
    const res = await POST(req);
    const payload = await res.json();

    expect(res.status).toBe(201);
    expect(payload.success).toBe(true);
    expect(payload.settlement.id).toBe("settlement-1");

    const settlementInsert = calls.find(
      (call) => call.table === "promoter_settlements" && call.op === "insert",
    );
    expect(settlementInsert?.payload).toMatchObject({
      event_id: "event-1",
      promoter_id: "prom-1",
      status: "paid",
      cash_total_cents: 650,
      created_by_staff_id: "staff-1",
      settled_by_staff_id: "staff-1",
    });

    const itemsInsert = calls.find(
      (call) =>
        call.table === "promoter_settlement_items" && call.op === "insert",
    );
    expect(itemsInsert?.payload).toHaveLength(2);
    expect(itemsInsert?.payload[0]).toMatchObject({
      settlement_id: "settlement-1",
      source_type: "reservation",
      source_id: "res-ticket",
      event_id: "event-1",
      promoter_id: "prom-1",
      cash_amount_cents: 500,
    });
  });

  it("bloquea doble liquidacion por ticket o reserva", async () => {
    const { supabase, calls } = createSupabaseMock({
      "promoter_settlement_items.select": [
        {
          data: [{ source_type: "ticket", source_id: "ticket-free" }],
          error: null,
        },
      ],
    });
    (createClient as any).mockReturnValue(supabase);
    const { POST } = await import("./route");

    const req = new Request("http://localhost/api/admin/promoter-settlements", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event_id: "event-1",
        promoter_id: "prom-1",
        items: [
          {
            source_type: "ticket",
            source_id: "ticket-free",
            cash_amount_cents: 150,
          },
        ],
      }),
    }) as any;
    const res = await POST(req);
    const payload = await res.json();

    expect(res.status).toBe(409);
    expect(payload.success).toBe(false);
    expect(payload.duplicates).toHaveLength(1);
    expect(
      calls.some(
        (call) => call.table === "promoter_settlements" && call.op === "insert",
      ),
    ).toBe(false);
  });

  it("permite consultar liquidaciones anuladas con filtro status=void", async () => {
    const { supabase, calls } = createSupabaseMock({
      "promoter_settlements.select": [
        {
          data: [
            {
              id: "settlement-void",
              status: "void",
              cash_total_cents: 0,
            },
          ],
          error: null,
        },
      ],
    });
    (createClient as any).mockReturnValue(supabase);
    const { GET } = await import("./route");

    const res = await GET({
      nextUrl: new URL(
        "http://localhost/api/admin/promoter-settlements?status=void",
      ),
    } as any);
    const payload = await res.json();

    expect(res.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.settlements).toHaveLength(1);

    const selectCall = calls.find(
      (call) => call.table === "promoter_settlements" && call.op === "select",
    );
    expect(selectCall?.filters).toContainEqual({
      type: "eq",
      args: ["status", "void"],
    });
    expect(
      selectCall?.filters?.some(
        (filter) =>
          filter.type === "is" &&
          filter.args[0] === "deleted_at" &&
          filter.args[1] === null,
      ),
    ).toBe(false);
  });
});
