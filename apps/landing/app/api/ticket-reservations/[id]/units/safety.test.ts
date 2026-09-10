import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSupabaseMock } from "../../../../../../../tests/utils/supabaseMock";

vi.mock("@supabase/supabase-js", () => ({ createClient: vi.fn() }));
vi.mock("../../../../../../backoffice/app/api/reservations/utils", () => ({
  createTicketForReservation: vi.fn(),
}));
vi.mock("../../../../../../backoffice/app/api/reservations/email", () => ({
  sendTicketEmail: vi.fn(),
}));
const { createClient } = await import("@supabase/supabase-js");
const { createTicketForReservation } = await import(
  "../../../../../../backoffice/app/api/reservations/utils"
);
const { sendTicketEmail } = await import(
  "../../../../../../backoffice/app/api/reservations/email"
);
const routePath = "./route";
const res = {
  id: "reservation-fixture",
  event_id: "event-fixture",
  sale_origin: "ticket",
  status: "approved",
  full_name: "Persona Compradora",
  document: "11112222",
  doc_type: "dni",
  email: "shared@example.test",
  phone: "999999999",
  total_ticket_units: 2,
  codes: ["BUY", "GUEST"],
};
const buyer = {
  updated_at: "2026-09-10T00:00:00Z",
  id: "unit-buyer",
  reservation_id: res.id,
  event_id: res.event_id,
  unit_index: 1,
  package_index: 1,
  person_index: 1,
  status: "issued",
  full_name: res.full_name,
  doc_type: "dni",
  document: res.document,
  email: res.email,
  phone: res.phone,
  ticket_id: "ticket-buyer",
};
const guest = {
  updated_at: "2026-09-10T00:00:00Z",
  id: "unit-guest",
  reservation_id: res.id,
  event_id: res.event_id,
  unit_index: 2,
  package_index: 1,
  person_index: 2,
  status: "issued",
  full_name: "Persona Invitada",
  doc_type: "dni",
  document: "33334444",
  email: "old@example.test",
  phone: "988888888",
  ticket_id: "ticket-guest",
};
const ok = (data: any) => ({ data, error: null });
function mock(
  reservation = res,
  units: any[] = [buyer, guest],
  extra: Record<string, any> = {},
) {
  const result = createSupabaseMock({
    "table_reservations.select": ok(reservation),
    "ticket_reservation_units.select": ok(units),
    "tickets.select": ok([]),
    "codes.select": ok([]),
    ...extra,
  });
  vi.mocked(createClient).mockReturnValue(result.supabase as any);
  return result;
}
function request(unit = guest) {
  return new Request(
    `http://localhost/api/ticket-reservations/${res.id}/units`,
    {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        units: [
          {
            id: unit.id,
            expected_updated_at: unit.updated_at,
            full_name: unit.full_name,
            document: unit.document,
            doc_type: unit.doc_type,
            email: "new@example.test",
            phone: unit.phone,
          },
        ],
      }),
    },
  );
}
const params = { params: Promise.resolve({ id: res.id }) };

describe("nominación: regresiones de QR y estados", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env.SUPABASE_URL = "http://localhost:54321";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "mock-only-not-a-secret";
    vi.mocked(createTicketForReservation).mockResolvedValue({
      ticketId: "ticket-created",
      code: "BUY",
    });
    vi.mocked(sendTicketEmail).mockResolvedValue(undefined);
  });

  it("edita contacto mediante una sola operación atómica y conserva QR", async () => {
    const { calls } = mock(res, [buyer, guest], {
      "update_ticket_reservation_unit_nomination.rpc": ok({
        unit_id: guest.id,
        ticket_id: guest.ticket_id,
        updated_at: "2026-09-10T01:00:00Z",
        qr_rotated: false,
      }),
    });
    const { PUT } = await import(routePath);
    const response = await PUT(request() as any, params);
    expect(response.status).toBe(200);
    expect((await response.json()).updatedUnits).toEqual([
      {
        id: guest.id,
        ticketId: guest.ticket_id,
        qrRotated: false,
        updated_at: "2026-09-10T01:00:00Z",
      },
    ]);
    expect(calls.filter((c) => c.op === "rpc")).toHaveLength(1);
    expect(calls.some((c) => c.op === "update")).toBe(false);
    expect(sendTicketEmail).not.toHaveBeenCalled();
  });

  it("rechaza guardar asistentes de una reserva rechazada", async () => {
    const pending = { ...guest, ticket_id: null, status: "pending_nomination" };
    const { calls } = mock({ ...res, status: "rejected" }, [buyer, pending]);
    const { PUT } = await import(routePath);
    const req = request(pending as any);
    expect(req.headers.has("authorization")).toBe(false);
    expect(req.headers.has("cookie")).toBe(false);
    const response = await PUT(req as any, params);
    expect(response.status).toBe(409);
    expect(calls.some((c) => c.op === "update")).toBe(false);
  });

  it("GET informa preparación pendiente sin crear códigos ni entradas", async () => {
    const { calls } = mock({ ...res, codes: [] }, [buyer, guest], {
      "codes.insert": ok([
        { id: "code-buyer", code: "BUY" },
        { id: "code-guest", code: "GUEST" },
      ]),
    });
    const { GET } = await import(routePath);
    const response = await GET(
      new Request(
        `http://localhost/api/ticket-reservations/${res.id}/units`,
      ) as any,
      params,
    );
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.reservation.document).toBe(res.document);
    expect(body.needsPreparation).toBe(true);
    expect(
      calls.some((c) =>
        ["insert", "update", "upsert", "delete"].includes(c.op),
      ),
    ).toBe(false);
  });

  it("rechaza emisión de comprador cancelado sin crear ticket", async () => {
    const cancelledBuyer = { ...buyer, status: "cancelled", ticket_id: null };
    const { supabase } = mock(res, [cancelledBuyer]);
    const { issueReservationUnits } = await import(
      "../../lib/issueReservationUnits"
    );
    await expect(
      issueReservationUnits({
        supabase,
        reservation: res,
        reservationId: res.id,
        targetUnitId: buyer.id,
      }),
    ).rejects.toMatchObject({ status: 409 });
    expect(createTicketForReservation).not.toHaveBeenCalled();
  });

  it("si falla la transferencia atómica no intenta escrituras parciales ni correo", async () => {
    const { calls } = mock(res, [buyer, guest], {
      "update_ticket_reservation_unit_nomination.rpc": {
        data: null,
        error: { code: "P0001", message: "UNIT_NOT_EDITABLE" },
      },
    });
    const { PUT } = await import(routePath);
    const response = await PUT(
      request({ ...guest, document: "55556666" }) as any,
      params,
    );
    expect(response.status).toBe(409);
    expect((await response.json()).code).toBe("UNIT_NOT_EDITABLE");
    expect(calls.some((c) => c.op === "update")).toBe(false);
    expect(sendTicketEmail).not.toHaveBeenCalled();
  });

  it("conserva emisión exitosa y reporta aparte un fallo del correo", async () => {
    const nominated = { ...guest, status: "nominated", ticket_id: null };
    const { supabase } = mock(res, [buyer, nominated]);
    vi.mocked(sendTicketEmail).mockRejectedValue(
      new Error("synthetic provider rejection"),
    );
    const { issueReservationUnits } = await import(
      "../../lib/issueReservationUnits"
    );
    const result = await issueReservationUnits({
      supabase,
      reservation: res,
      reservationId: res.id,
      targetUnitId: guest.id,
    });
    expect(result.success).toBe(true);
    expect(result.issuedCount).toBe(1);
    expect(result.mailDelivery).toEqual([
      expect.objectContaining({
        unitId: guest.id,
        ticketId: "ticket-created",
        status: "failed",
      }),
    ]);
  });

  it("reintenta correo de unidad emitida sin crear entrada ni cambiar token", async () => {
    const { supabase, calls } = mock();
    const { issueReservationUnits } = await import(
      "../../lib/issueReservationUnits"
    );
    const result = await issueReservationUnits({
      supabase,
      reservation: res,
      reservationId: res.id,
      targetUnitId: guest.id,
    });
    expect(result.issuedCount).toBe(0);
    expect(createTicketForReservation).not.toHaveBeenCalled();
    expect(sendTicketEmail).toHaveBeenCalledWith({
      supabase,
      ticketId: guest.ticket_id,
      toEmail: guest.email,
    });
    expect(result.mailDelivery).toEqual([
      expect.objectContaining({
        unitId: guest.id,
        ticketId: guest.ticket_id,
        status: "sent",
      }),
    ]);
    expect(calls.some((c) => c.table === "tickets" && c.op === "update")).toBe(
      false,
    );
  });

  it("permite transferir portador unidad 1 sin modificar comprador de reserva", async () => {
    const { calls } = mock(res, [buyer, guest], {
      "update_ticket_reservation_unit_nomination.rpc": ok({
        unit_id: buyer.id,
        ticket_id: buyer.ticket_id,
        updated_at: "2026-09-10T01:00:00Z",
        qr_rotated: true,
      }),
    });
    const { PUT } = await import(routePath);
    const response = await PUT(
      request({
        ...buyer,
        full_name: "Tercera Persona",
        document: "55556666",
      }) as any,
      params,
    );
    expect(response.status).toBe(200);
    expect((await response.json()).updatedUnits[0].qrRotated).toBe(true);
    expect(
      calls.some((c) => c.table === "table_reservations" && c.op === "update"),
    ).toBe(false);
  });

  it("un guardado que perdió la carrera contra emisión no devuelve éxito ni degrada estado", async () => {
    const pending = { ...guest, status: "nominated", ticket_id: null };
    const { calls } = mock(res, [buyer, pending], {
      "ticket_reservation_units.update": ok(null),
    });
    const { PUT } = await import(routePath);
    const response = await PUT(request(pending as any) as any, params);
    expect(response.status).toBe(409);
    expect((await response.json()).code).toBe("NOMINATION_VERSION_CONFLICT");
    expect(
      calls.find(
        (c) => c.table === "ticket_reservation_units" && c.op === "update",
      )?.filters,
    ).toEqual(
      expect.arrayContaining([
        { type: "eq", args: ["status", "nominated"] },
        { type: "is", args: ["ticket_id", null] },
        { type: "eq", args: ["updated_at", pending.updated_at] },
      ]),
    );
  });

  it("GET no emite comprador aunque esté pendiente y tenga identidad completa", async () => {
    const { calls } = mock(res, [
      { ...buyer, status: "pending_nomination", ticket_id: null },
      guest,
    ]);
    const { GET } = await import(routePath);
    const response = await GET(
      new Request("http://localhost/api/ticket-reservations/res/units") as any,
      params,
    );
    expect(response.status).toBe(200);
    expect((await response.json()).needsPreparation).toBe(true);
    expect(createTicketForReservation).not.toHaveBeenCalled();
    expect(
      calls.some((c) =>
        ["insert", "update", "upsert", "delete"].includes(c.op),
      ),
    ).toBe(false);
  });

  it("GET distingue ticket emitido vencido de entrada disponible y usada", async () => {
    mock(res, [buyer, guest], {
      "tickets.select": ok([
        {
          id: buyer.ticket_id,
          used: true,
          event: { is_active: true },
          code: { type: "courtesy" },
        },
        {
          id: guest.ticket_id,
          used: false,
          is_active: true,
          event: { is_active: true, starts_at: "2000-01-01T00:00:00Z" },
          code: { type: "general", expires_at: "2000-01-01T00:00:00Z" },
        },
      ]),
    });
    const { GET } = await import(routePath);
    const response = await GET(
      new Request("http://localhost/api/ticket-reservations/res/units") as any,
      params,
    );
    const { units } = await response.json();
    expect(units[0]).toMatchObject({ status: "issued", access_status: "used" });
    expect(units[1]).toMatchObject({
      status: "issued",
      access_status: "expired",
      expired_at: "2000-01-01T00:00:00.000Z",
    });
  });
});
