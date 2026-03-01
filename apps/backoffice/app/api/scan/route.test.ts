import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSupabaseMock } from "../../../../../tests/utils/supabaseMock";
import { resetRateLimitStore } from "shared/security/rateLimit";

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(),
}));
vi.mock("shared/auth/requireStaff", () => ({
  requireStaffRole: vi.fn(),
}));

const { createClient } = await import("@supabase/supabase-js");
const { requireStaffRole } = await import("shared/auth/requireStaff");

describe("POST /api/scan", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetRateLimitStore();
    process.env.SUPABASE_URL = "http://localhost:54321";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-key";
    (requireStaffRole as any).mockResolvedValue({
      ok: true,
      context: { user: { id: "user-1" }, staffId: "staff-1", role: "door", staff: {} },
    });
  });

  it("clasifica QR de mesa usando contexto de reserva", async () => {
    const { supabase } = createSupabaseMock({
      "events.select": [
        {
          data: { id: "event-1", starts_at: "2099-02-01T04:00:00.000Z", entry_limit: null },
          error: null,
        },
      ],
      "codes.select": [
        {
          data: {
            id: "code-1",
            code: "TABLE-001",
            type: "courtesy",
            event_id: "event-1",
            is_active: true,
            max_uses: 1,
            uses: 0,
            expires_at: null,
            table_reservation_id: "res-1",
          },
          error: null,
        },
      ],
      "tickets.select": [
        {
          data: {
            id: "ticket-1",
            full_name: "Mesa Cliente",
            dni: "12345678",
            email: "mesa@test.com",
            phone: "999999999",
            used: false,
            table_id: null,
            product_id: null,
            table_reservation_id: "res-1",
          },
          error: null,
        },
      ],
      "table_reservations.select": [
        {
          data: {
            id: "res-1",
            table_id: "table-1",
            product_id: "prod-1",
            sale_origin: "table",
            ticket_pricing_phase: null,
            table: { name: "Mesa Diamante" },
            product: { name: "Pack Premium" },
          },
          error: null,
        },
      ],
      "scan_logs.insert": [{ data: null, error: null }],
    });

    (createClient as any).mockReturnValue(supabase);
    const { POST } = await import("./route");

    const req = new Request("http://localhost/api/scan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: "TABLE-001", event_id: "event-1" }),
    });

    const res = await POST(req as any);
    const payload = await res.json();

    expect(res.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.result).toBe("valid");
    expect(payload.qr_kind).toBe("table");
    expect(payload.qr_kind_label).toBe("Mesa / Box");
    expect(payload.table_name).toBe("Mesa Diamante");
    expect(payload.product_name).toBe("Pack Premium");
  });

  it("clasifica QR EARLY para ticket-only reservation", async () => {
    const { supabase } = createSupabaseMock({
      "events.select": [
        {
          data: { id: "event-2", starts_at: "2099-02-01T04:00:00.000Z", entry_limit: null },
          error: null,
        },
      ],
      "codes.select": [{ data: null, error: null }],
      "tickets.select": [
        {
          data: {
            id: "ticket-early-1",
            code_id: "code-early-1",
            full_name: "Early Cliente",
            dni: "88888888",
            email: "early@test.com",
            phone: "988888888",
            used: false,
            table_id: null,
            product_id: null,
            table_reservation_id: "res-ticket-early",
            code: { type: "courtesy" },
          },
          error: null,
        },
      ],
      "table_reservations.select": [
        {
          data: {
            id: "res-ticket-early",
            table_id: null,
            product_id: null,
            sale_origin: "ticket",
            ticket_pricing_phase: "early_bird",
            table: null,
            product: null,
          },
          error: null,
        },
      ],
      "scan_logs.insert": [{ data: null, error: null }],
    });

    (createClient as any).mockReturnValue(supabase);
    const { POST } = await import("./route");

    const req = new Request("http://localhost/api/scan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: "QR-TICKET-EARLY", event_id: "event-2" }),
    });

    const res = await POST(req as any);
    const payload = await res.json();

    expect(res.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.result).toBe("valid");
    expect(payload.qr_kind).toBe("ticket_early");
    expect(payload.qr_kind_label).toBe("Entrada EARLY");
    expect(payload.ticket_pricing_phase).toBe("early_bird");
  });

  it("mantiene clasificación de entrada general cuando no hay reserva comercial", async () => {
    const { supabase } = createSupabaseMock({
      "events.select": [
        {
          data: { id: "event-3", starts_at: "2099-02-01T04:00:00.000Z", entry_limit: null },
          error: null,
        },
      ],
      "codes.select": [
        {
          data: {
            id: "code-general-1",
            code: "GENERAL-001",
            type: "general",
            event_id: "event-3",
            is_active: true,
            max_uses: 5,
            uses: 1,
            expires_at: null,
            table_reservation_id: null,
          },
          error: null,
        },
      ],
      "tickets.select": [{ data: null, error: null }],
      "scan_logs.insert": [{ data: null, error: null }],
    });

    (createClient as any).mockReturnValue(supabase);
    const { POST } = await import("./route");

    const req = new Request("http://localhost/api/scan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: "GENERAL-001", event_id: "event-3" }),
    });

    const res = await POST(req as any);
    const payload = await res.json();

    expect(res.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.result).toBe("valid");
    expect(payload.qr_kind).toBe("ticket_general");
    expect(payload.qr_kind_label).toBe("Entrada General");
  });
});
