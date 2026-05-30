import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSupabaseMock } from "../../../../../../../tests/utils/supabaseMock";

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(),
}));
vi.mock(
  "../../../../../../backoffice/app/api/reservations/utils",
  () => ({
  }),
);
vi.mock(
  "../../../../../../backoffice/app/api/reservations/email",
  () => ({
    sendTicketEmail: vi.fn(),
  }),
);

const { createClient } = await import("@supabase/supabase-js");
const { sendTicketEmail } = await import(
  "../../../../../../backoffice/app/api/reservations/email"
);

describe("GET/PUT /api/ticket-reservations/[id]/units", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env.SUPABASE_URL = "http://localhost:54321";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-key";
  });

  it("devuelve cabecera mínima y units ordenadas por unit_index para ticket-only", async () => {
    const { supabase } = createSupabaseMock({
      "table_reservations.select": [
        {
          data: {
            id: "res-ticket-1",
            sale_origin: "ticket",
            status: "approved",
            ticket_quantity: 2,
            package_quantity: 1,
            total_ticket_units: 2,
            ticket_type_label: "2 QR ALL NIGHT",
            event: {
              name: "Baby Lima",
              starts_at: "2026-05-31T23:00:00.000Z",
              location: "Centro de Convenciones",
            },
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
              id: "unit-1",
              unit_index: 1,
              package_index: 1,
              person_index: 1,
              status: "nominated",
              full_name: "Ana Torres",
              doc_type: "dni",
              document: "12345678",
              email: "ana@test.com",
              phone: "999999999",
              ticket_id: null,
            },
          ],
          error: null,
        },
      ],
    });
    (createClient as any).mockReturnValue(supabase);

    const { GET } = await import("./route");
    const req = new Request(
      "http://localhost/api/ticket-reservations/res-ticket-1/units",
      { method: "GET" },
    );

    const res = await GET(req as any, {
      params: Promise.resolve({ id: "res-ticket-1" }),
    });
    const payload = await res.json();

    expect(res.status).toBe(200);
    expect(payload).toMatchObject({
      success: true,
      reservation: {
        id: "res-ticket-1",
        sale_origin: "ticket",
        status: "approved",
        ticket_quantity: 2,
        package_quantity: 1,
        total_ticket_units: 2,
        ticket_type_label: "2 QR ALL NIGHT",
        event: {
          name: "Baby Lima",
          starts_at: "2026-05-31T23:00:00.000Z",
          location: "Centro de Convenciones",
        },
      },
    });
    expect(payload.units.map((unit: any) => unit.id)).toEqual([
      "unit-1",
      "unit-2",
    ]);
  });

  it("nomina solo los asistentes restantes sin tocar la unidad 1", async () => {
    const { supabase, calls } = createSupabaseMock({
      "table_reservations.select": [
        {
          data: {
            id: "res-ticket-1",
            sale_origin: "ticket",
            status: "approved",
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
              status: "pending_nomination",
              ticket_id: null,
            },
            {
              id: "unit-2",
              unit_index: 2,
              status: "pending_nomination",
              ticket_id: null,
            },
          ],
          error: null,
        },
      ],
      "ticket_reservation_units.update": [
        { data: null, error: null },
        { data: null, error: null },
      ],
    });
    (createClient as any).mockReturnValue(supabase);

    const { PUT } = await import("./route");
    const req = new Request(
      "http://localhost/api/ticket-reservations/res-ticket-1/units",
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          units: [
            {
              id: "unit-2",
              full_name: "Luis Perez",
              doc_type: "dni",
              document: "87654321",
              email: "luis@test.com",
              phone: "988888888",
            },
          ],
        }),
      },
    );

    const res = await PUT(req as any, {
      params: Promise.resolve({ id: "res-ticket-1" }),
    });
    const payload = await res.json();

    expect(res.status).toBe(200);
    expect(payload).toMatchObject({
      success: true,
      updatedCount: 1,
    });

    const updates = calls.filter(
      (call) =>
        call.table === "ticket_reservation_units" && call.op === "update",
    );
    expect(updates).toHaveLength(1);
    expect(updates[0].payload).toMatchObject({
      full_name: "Luis Perez",
      doc_type: "dni",
      document: "87654321",
      email: "luis@test.com",
      phone: "988888888",
      status: "nominated",
    });
    expect(typeof updates[0].payload.nominated_at).toBe("string");
    expect(updates[0].payload.ticket_id).toBeUndefined();
  });

  it("usa el doc_type de la reserva cuando la unidad llega sin tipo de documento", async () => {
    const { supabase, calls } = createSupabaseMock({
      "table_reservations.select": [
        {
          data: {
            id: "res-ticket-1",
            sale_origin: "ticket",
            status: "approved",
            doc_type: "dni",
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
              status: "pending_nomination",
              full_name: "",
              doc_type: null,
              document: "",
              email: "",
              phone: "",
              ticket_id: null,
            },
          ],
          error: null,
        },
      ],
      "ticket_reservation_units.update": [{ data: null, error: null }],
    });
    (createClient as any).mockReturnValue(supabase);

    const { PUT } = await import("./route");
    const req = new Request(
      "http://localhost/api/ticket-reservations/res-ticket-1/units",
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          units: [
            {
              id: "unit-2",
              full_name: "Luis Perez",
              document: "87654321",
              email: "luis@test.com",
              phone: "988888888",
            },
          ],
        }),
      },
    );

    const res = await PUT(req as any, {
      params: Promise.resolve({ id: "res-ticket-1" }),
    });
    const payload = await res.json();

    expect(res.status).toBe(200);
    expect(payload.success).toBe(true);

    const updates = calls.filter(
      (call) =>
        call.table === "ticket_reservation_units" && call.op === "update",
    );
    expect(updates).toHaveLength(1);
    expect(updates[0].payload).toMatchObject({
      full_name: "Luis Perez",
      doc_type: "dni",
      document: "87654321",
      email: "luis@test.com",
      phone: "988888888",
      status: "nominated",
    });
  });

  it("rechaza editar la unidad 1 porque es del comprador", async () => {
    const { supabase } = createSupabaseMock({
      "table_reservations.select": [
        {
          data: {
            id: "res-ticket-1",
            sale_origin: "ticket",
            status: "approved",
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
              status: "pending_nomination",
              ticket_id: null,
            },
          ],
          error: null,
        },
      ],
    });
    (createClient as any).mockReturnValue(supabase);

    const { PUT } = await import("./route");
    const req = new Request(
      "http://localhost/api/ticket-reservations/res-ticket-1/units",
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          units: [
            {
              id: "unit-1",
              full_name: "Comprador Principal",
              doc_type: "dni",
              document: "11112222",
              email: "buyer@test.com",
              phone: "999999999",
            },
          ],
        }),
      },
    );

    const res = await PUT(req as any, {
      params: Promise.resolve({ id: "res-ticket-1" }),
    });
    const payload = await res.json();

    expect(res.status).toBe(409);
    expect(payload.success).toBe(false);
    expect(String(payload.error || "")).toContain("comprador");
  });

  it("rechaza nominaciones con identidad mínima inválida", async () => {
    const { supabase, calls } = createSupabaseMock({
      "table_reservations.select": [
        {
          data: {
            id: "res-ticket-1",
            sale_origin: "ticket",
            status: "approved",
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
              status: "pending_nomination",
              ticket_id: null,
            },
          ],
          error: null,
        },
      ],
    });
    (createClient as any).mockReturnValue(supabase);

    const { PUT } = await import("./route");
    const req = new Request(
      "http://localhost/api/ticket-reservations/res-ticket-1/units",
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          units: [
            {
              id: "unit-2",
              full_name: "Ana Torres",
              doc_type: "dni",
              document: "123",
              email: "ana@test.com",
            },
          ],
        }),
      },
    );

    const res = await PUT(req as any, {
      params: Promise.resolve({ id: "res-ticket-1" }),
    });
    const payload = await res.json();

    expect(res.status).toBe(400);
    expect(payload.success).toBe(false);
    expect(String(payload.error || "")).toContain("unidad 2");
    expect(
      calls.find(
        (call) =>
          call.table === "ticket_reservation_units" && call.op === "update",
      ),
    ).toBeFalsy();
  });

  it("rechaza email inválido al nominar una unidad", async () => {
    const { supabase, calls } = createSupabaseMock({
      "table_reservations.select": [
        {
          data: {
            id: "res-ticket-1",
            sale_origin: "ticket",
            status: "approved",
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
              status: "pending_nomination",
              ticket_id: null,
            },
          ],
          error: null,
        },
      ],
    });
    (createClient as any).mockReturnValue(supabase);

    const { PUT } = await import("./route");
    const req = new Request(
      "http://localhost/api/ticket-reservations/res-ticket-1/units",
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          units: [
            {
              id: "unit-2",
              full_name: "Ana Torres",
              doc_type: "dni",
              document: "12345678",
              email: "ana@test",
            },
          ],
        }),
      },
    );

    const res = await PUT(req as any, {
      params: Promise.resolve({ id: "res-ticket-1" }),
    });
    const payload = await res.json();

    expect(res.status).toBe(400);
    expect(payload.success).toBe(false);
    expect(String(payload.error || "")).toContain("Email inválido");
    expect(
      calls.find(
        (call) =>
          call.table === "ticket_reservation_units" && call.op === "update",
      ),
    ).toBeFalsy();
  });

  it("reemplaza el QR cuando se corrige una unidad ya emitida", async () => {
    const { supabase, calls } = createSupabaseMock({
      "table_reservations.select": [
        {
          data: {
            id: "res-ticket-1",
            sale_origin: "ticket",
            status: "approved",
            event_id: "event-1",
            promoter_id: null,
            ticket_type_label: "ALL NIGHT DUO",
            full_name: "Comprador",
            email: "buyer@test.com",
            phone: "999999999",
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
              status: "issued",
              full_name: "Nombre Viejo",
              doc_type: "dni",
              document: "12345678",
              email: "old@test.com",
              phone: "999999999",
              ticket_id: "old-ticket",
            },
          ],
          error: null,
        },
      ],
      "tickets.update": [{ data: null, error: null }],
      "ticket_reservation_units.update": [{ data: null, error: null }],
    });
    (createClient as any).mockReturnValue(supabase);
    (sendTicketEmail as any).mockResolvedValue({ data: { id: "mail-1" } });

    const { PUT } = await import("./route");
    const req = new Request(
      "http://localhost/api/ticket-reservations/res-ticket-1/units",
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          units: [
            {
              id: "unit-2",
              full_name: "Nombre Nuevo",
              doc_type: "dni",
              document: "87654321",
              email: "new@test.com",
              phone: "988888888",
            },
          ],
        }),
      },
    );

    const res = await PUT(req as any, {
      params: Promise.resolve({ id: "res-ticket-1" }),
    });
    const payload = await res.json();

    expect(res.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(sendTicketEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        ticketId: "old-ticket",
        toEmail: "new@test.com",
      }),
    );

    const unitUpdate = calls.find(
      (call) =>
      call.table === "ticket_reservation_units" && call.op === "update",
    );
    expect(unitUpdate?.payload).toMatchObject({
      full_name: "Nombre Nuevo",
      doc_type: "dni",
      document: "87654321",
      email: "new@test.com",
      phone: "988888888",
      status: "issued",
      ticket_id: "old-ticket",
    });
    expect(unitUpdate?.payload?.deleted_at).toBeUndefined();

    const ticketUpdate = calls.find(
      (call) => call.table === "tickets" && call.op === "update",
    );
    expect(ticketUpdate?.payload).toMatchObject({
      full_name: "Nombre Nuevo",
      doc_type: "dni",
      document: "87654321",
      email: "new@test.com",
      phone: "988888888",
    });
    expect(ticketUpdate?.payload?.qr_token).toBeDefined();
    expect(
      calls.find((call) => call.table === "tickets" && call.op === "insert"),
    ).toBeFalsy();
  });

  it("convierte el error crudo de constraint en un mensaje legible", async () => {
    const { supabase } = createSupabaseMock({
      "table_reservations.select": [
        {
          data: {
            id: "res-ticket-1",
            sale_origin: "ticket",
            status: "approved",
            doc_type: "dni",
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
              status: "pending_nomination",
              full_name: "",
              doc_type: null,
              document: "",
              email: "",
              phone: "",
              ticket_id: null,
            },
          ],
          error: null,
        },
      ],
      "ticket_reservation_units.update": [
        {
          data: null,
          error: {
            message:
              'new row for relation "ticket_reservation_units" violates check constraint "ticket_reservation_units_nomination_document_check"',
          },
        },
      ],
    });
    (createClient as any).mockReturnValue(supabase);

    const { PUT } = await import("./route");
    const req = new Request(
      "http://localhost/api/ticket-reservations/res-ticket-1/units",
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          units: [
            {
              id: "unit-2",
              full_name: "Luis Perez",
              doc_type: "dni",
              document: "87654321",
              email: "luis@test.com",
              phone: "988888888",
            },
          ],
        }),
      },
    );

    const res = await PUT(req as any, {
      params: Promise.resolve({ id: "res-ticket-1" }),
    });
    const payload = await res.json();

    expect(res.status).toBe(400);
    expect(payload.success).toBe(false);
    expect(String(payload.error || "")).toContain(
      "Completa el nombre y documento de unidad 2 antes de guardar.",
    );
    expect(String(payload.error || "")).not.toContain("violates check constraint");
  });
});
