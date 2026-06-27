import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSupabaseMock } from "../../../../../../../tests/utils/supabaseMock";

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(),
}));
vi.mock(
  "../../../../../../backoffice/app/api/reservations/utils",
  async () => {
    const actual = await vi.importActual<
      typeof import("../../../../../../backoffice/app/api/reservations/utils")
    >("../../../../../../backoffice/app/api/reservations/utils");
    return {
      ...actual,
      createTicketForReservation: vi.fn(),
    };
  },
);
vi.mock(
  "../../../../../../backoffice/app/api/reservations/email",
  () => ({
    sendTicketEmail: vi.fn(),
  }),
);

const { createClient } = await import("@supabase/supabase-js");
const { createTicketForReservation } = await import(
  "../../../../../../backoffice/app/api/reservations/utils"
);
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

  it("permite cargar el workspace público para reservas de mesa con unidades preparadas", async () => {
    const { supabase } = createSupabaseMock({
      "table_reservations.select": [
        {
          data: {
            id: "res-table-1",
            sale_origin: "table",
            status: "approved",
            ticket_quantity: 2,
            package_quantity: 1,
            total_ticket_units: 2,
            ticket_type_label: null,
            full_name: "Mesa Comprador",
            email: "mesa@test.com",
            phone: "999999999",
            doc_type: "dni",
            document: "12345678",
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
              id: "unit-1",
              unit_index: 1,
              package_index: 1,
              person_index: 1,
              status: "issued",
              full_name: "Mesa Comprador",
              doc_type: "dni",
              document: "12345678",
              email: "mesa@test.com",
              phone: "999999999",
              ticket_id: "ticket-1",
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
          ],
          error: null,
        },
      ],
    });
    (createClient as any).mockReturnValue(supabase);

    const { GET } = await import("./route");
    const req = new Request(
      "http://localhost/api/ticket-reservations/res-table-1/units",
      { method: "GET" },
    );

    const res = await GET(req as any, {
      params: Promise.resolve({ id: "res-table-1" }),
    });
    const payload = await res.json();

    expect(res.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.reservation.sale_origin).toBe("table");
    expect(payload.units.map((unit: any) => unit.id)).toEqual([
      "unit-1",
      "unit-2",
    ]);
  });

  it("autorrepara la unidad 1 cuando una reserva ticket-only aprobada quedó sin QR emitido", async () => {
    const { supabase, calls } = createSupabaseMock({
      "table_reservations.select": [
        {
          data: {
            id: "res-ticket-repair-1",
            event_id: "event-1",
            sale_origin: "ticket",
            status: "approved",
            full_name: "Blanca Mejia Hoyos",
            email: "blanca@test.com",
            phone: "999999999",
            doc_type: "dni",
            document: "12345678",
            ticket_quantity: 1,
            package_quantity: 1,
            total_ticket_units: 1,
            codes: ["BUYER-CODE"],
            ticket_type_label: "Entrada",
            promoter_id: null,
            event: {
              name: "Baby Pride 2026",
              starts_at: "2026-06-26T21:00:00.000Z",
              location: "Mr Juerga",
              event_prefix: "BABY",
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
              reservation_id: "res-ticket-repair-1",
              event_id: "event-1",
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
              reservation_id: "res-ticket-repair-1",
              event_id: "event-1",
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
              reservation_id: "res-ticket-repair-1",
              event_id: "event-1",
              unit_index: 1,
              package_index: 1,
              person_index: 1,
              status: "issued",
              full_name: "Blanca Mejia Hoyos",
              doc_type: "dni",
              document: "12345678",
              email: "blanca@test.com",
              phone: "999999999",
              ticket_id: "ticket-buyer-1",
            },
          ],
          error: null,
        },
      ],
      "ticket_reservation_units.update": [{ data: null, error: null }],
      "codes.select": [
        {
          data: [{ id: "code-1", code: "BUYER-CODE", person_index: 1 }],
          error: null,
        },
      ],
    });
    (createClient as any).mockReturnValue(supabase);
    (createTicketForReservation as any).mockResolvedValue({
      ticketId: "ticket-buyer-1",
      code: "BUYER-CODE",
    });

    const { GET } = await import("./route");
    const req = new Request(
      "http://localhost/api/ticket-reservations/res-ticket-repair-1/units",
      { method: "GET" },
    );

    const res = await GET(req as any, {
      params: Promise.resolve({ id: "res-ticket-repair-1" }),
    });
    const payload = await res.json();

    expect(res.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(createTicketForReservation).toHaveBeenCalledTimes(1);
    expect(payload.units).toEqual([
      expect.objectContaining({
        id: "unit-1",
        status: "issued",
        ticket_id: "ticket-buyer-1",
        claim_code: "BUYER-CODE",
      }),
    ]);

    const unitUpdate = calls.find(
      (call) =>
        call.table === "ticket_reservation_units" && call.op === "update",
    );
    expect(unitUpdate?.payload).toMatchObject({
      status: "issued",
      ticket_id: "ticket-buyer-1",
      full_name: "Blanca Mejia Hoyos",
      email: "blanca@test.com",
      phone: "999999999",
      doc_type: "dni",
      document: "12345678",
    });
  });

  it("expone claim_code y claim_url por unidad y completa faltantes de forma idempotente", async () => {
    const { supabase, calls } = createSupabaseMock({
      "table_reservations.select": [
        {
          data: {
            id: "res-ticket-claims",
            event_id: "event-claims-1",
            sale_origin: "ticket",
            status: "approved",
            ticket_quantity: 2,
            package_quantity: 1,
            total_ticket_units: 2,
            ticket_type_label: "2 QR ALL NIGHT",
            codes: ["LEGACY-1"],
            event: {
              name: "Baby Lima",
              starts_at: "2026-05-31T23:00:00.000Z",
              location: "Centro de Convenciones",
              event_prefix: "BABY",
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
              full_name: "Ana Torres",
              doc_type: "dni",
              document: "12345678",
              email: "ana@test.com",
              phone: "999999999",
              ticket_id: "ticket-1",
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
          ],
          error: null,
        },
      ],
      "codes.select": [
        {
          data: [{ id: "code-1", code: "LEGACY-1", person_index: 1 }],
          error: null,
        },
      ],
      "codes.insert": [
        {
          data: [{ id: "code-2", code: "BC-BABY-TCLAIMS-002" }],
          error: null,
        },
      ],
      "table_reservations.update": [{ data: null, error: null }],
    });
    (createClient as any).mockReturnValue(supabase);

    const { GET } = await import("./route");
    const req = new Request(
      "http://localhost/api/ticket-reservations/res-ticket-claims/units",
      { method: "GET" },
    );

    const res = await GET(req as any, {
      params: Promise.resolve({ id: "res-ticket-claims" }),
    });
    const payload = await res.json();

    expect(res.status).toBe(200);
    expect(payload.units).toEqual([
      expect.objectContaining({
        id: "unit-1",
        claim_code: "LEGACY-1",
        claim_url: "https://babyclubaccess.com/registro?code=LEGACY-1",
      }),
      expect.objectContaining({
        id: "unit-2",
        claim_code: "BC-BABY-TCLAIMS-002",
        claim_url:
          "https://babyclubaccess.com/registro?code=BC-BABY-TCLAIMS-002",
      }),
    ]);

    const codesInsert = calls.find(
      (call) => call.table === "codes" && call.op === "insert",
    );
    expect(codesInsert?.payload).toEqual([
      expect.objectContaining({
        table_reservation_id: "res-ticket-claims",
        person_index: 2,
      }),
    ]);

    const reservationUpdate = calls.find(
      (call) => call.table === "table_reservations" && call.op === "update",
    );
    expect(reservationUpdate?.payload).toMatchObject({
      codes: ["LEGACY-1", "BC-BABY-TCLAIMS-002"],
    });
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

  it("rechaza nominar una unidad con el mismo documento del comprador", async () => {
    const { supabase, calls } = createSupabaseMock({
      "table_reservations.select": [
        {
          data: {
            id: "res-ticket-1",
            sale_origin: "ticket",
            status: "approved",
            full_name: "Comprador Principal",
            email: "buyer@test.com",
            phone: "999999999",
            doc_type: "dni",
            document: "11112222",
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
              document: "11112222",
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

    expect(res.status).toBe(409);
    expect(payload.success).toBe(false);
    expect(String(payload.error || "")).toContain("documento");
    expect(
      calls.find(
        (call) =>
          call.table === "ticket_reservation_units" && call.op === "update",
      ),
    ).toBeFalsy();
  });

  it("usa la cabecera de la reserva como identidad canonica del comprador aunque la unidad 1 este desfasada", async () => {
    const { supabase, calls } = createSupabaseMock({
      "table_reservations.select": [
        {
          data: {
            id: "res-ticket-1",
            sale_origin: "ticket",
            status: "approved",
            full_name: "Comprador Canonico",
            email: "buyer@canonical.test",
            phone: "955555555",
            doc_type: "dni",
            document: "22223333",
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
              full_name: "Buyer Viejo",
              doc_type: "dni",
              document: "11112222",
              email: "buyer@stale.test",
              phone: "944444444",
              ticket_id: null,
            },
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
              document: "22223333",
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

    expect(res.status).toBe(409);
    expect(payload.success).toBe(false);
    expect(String(payload.error || "")).toContain("documento");
    expect(
      calls.find(
        (call) =>
          call.table === "ticket_reservation_units" && call.op === "update",
      ),
    ).toBeFalsy();
  });

  it("rechaza nominar una unidad con la misma identidad de otra unidad de la reserva", async () => {
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
              id: "unit-1",
              unit_index: 1,
              status: "pending_nomination",
              full_name: "Comprador Principal",
              doc_type: "dni",
              document: "11112222",
              email: "buyer@test.com",
              phone: "999999999",
              ticket_id: null,
            },
            {
              id: "unit-2",
              unit_index: 2,
              status: "nominated",
              full_name: "Ana Torres",
              doc_type: "dni",
              document: "12345678",
              email: "ana@test.com",
              phone: "977777777",
              ticket_id: null,
            },
            {
              id: "unit-3",
              unit_index: 3,
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
              id: "unit-3",
              full_name: "Ana Torres",
              doc_type: "ce",
              document: "ABC123456",
              email: "ana@test.com",
              phone: "966666666",
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
    expect(String(payload.error || "")).toContain("unidad 2");
    expect(
      calls.find(
        (call) =>
          call.table === "ticket_reservation_units" && call.op === "update",
      ),
    ).toBeFalsy();
  });

  it("rechaza nominar una unidad con la misma combinacion nombre y telefono de otra unidad", async () => {
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
              id: "unit-1",
              unit_index: 1,
              status: "pending_nomination",
              full_name: "Comprador Principal",
              doc_type: "dni",
              document: "11112222",
              email: "buyer@test.com",
              phone: "999999999",
              ticket_id: null,
            },
            {
              id: "unit-2",
              unit_index: 2,
              status: "nominated",
              full_name: "Ana Torres",
              doc_type: "dni",
              document: "12345678",
              email: "ana+1@test.com",
              phone: "977777777",
              ticket_id: null,
            },
            {
              id: "unit-3",
              unit_index: 3,
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
              id: "unit-3",
              full_name: "Ana Torres",
              doc_type: "ce",
              document: "CE9988776",
              email: "ana+2@test.com",
              phone: "977777777",
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
    expect(String(payload.error || "")).toContain("misma persona");
    expect(
      calls.find(
        (call) =>
          call.table === "ticket_reservation_units" && call.op === "update",
      ),
    ).toBeFalsy();
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
    expect(ticketUpdate?.payload?.issued_at).toBeUndefined();
    expect(ticketUpdate?.payload?.updated_at).toBeUndefined();
    expect(
      calls.find((call) => call.table === "tickets" && call.op === "insert"),
    ).toBeFalsy();
  });

  it("vuelve a validar unicidad por evento antes de reemitir una unidad ya emitida", async () => {
    const { supabase, calls } = createSupabaseMock({
      "table_reservations.select": [
        {
          data: {
            id: "res-ticket-1",
            sale_origin: "ticket",
            status: "approved",
            event_id: "event-1",
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
      "tickets.select": [
        {
          data: [
            {
              id: "ticket-other",
              person_id: "person-other",
              table_reservation_id: "res-other",
              qr_token: "qr-other",
              full_name: "Nombre Nuevo",
              email: "new@test.com",
              phone: "988888888",
              doc_type: "dni",
              document: "87654321",
              dni: "87654321",
              code: { code: "OTHER-CODE", type: "courtesy" },
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

    expect(res.status).toBe(409);
    expect(payload.success).toBe(false);
    expect(String(payload.error || "")).toContain("QR activo");
    expect(
      calls.find((call) => call.table === "tickets" && call.op === "update"),
    ).toBeFalsy();
    expect(
      calls.find(
        (call) =>
          call.table === "ticket_reservation_units" && call.op === "update",
      ),
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
