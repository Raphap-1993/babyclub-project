import { beforeEach, expect, it, vi } from "vitest";
import { createSupabaseMock } from "../../../../../../tests/utils/supabaseMock";
vi.mock("shared/auth/requireStaff", () => ({
  requireStaffRole: vi.fn(async () => ({ ok: true })),
}));
vi.mock("@supabase/supabase-js", () => ({ createClient: vi.fn() }));
vi.mock("shared/email/resend", () => ({
  sendEmail: vi.fn(async () => ({ data: { id: "message-1" }, error: null })),
}));
vi.mock("../../reservations/utils", () => ({
  createTicketForReservation: vi.fn(async () => ({
    ticketId: "ticket-1",
    code: "CODE-1",
  })),
  createReservationCodes: vi.fn(async () => ({ codes: ["CODE-1"] })),
}));
const { createClient } = await import("@supabase/supabase-js");
const { sendEmail } = await import("shared/email/resend");
beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  process.env.SUPABASE_URL = "http://localhost:54321";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-key";
});

it.each(["approved", "pending"])(
  "creación manual %s conserva estado y usa un solo acceso a Mis entradas",
  async (status) => {
    const { supabase, calls } = createSupabaseMock({
      "tables.select": {
        data: {
          id: "table-1",
          name: "Mesa Demo",
          event_id: "event-1",
          ticket_count: 1,
          is_active: true,
        },
        error: null,
      },
      "events.select": {
        data: { id: "event-1", name: "Evento Demo", event_prefix: "DEMO" },
        error: null,
      },
      "table_products.select": {
        data: [{ id: "product-1", is_active: true }],
        error: null,
      },
      "table_reservations.select": [
        { data: null, error: null },
        {
          data: {
            status,
            full_name: "Buyer <Demo>",
            codes: ["CODE<1>"],
            product: { name: "Pack <Demo>" },
            table: { name: "Mesa <Demo>", event: { name: "Evento <Demo>" } },
            ticket: null,
          },
          error: null,
        },
      ],
      "table_reservations.insert": { data: { id: "res-1" }, error: null },
    });
    (createClient as any).mockReturnValue(supabase);
    const { POST } = await import("./route");
    const response = await POST({
      json: async () => ({
        mode: "new_customer",
        table_id: "table-1",
        product_id: "product-1",
        event_id: "event-1",
        full_name: "Buyer Demo",
        email: "buyer@example.test",
        doc_type: "dni",
        document: "12345678",
        status,
      }),
    } as any);
    expect(response.status).toBe(200);
    if (status === "pending") {
      expect(sendEmail).not.toHaveBeenCalled();
      return;
    }
    expect(sendEmail).toHaveBeenCalledTimes(1);
    const payload = (sendEmail as any).mock.calls[0][0];
    expect(payload.html).not.toContain("api.qrserver.com");
    expect(payload.html).toContain("Buyer &lt;Demo&gt;");
    expect(payload.html).toContain("Mesa &lt;Demo&gt;");
    expect(payload.html.match(/<a\s/g)).toHaveLength(1);
    expect(payload.html).toContain("Mis entradas");
    expect(payload.html).not.toContain("CODE");
    expect(payload.text).not.toContain("CODE");
    expect(payload.html).toContain("/compra?reservationId=res-1");
    expect(
      calls.find((call) => call.table === "process_logs")?.payload.action,
    ).toBe("reservation_confirmed");
  },
);
