import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSupabaseMock } from "../../../../../tests/utils/supabaseMock";

vi.mock("shared/email/resend", () => ({
  sendEmail: vi.fn(),
}));
vi.mock("../logs/logger", () => ({
  logProcessEvent: vi.fn(),
}));

const { sendEmail } = await import("shared/email/resend");

describe("sendTicketEmail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.RESEND_API_KEY = "test-resend-key";
    delete process.env.NEXT_PUBLIC_APP_URL;
    delete process.env.NEXT_PUBLIC_LANDING_URL;
    (sendEmail as any).mockResolvedValue({ data: { id: "mail-1" } });
  });

  it("incluye CTA al workspace cuando el comprador aún tiene asistentes pendientes", async () => {
    const { supabase } = createSupabaseMock({
      "tickets.select": [
        {
          data: {
            id: "ticket-1",
            qr_token: "qr-token-1",
            full_name: "Comprador Principal",
            doc_type: "dni",
            document: "11112222",
            dni: null,
            email: "buyer@test.com",
            phone: "999999999",
            table_reservation_id: "res-ticket-1",
            code: {
              code: "CODE-1",
              type: "courtesy",
              expires_at: null,
              promoter_id: null,
              table_reservation_id: "res-ticket-1",
            },
            event: {
              name: "Baby Test",
              starts_at: "2099-02-01T04:00:00.000Z",
              location: "Lima",
            },
          },
          error: null,
        },
      ],
      "table_reservations.select": [
        {
          data: {
            id: "res-ticket-1",
            status: "approved",
            sale_origin: "ticket",
            full_name: "Comprador Principal",
            email: "buyer@test.com",
            phone: "999999999",
            document: "11112222",
          },
          error: null,
        },
      ],
      "ticket_reservation_units.select": [
        {
          data: [
            {
              unit_index: 1,
              status: "issued",
              ticket_id: "ticket-1",
            },
            {
              unit_index: 2,
              status: "pending_nomination",
              ticket_id: null,
            },
          ],
          error: null,
        },
      ],
    });

    const { sendTicketEmail } = await import("./email");
    await sendTicketEmail({
      supabase: supabase as any,
      ticketId: "ticket-1",
      toEmail: "buyer@test.com",
    });

    expect(sendEmail).toHaveBeenCalledTimes(1);
    const payload = (sendEmail as any).mock.calls[0][0];
    expect(payload.to).toBe("buyer@test.com");
    expect(String(payload.html || "")).toContain("Completar asistentes");
    expect(String(payload.html || "")).toContain(
      "https://babyclubaccess.com/compra?reservationId=res-ticket-1",
    );
    expect(String(payload.text || "")).toContain(
      "Completar asistentes: https://babyclubaccess.com/compra?reservationId=res-ticket-1",
    );
  });
});
