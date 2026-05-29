import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("shared/auth/requireStaff", () => ({
  requireStaffRole: vi.fn(),
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(),
}));

vi.mock("../../../reservations/utils", () => ({
  createTicketForReservation: vi.fn(),
}));

vi.mock("../../../reservations/email", () => ({
  sendApprovalEmail: vi.fn(),
  sendCancellationEmail: vi.fn(),
}));

const { createClient } = await import("@supabase/supabase-js");
const { requireStaffRole } = await import("shared/auth/requireStaff");
const { createTicketForReservation } = await import("../../../reservations/utils");
const { sendApprovalEmail } = await import("../../../reservations/email");

function createSupabaseMock(responses: Record<string, any>) {
  const defaultResponse = { data: null, error: null };
  const nextResponse = (key: string) => {
    const value = responses[key];
    if (Array.isArray(value)) return value.shift() || defaultResponse;
    return value || defaultResponse;
  };

  const makeChain = (state: any) => {
    const chain: any = {
      _addFilter: (type: string, args: any[]) => {
        state.filters = state.filters || [];
        state.filters.push({ type, args });
        return chain;
      },
      select: () => chain,
      insert: (payload: any) => {
        state.op = "insert";
        state.payload = payload;
        return chain;
      },
      update: (payload: any) => {
        state.op = "update";
        state.payload = payload;
        return chain;
      },
      eq: (...args: any[]) => chain._addFilter("eq", args),
      is: (...args: any[]) => chain._addFilter("is", args),
      in: (...args: any[]) => chain._addFilter("in", args),
      or: (...args: any[]) => chain._addFilter("or", args),
      limit: () => chain,
      order: () => chain,
      maybeSingle: () => Promise.resolve(nextResponse(`${state.table}.${state.op}`)),
      single: () => Promise.resolve(nextResponse(`${state.table}.${state.op}`)),
    };
    chain.then = (resolve: any, reject: any) =>
      Promise.resolve(nextResponse(`${state.table}.${state.op}`)).then(resolve, reject);
    return chain;
  };

  return {
    supabase: {
      from: (table: string) => makeChain({ table, op: "select" }),
    },
  };
}

describe("PATCH /api/admin/reservations/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.SUPABASE_URL = "http://localhost:54321";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-key";
    process.env.RESEND_API_KEY = "test-resend-key";
  });

  it("proxya la aprobación y envía correo para reservas de entrada sin QR emitidos", async () => {
    (requireStaffRole as any).mockResolvedValue({
      ok: true,
      context: { role: "admin", staffId: "staff-1" },
    });

    const { supabase } = createSupabaseMock({
      "table_reservations.select": [
        {
          data: {
            id: "res-ticket-1",
            table_id: null,
            product_id: null,
            full_name: "Ana Perez",
            email: "ana@example.com",
            phone: "999999999",
            doc_type: "dni",
            document: "12345678",
            codes: [],
            ticket_quantity: 2,
            total_ticket_units: 2,
            package_quantity: 1,
            ticket_type_label: "General",
            attendees: [],
            event_id: "event-1",
            promoter_id: null,
            event: {
              id: "event-1",
              name: "Evento Baby",
              starts_at: "2026-06-01T20:00:00Z",
              location: "Club",
            },
            table: null,
          },
          error: null,
        },
      ],
      "ticket_reservation_units.select": [{ data: [], error: null }],
      "ticket_reservation_units.insert": [{ data: null, error: null }],
      "codes.select": [{ data: [], error: null }],
      "table_reservations.update": [{ data: null, error: null }],
    });

    (createClient as any).mockReturnValue(supabase);
    (sendApprovalEmail as any).mockResolvedValue({ data: { id: "email-1" }, error: null });

    const { PATCH } = await import("./route");
    const req = {
      json: async () => ({ status: "approved" }),
      headers: new Headers(),
      url: "http://localhost/api/admin/reservations/res-ticket-1",
    } as any;

    const res = await PATCH(req, { params: Promise.resolve({ id: "res-ticket-1" }) } as any);
    const payload = await res.json();

    expect(res.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.emailSent).toBe(true);
    expect(createTicketForReservation).not.toHaveBeenCalled();
    expect(sendApprovalEmail).toHaveBeenCalledTimes(1);
  });
});
