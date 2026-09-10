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
    expect(String(payload.html || "")).toContain("Ver mis entradas");
    expect(String(payload.html || "")).toContain(
      "https://babyclubaccess.com/compra?reservationId=res-ticket-1",
    );
    expect(String(payload.text || "")).toContain(
      "Ver mis entradas: https://babyclubaccess.com/compra?reservationId=res-ticket-1",
    );
  });

  it("envía acceso al ticket vigente sin QR externo y escapa los datos del asistente", async () => {
    const { supabase } = createSupabaseMock({
      "tickets.select": {
        data: {
          id: "ticket-1",
          qr_token: "private-token",
          full_name: '<a href="https://example.test">Demo</a>',
          document: "12345678",
          doc_type: "dni",
          phone: "<b>999</b>",
          event: { name: "Evento <Demo>", location: "Sala <Demo>" },
          code: { code: "CODE<1>", type: "courtesy" },
        },
        error: null,
      },
    });
    const { sendTicketEmail } = await import("./email");
    await sendTicketEmail({
      supabase,
      ticketId: "ticket-1",
      toEmail: "recipient@example.test",
    });
    const payload = (sendEmail as any).mock.calls[0][0];
    expect(payload.html).not.toContain("api.qrserver.com");
    expect(payload.html).not.toContain("private-token");
    expect(payload.html).not.toContain(
      '<a href="https://example.test">Demo</a>',
    );
    expect(payload.html).toContain("Evento &lt;Demo&gt;");
    expect(payload.html).toContain(
      "https://babyclubaccess.com/ticket/ticket-1",
    );
  });

  it("ofrece una sola entrada a la compra sin códigos ni botones repetidos", async () => {
    const { supabase } = createSupabaseMock({
      "tickets.select": {
        data: null,
        error: { message: "Ticket lookup failed" },
      },
    });
    const { sendApprovalEmail } = await import("./email");
    await sendApprovalEmail({
      supabase,
      id: "res-1",
      full_name: "Buyer",
      email: "buyer@example.test",
      phone: "<em>999</em>",
      codes: ["CODE<1>"],
      ticketIds: ["ticket-1"],
      resourceLabel: "<b>Mesa</b>",
      callToAction: {
        label: "Completar asistentes",
        url: "https://babyclubaccess.com/compra?reservationId=res-1",
      },
    });
    const payload = (sendEmail as any).mock.calls[0][0];
    expect(payload.html).not.toContain("api.qrserver.com");
    expect(payload.html).not.toContain("<img");
    expect(payload.html).toContain("Mis entradas");
    expect(payload.html.match(/<a\s/g)).toHaveLength(1);
    expect(payload.html).not.toContain("<em>999</em>");
    expect(payload.html).not.toContain("<b>Mesa</b>");
    expect(payload.text).toContain(
      "https://babyclubaccess.com/compra?reservationId=res-1",
    );
    expect(payload.html).not.toContain("CODE");
    expect(payload.text).not.toContain("CODE");
    expect(payload.text).not.toContain("/ticket/ticket-1");
    expect(payload.html).toContain("1 entrada disponible");
  });

  it("usa el enlace seguro de la compra incluso sin tickets emitidos ni CTA proporcionado", async () => {
    const { sendApprovalEmail } = await import("./email");
    await sendApprovalEmail({
      id: "res id/1",
      full_name: "Buyer",
      email: "buyer@example.test",
      phone: null,
      codes: [],
    });
    const payload = (sendEmail as any).mock.calls[0][0];
    expect(payload.html.match(/<a\s/g)).toHaveLength(1);
    expect(payload.text).toContain("/compra?reservationId=res%20id%2F1");
    expect(payload.html).not.toContain("No se generaron códigos");
    expect(payload.text).not.toContain("sin códigos");
    expect(payload.html).not.toContain("entradas disponibles");
  });
});
