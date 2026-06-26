import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSupabaseMock } from "../../../../../tests/utils/supabaseMock";

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(),
}));

vi.mock("shared/email/resend", () => ({
  sendEmail: vi.fn(),
}));

const { createClient } = await import("@supabase/supabase-js");
const { sendEmail } = await import("shared/email/resend");

describe("POST /api/tickets", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env.SUPABASE_URL = "http://localhost:54321";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-key";
  });

  it("bloquea ticket free cuando el release flag no está habilitado", async () => {
    delete process.env.ENABLE_FREE_QR_CODES;

    const { supabase } = createSupabaseMock({
      "codes.select": [
        {
          data: {
            id: "code-1",
            code: "FREE-123",
            type: "free",
            event_id: "event-1",
            promoter_id: null,
            is_active: true,
            max_uses: 999,
            uses: 0,
            expires_at: null,
          },
          error: null,
        },
      ],
    });

    (createClient as any).mockReturnValue(supabase);
    const { POST } = await import("./route");

    const req = new Request("http://localhost/api/tickets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: "FREE-123",
        doc_type: "dni",
        document: "12345678",
        nombre: "Ana",
        apellido_paterno: "Perez",
        apellido_materno: "Lopez",
        email: "ana@example.com",
        telefono: "+51999999999",
        birthdate: "1999-01-01",
      }),
    });

    const res = await POST(req as any);
    const payload = await res.json();

    expect(res.status).toBe(409);
    expect(payload.code).toBe("free_qr_disabled");
  });

  it("crea ticket free con código válido cuando el release flag está habilitado", async () => {
    process.env.ENABLE_FREE_QR_CODES = "true";

    const { supabase } = createSupabaseMock({
      "codes.select": [
        {
          data: {
            id: "code-1",
            code: "FREE-123",
            type: "free",
            event_id: "event-1",
            promoter_id: null,
            is_active: true,
            max_uses: 999,
            uses: 0,
            expires_at: null,
          },
          error: null,
        },
      ],
      "events.select": [
        { data: null, error: null }, // capacity check (no capacity → skip)
        {
          data: {
            id: "event-1",
            is_active: true,
            closed_at: null,
            sale_status: "on_sale",
            sale_public_message: null,
          },
          error: null,
        },
      ],
      "persons.select": [{ data: null, error: null }],
      "persons.insert": [{ data: { id: "person-1" }, error: null }],
      "tickets.select": [
        { data: null, error: null },
        { data: null, error: null },
      ],
      "tickets.insert": [{ data: { id: "ticket-1" }, error: null }],
      "codes.update": [{ data: null, error: null }],
    });

    (createClient as any).mockReturnValue(supabase);
    const { POST } = await import("./route");

    const req = new Request("http://localhost/api/tickets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: "FREE-123",
        doc_type: "dni",
        document: "12345678",
        nombre: "Ana",
        apellido_paterno: "Perez",
        apellido_materno: "Lopez",
        email: "ana@example.com",
        telefono: "+51999999999",
        birthdate: "1999-01-01",
      }),
    });

    const res = await POST(req as any);
    const payload = await res.json();

    expect(res.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.ticketId).toBe("ticket-1");
    expect(typeof payload.qr).toBe("string");
    expect(sendEmail).toHaveBeenCalledTimes(1);
  });

  it("envía correo automático al crear un ticket de entrada", async () => {
    const { supabase } = createSupabaseMock({
      "codes.select": [
        {
          data: {
            id: "code-2",
            code: "ENTRY-123",
            event_id: "event-2",
            promoter_id: null,
            is_active: true,
            max_uses: 999,
            uses: 0,
            expires_at: null,
          },
          error: null,
        },
      ],
      "events.select": [
        { data: null, error: null },
        {
          data: {
            id: "event-2",
            name: "Evento Baby",
            location: "Club",
            starts_at: "2026-06-01T20:00:00Z",
            is_active: true,
            closed_at: null,
            sale_status: "on_sale",
            sale_public_message: null,
          },
          error: null,
        },
      ],
      "persons.select": [{ data: null, error: null }],
      "persons.insert": [{ data: { id: "person-2" }, error: null }],
      "tickets.select": [
        { data: null, error: null },
        { data: null, error: null },
      ],
      "tickets.insert": [{ data: { id: "ticket-2" }, error: null }],
      "codes.update": [{ data: null, error: null }],
    });

    (createClient as any).mockReturnValue(supabase);
    (sendEmail as any).mockResolvedValue({ data: { id: "email-1" }, error: null });
    const { POST } = await import("./route");

    const req = new Request("http://localhost/api/tickets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: "ENTRY-123",
        doc_type: "dni",
        document: "12345678",
        nombre: "Ana",
        apellido_paterno: "Perez",
        apellido_materno: "Lopez",
        email: "ana@example.com",
        telefono: "+51999999999",
        birthdate: "1999-01-01",
      }),
    });

    const res = await POST(req as any);
    const payload = await res.json();

    expect(res.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.ticketId).toBe("ticket-2");
    expect(payload.emailSent).toBe(true);
    expect(sendEmail).toHaveBeenCalledTimes(1);
  });

  it("bloquea código de mesa si la reserva aún no está aprobada", async () => {
    const { supabase } = createSupabaseMock({
      "codes.select": [
        {
          data: {
            id: "code-table-1",
            code: "LOVEI53396",
            event_id: "event-1",
            promoter_id: null,
            is_active: true,
            max_uses: 1,
            uses: 0,
            expires_at: null,
            table_reservation_id: "res-1",
            type: "table",
          },
          error: null,
        },
      ],
      "events.select": [
        {
          data: {
            id: "event-1",
            is_active: true,
            closed_at: null,
            sale_status: "on_sale",
            sale_public_message: null,
          },
          error: null,
        },
      ],
      "table_reservations.select": [
        {
          data: {
            id: "res-1",
            event_id: "event-1",
            table_id: "table-1",
            product_id: "prod-1",
            status: "pending",
          },
          error: null,
        },
      ],
    });

    (createClient as any).mockReturnValue(supabase);
    const { POST } = await import("./route");

    const req = new Request("http://localhost/api/tickets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: "LOVEI53396",
        doc_type: "dni",
        document: "12345678",
        nombre: "Diego",
        apellido_paterno: "Huansi",
        apellido_materno: "Ruiz",
        email: "diego@example.com",
        telefono: "+51940503791",
        birthdate: "1999-01-01",
      }),
    });

    const res = await POST(req as any);
    const payload = await res.json();

    expect(res.status).toBe(400);
    expect(payload.success).toBe(false);
    expect(String(payload.error || "")).toContain("aún no está aprobada");
  });

  it("crea ticket de mesa heredando table_id y product_id de la reserva", async () => {
    const { supabase, calls } = createSupabaseMock({
      "codes.select": [
        {
          data: {
            id: "code-table-2",
            code: "LOVEI1764",
            event_id: "event-1",
            promoter_id: null,
            is_active: true,
            max_uses: 1,
            uses: 0,
            expires_at: null,
            table_reservation_id: "res-2",
            type: "table",
          },
          error: null,
        },
      ],
      "events.select": [
        { data: null, error: null }, // capacity check (no capacity → skip)
        {
          data: {
            id: "event-1",
            is_active: true,
            closed_at: null,
            sale_status: "on_sale",
            sale_public_message: null,
          },
          error: null,
        },
      ],
      "table_reservations.select": [
        {
          data: {
            id: "res-2",
            event_id: "event-1",
            table_id: "table-22",
            product_id: "prod-22",
            status: "approved",
          },
          error: null,
        },
      ],
      "persons.select": [{ data: null, error: null }],
      "persons.insert": [{ data: { id: "person-22" }, error: null }],
      "tickets.select": [
        { data: null, error: null },
        { data: null, error: null },
      ],
      "tickets.insert": [{ data: { id: "ticket-22" }, error: null }],
      "codes.update": [{ data: null, error: null }],
    });

    (createClient as any).mockReturnValue(supabase);
    const { POST } = await import("./route");

    const req = new Request("http://localhost/api/tickets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: "LOVEI1764",
        doc_type: "dni",
        document: "87654321",
        nombre: "Lorena",
        apellido_paterno: "Pelaez",
        apellido_materno: "Bardales",
        email: "lorena@example.com",
        telefono: "+51968284152",
        birthdate: "1998-02-10",
      }),
    });

    const res = await POST(req as any);
    const payload = await res.json();
    const ticketInsertCall = calls.find((call) => call.table === "tickets" && call.op === "insert");

    expect(res.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.ticketId).toBe("ticket-22");
    expect(ticketInsertCall?.payload?.table_id).toBe("table-22");
    expect(ticketInsertCall?.payload?.product_id).toBe("prod-22");
    expect(ticketInsertCall?.payload?.table_reservation_id).toBe("res-2");
  });

  it("retorna el ticket existente cuando la misma persona reutiliza el código de una unidad ya emitida", async () => {
    const { supabase, calls } = createSupabaseMock({
      "codes.select": [
        {
          data: {
            id: "code-unit-issued",
            code: "UNIT-ISSUED-1",
            event_id: "event-1",
            promoter_id: null,
            is_active: true,
            max_uses: 1,
            uses: 1,
            expires_at: null,
            table_reservation_id: "res-issued-1",
            person_index: 2,
            type: "table",
          },
          error: null,
        },
      ],
      "table_reservations.select": [
        {
          data: {
            id: "res-issued-1",
            event_id: "event-1",
            table_id: "table-issued-1",
            product_id: "prod-issued-1",
            status: "approved",
          },
          error: null,
        },
      ],
      "ticket_reservation_units.select": [
        {
          data: {
            id: "unit-issued-2",
            reservation_id: "res-issued-1",
            event_id: "event-1",
            unit_index: 2,
            status: "issued",
            ticket_id: "ticket-issued-2",
          },
          error: null,
        },
      ],
      "tickets.select": [
        {
          data: {
            id: "ticket-issued-2",
            qr_token: "qr-issued-2",
            person_id: "person-issued-2",
            payment_status: "paid",
            doc_type: "dni",
            document: "12345678",
            dni: "12345678",
          },
          error: null,
        },
      ],
    });

    (createClient as any).mockReturnValue(supabase);
    const { POST } = await import("./route");

    const req = new Request("http://localhost/api/tickets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: "UNIT-ISSUED-1",
        doc_type: "dni",
        document: "12345678",
        nombre: "Ana",
        apellido_paterno: "Perez",
        apellido_materno: "Lopez",
        email: "ana@example.com",
        telefono: "+51999999999",
        birthdate: "1999-01-01",
      }),
    });

    const res = await POST(req as any);
    const payload = await res.json();

    expect(res.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.existing).toBe(true);
    expect(payload.ticketId).toBe("ticket-issued-2");
    expect(payload.qr).toBe("qr-issued-2");
    expect(
      calls.find((call) => call.table === "tickets" && call.op === "insert"),
    ).toBeFalsy();
    expect(
      calls.find((call) => call.table === "persons" && call.op === "insert"),
    ).toBeFalsy();
  });

  it("bloquea una unidad ya emitida si el código se usa con datos de otra persona", async () => {
    const { supabase, calls } = createSupabaseMock({
      "codes.select": [
        {
          data: {
            id: "code-unit-issued",
            code: "UNIT-ISSUED-1",
            event_id: "event-1",
            promoter_id: null,
            is_active: true,
            max_uses: 1,
            uses: 1,
            expires_at: null,
            table_reservation_id: "res-issued-1",
            person_index: 2,
            type: "table",
          },
          error: null,
        },
      ],
      "table_reservations.select": [
        {
          data: {
            id: "res-issued-1",
            event_id: "event-1",
            table_id: "table-issued-1",
            product_id: "prod-issued-1",
            status: "approved",
          },
          error: null,
        },
      ],
      "ticket_reservation_units.select": [
        {
          data: {
            id: "unit-issued-2",
            reservation_id: "res-issued-1",
            event_id: "event-1",
            unit_index: 2,
            status: "issued",
            ticket_id: "ticket-issued-2",
          },
          error: null,
        },
      ],
      "tickets.select": [
        {
          data: {
            id: "ticket-issued-2",
            qr_token: "qr-issued-2",
            person_id: "person-issued-2",
            payment_status: "paid",
            doc_type: "dni",
            document: "12345678",
            dni: "12345678",
          },
          error: null,
        },
      ],
    });

    (createClient as any).mockReturnValue(supabase);
    const { POST } = await import("./route");

    const req = new Request("http://localhost/api/tickets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: "UNIT-ISSUED-1",
        doc_type: "dni",
        document: "87654321",
        nombre: "Lorena",
        apellido_paterno: "Pelaez",
        apellido_materno: "Bardales",
        email: "lorena@example.com",
        telefono: "+51968284152",
        birthdate: "1998-02-10",
      }),
    });

    const res = await POST(req as any);
    const payload = await res.json();

    expect(res.status).toBe(409);
    expect(payload.success).toBe(false);
    expect(String(payload.error || "")).toContain("otra persona");
    expect(
      calls.find((call) => call.table === "tickets" && call.op === "insert"),
    ).toBeFalsy();
    expect(
      calls.find((call) => call.table === "persons" && call.op === "insert"),
    ).toBeFalsy();
  });

  it("emite y sincroniza solo la unidad asociada al código de reserva", async () => {
    const { supabase, calls } = createSupabaseMock({
      "codes.select": [
        {
          data: {
            id: "code-unit-new",
            code: "UNIT-NEW-3",
            event_id: "event-1",
            promoter_id: null,
            is_active: true,
            max_uses: 1,
            uses: 0,
            expires_at: null,
            table_reservation_id: "res-unit-3",
            person_index: 3,
            type: "table",
          },
          error: null,
        },
      ],
      "table_reservations.select": [
        {
          data: {
            id: "res-unit-3",
            event_id: "event-1",
            table_id: "table-3",
            product_id: "prod-3",
            status: "approved",
          },
          error: null,
        },
      ],
      "ticket_reservation_units.select": [
        {
          data: {
            id: "unit-3",
            reservation_id: "res-unit-3",
            event_id: "event-1",
            unit_index: 3,
            status: "pending_nomination",
            ticket_id: null,
          },
          error: null,
        },
      ],
      "events.select": [
        { data: null, error: null },
        {
          data: {
            id: "event-1",
            is_active: true,
            closed_at: null,
            sale_status: "on_sale",
            sale_public_message: null,
          },
          error: null,
        },
      ],
      "persons.select": [{ data: null, error: null }],
      "persons.insert": [{ data: { id: "person-unit-3" }, error: null }],
      "tickets.select": [
        { data: null, error: null },
        { data: [], error: null },
      ],
      "tickets.insert": [{ data: { id: "ticket-unit-3" }, error: null }],
      "ticket_reservation_units.update": [{ data: null, error: null }],
      "codes.update": [{ data: null, error: null }],
    });

    (createClient as any).mockReturnValue(supabase);
    const { POST } = await import("./route");

    const req = new Request("http://localhost/api/tickets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: "UNIT-NEW-3",
        doc_type: "dni",
        document: "87654321",
        nombre: "Lorena",
        apellido_paterno: "Pelaez",
        apellido_materno: "Bardales",
        email: "lorena@example.com",
        telefono: "+51968284152",
        birthdate: "1998-02-10",
      }),
    });

    const res = await POST(req as any);
    const payload = await res.json();
    const ticketInsertCall = calls.find(
      (call) => call.table === "tickets" && call.op === "insert",
    );
    const unitUpdateCall = calls.find(
      (call) =>
        call.table === "ticket_reservation_units" && call.op === "update",
    );

    expect(res.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.ticketId).toBe("ticket-unit-3");
    expect(ticketInsertCall?.payload?.table_id).toBe("table-3");
    expect(ticketInsertCall?.payload?.product_id).toBe("prod-3");
    expect(ticketInsertCall?.payload?.table_reservation_id).toBe("res-unit-3");
    expect(unitUpdateCall?.payload).toEqual(
      expect.objectContaining({
        status: "issued",
        ticket_id: "ticket-unit-3",
        full_name: "Lorena Pelaez Bardales",
        doc_type: "dni",
        document: "87654321",
        email: "lorena@example.com",
        phone: "+51968284152",
      }),
    );
    expect(unitUpdateCall?.filters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "eq",
          args: ["id", "unit-3"],
        }),
        expect.objectContaining({
          type: "eq",
          args: ["reservation_id", "res-unit-3"],
        }),
      ]),
    );
  });

  it("bloquea generación cuando el evento está sold out", async () => {
    const { supabase } = createSupabaseMock({
      "codes.select": [
        {
          data: {
            id: "code-1",
            code: "FREE-123",
            event_id: "event-1",
            promoter_id: null,
            is_active: true,
            max_uses: 999,
            uses: 0,
            expires_at: null,
          },
          error: null,
        },
      ],
      "events.select": [
        { data: null, error: null }, // capacity check (no capacity → skip)
        {
          data: {
            id: "event-1",
            is_active: true,
            closed_at: null,
            sale_status: "sold_out",
            sale_public_message: "Entradas agotadas",
          },
          error: null,
        },
      ],
    });

    (createClient as any).mockReturnValue(supabase);
    const { POST } = await import("./route");

    const req = new Request("http://localhost/api/tickets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: "FREE-123",
        doc_type: "dni",
        document: "12345678",
        nombre: "Ana",
        apellido_paterno: "Perez",
        apellido_materno: "Lopez",
        email: "ana@example.com",
        telefono: "+51999999999",
        birthdate: "1999-01-01",
      }),
    });

    const res = await POST(req as any);
    const payload = await res.json();

    expect(res.status).toBe(409);
    expect(payload.success).toBe(false);
    expect(payload.code).toBe("sales_blocked");
    expect(payload.sale_status).toBe("sold_out");
  });

  it("permite generar QR de mesa aprobado aunque el evento esté sold out", async () => {
    const { supabase } = createSupabaseMock({
      "codes.select": [
        {
          data: {
            id: "code-table-3",
            code: "LOVEI9001",
            event_id: "event-1",
            promoter_id: null,
            is_active: true,
            max_uses: 1,
            uses: 0,
            expires_at: null,
            table_reservation_id: "res-3",
            type: "table",
          },
          error: null,
        },
      ],
      "events.select": [
        { data: null, error: null }, // capacity check (no capacity → skip)
        {
          data: {
            id: "event-1",
            is_active: true,
            closed_at: null,
            sale_status: "sold_out",
            sale_public_message: "Entradas agotadas",
          },
          error: null,
        },
      ],
      "table_reservations.select": [
        {
          data: {
            id: "res-3",
            event_id: "event-1",
            table_id: "table-33",
            product_id: "prod-33",
            status: "approved",
          },
          error: null,
        },
      ],
      "persons.select": [{ data: null, error: null }],
      "persons.insert": [{ data: { id: "person-33" }, error: null }],
      "tickets.select": [
        { data: null, error: null },
        { data: null, error: null },
      ],
      "tickets.insert": [{ data: { id: "ticket-33" }, error: null }],
      "codes.update": [{ data: null, error: null }],
    });

    (createClient as any).mockReturnValue(supabase);
    const { POST } = await import("./route");

    const req = new Request("http://localhost/api/tickets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: "LOVEI9001",
        doc_type: "dni",
        document: "12345678",
        nombre: "Ana",
        apellido_paterno: "Perez",
        apellido_materno: "Lopez",
        email: "ana@example.com",
        telefono: "+51999999999",
        birthdate: "1999-01-01",
      }),
    });

    const res = await POST(req as any);
    const payload = await res.json();

    expect(res.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.ticketId).toBe("ticket-33");
  });

  it("bloquea el uso de un código ya vinculado a otra persona", async () => {
    const { supabase } = createSupabaseMock({
      "codes.select": [
        {
          data: {
            id: "code-table-4",
            code: "LOVEIS7897",
            event_id: "event-1",
            promoter_id: null,
            is_active: true,
            max_uses: 1,
            uses: 1,
            expires_at: null,
            table_reservation_id: "res-4",
            type: "table",
          },
          error: null,
        },
      ],
      "events.select": [
        { data: null, error: null }, // capacity check (no capacity → skip)
        {
          data: {
            id: "event-1",
            is_active: true,
            closed_at: null,
            sale_status: "sold_out",
            sale_public_message: "Entradas agotadas",
          },
          error: null,
        },
      ],
      "table_reservations.select": [
        {
          data: {
            id: "res-4",
            event_id: "event-1",
            table_id: "table-44",
            product_id: "prod-44",
            status: "approved",
          },
          error: null,
        },
      ],
      "persons.select": [{ data: { id: "person-current" }, error: null }],
      "tickets.select": [
        {
          data: {
            id: "ticket-owner",
            qr_token: "qr-owner",
            person_id: "person-owner",
          },
          error: null,
        },
      ],
    });

    (createClient as any).mockReturnValue(supabase);
    const { POST } = await import("./route");

    const req = new Request("http://localhost/api/tickets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: "LOVEIS7897",
        doc_type: "dni",
        document: "77378843",
        nombre: "Gianella",
        apellido_paterno: "Brehaut",
        apellido_materno: "Ojeda",
        email: "gianella@example.com",
        telefono: "+51904790266",
        birthdate: "2001-09-01",
      }),
    });

    const res = await POST(req as any);
    const payload = await res.json();

    expect(res.status).toBe(409);
    expect(payload.success).toBe(false);
    expect(String(payload.error || "")).toContain("otra persona");
  });

  it("bloquea un segundo QR cuando el mismo nombre y correo ya tienen un ticket activo en el evento aunque cambie el documento", async () => {
    const { supabase, calls } = createSupabaseMock({
      "codes.select": [
        {
          data: {
            id: "code-general-66",
            code: "RAVE256",
            event_id: "event-66",
            promoter_id: null,
            is_active: true,
            max_uses: 999,
            uses: 1,
            expires_at: null,
            type: "general",
          },
          error: null,
        },
      ],
      "events.select": [
        { data: null, error: null },
        {
          data: {
            id: "event-66",
            is_active: true,
            closed_at: null,
            sale_status: "on_sale",
            sale_public_message: null,
          },
          error: null,
        },
      ],
      "persons.select": [{ data: null, error: null }],
      "persons.insert": [{ data: { id: "person-66" }, error: null }],
      "tickets.select": [
        { data: null, error: null },
        {
          data: [
            {
              id: "ticket-existing-66",
              person_id: "person-old-66",
              qr_token: "qr-existing-66",
              full_name: "ALVARO VELA DEL AGUILA",
              email: "alvaro@example.com",
              phone: "993663940",
              doc_type: "dni",
              document: "99366394",
              dni: "99366394",
              code: { code: "RAVE256", type: "general" },
            },
          ],
          error: null,
        },
      ],
    });

    (createClient as any).mockReturnValue(supabase);
    const { POST } = await import("./route");

    const req = new Request("http://localhost/api/tickets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: "RAVE256",
        doc_type: "dni",
        document: "71126993",
        nombre: "ALVARO",
        apellido_paterno: "VELA DEL",
        apellido_materno: "AGUILA",
        email: "alvaro@example.com",
        telefono: "993693940",
        birthdate: "1999-01-01",
      }),
    });

    const res = await POST(req as any);
    const payload = await res.json();
    const ticketInsertCall = calls.find(
      (call) => call.table === "tickets" && call.op === "insert",
    );

    expect(res.status).toBe(409);
    expect(payload.success).toBe(false);
    expect(payload.code).toBe("event_ticket_conflict");
    expect(payload.match_reason).toBe("full_name_email");
    expect(String(payload.error || "")).toContain("datos coincidentes");
    expect(ticketInsertCall).toBeFalsy();
  });

  it("retorna el QR existente cuando la misma persona intenta usar otro código del mismo evento", async () => {
    const { supabase, calls } = createSupabaseMock({
      "codes.select": [
        {
          data: {
            id: "code-table-5",
            code: "LOVEI5555",
            event_id: "event-1",
            promoter_id: null,
            is_active: true,
            max_uses: 1,
            uses: 0,
            expires_at: null,
            table_reservation_id: "res-5",
            type: "table",
          },
          error: null,
        },
      ],
      "events.select": [
        { data: null, error: null },
        {
          data: {
            id: "event-1",
            is_active: true,
            closed_at: null,
            sale_status: "on_sale",
            sale_public_message: null,
          },
          error: null,
        },
      ],
      "table_reservations.select": [
        {
          data: {
            id: "res-5",
            event_id: "event-1",
            table_id: "table-55",
            product_id: "prod-55",
            status: "approved",
          },
          error: null,
        },
      ],
      "persons.select": [{ data: { id: "person-55" }, error: null }],
      "tickets.select": [
        { data: null, error: null },
        {
          data: [
            {
              id: "ticket-existing-55",
              person_id: "person-55",
              qr_token: "qr-existing-55",
              code_id: "code-table-legacy",
              full_name: "Ana Perez Lopez",
              email: "ana@example.com",
              phone: "+51999999999",
              doc_type: "dni",
              document: "12345678",
              dni: "12345678",
              table_id: "table-legacy",
              product_id: "prod-legacy",
              table_reservation_id: "res-legacy",
              code: { code: "LEGACY-55", type: "table" },
            },
          ],
          error: null,
        },
      ],
    });

    (createClient as any).mockReturnValue(supabase);
    const { POST } = await import("./route");

    const req = new Request("http://localhost/api/tickets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: "LOVEI5555",
        doc_type: "dni",
        document: "12345678",
        nombre: "Ana",
        apellido_paterno: "Perez",
        apellido_materno: "Lopez",
        email: "ana@example.com",
        telefono: "+51999999999",
        birthdate: "1999-01-01",
      }),
    });

    const res = await POST(req as any);
    const payload = await res.json();
    const ticketInsertCall = calls.find(
      (call) => call.table === "tickets" && call.op === "insert",
    );

    expect(res.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.existing).toBe(true);
    expect(payload.ticketId).toBe("ticket-existing-55");
    expect(payload.qr).toBe("qr-existing-55");
    expect(ticketInsertCall).toBeFalsy();
  });
});
