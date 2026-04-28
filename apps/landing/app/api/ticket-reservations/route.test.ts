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
    });
  });
});
