import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSupabaseMock } from "../../../../../tests/utils/supabaseMock";

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(),
}));

const { createClient } = await import("@supabase/supabase-js");

describe("POST /api/ticket-reservations", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env.SUPABASE_URL = "http://localhost:54321";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-key";
  });

  it("resuelve el tipo de entrada desde DB, persiste compra por paquetes y crea unidades pendientes", async () => {
    const { supabase, calls } = createSupabaseMock({
      "events.select": [
        {
          data: {
            id: "event-1",
            event_prefix: "BABY",
            is_active: true,
            closed_at: null,
            sale_status: "on_sale",
            sale_public_message: null,
            early_bird_enabled: true,
            ticket_types: [
              {
                id: "type-all-night-2",
                code: "all_night_2",
                label: "2 QR ALL NIGHT",
                description: "Incluye 2 tragos a eleccion",
                sale_phase: "all_night",
                ticket_quantity: 2,
                price: 42,
                currency_code: "PEN",
                is_active: true,
                sort_order: 20,
              },
            ],
          },
          error: null,
        },
      ],
      "table_reservations.insert": [
        {
          data: { id: "res-ticket-1" },
          error: null,
        },
      ],
      "ticket_reservation_units.insert": [
        {
          data: null,
          error: null,
        },
      ],
      "codes.insert": [
        {
          data: [
            { id: "code-1", code: "BC-BABY-2-QR-001" },
            { id: "code-2", code: "BC-BABY-2-QR-002" },
            { id: "code-3", code: "BC-BABY-2-QR-003" },
            { id: "code-4", code: "BC-BABY-2-QR-004" },
            { id: "code-5", code: "BC-BABY-2-QR-005" },
            { id: "code-6", code: "BC-BABY-2-QR-006" },
          ],
          error: null,
        },
      ],
      "table_reservations.update": [{ data: null, error: null }],
    });
    (createClient as any).mockReturnValue(supabase);

    const { POST } = await import("./route");
    const req = new Request("http://localhost/api/ticket-reservations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event_id: "event-1",
        doc_type: "dni",
        document: "12345678",
        nombre: "Ana",
        apellido_paterno: "Torres",
        apellido_materno: "Rios",
        email: "ana@test.com",
        telefono: "999999999",
        payment_method: "culqi",
        ticket_type_code: "all_night_2",
        package_quantity: 3,
        promoter_id: "prom-1",
        promoter_link_code_id: "code-link-1",
        promoter_link_code: "PROM01",
      }),
    });

    const res = await POST(req as any);
    const payload = await res.json();

    expect(res.status).toBe(200);
    expect(payload).toMatchObject({
      success: true,
      reservationId: "res-ticket-1",
      ticket_type_code: "all_night_2",
      ticket_type_label: "2 QR ALL NIGHT",
      ticket_quantity: 6,
      package_quantity: 3,
      total_ticket_units: 6,
      amount: 126,
      amount_cents: 12600,
    });

    const insertCall = calls.find(
      (call) => call.table === "table_reservations" && call.op === "insert",
    );
    expect(insertCall?.payload).toMatchObject({
      event_id: "event-1",
      sale_origin: "ticket",
      ticket_pricing_phase: "all_night",
      ticket_type_id: "type-all-night-2",
      ticket_type_code: "all_night_2",
      ticket_type_label: "2 QR ALL NIGHT",
      ticket_quantity: 6,
      package_quantity: 3,
      total_ticket_units: 6,
      ticket_unit_price: 21,
      ticket_total_amount: 126,
      status: "pending",
      promoter_id: "prom-1",
      promoter_link_code_id: "code-link-1",
      promoter_link_code: "PROM01",
    });
    expect(insertCall?.payload.attendees).toHaveLength(1);
    expect(insertCall?.payload.attendees[0]).toMatchObject({
      person_index: 1,
      doc_type: "dni",
      document: "12345678",
      full_name: "Ana Torres Rios",
    });

    const unitsInsertCall = calls.find(
      (call) =>
        call.table === "ticket_reservation_units" && call.op === "insert",
    );
    expect(unitsInsertCall?.payload).toHaveLength(6);
    expect(unitsInsertCall?.payload[0]).toMatchObject({
      reservation_id: "res-ticket-1",
      event_id: "event-1",
      package_index: 1,
      person_index: 1,
      unit_index: 1,
      status: "pending_nomination",
    });
    expect(unitsInsertCall?.payload[5]).toMatchObject({
      package_index: 3,
      person_index: 2,
      unit_index: 6,
      status: "pending_nomination",
    });

    const codesInsertCall = calls.find(
      (call) => call.table === "codes" && call.op === "insert",
    );
    expect(codesInsertCall?.payload).toHaveLength(6);
    expect(codesInsertCall?.payload[0]).toMatchObject({
      event_id: "event-1",
      table_reservation_id: "res-ticket-1",
      person_index: 1,
      type: "courtesy",
      is_active: true,
      max_uses: 1,
    });
    expect(codesInsertCall?.payload[5]).toMatchObject({
      table_reservation_id: "res-ticket-1",
      person_index: 6,
      type: "courtesy",
    });

    const reservationUpdateCall = calls.find(
      (call) => call.table === "table_reservations" && call.op === "update",
    );
    expect(reservationUpdateCall?.payload).toMatchObject({
      codes: [
        "BC-BABY-2-QR-001",
        "BC-BABY-2-QR-002",
        "BC-BABY-2-QR-003",
        "BC-BABY-2-QR-004",
        "BC-BABY-2-QR-005",
        "BC-BABY-2-QR-006",
      ],
    });
  });

  it("siembra códigos por unidad para compras públicas ticket-only", async () => {
    const { supabase, calls } = createSupabaseMock({
      "events.select": [
        {
          data: {
            id: "event-1",
            event_prefix: "BABY",
            is_active: true,
            closed_at: null,
            sale_status: "on_sale",
            sale_public_message: null,
            early_bird_enabled: true,
            ticket_types: [
              {
                id: "type-all-night-2",
                code: "all_night_2",
                label: "2 QR ALL NIGHT",
                sale_phase: "all_night",
                ticket_quantity: 2,
                price: 42,
                currency_code: "PEN",
                is_active: true,
                sort_order: 20,
              },
            ],
          },
          error: null,
        },
      ],
      "table_reservations.insert": [
        {
          data: { id: "res-ticket-codes" },
          error: null,
        },
      ],
      "ticket_reservation_units.insert": [
        {
          data: null,
          error: null,
        },
      ],
      "codes.insert": [
        {
          data: [
            { id: "code-1", code: "BC-BABY-TCODES-001" },
            { id: "code-2", code: "BC-BABY-TCODES-002" },
          ],
          error: null,
        },
      ],
      "table_reservations.update": [{ data: null, error: null }],
    });
    (createClient as any).mockReturnValue(supabase);

    const { POST } = await import("./route");
    const req = new Request("http://localhost/api/ticket-reservations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event_id: "event-1",
        doc_type: "dni",
        document: "12345678",
        nombre: "Ana",
        apellido_paterno: "Torres",
        apellido_materno: "Rios",
        email: "ana@test.com",
        telefono: "999999999",
        payment_method: "culqi",
        ticket_type_code: "all_night_2",
      }),
    });

    const res = await POST(req as any);

    expect(res.status).toBe(200);

    const codesInsert = calls.find(
      (call) => call.table === "codes" && call.op === "insert",
    );
    expect(codesInsert?.payload).toHaveLength(2);
    expect(codesInsert?.payload).toEqual([
      expect.objectContaining({
        event_id: "event-1",
        table_reservation_id: "res-ticket-codes",
        person_index: 1,
        is_active: true,
        max_uses: 1,
      }),
      expect.objectContaining({
        event_id: "event-1",
        table_reservation_id: "res-ticket-codes",
        person_index: 2,
        is_active: true,
        max_uses: 1,
      }),
    ]);

    const reservationUpdate = calls.find(
      (call) => call.table === "table_reservations" && call.op === "update",
    );
    expect(reservationUpdate?.payload).toMatchObject({
      codes: ["BC-BABY-TCODES-001", "BC-BABY-TCODES-002"],
    });
  });

  it("guarda datos de segunda persona cuando la compra trae 2 entradas", async () => {
    const { supabase, calls } = createSupabaseMock({
      "events.select": [
        {
          data: {
            id: "event-1",
            is_active: true,
            closed_at: null,
            sale_status: "on_sale",
            sale_public_message: null,
            early_bird_enabled: true,
            ticket_types: [
              {
                id: "type-all-night-2",
                code: "all_night_2",
                label: "2 QR ALL NIGHT",
                sale_phase: "all_night",
                ticket_quantity: 2,
                price: 42,
                currency_code: "PEN",
                is_active: true,
                sort_order: 20,
              },
            ],
          },
          error: null,
        },
      ],
      "table_reservations.insert": [
        {
          data: { id: "res-ticket-1" },
          error: null,
        },
      ],
    });
    (createClient as any).mockReturnValue(supabase);

    const { POST } = await import("./route");
    const req = new Request("http://localhost/api/ticket-reservations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event_id: "event-1",
        doc_type: "dni",
        document: "12345678",
        nombre: "Ana",
        apellido_paterno: "Torres",
        apellido_materno: "Rios",
        email: "ana@test.com",
        telefono: "999999999",
        payment_method: "culqi",
        ticket_type_code: "all_night_2",
        attendees: [
          {
            doc_type: "dni",
            document: "12345678",
            nombre: "Ana",
            apellido_paterno: "Torres",
            apellido_materno: "Rios",
            email: "ana@test.com",
            phone: "999999999",
          },
          {
            doc_type: "dni",
            document: "87654321",
            nombre: "Luis",
            apellido_paterno: "Perez",
            apellido_materno: "Diaz",
            email: "luis@test.com",
            phone: "988888888",
          },
        ],
      }),
    });

    const res = await POST(req as any);
    const payload = await res.json();

    expect(res.status).toBe(200);
    expect(payload.success).toBe(true);

    const insertCall = calls.find(
      (call) => call.table === "table_reservations" && call.op === "insert",
    );
    expect(insertCall?.payload.attendees[1]).toMatchObject({
      person_index: 2,
      doc_type: "dni",
      document: "87654321",
      full_name: "Luis Perez Diaz",
      email: "luis@test.com",
      phone: "988888888",
    });
  });

  it("bloquea la compra si el paquete esperado ya no coincide con la resolucion actual del servidor", async () => {
    const { supabase, calls } = createSupabaseMock({
      "events.select": [
        {
          data: {
            id: "event-1",
            is_active: true,
            closed_at: null,
            sale_status: "on_sale",
            sale_public_message: null,
            early_bird_enabled: true,
            ticket_types: [
              {
                id: "type-all-night-2",
                code: "all_night_2",
                label: "ALL NIGHT DUO",
                sale_phase: "all_night",
                ticket_quantity: 3,
                price: 60,
                currency_code: "PEN",
                is_active: true,
                sort_order: 30,
              },
            ],
          },
          error: null,
        },
      ],
    });
    (createClient as any).mockReturnValue(supabase);

    const { POST } = await import("./route");
    const req = new Request("http://localhost/api/ticket-reservations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event_id: "event-1",
        doc_type: "dni",
        document: "12345678",
        nombre: "Ana",
        apellido_paterno: "Torres",
        apellido_materno: "Rios",
        email: "ana@test.com",
        telefono: "999999999",
        payment_method: "culqi",
        ticket_type_code: "all_night_2",
        package_quantity: 1,
        expected_ticket_type_id: "type-all-night-2",
        expected_ticket_quantity: 2,
        expected_ticket_total_amount: 45,
      }),
    });

    const res = await POST(req as any);
    const payload = await res.json();

    expect(res.status).toBe(409);
    expect(payload.success).toBe(false);
    expect(payload.code).toBe("ticket_type_changed");
    expect(String(payload.error || "")).toContain("cambió");
    expect(payload.actual).toMatchObject({
      ticket_type_id: "type-all-night-2",
      ticket_type_code: "all_night_2",
      ticket_quantity: 3,
      total_ticket_units: 3,
      total_amount: 60,
    });
    expect(
      calls.find(
        (call) => call.table === "table_reservations" && call.op === "insert",
      ),
    ).toBeFalsy();
  });

  it("rechaza email inválido en la compra principal", async () => {
    const { supabase, calls } = createSupabaseMock({});
    (createClient as any).mockReturnValue(supabase);

    const { POST } = await import("./route");
    const req = new Request("http://localhost/api/ticket-reservations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event_id: "event-1",
        doc_type: "dni",
        document: "12345678",
        nombre: "Ana",
        apellido_paterno: "Torres",
        apellido_materno: "Rios",
        email: "ana@test",
        telefono: "999999999",
        payment_method: "culqi",
        ticket_type_code: "all_night_2",
      }),
    });

    const res = await POST(req as any);
    const payload = await res.json();

    expect(res.status).toBe(400);
    expect(payload.success).toBe(false);
    expect(String(payload.error || "")).toContain("Email inválido");
    expect(
      calls.find(
        (call) => call.table === "table_reservations" && call.op === "insert",
      ),
    ).toBeFalsy();
  });

  it("rechaza email inválido en asistentes adicionales", async () => {
    const { supabase, calls } = createSupabaseMock({
      "events.select": [
        {
          data: {
            id: "event-1",
            is_active: true,
            closed_at: null,
            sale_status: "on_sale",
            sale_public_message: null,
            early_bird_enabled: true,
            ticket_types: [
              {
                id: "type-all-night-2",
                code: "all_night_2",
                label: "2 QR ALL NIGHT",
                sale_phase: "all_night",
                ticket_quantity: 2,
                price: 42,
                currency_code: "PEN",
                is_active: true,
                sort_order: 20,
              },
            ],
          },
          error: null,
        },
      ],
    });
    (createClient as any).mockReturnValue(supabase);

    const { POST } = await import("./route");
    const req = new Request("http://localhost/api/ticket-reservations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event_id: "event-1",
        doc_type: "dni",
        document: "12345678",
        nombre: "Ana",
        apellido_paterno: "Torres",
        apellido_materno: "Rios",
        email: "ana@test.com",
        telefono: "999999999",
        payment_method: "culqi",
        ticket_type_code: "all_night_2",
        attendees: [
          {
            doc_type: "dni",
            document: "12345678",
            nombre: "Ana",
            apellido_paterno: "Torres",
            apellido_materno: "Rios",
            email: "ana@test.com",
          },
          {
            doc_type: "dni",
            document: "87654321",
            nombre: "Luis",
            apellido_paterno: "Perez",
            apellido_materno: "Diaz",
            email: "luis@test",
          },
        ],
      }),
    });

    const res = await POST(req as any);
    const payload = await res.json();

    expect(res.status).toBe(400);
    expect(payload.success).toBe(false);
    expect(String(payload.error || "")).toContain("entrada 2");
    expect(
      calls.find(
        (call) => call.table === "table_reservations" && call.op === "insert",
      ),
    ).toBeFalsy();
  });

  it("bloquea la reserva si el comprador ya tiene un QR activo para el mismo evento", async () => {
    const { supabase, calls } = createSupabaseMock({
      "events.select": [
        {
          data: {
            id: "event-1",
            is_active: true,
            closed_at: null,
            sale_status: "on_sale",
            sale_public_message: null,
            early_bird_enabled: true,
            ticket_types: [
              {
                id: "type-all-night-1",
                code: "all_night_1",
                label: "ALL NIGHT SOLO",
                sale_phase: "all_night",
                ticket_quantity: 1,
                price: 20,
                currency_code: "PEN",
                is_active: true,
                sort_order: 10,
              },
            ],
          },
          error: null,
        },
      ],
      "tickets.select": [
        {
          data: [
            {
              id: "ticket-existing-1",
              person_id: "person-existing-1",
              table_reservation_id: null,
              qr_token: "qr-existing-1",
              full_name: "Phil Chota Ibaran",
              email: "francistc2001@gmail.com",
              phone: "987654321",
              doc_type: "dni",
              document: "12345678",
              dni: "12345678",
              code: { code: "GENERAL-1", type: "general" },
            },
          ],
          error: null,
        },
      ],
    });
    (createClient as any).mockReturnValue(supabase);

    const { POST } = await import("./route");
    const req = new Request("http://localhost/api/ticket-reservations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event_id: "event-1",
        doc_type: "dni",
        document: "12345678",
        nombre: "Phil",
        apellido_paterno: "Chota",
        apellido_materno: "Ibaran",
        email: "francistc2001@gmail.com",
        telefono: "987654321",
        payment_method: "culqi",
        ticket_type_code: "all_night_1",
      }),
    });

    const res = await POST(req as any);
    const payload = await res.json();

    expect(res.status).toBe(409);
    expect(payload.success).toBe(false);
    expect(String(payload.error || "")).toContain(
      "ya tiene un QR activo para este evento",
    );
    expect(payload.code).toBe("event_ticket_conflict");
    expect(
      calls.find(
        (call) => call.table === "table_reservations" && call.op === "insert",
      ),
    ).toBeFalsy();
  });
});
