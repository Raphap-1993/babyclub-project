import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSupabaseMock } from "../../../../../../../../tests/utils/supabaseMock";

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(),
}));
vi.mock("shared/auth/requireStaff", () => ({
  requireStaffRole: vi.fn(),
}));
vi.mock("../../../../reservations/utils", () => ({
  createTicketForReservation: vi.fn(),
}));
vi.mock("../../../../reservations/email", () => ({
  sendApprovalEmail: vi.fn(),
  sendTicketEmail: vi.fn(),
}));

const { createClient } = await import("@supabase/supabase-js");
const { requireStaffRole } = await import("shared/auth/requireStaff");
const { createTicketForReservation } = await import(
  "../../../../reservations/utils"
);
const { sendApprovalEmail, sendTicketEmail } = await import(
  "../../../../reservations/email"
);

describe("POST /api/admin/reservations/[id]/resend", () => {
  beforeEach(() => {
    vi.resetModules();
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

  it("reenvía ticket-only por unidades emitidas sin crear faltantes", async () => {
    const { supabase } = createSupabaseMock({
      "table_reservations.select": [
        {
          data: {
            id: "res-ticket-1",
            sale_origin: "ticket",
            table_id: null,
            product_id: null,
            full_name: "Compra Ticket",
            email: "buyer@test.com",
            phone: "999999999",
            doc_type: "dni",
            document: "12345678",
            status: "approved",
            codes: ["legacy-code"],
            ticket_quantity: 2,
            attendees: [
              {
                full_name: "Legacy Person",
                doc_type: "dni",
                document: "11112222",
              },
            ],
            event_id: "event-1",
            promoter_id: null,
            table: null,
          },
          error: null,
        },
      ],
      "ticket_reservation_units.select": [
        {
          data: [
            {
              id: "unit-1",
              status: "issued",
              ticket_id: "ticket-1",
              email: "unit1@test.com",
            },
            {
              id: "unit-2",
              status: "issued",
              ticket_id: "ticket-2",
              email: null,
            },
            {
              id: "unit-3",
              status: "pending_nomination",
              ticket_id: null,
              email: "pending@test.com",
            },
          ],
          error: null,
        },
      ],
    });
    (createClient as any).mockReturnValue(supabase);
    (sendTicketEmail as any).mockResolvedValue(undefined);

    const { POST } = await import("./route");
    const req = new Request(
      "http://localhost/api/admin/reservations/res-ticket-1/resend",
      { method: "POST" },
    );

    const res = await POST(req as any, {
      params: Promise.resolve({ id: "res-ticket-1" }),
    });
    const payload = await res.json();

    expect(res.status).toBe(200);
    expect(payload).toMatchObject({
      success: true,
      sentCount: 2,
      skippedCount: 1,
    });
    expect(createTicketForReservation).not.toHaveBeenCalled();
    expect(sendApprovalEmail).not.toHaveBeenCalled();
    expect(sendTicketEmail).toHaveBeenNthCalledWith(1, {
      supabase,
      ticketId: "ticket-1",
      toEmail: "unit1@test.com",
    });
    expect(sendTicketEmail).toHaveBeenNthCalledWith(2, {
      supabase,
      ticketId: "ticket-2",
      toEmail: "buyer@test.com",
    });
  });

  it("retorna error claro si ticket-only no tiene unidades emitidas", async () => {
    const { supabase } = createSupabaseMock({
      "table_reservations.select": [
        {
          data: {
            id: "res-ticket-1",
            sale_origin: "ticket",
            table_id: null,
            product_id: null,
            full_name: "Compra Ticket",
            email: "buyer@test.com",
            phone: "999999999",
            doc_type: "dni",
            document: "12345678",
            status: "approved",
            codes: [],
            ticket_quantity: 2,
            attendees: [],
            event_id: "event-1",
            promoter_id: null,
            table: null,
          },
          error: null,
        },
      ],
      "ticket_reservation_units.select": [
        {
          data: [
            {
              id: "unit-1",
              status: "pending_nomination",
              ticket_id: null,
              email: "pending@test.com",
            },
          ],
          error: null,
        },
      ],
    });
    (createClient as any).mockReturnValue(supabase);

    const { POST } = await import("./route");
    const req = new Request(
      "http://localhost/api/admin/reservations/res-ticket-1/resend",
      { method: "POST" },
    );

    const res = await POST(req as any, {
      params: Promise.resolve({ id: "res-ticket-1" }),
    });
    const payload = await res.json();

    expect(res.status).toBe(400);
    expect(payload.success).toBe(false);
    expect(String(payload.error || "")).toContain("emitidas");
    expect(createTicketForReservation).not.toHaveBeenCalled();
    expect(sendTicketEmail).not.toHaveBeenCalled();
  });

  it("rechaza ticket-only si no hay ningún correo válido para reenviar", async () => {
    const { supabase } = createSupabaseMock({
      "table_reservations.select": [
        {
          data: {
            id: "res-ticket-1",
            sale_origin: "ticket",
            table_id: null,
            product_id: null,
            full_name: "Compra Ticket",
            email: "buyer@test",
            phone: "999999999",
            doc_type: "dni",
            document: "12345678",
            status: "approved",
            codes: [],
            ticket_quantity: 2,
            attendees: [],
            event_id: "event-1",
            promoter_id: null,
            table: null,
          },
          error: null,
        },
      ],
      "ticket_reservation_units.select": [
        {
          data: [
            {
              id: "unit-1",
              status: "issued",
              ticket_id: "ticket-1",
              email: null,
            },
          ],
          error: null,
        },
      ],
    });
    (createClient as any).mockReturnValue(supabase);

    const { POST } = await import("./route");
    const req = new Request(
      "http://localhost/api/admin/reservations/res-ticket-1/resend",
      { method: "POST" },
    );

    const res = await POST(req as any, {
      params: Promise.resolve({ id: "res-ticket-1" }),
    });
    const payload = await res.json();

    expect(res.status).toBe(400);
    expect(payload.success).toBe(false);
    expect(String(payload.error || "")).toContain("correos válidos");
    expect(sendTicketEmail).not.toHaveBeenCalled();
  });

  it("reenvía reserva de mesa respetando la cantidad snapshot de la reserva y no el ticket_count actual", async () => {
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
            status: "approved",
            codes: Array.from({ length: 10 }, (_, index) => `CODE-${index + 1}`),
            ticket_quantity: 10,
            total_ticket_units: 10,
            attendees: [],
            event_id: "event-1",
            promoter_id: null,
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
            id: `code-${index + 1}`,
            code: `CODE-${index + 1}`,
          })),
          error: null,
        },
        {
          data: Array.from({ length: 10 }, (_, index) => ({
            id: `code-${index + 1}`,
            code: `CODE-${index + 1}`,
          })),
          error: null,
        },
      ],
      "tickets.select": [
        { data: [], error: null },
        { data: [], error: null },
      ],
      "table_reservations.update": [{ data: null, error: null }],
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
    const req = new Request(
      "http://localhost/api/admin/reservations/res-table-1/resend",
      { method: "POST" },
    );

    const res = await POST(req as any, {
      params: Promise.resolve({ id: "res-table-1" }),
    });
    const payload = await res.json();

    expect(res.status).toBe(200);
    expect(payload).toMatchObject({
      success: true,
      ticketsCreated: 10,
      codesCount: 10,
    });
    expect(createTicketForReservation).toHaveBeenCalledTimes(10);
    expect(sendApprovalEmail).toHaveBeenCalledTimes(1);
  });
});
