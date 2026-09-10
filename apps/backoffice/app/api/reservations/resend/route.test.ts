import { beforeEach, expect, it, vi } from "vitest";
import { createSupabaseMock } from "../../../../../../tests/utils/supabaseMock";
vi.mock("shared/auth/requireStaff", () => ({ requireStaffRole: vi.fn() }));
vi.mock("@supabase/supabase-js", () => ({ createClient: vi.fn() }));
vi.mock("../email", () => ({
  sendApprovalEmail: vi.fn(),
  sendTicketEmail: vi.fn(),
}));
vi.mock("../utils", () => ({ createTicketForReservation: vi.fn() }));
vi.mock("../ticketOnlyFlow", () => ({ ensureTicketOnlyBuyerIssued: vi.fn() }));
const { createClient } = await import("@supabase/supabase-js");
const { requireStaffRole } = await import("shared/auth/requireStaff");
const { sendApprovalEmail, sendTicketEmail } = await import("../email");
const { ensureTicketOnlyBuyerIssued } = await import("../ticketOnlyFlow");
const { createTicketForReservation } = await import("../utils");

beforeEach(() => {
  vi.resetModules();
  vi.resetAllMocks();
  process.env.SUPABASE_URL = "http://localhost:54321";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-key";
  process.env.RESEND_API_KEY = "test-key";
  (requireStaffRole as any).mockResolvedValue({ ok: true });
  (sendApprovalEmail as any).mockResolvedValue(undefined);
});

it("ruta anterior también reenvía un solo consolidado sin emitir tickets", async () => {
  const units = [
    {
      unit_index: 1,
      status: "issued",
      ticket_id: "ticket-1",
      email: "first@example.test",
    },
    {
      unit_index: 2,
      status: "issued",
      ticket_id: "ticket-2",
      email: "second@example.test",
    },
  ];
  const { supabase, calls } = createSupabaseMock({
    "table_reservations.select": {
      data: {
        id: "res-1",
        full_name: "Buyer Demo",
        email: "buyer@example.test",
        sale_origin: "ticket",
        status: "approved",
        total_ticket_units: 2,
        codes: [],
        event_id: "event-1",
      },
      error: null,
    },
    "ticket_reservation_units.select": { data: units, error: null },
    "tickets.select": {
      data: [{ id: "ticket-1" }, { id: "ticket-2" }],
      error: null,
    },
    "codes.select": { data: [], error: null },
  });
  (createClient as any).mockReturnValue(supabase);
  (ensureTicketOnlyBuyerIssued as any).mockResolvedValue({
    units,
    unitsPrepared: false,
    buyerCode: null,
  });
  const { POST } = await import("./route");
  const response = await POST(
    new Request("http://localhost/api/reservations/resend", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: "res-1" }),
    }) as any,
  );
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({
    success: true,
    sentCount: 1,
    ticketsCreated: 0,
    unitsPrepared: false,
  });
  expect(sendApprovalEmail).toHaveBeenCalledTimes(1);
  expect(sendTicketEmail).not.toHaveBeenCalled();
  expect(ensureTicketOnlyBuyerIssued).not.toHaveBeenCalled();
  expect(createTicketForReservation).not.toHaveBeenCalled();
  expect(calls.every((c) => c.op === "select")).toBe(true);
});

it("rechaza JSON inválido sin consultar BD ni enviar", async () => {
  const { POST } = await import("./route");
  const response = await POST(
    new Request("http://localhost/api/reservations/resend", {
      method: "POST",
      body: "{",
    }) as any,
  );
  expect(response.status).toBe(400);
  expect(createClient).not.toHaveBeenCalled();
  expect(sendApprovalEmail).not.toHaveBeenCalled();
});

it("requiere personal autenticado", async () => {
  (requireStaffRole as any).mockResolvedValue({
    ok: false,
    status: 401,
    error: "unauthorized",
  });
  const { POST } = await import("./route");
  expect(
    (
      await POST(
        new Request("http://localhost/api/reservations/resend", {
          method: "POST",
        }) as any,
      )
    ).status,
  ).toBe(401);
  expect(createClient).not.toHaveBeenCalled();
});
