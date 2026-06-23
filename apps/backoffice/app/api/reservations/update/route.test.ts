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
  createReservationCodes: vi.fn(),
}));
vi.mock("../email", () => ({
  sendApprovalEmail: vi.fn(),
  sendCancellationEmail: vi.fn(),
}));

const { createClient } = await import("@supabase/supabase-js");
const { requireStaffRole } = await import("shared/auth/requireStaff");
const { createTicketForReservation, createReservationCodes } = await import("../utils");
const { sendApprovalEmail } = await import("../email");

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
    const { supabase, calls } = createSupabaseMock({
      "table_reservations.select": [
        {
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
        },
      ],
      "ticket_reservation_units.select": [
        { data: [], error: null },
        {
          data: [
            {
              id: "unit-1",
              reservation_id: "res-ticket-1",
              event_id: "event-1",
              package_index: 1,
              person_index: 1,
              unit_index: 1,
              status: "pending_nomination",
              full_name: "Comprador Principal",
              doc_type: "dni",
              document: "11112222",
              email: "buyer@test.com",
              phone: "999999999",
              ticket_id: null,
            },
          ],
          error: null,
        },
        {
          data: [
            {
              id: "unit-1",
              reservation_id: "res-ticket-1",
              event_id: "event-1",
              package_index: 1,
              person_index: 1,
              unit_index: 1,
              status: "issued",
              full_name: "Comprador Principal",
              doc_type: "dni",
              document: "11112222",
              email: "buyer@test.com",
              phone: "999999999",
              ticket_id: "ticket-1",
            },
          ],
          error: null,
        },
      ],
      "ticket_reservation_units.insert": [{ data: [{ id: "unit-1" }], error: null }],
      "ticket_reservation_units.update": [{ data: null, error: null }],
      "table_reservations.update": [{ data: null, error: null }],
    });
    (createClient as any).mockReturnValue(supabase);
    (createTicketForReservation as any).mockResolvedValue({
      ticketId: "ticket-1",
      code: "BUYER-CODE",
    });
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
    expect(createTicketForReservation).toHaveBeenCalledTimes(1);
    expect(sendApprovalEmail).toHaveBeenCalledTimes(1);
    expect(
      calls.some(
        (call) =>
          call.table === "ticket_reservation_units" &&
          (call.op === "insert" || call.op === "update"),
      ),
    ).toBe(true);

    expect((sendApprovalEmail as any).mock.calls[0][0]).toMatchObject({
      ticketIds: ["ticket-1"],
      callToAction: {
        label: "Completar asistentes",
        url: "https://babyclubaccess.com/compra?reservationId=res-ticket-1",
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
            codes: Array.from(
              { length: 10 },
              (_, index) => `CODE-${index + 1}`,
            ),
            ticket_quantity: 10,
            total_ticket_units: 10,
            attendees: Array.from({ length: 10 }, (_, index) => ({
              full_name: `Invitado ${index + 1}`,
              doc_type: "dni",
              document: `700000${String(index).padStart(2, "0")}`,
              email: `guest${index + 1}@test.com`,
              phone: `9000000${index}`,
            })),
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

  it("aprueba una reserva de mesa sin asistentes nominados sin duplicar la identidad del comprador", async () => {
    process.env.RESEND_API_KEY = "test-resend-key";
    const { supabase } = createSupabaseMock({
      "table_reservations.select": [
        {
          data: {
            id: "res-table-dup-1",
            sale_origin: "table",
            table_id: "table-dup-1",
            product_id: "product-dup-1",
            full_name: "Mesa Duplicada",
            email: "mesa-dup@test.com",
            phone: "999999999",
            doc_type: "dni",
            document: "12345678",
            codes: [],
            ticket_quantity: 2,
            total_ticket_units: 2,
            attendees: [],
            event_id: "event-dup-1",
            promoter_id: null,
            event: {
              id: "event-dup-1",
              name: "Baby Club",
              starts_at: "2099-02-01T04:00:00.000Z",
              location: "Lima",
            },
            table: {
              id: "table-dup-1",
              name: "Mesa Duplicada",
              event_id: "event-dup-1",
              ticket_count: 2,
              event: {
                id: "event-dup-1",
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
          data: [
            
          ],
          error: null,
        },
      ],
      "table_reservations.update": [{ data: null, error: null }],
    });
    (createClient as any).mockReturnValue(supabase);
    (createReservationCodes as any).mockResolvedValue({
      codes: ["CODE-1", "CODE-2"],
      codeIds: ["code-1", "code-2"],
    });
    (sendApprovalEmail as any).mockResolvedValue(undefined);

    const { POST } = await import("./route");
    const res = await POST(
      new Request("http://localhost/api/reservations/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: "res-table-dup-1", status: "approved" }),
      }) as any,
    );
    const payload = await res.json();

    expect(res.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(createTicketForReservation).not.toHaveBeenCalled();
    expect(createReservationCodes).toHaveBeenCalledTimes(1);
    expect(sendApprovalEmail).toHaveBeenCalledTimes(1);
    expect((sendApprovalEmail as any).mock.calls[0][0]).toMatchObject({
      codes: ["CODE-1", "CODE-2"],
      ticketIds: [],
      callToAction: null,
    });
  });

  it("rechaza una aprobación de mesa si repite la misma identidad en asistentes nominados", async () => {
    process.env.RESEND_API_KEY = "test-resend-key";
    const { supabase } = createSupabaseMock({
      "table_reservations.select": [
        {
          data: {
            id: "res-table-dup-2",
            sale_origin: "table",
            table_id: "table-dup-1",
            product_id: "product-dup-1",
            full_name: "Mesa Duplicada",
            email: "mesa-dup@test.com",
            phone: "999999999",
            doc_type: "dni",
            document: "12345678",
            codes: ["CODE-1", "CODE-2"],
            ticket_quantity: 2,
            total_ticket_units: 2,
            attendees: [
              {
                full_name: "Invitado Duplicado",
                doc_type: "dni",
                document: "70000001",
                email: "uno@test.com",
                phone: "900000001",
              },
              {
                full_name: "Invitado Duplicado",
                doc_type: "dni",
                document: "70000001",
                email: "dos@test.com",
                phone: "900000002",
              },
            ],
            event_id: "event-dup-1",
            promoter_id: null,
            event: {
              id: "event-dup-1",
              name: "Baby Club",
              starts_at: "2099-02-01T04:00:00.000Z",
              location: "Lima",
            },
            table: {
              id: "table-dup-1",
              name: "Mesa Duplicada",
              event_id: "event-dup-1",
              ticket_count: 2,
              event: {
                id: "event-dup-1",
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
          data: [
            { code: "CODE-1", is_active: true },
            { code: "CODE-2", is_active: true },
          ],
          error: null,
        },
      ],
    });
    (createClient as any).mockReturnValue(supabase);

    const { POST } = await import("./route");
    const res = await POST(
      new Request("http://localhost/api/reservations/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: "res-table-dup-2", status: "approved" }),
      }) as any,
    );
    const payload = await res.json();

    expect(res.status).toBe(409);
    expect(payload.success).toBe(false);
    expect(String(payload.error || "")).toContain("misma persona");
    expect(createTicketForReservation).not.toHaveBeenCalled();
  });
});
