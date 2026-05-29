import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSupabaseMock } from "../../../../../../tests/utils/supabaseMock";

vi.mock("shared/auth/requireStaff", () => ({
  requireStaffRole: vi.fn(),
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(),
}));

vi.mock("../email", () => ({
  sendApprovalEmail: vi.fn(),
  sendTicketEmail: vi.fn(),
}));

vi.mock("../utils", () => ({
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
const { sendApprovalEmail, sendTicketEmail } = await import("../email");

describe("POST /api/reservations/resend", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env.SUPABASE_URL = "http://localhost:54321";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-key";
    process.env.RESEND_API_KEY = "resend-key";
    process.env.NEXT_PUBLIC_APP_URL = "https://babyclubaccess.com";
    (requireStaffRole as any).mockResolvedValue({
      ok: true,
      context: { user: { id: "user-1" }, staffId: "staff-1", role: "admin", staff: {} },
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
            event: null,
          },
          error: null,
        },
      ],
      "ticket_reservation_units.select": [
        { data: [], error: null },
      ],
      "ticket_reservation_units.insert": [
        { data: [{ reservation_id: "res-1" }], error: null },
      ],
    });

    (createClient as any).mockReturnValue(supabase);
    (sendApprovalEmail as any).mockResolvedValue(undefined);
    (sendTicketEmail as any).mockResolvedValue(undefined);

    const { POST } = await import("./route");
    const res = await POST(
      new Request("http://localhost/api/reservations/resend", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer token-123",
        },
        body: JSON.stringify({ id: "res-1" }),
      }) as any,
    );
    const payload = await res.json();

    expect(res.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.sentCount).toBe(0);
    expect(payload.unitsPrepared).toBe(true);
    expect(sendApprovalEmail).toHaveBeenCalledTimes(1);
    expect((sendApprovalEmail as any).mock.calls[0][0]).toMatchObject({
      id: "res-1",
      email: "ana@example.com",
      resourceLabel: "Entrada",
      callToAction: {
        label: "Asignar asistentes",
        url: "https://babyclubaccess.com/compra/reserva/res-1",
      },
    });
    expect(sendTicketEmail).not.toHaveBeenCalled();
  });
});
