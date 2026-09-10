import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSupabaseMock } from "../../../../../../../../tests/utils/supabaseMock";

vi.mock("shared/auth/requireStaff", () => ({ requireStaffRole: vi.fn() }));
vi.mock("@supabase/supabase-js", () => ({ createClient: vi.fn() }));
vi.mock("../../../../reservations/email", () => ({
  sendApprovalEmail: vi.fn(),
  sendTicketEmail: vi.fn(),
}));
vi.mock("../../../../reservations/utils", () => ({
  createTicketForReservation: vi.fn(),
}));
vi.mock("../../../../reservations/ticketOnlyFlow", () => ({
  ensureTicketOnlyBuyerIssued: vi.fn(),
}));

const { createClient } = await import("@supabase/supabase-js");
const { requireStaffRole } = await import("shared/auth/requireStaff");
const { createTicketForReservation } = await import(
  "../../../../reservations/utils"
);
const { ensureTicketOnlyBuyerIssued } = await import(
  "../../../../reservations/ticketOnlyFlow"
);
const { sendApprovalEmail, sendTicketEmail } = await import(
  "../../../../reservations/email"
);

const issuedUnits = [
  {
    id: "unit-1",
    unit_index: 1,
    status: "issued",
    ticket_id: "ticket-1",
    email: "first@example.test",
  },
  {
    id: "unit-2",
    unit_index: 2,
    status: "issued",
    ticket_id: "ticket-2",
    email: "second@example.test",
  },
];
const reservation = {
  id: "res-1",
  full_name: "Buyer Demo",
  email: "buyer@example.test",
  phone: null,
  sale_origin: "ticket",
  status: "approved",
  codes: [],
  ticket_quantity: 2,
  total_ticket_units: 2,
  event_id: "event-1",
  table: null,
  event: {
    id: "event-1",
    name: "Evento Demo",
    starts_at: "2099-10-10T04:00:00.000Z",
    location: "Lima",
  },
};

function fixture(
  options: {
    reservation?: Record<string, unknown>;
    units?: any[];
    tickets?: any[];
    ticketError?: any;
  } = {},
) {
  const units = options.units ?? issuedUnits;
  const { supabase, calls } = createSupabaseMock({
    "table_reservations.select": {
      data: { ...reservation, ...options.reservation },
      error: null,
    },
    "ticket_reservation_units.select": { data: units, error: null },
    "codes.select": { data: [], error: null },
    "tickets.select": {
      data: options.tickets ?? [{ id: "ticket-1" }, { id: "ticket-2" }],
      error: options.ticketError ?? null,
    },
  });
  (createClient as any).mockReturnValue(supabase);
  (ensureTicketOnlyBuyerIssued as any).mockResolvedValue({
    units,
    unitsPrepared: false,
    buyerCode: null,
  });
  return { supabase, calls };
}
async function resend() {
  const { POST } = await import("./route");
  return POST(
    new Request("http://localhost/api/admin/reservations/res-1/resend", {
      method: "POST",
    }) as any,
    { params: Promise.resolve({ id: "res-1" }) },
  );
}
function expectNoIssuance(calls: Array<{ table: string; op: string }>) {
  expect(ensureTicketOnlyBuyerIssued).not.toHaveBeenCalled();
  expect(createTicketForReservation).not.toHaveBeenCalled();
  expect(
    calls
      .filter((c) =>
        [
          "tickets",
          "codes",
          "ticket_reservation_units",
          "table_reservations",
        ].includes(c.table),
      )
      .every((c) => c.op === "select"),
  ).toBe(true);
}

describe("POST /api/admin/reservations/[id]/resend", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.resetAllMocks();
    process.env.SUPABASE_URL = "http://localhost:54321";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-key";
    process.env.NEXT_PUBLIC_APP_URL = "https://babyclubaccess.com";
    delete process.env.NEXT_PUBLIC_LANDING_URL;
    delete process.env.VERCEL_ENV;
    delete process.env.VERCEL_URL;
    delete process.env.VERCEL_PROJECT_PRODUCTION_URL;
    (requireStaffRole as any).mockResolvedValue({ ok: true });
    (sendApprovalEmail as any).mockResolvedValue(undefined);
    (sendTicketEmail as any).mockResolvedValue(undefined);
    (createTicketForReservation as any).mockResolvedValue({
      ticketId: "new-ticket",
      code: "NEW-CODE",
    });
  });

  it("reenvía dos entradas en un solo consolidado al comprador sin correos individuales", async () => {
    const { calls } = fixture();
    const response = await resend();
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      success: true,
      sentCount: 1,
      ticketsCreated: 0,
      unitsPrepared: false,
      ticketIds: ["ticket-1", "ticket-2"],
    });
    expect(sendApprovalEmail).toHaveBeenCalledTimes(1);
    expect(sendTicketEmail).not.toHaveBeenCalled();
    expect((sendApprovalEmail as any).mock.calls[0][0]).toMatchObject({
      email: "buyer@example.test",
      ticketIds: ["ticket-1", "ticket-2"],
      event: reservation.event,
      callToAction: { label: "Ver mis entradas" },
    });
    expectNoIssuance(calls);
  });

  it("repetir un reenvío explícito conserva los mismos tickets y envía sólo un correo por solicitud", async () => {
    const { calls } = fixture();
    for (let i = 0; i < 2; i++) expect((await resend()).status).toBe(200);
    expect(sendApprovalEmail).toHaveBeenCalledTimes(2);
    expect(sendTicketEmail).not.toHaveBeenCalled();
    expect(
      (sendApprovalEmail as any).mock.calls.map((c: any[]) => c[0].ticketIds),
    ).toEqual([
      ["ticket-1", "ticket-2"],
      ["ticket-1", "ticket-2"],
    ]);
    expectNoIssuance(calls);
  });

  it("confirma una compra sin QR emitidos sin preparar ni emitir unidades", async () => {
    const { calls } = fixture({ units: [], tickets: [] });
    const response = await resend();
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      sentCount: 1,
      ticketsCreated: 0,
      pendingCount: 2,
      ticketIds: [],
    });
    expect(
      (sendApprovalEmail as any).mock.calls[0][0].ticketIds,
    ).toBeUndefined();
    expectNoIssuance(calls);
  });

  it("reenviar una mesa con entradas faltantes tampoco crea nuevos QR", async () => {
    const { calls } = fixture({
      reservation: {
        sale_origin: "table",
        table: {
          id: "table-1",
          name: "Mesa Demo",
          event_id: "event-1",
          ticket_count: 6,
        },
        total_ticket_units: 6,
      },
    });
    const response = await resend();
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      sentCount: 1,
      ticketsCreated: 0,
      pendingCount: 4,
    });
    expectNoIssuance(calls);
  });

  it("deduplica referencias del mismo ticket y filtra tickets activos por evento", async () => {
    const { calls } = fixture({
      tickets: [{ id: "ticket-1" }, { id: "ticket-1" }, { id: "ticket-2" }],
    });
    expect((await resend()).status).toBe(200);
    expect((sendApprovalEmail as any).mock.calls[0][0].ticketIds).toEqual([
      "ticket-1",
      "ticket-2",
    ]);
    const ticketReads = calls.filter((c) => c.table === "tickets");
    expect(ticketReads.length).toBeGreaterThan(0);
    for (const read of ticketReads) {
      expect(read.filters).toContainEqual({
        type: "eq",
        args: ["is_active", true],
      });
      expect(read.filters).toContainEqual({
        type: "eq",
        args: ["event_id", "event-1"],
      });
    }
  });

  it("devuelve fallo de notificación sin mutar entradas si el proveedor rechaza el correo", async () => {
    const { calls } = fixture();
    (sendApprovalEmail as any).mockRejectedValue(
      new Error("Private provider detail"),
    );
    const response = await resend();
    expect(response.status).toBe(502);
    const payload = await response.json();
    expect(payload).toMatchObject({
      success: false,
      sentCount: 0,
      ticketsCreated: 0,
    });
    expect(payload.error).not.toContain("Private provider detail");
    expectNoIssuance(calls);
  });

  it("no informa envío exitoso si falla consultar tickets", async () => {
    fixture({ ticketError: { message: "Database read failed" } });
    const response = await resend();
    expect(response.status).toBe(500);
    expect(sendApprovalEmail).not.toHaveBeenCalled();
    expect(sendTicketEmail).not.toHaveBeenCalled();
  });

  it("rechaza correo inválido del comprador antes de preparar o enviar", async () => {
    const { calls } = fixture({ reservation: { email: "invalid-address" } });
    expect((await resend()).status).toBe(400);
    expect(sendApprovalEmail).not.toHaveBeenCalled();
    expect(sendTicketEmail).not.toHaveBeenCalled();
    expectNoIssuance(calls);
  });

  it("mantiene el destino público del botón aunque backoffice sea preview", async () => {
    delete process.env.NEXT_PUBLIC_APP_URL;
    process.env.VERCEL_ENV = "preview";
    process.env.VERCEL_URL = "backoffice-preview.example.test";
    fixture();
    expect((await resend()).status).toBe(200);
    expect((sendApprovalEmail as any).mock.calls[0][0].callToAction.url).toBe(
      "https://babyclubaccess.com/compra?reservationId=res-1",
    );
  });

  it("requiere personal autenticado antes de consultar la reserva", async () => {
    (requireStaffRole as any).mockResolvedValue({
      ok: false,
      status: 401,
      error: "unauthorized",
    });
    expect((await resend()).status).toBe(401);
    expect(createClient).not.toHaveBeenCalled();
    expect(sendApprovalEmail).not.toHaveBeenCalled();
  });
});
