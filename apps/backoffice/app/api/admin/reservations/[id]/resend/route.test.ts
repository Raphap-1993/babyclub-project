import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSupabaseMock } from "../../../../../../../../tests/utils/supabaseMock";

vi.mock("shared/auth/requireStaff", () => ({
  requireStaffRole: vi.fn(),
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(),
}));

vi.mock("../../../../reservations/email", () => ({
  sendApprovalEmail: vi.fn(),
  sendTicketEmail: vi.fn(),
}));

vi.mock("../../../../reservations/utils", () => ({
  createTicketForReservation: vi.fn(),
}));

vi.mock("shared/ticketReservationUnits", () => ({
  buildReservationUnits: vi.fn(() => [
    {
      reservation_id: "res-1",
      event_id: "event-1",
      package_index: 1,
      person_index: 1,
      unit_index: 1,
      status: "pending_nomination",
    },
  ]),
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
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-key";
    process.env.NEXT_PUBLIC_APP_URL = "https://babyclubaccess.com";
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

  it("reenvia confirmación para ticket-only aunque todavía no haya QR emitidos", async () => {
    const { supabase } = createSupabaseMock({
      "table_reservations.select": [
        {
          data: {
            id: "res-1",
            full_name: "Ana Pérez",
            email: "ana@example.com",
            phone: "+51999999999",
            doc_type: "dni",
            document: "12345678",
            sale_origin: "ticket",
            status: "approved",
            codes: [],
            ticket_quantity: 2,
            total_ticket_units: 2,
            event_id: "event-1",
            promoter_id: null,
            table: null,
            attendees: [],
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
              reservation_id: "res-1",
              event_id: "event-1",
              package_index: 1,
              person_index: 1,
              unit_index: 1,
              status: "pending_nomination",
              full_name: "Ana Pérez",
              doc_type: "dni",
              document: "12345678",
              email: "ana@example.com",
              phone: "+51999999999",
              ticket_id: null,
            },
          ],
          error: null,
        },
        {
          data: [
            {
              id: "unit-1",
              reservation_id: "res-1",
              event_id: "event-1",
              package_index: 1,
              person_index: 1,
              unit_index: 1,
              status: "issued",
              full_name: "Ana Pérez",
              doc_type: "dni",
              document: "12345678",
              email: "ana@example.com",
              phone: "+51999999999",
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
      new Request("http://localhost/api/admin/reservations/res-1/resend", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer token-123",
        },
      }) as any,
      { params: Promise.resolve({ id: "res-1" }) } as any,
    );
    const payload = await res.json();

    expect(res.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.unitsPrepared).toBe(true);
    expect(createTicketForReservation).toHaveBeenCalledTimes(1);
    expect(sendApprovalEmail).toHaveBeenCalledTimes(1);
    expect((sendApprovalEmail as any).mock.calls[0][0]).toMatchObject({
      id: "res-1",
      email: "ana@example.com",
      resourceLabel: "Entrada",
      ticketIds: ["ticket-1"],
      callToAction: {
        label: "Completar asistentes",
        url: "https://babyclubaccess.com/compra?reservationId=res-1",
      },
    });
    expect(sendTicketEmail).toHaveBeenCalledTimes(1);
  });
});
