import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSupabaseMock } from "../../../../../../../tests/utils/supabaseMock";

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(),
}));
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

describe("POST /api/ticket-reservations/[id]/issue", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env.SUPABASE_URL = "http://localhost:54321";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-key";
  });

  it("emite primero la unidad 1 del comprador y deja el resto pendiente", async () => {
    const { supabase, calls } = createSupabaseMock({
      "table_reservations.select": [
        {
          data: {
            id: "res-ticket-1",
            sale_origin: "ticket",
            status: "approved",
            event_id: "event-1",
            table_id: null,
            product_id: null,
            full_name: "Comprador Principal",
            email: "buyer@test.com",
            phone: "999999999",
            doc_type: "dni",
            document: "11112222",
            promoter_id: null,
            codes: ["legacy-code"],
          },
          error: null,
        },
      ],
      "ticket_reservation_units.select": [
        {
          data: [
            {
              id: "unit-1",
              unit_index: 1,
              package_index: 1,
              person_index: 1,
              status: "pending_nomination",
              full_name: null,
              doc_type: null,
              document: null,
              email: null,
              phone: null,
              ticket_id: null,
            },
            {
              id: "unit-2",
              unit_index: 2,
              package_index: 1,
              person_index: 2,
              status: "pending_nomination",
              full_name: null,
              doc_type: null,
              document: null,
              email: null,
              phone: null,
              ticket_id: null,
            },
            {
              id: "unit-3",
              unit_index: 3,
              package_index: 2,
              person_index: 1,
              status: "issued",
              full_name: "Ya Emitido",
              doc_type: "dni",
              document: "87654321",
              email: "issued@test.com",
              phone: "988888888",
              ticket_id: "ticket-existing",
            },
          ],
          error: null,
        },
      ],
      "ticket_reservation_units.update": [{ data: null, error: null }],
      "table_reservations.update": [{ data: null, error: null }],
    });
    (createClient as any).mockReturnValue(supabase);
    (createTicketForReservation as any).mockResolvedValue({
      ticketId: "ticket-new-1",
      code: "CODE-NEW-1",
    });
    (sendTicketEmail as any).mockResolvedValue(undefined);

    const { POST } = await import("./route");
    const req = new Request(
      "http://localhost/api/ticket-reservations/res-ticket-1/issue",
      { method: "POST" },
    );

    const res = await POST(req as any, {
      params: Promise.resolve({ id: "res-ticket-1" }),
    });
    const payload = await res.json();

    expect(res.status).toBe(200);
    expect(payload).toMatchObject({
      success: true,
      issuedCount: 1,
      pendingNominationCount: 1,
    });

    expect(createTicketForReservation).toHaveBeenCalledTimes(1);
    expect(createTicketForReservation).toHaveBeenCalledWith(
      supabase,
      expect.objectContaining({
        eventId: "event-1",
        tableName: "Entrada",
        fullName: "Comprador Principal",
        email: "buyer@test.com",
        phone: "999999999",
        docType: "dni",
        document: "11112222",
        tableReservationId: "res-ticket-1",
        codeType: "courtesy",
      }),
    );
    expect(sendTicketEmail).toHaveBeenCalledWith({
      supabase,
      ticketId: "ticket-new-1",
      toEmail: "buyer@test.com",
    });

    const unitUpdate = calls.find(
      (call) =>
        call.table === "ticket_reservation_units" && call.op === "update",
    );
    expect(unitUpdate?.payload).toMatchObject({
      status: "issued",
      ticket_id: "ticket-new-1",
    });
    expect(typeof unitUpdate?.payload?.issued_at).toBe("string");

    const reservationUpdate = calls.find(
      (call) => call.table === "table_reservations" && call.op === "update",
    );
    expect(reservationUpdate?.payload.codes).toEqual([
      "legacy-code",
      "CODE-NEW-1",
    ]);
  });

  it("rechaza emisión cuando la reserva aún no está aprobada", async () => {
    const { supabase } = createSupabaseMock({
      "table_reservations.select": [
        {
          data: {
            id: "res-ticket-1",
            sale_origin: "ticket",
            status: "pending",
            event_id: "event-1",
            codes: [],
          },
          error: null,
        },
      ],
    });
    (createClient as any).mockReturnValue(supabase);

    const { POST } = await import("./route");
    const req = new Request(
      "http://localhost/api/ticket-reservations/res-ticket-1/issue",
      { method: "POST" },
    );

    const res = await POST(req as any, {
      params: Promise.resolve({ id: "res-ticket-1" }),
    });
    const payload = await res.json();

    expect(res.status).toBe(400);
    expect(payload.success).toBe(false);
    expect(String(payload.error || "")).toContain("approved");
    expect(createTicketForReservation).not.toHaveBeenCalled();
  });

  it("no copia contacto del comprador cuando la unidad nominada no trae email ni teléfono", async () => {
    const { supabase } = createSupabaseMock({
      "table_reservations.select": [
        {
          data: {
            id: "res-ticket-2",
            sale_origin: "ticket",
            status: "approved",
            event_id: "event-2",
            full_name: "Comprador Principal",
            email: "buyer@test.com",
            phone: "999999999",
            promoter_id: null,
            codes: [],
          },
          error: null,
        },
      ],
      "ticket_reservation_units.select": [
        {
          data: [
            {
              id: "unit-2",
              unit_index: 2,
              package_index: 1,
              person_index: 1,
              status: "nominated",
              full_name: "Invitado Sin Contacto",
              doc_type: "dni",
              document: "70000001",
              email: null,
              phone: null,
              ticket_id: null,
            },
          ],
          error: null,
        },
        {
          data: [
            {
              id: "unit-2",
              unit_index: 2,
              package_index: 1,
              person_index: 1,
              status: "issued",
              full_name: "Invitado Sin Contacto",
              doc_type: "dni",
              document: "70000001",
              email: null,
              phone: null,
              ticket_id: "ticket-no-contact",
            },
          ],
          error: null,
        },
      ],
      "ticket_reservation_units.update": [{ data: null, error: null }],
      "table_reservations.update": [{ data: null, error: null }],
    });
    (createClient as any).mockReturnValue(supabase);
    (createTicketForReservation as any).mockResolvedValue({
      ticketId: "ticket-no-contact",
      code: "CODE-NO-CONTACT",
    });
    (sendTicketEmail as any).mockResolvedValue(undefined);

    const { POST } = await import("./route");
    const req = new Request(
      "http://localhost/api/ticket-reservations/res-ticket-2/issue",
      { method: "POST" },
    );

    const res = await POST(req as any, {
      params: Promise.resolve({ id: "res-ticket-2" }),
    });

    expect(res.status).toBe(200);
    expect(createTicketForReservation).toHaveBeenCalledWith(
      supabase,
      expect.objectContaining({
        fullName: "Invitado Sin Contacto",
        email: null,
        phone: null,
        document: "70000001",
      }),
    );
    expect(sendTicketEmail).not.toHaveBeenCalled();
  });
});
