import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSupabaseMock } from "../../../../../../tests/utils/supabaseMock";

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(),
}));
vi.mock("shared/auth/requireStaff", () => ({
  requireStaffRole: vi.fn(),
}));
vi.mock("../utils", () => ({
  createTicketForReservation: vi.fn(),
}));
vi.mock("../email", () => ({
  sendApprovalEmail: vi.fn(),
  sendCancellationEmail: vi.fn(),
}));

const { createClient } = await import("@supabase/supabase-js");
const { requireStaffRole } = await import("shared/auth/requireStaff");
const { createTicketForReservation } = await import("../utils");
const { sendApprovalEmail } = await import("../email");

function createRouteSupabaseMock() {
  const calls: Array<{
    table: string;
    op: "select" | "update" | "insert";
    payload?: any;
  }> = [];

  const chainFor = (table: string) => {
    const chain: any = {
      select: () => {
        calls.push({ table, op: "select" });
        return chain;
      },
      insert: (payload: any) => {
        calls.push({ table, op: "insert", payload });
        return chain;
      },
      update: (payload: any) => {
        calls.push({ table, op: "update", payload });
        return chain;
      },
      eq: () => chain,
      maybeSingle: () =>
        Promise.resolve({
          data: {
            id: "res-ticket-1",
            sale_origin: "ticket",
            table_id: null,
            product_id: null,
            full_name: "Comprador Principal",
            email: "buyer@test.com",
            phone: "999999999",
            doc_type: "dni",
            document: "11112222",
            codes: [],
            ticket_quantity: 2,
            attendees: [],
            event_id: "event-1",
            promoter_id: null,
            event: {
              id: "event-1",
              name: "Baby Club",
              starts_at: "2099-02-01T04:00:00.000Z",
              location: "Lima",
            },
            table: null,
          },
          error: null,
        }),
      then: (resolve: any) => resolve({ data: null, error: null }),
    };
    return chain;
  };

  return {
    supabase: {
      from: (table: string) => chainFor(table),
    },
    calls,
  };
}

describe("POST /api/reservations/update", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env.SUPABASE_URL = "http://localhost:54321";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-key";
    delete process.env.RESEND_API_KEY;
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

  it("aprueba ticket-only y envía correo de nominación aunque aún no haya QR emitidos", async () => {
    const { supabase, calls } = createRouteSupabaseMock();
    (createClient as any).mockReturnValue(supabase);
    (sendApprovalEmail as any).mockResolvedValue(undefined);

    const { POST } = await import("./route");
    const res = await POST(
      new Request("http://localhost/api/reservations/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: "res-ticket-1", status: "approved" }),
      }) as any,
    );
    const payload = await res.json();

    expect(res.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(createTicketForReservation).not.toHaveBeenCalled();
    expect(sendApprovalEmail).toHaveBeenCalledTimes(1);
    expect(
      calls.some(
        (call) =>
          call.table === "ticket_reservation_units" && call.op === "insert",
      ),
    ).toBe(true);

    expect((sendApprovalEmail as any).mock.calls[0][0]).toMatchObject({
      callToAction: {
        label: "Asignar asistentes",
        url: "https://babyclubaccess.com/compra/reserva/res-ticket-1",
      },
    });

    const reservationUpdate = calls.find(
      (call) => call.table === "table_reservations" && call.op === "update",
    );
    expect(reservationUpdate?.payload).toMatchObject({
      status: "approved",
    });
  });

  it("aprueba una reserva de mesa usando la cantidad snapshot y no el ticket_count actual de la mesa", async () => {
    process.env.RESEND_API_KEY = "test-resend-key";
    const { supabase } = createSupabaseMock({
      "table_reservations.select": [
        {
          data: {
            id: "res-table-1",
            sale_origin: "table",
            table_id: "table-1",
            product_id: "product-1",
            full_name: "Mesa Snapshot",
            email: "mesa@test.com",
            phone: "999999999",
            doc_type: "dni",
            document: "12345678",
            codes: Array.from({ length: 10 }, (_, index) => `CODE-${index + 1}`),
            ticket_quantity: 10,
            total_ticket_units: 10,
            attendees: [],
            event_id: "event-1",
            promoter_id: null,
            event: {
              id: "event-1",
              name: "Baby Club",
              starts_at: "2099-02-01T04:00:00.000Z",
              location: "Lima",
            },
            table: {
              id: "table-1",
              name: "Mesa 5",
              event_id: "event-1",
              ticket_count: 12,
              event: {
                id: "event-1",
                name: "Baby Club",
                starts_at: "2099-02-01T04:00:00.000Z",
                location: "Lima",
              },
            },
          },
          error: null,
        },
      ],
      "codes.select": [
        {
          data: Array.from({ length: 10 }, (_, index) => ({
            code: `CODE-${index + 1}`,
            is_active: true,
          })),
          error: null,
        },
      ],
      "table_reservations.update": [
        { data: null, error: null },
      ],
    });
    (createClient as any).mockReturnValue(supabase);
    (createTicketForReservation as any).mockImplementation(
      async (_supabase: any, input: any) => ({
        ticketId: `ticket-${input.reuseCodes?.[0] || "new"}`,
        code: input.reuseCodes?.[0] || "NEW-CODE",
      }),
    );
    (sendApprovalEmail as any).mockResolvedValue(undefined);

    const { POST } = await import("./route");
    const res = await POST(
      new Request("http://localhost/api/reservations/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: "res-table-1", status: "approved" }),
      }) as any,
    );
    const payload = await res.json();

    expect(res.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(createTicketForReservation).toHaveBeenCalledTimes(10);
    expect(sendApprovalEmail).toHaveBeenCalledTimes(1);
    expect((sendApprovalEmail as any).mock.calls[0][0].callToAction).toBeNull();
  });
});
