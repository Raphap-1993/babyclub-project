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

  it("resuelve el tipo de entrada desde DB y persiste snapshot de precio", async () => {
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
      ticket_quantity: 2,
      amount: 42,
      amount_cents: 4200,
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
      ticket_quantity: 2,
      ticket_unit_price: 21,
      ticket_total_amount: 42,
      status: "pending",
      promoter_id: "prom-1",
      promoter_link_code_id: "code-link-1",
      promoter_link_code: "PROM01",
    });
    expect(insertCall?.payload.attendees).toHaveLength(2);
    expect(insertCall?.payload.attendees[0]).toMatchObject({
      person_index: 1,
      doc_type: "dni",
      document: "12345678",
      full_name: "Ana Torres Rios",
    });
    expect(insertCall?.payload.attendees[1]).toMatchObject({
      person_index: 2,
      doc_type: "dni",
      document: "12345678",
      full_name: "Ana Torres Rios",
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
});
