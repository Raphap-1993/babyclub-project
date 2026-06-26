import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSupabaseMock } from "../../../../../../../tests/utils/supabaseMock";

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(),
}));
vi.mock("../../../../../../backoffice/app/api/reservations/utils", () => ({
  createTicketForReservation: vi.fn(),
  createReservationCodes: vi.fn(),
}));
vi.mock("../../../../../../backoffice/app/api/reservations/email", () => ({
  sendTicketEmail: vi.fn(),
}));

const { createClient } = await import("@supabase/supabase-js");
const { createReservationCodes, createTicketForReservation } = await import(
  "../../../../../../backoffice/app/api/reservations/utils"
);
const { sendTicketEmail } = await import(
  "../../../../../../backoffice/app/api/reservations/email"
);

describe("POST /api/ticket-reservations/[id]/issue", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    (createReservationCodes as any).mockReset();
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
      "codes.select": [
        {
          data: [
            { id: "code-1", code: "legacy-code", person_index: 1 },
            { id: "code-2", code: "CODE-UNIT-2", person_index: 2 },
            { id: "code-3", code: "CODE-UNIT-3", person_index: 3 },
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
      code: "legacy-code",
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
        reuseCodes: ["legacy-code"],
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
      full_name: "Comprador Principal",
      email: "buyer@test.com",
      phone: "999999999",
      doc_type: "dni",
      document: "11112222",
      status: "issued",
      ticket_id: "ticket-new-1",
    });
    expect(typeof unitUpdate?.payload?.issued_at).toBe("string");

    const reservationUpdate = calls.find(
      (call) => call.table === "table_reservations" && call.op === "update",
    );
    expect(reservationUpdate?.payload.codes).toEqual([
      "legacy-code",
      "CODE-UNIT-2",
      "CODE-UNIT-3",
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

  it("usa el correo del comprador cuando la unidad nominada no trae email ni teléfono", async () => {
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
      "codes.select": [
        {
          data: [{ id: "code-2", code: "CODE-NO-CONTACT", person_index: 2 }],
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
        email: "buyer@test.com",
        phone: null,
        document: "70000001",
      }),
    );
    expect(sendTicketEmail).toHaveBeenCalledWith({
      supabase,
      ticketId: "ticket-no-contact",
      toEmail: "buyer@test.com",
    });
  });

  it("emite una unidad de mesa reutilizando su código reservado y enviando al asistente", async () => {
    const { supabase } = createSupabaseMock({
      "table_reservations.select": [
        {
          data: {
            id: "res-table-1",
            sale_origin: "table",
            status: "approved",
            event_id: "event-1",
            table_id: "table-1",
            product_id: "product-1",
            ticket_type_label: null,
            full_name: "Comprador Mesa",
            email: "buyer@test.com",
            phone: "999999999",
            doc_type: "dni",
            document: "11112222",
            codes: ["TABLE-CODE-1", "TABLE-CODE-2"],
            table: {
              name: "Mesa 17",
            },
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
              status: "issued",
              full_name: "Comprador Mesa",
              doc_type: "dni",
              document: "11112222",
              email: "buyer@test.com",
              phone: "999999999",
              ticket_id: "ticket-buyer-1",
            },
            {
              id: "unit-2",
              unit_index: 2,
              package_index: 1,
              person_index: 2,
              status: "nominated",
              full_name: "Invitada Mesa",
              doc_type: "dni",
              document: "70000002",
              email: "guest@test.com",
              phone: "988888888",
              ticket_id: null,
            },
          ],
          error: null,
        },
        {
          data: [
            {
              id: "unit-1",
              unit_index: 1,
              package_index: 1,
              person_index: 1,
              status: "issued",
              full_name: "Comprador Mesa",
              doc_type: "dni",
              document: "11112222",
              email: "buyer@test.com",
              phone: "999999999",
              ticket_id: "ticket-buyer-1",
            },
            {
              id: "unit-2",
              unit_index: 2,
              package_index: 1,
              person_index: 2,
              status: "issued",
              full_name: "Invitada Mesa",
              doc_type: "dni",
              document: "70000002",
              email: "guest@test.com",
              phone: "988888888",
              ticket_id: "ticket-table-2",
            },
          ],
          error: null,
        },
      ],
      "codes.select": [
        {
          data: [
            { id: "code-1", code: "TABLE-CODE-1", person_index: 1 },
            { id: "code-2", code: "TABLE-CODE-2", person_index: 2 },
          ],
          error: null,
        },
      ],
      "ticket_reservation_units.update": [{ data: null, error: null }],
      "table_reservations.update": [{ data: null, error: null }],
    });
    (createClient as any).mockReturnValue(supabase);
    (createTicketForReservation as any).mockResolvedValue({
      ticketId: "ticket-table-2",
      code: "TABLE-CODE-2",
    });
    (sendTicketEmail as any).mockResolvedValue(undefined);

    const { POST } = await import("./route");
    const req = new Request(
      "http://localhost/api/ticket-reservations/res-table-1/issue",
      { method: "POST" },
    );

    const res = await POST(req as any, {
      params: Promise.resolve({ id: "res-table-1" }),
    });
    const payload = await res.json();

    expect(res.status).toBe(200);
    expect(payload).toMatchObject({
      success: true,
      issuedCount: 1,
      pendingNominationCount: 0,
    });

    expect(createTicketForReservation).toHaveBeenCalledWith(
      supabase,
      expect.objectContaining({
        eventId: "event-1",
        tableName: "Mesa 17",
        fullName: "Invitada Mesa",
        email: "guest@test.com",
        phone: "988888888",
        docType: "dni",
        document: "70000002",
        codeType: "table",
        reuseCodes: ["TABLE-CODE-2"],
        tableId: "table-1",
        productId: "product-1",
        tableReservationId: "res-table-1",
      }),
    );
    expect(sendTicketEmail).toHaveBeenCalledWith({
      supabase,
      ticketId: "ticket-table-2",
      toEmail: "guest@test.com",
    });
  });

  it("bloquea la emisión con un mensaje legible si falta documento en una unidad nominada", async () => {
    const { supabase } = createSupabaseMock({
      "table_reservations.select": [
        {
          data: {
            id: "res-ticket-3",
            sale_origin: "ticket",
            status: "approved",
            event_id: "event-3",
            full_name: "Comprador Principal",
            email: "buyer@test.com",
            phone: "999999999",
            doc_type: "dni",
            document: "11112222",
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
              full_name: "Invitado Sin Documento",
              doc_type: "dni",
              document: "",
              email: "guest@test.com",
              phone: null,
              ticket_id: null,
            },
          ],
          error: null,
        },
      ],
      "codes.select": [
        {
          data: [{ id: "code-2", code: "CODE-MISSING-DOC", person_index: 2 }],
          error: null,
        },
      ],
    });
    (createClient as any).mockReturnValue(supabase);

    const { POST } = await import("./route");
    const req = new Request(
      "http://localhost/api/ticket-reservations/res-ticket-3/issue",
      { method: "POST" },
    );

    const res = await POST(req as any, {
      params: Promise.resolve({ id: "res-ticket-3" }),
    });
    const payload = await res.json();

    expect(res.status).toBe(400);
    expect(payload.success).toBe(false);
    expect(String(payload.error || "")).toContain(
      "Completa el documento de unidad 2 antes de emitir el QR.",
    );
    expect(createTicketForReservation).not.toHaveBeenCalled();
    expect(sendTicketEmail).not.toHaveBeenCalled();
  });

  it("consulta doc_type y document del comprador para emitir la unidad 1", async () => {
    const { supabase, calls } = createSupabaseMock({
      "table_reservations.select": [
        {
          data: {
            id: "res-ticket-4",
            sale_origin: "ticket",
            status: "approved",
            event_id: "event-4",
            full_name: "Comprador Principal",
            email: "buyer@test.com",
            phone: "999999999",
            doc_type: "dni",
            document: "11112222",
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
          ],
          error: null,
        },
        {
          data: [
            {
              id: "unit-1",
              unit_index: 1,
              package_index: 1,
              person_index: 1,
              status: "issued",
              full_name: "Comprador Principal",
              doc_type: "dni",
              document: "11112222",
              email: "buyer@test.com",
              phone: "999999999",
              ticket_id: "ticket-new-4",
            },
          ],
          error: null,
        },
      ],
      "codes.select": [
        {
          data: [{ id: "code-1", code: "CODE-NEW-4", person_index: 1 }],
          error: null,
        },
      ],
      "ticket_reservation_units.update": [{ data: null, error: null }],
      "table_reservations.update": [{ data: null, error: null }],
    });
    (createClient as any).mockReturnValue(supabase);
    (createTicketForReservation as any).mockResolvedValue({
      ticketId: "ticket-new-4",
      code: "CODE-NEW-4",
    });
    (sendTicketEmail as any).mockResolvedValue(undefined);

    const { POST } = await import("./route");
    const req = new Request(
      "http://localhost/api/ticket-reservations/res-ticket-4/issue",
      { method: "POST" },
    );

    const res = await POST(req as any, {
      params: Promise.resolve({ id: "res-ticket-4" }),
    });

    expect(res.status).toBe(200);

    const reservationSelect = calls.find(
      (call) => call.table === "table_reservations" && call.op === "select",
    );
    expect(reservationSelect?.selectClause).toContain("doc_type");
    expect(reservationSelect?.selectClause).toContain("document");
  });
});
