import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createSupabaseMock } from "../../../../../tests/utils/supabaseMock";

const { providerSend } = vi.hoisted(() => ({ providerSend: vi.fn() }));
vi.mock("resend", () => ({
  Resend: function () {
    return { emails: { send: providerSend } };
  },
}));

beforeEach(() => {
  vi.resetModules();
  vi.resetAllMocks();
  process.env.RESEND_API_KEY = "test-provider-key";
  process.env.RESEND_FROM = "BabyClub Access <no-reply@babyclubaccess.com>";
  vi.stubGlobal(
    "fetch",
    vi.fn(() => {
      throw new Error("Network prohibited in test");
    }),
  );
});
afterEach(() => {
  expect(fetch).not.toHaveBeenCalled();
  vi.unstubAllGlobals();
});

it.each([false, true])(
  "un único intento al proveedor simulado para dos entradas; rejection=%s",
  async (rejected) => {
    providerSend.mockResolvedValue(
      rejected
        ? { data: null, error: { message: "Provider rejected request" } }
        : { data: { id: "provider-message-1" }, error: null },
    );
    const { supabase, calls } = createSupabaseMock({
      "table_reservations.select": {
        data: {
          id: "res-1",
          status: "approved",
          sale_origin: "ticket",
          full_name: "Buyer Demo",
          email: "buyer@example.test",
          event_id: "event-1",
          total_ticket_units: 2,
          codes: [],
        },
        error: null,
      },
      "ticket_reservation_units.select": {
        data: [
          { status: "issued", ticket_id: "ticket-1" },
          { status: "issued", ticket_id: "ticket-2" },
        ],
        error: null,
      },
      "codes.select": { data: [], error: null },
      "tickets.select": [
        { data: [{ id: "ticket-1" }, { id: "ticket-2" }], error: null },
        { data: [{ id: "ticket-1" }, { id: "ticket-2" }], error: null },
        {
          data: { full_name: "First Demo", event: { name: "Evento Demo" } },
          error: null,
        },
        {
          data: { full_name: "Second Demo", event: { name: "Evento Demo" } },
          error: null,
        },
      ],
    });
    const { resendReservationEmail } = await import("./resendReservationEmail");
    const response = await resendReservationEmail(supabase, "res-1");
    expect(response.status).toBe(rejected ? 502 : 200);
    expect((await response.json()).sentCount).toBe(rejected ? 0 : 1);
    expect(providerSend).toHaveBeenCalledTimes(1);
    const payload = providerSend.mock.calls[0][0];
    expect(payload.to).toBe("buyer@example.test");
    expect(payload.html).toContain("/compra?reservationId=res-1");
    expect(payload.html).toContain("2 entradas disponibles");
    expect(payload.html.match(/<a\s/g)).toHaveLength(1);
    expect(payload.html).not.toContain("/ticket/ticket-");
    expect(
      calls
        .filter((call) => call.table !== "process_logs")
        .every((call) => call.op === "select"),
    ).toBe(true);
  },
);
