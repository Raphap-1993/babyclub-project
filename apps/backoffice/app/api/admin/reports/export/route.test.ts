import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSupabaseMock } from "../../../../../../../tests/utils/supabaseMock";

vi.mock("shared/auth/requireStaff", () => ({
  requireStaffRole: vi.fn(),
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(),
}));

const { createClient } = await import("@supabase/supabase-js");
const { requireStaffRole } = await import("shared/auth/requireStaff");

describe("GET /api/admin/reports/export", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.SUPABASE_URL = "http://localhost:54321";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-key";
    (requireStaffRole as any).mockResolvedValue({
      ok: true,
      context: {
        user: { id: "user-1" },
        staffId: "staff-1",
        role: "admin",
        staff: {},
      },
    });
  });

  it("event_attendance: cae a fallback cuando scan_logs no tiene deleted_at", async () => {
    const { supabase, calls } = createSupabaseMock({
      "events.select": [
        {
          data: [
            {
              id: "event-1",
              name: "LOVE IS A DRUG",
              organizer_id: "org-1",
              organizer: { id: "org-1", name: "Baby Club", slug: "baby-club" },
            },
          ],
          error: null,
        },
      ],
      "scan_logs.select": [
        {
          data: null,
          error: {
            message: "column scan_logs.deleted_at does not exist",
            details: "",
            hint: "",
          },
        },
        {
          data: [
            {
              id: "scan-precheck-1",
              event_id: "event-1",
              ticket_id: "ticket-1",
              code_id: "code-1",
              raw_value: "QR-ABC-123",
              result: "valid",
              created_at: "2026-03-01T00:00:00.000Z",
              code: { type: "general" },
            },
            {
              id: "scan-confirm-1",
              event_id: "event-1",
              ticket_id: "ticket-1",
              code_id: "code-1",
              raw_value: "ticket-1",
              result: "valid",
              created_at: "2026-03-01T00:05:00.000Z",
              code: { type: "general" },
            },
            {
              id: "scan-confirm-2",
              event_id: "event-1",
              ticket_id: "ticket-2",
              code_id: "code-1",
              raw_value: "ticket-2",
              result: "valid",
              created_at: "2026-03-01T00:10:00.000Z",
              code: { type: "courtesy" },
            },
          ],
          error: null,
        },
      ],
    });

    (createClient as any).mockReturnValue(supabase);
    const { GET } = await import("./route");

    const req = {
      nextUrl: new URL(
        "http://localhost/api/admin/reports/export?report=event_attendance&format=json",
      ),
      headers: new Headers({ Authorization: "Bearer token-123" }),
    } as any;
    const res = await GET(req);
    const payload = await res.json();

    expect(res.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.rows[0].event_id).toBe("event-1");
    expect(payload.rows[0].scans_confirmed).toBe(2);
    expect(payload.rows[0].unique_admissions_confirmed).toBe(2);
    expect(payload.rows[0].unique_tickets_scanned).toBe(2);
    expect(payload.rows[0].unique_codes_scanned).toBe(1);
    expect(payload.rows[0].free_qr_scans_confirmed).toBe(1);
    expect(payload.rows[0].free_qr_unique_tickets_scanned).toBe(1);
    expect(payload.rows[0].first_scan_at_lima).toBeTruthy();
    expect(payload.rows[0].last_scan_at_lima).toBeTruthy();
    expect(payload.rows[0].free_qr_first_scan_at_lima).toBeTruthy();
    expect(payload.rows[0].free_qr_last_scan_at_lima).toBeTruthy();

    const scanCalls = calls.filter(
      (call) => call.table === "scan_logs" && call.op === "select",
    );
    expect(scanCalls.length).toBe(2);
    expect(
      scanCalls[0]?.filters?.some(
        (f) => f.type === "is" && f.args[0] === "deleted_at",
      ),
    ).toBe(true);
    expect(
      scanCalls[1]?.filters?.some(
        (f) => f.type === "is" && f.args[0] === "deleted_at",
      ),
    ).toBe(false);
  });

  it("promoter_performance: funciona con fallback de scan_logs y calcula métricas", async () => {
    const { supabase } = createSupabaseMock({
      "events.select": [
        {
          data: [
            {
              id: "event-1",
              name: "LOVE IS A DRUG",
              organizer_id: "org-1",
              organizer: { id: "org-1", name: "Baby Club", slug: "baby-club" },
            },
          ],
          error: null,
        },
      ],
      "codes.select": [
        {
          data: [
            {
              id: "code-1",
              event_id: "event-1",
              promoter_id: "prom-1",
              created_at: "2026-03-01T00:00:00.000Z",
            },
            {
              id: "code-2",
              event_id: "event-1",
              promoter_id: "prom-1",
              created_at: "2026-03-01T00:05:00.000Z",
            },
          ],
          error: null,
        },
      ],
      "scan_logs.select": [
        {
          data: null,
          error: {
            message: "column scan_logs.deleted_at does not exist",
            details: "",
            hint: "",
          },
        },
        {
          data: [
            {
              id: "scan-1",
              event_id: "event-1",
              ticket_id: "ticket-1",
              code_id: "code-1",
              raw_value: "ticket-1",
              result: "valid",
              created_at: "2026-03-01T01:00:00.000Z",
              code: { promoter_id: "prom-1" },
              ticket: null,
            },
            {
              id: "scan-precheck-ignored",
              event_id: "event-1",
              ticket_id: "ticket-1",
              code_id: "code-1",
              raw_value: "PROMO-QR",
              result: "valid",
              created_at: "2026-03-01T01:01:00.000Z",
              code: { promoter_id: "prom-1" },
              ticket: null,
            },
          ],
          error: null,
        },
      ],
      "promoters.select": [
        {
          data: [
            {
              id: "prom-1",
              code: "PROM01",
              organizer_id: "org-1",
              person: { first_name: "Luis", last_name: "Perez" },
            },
          ],
          error: null,
        },
      ],
    });

    (createClient as any).mockReturnValue(supabase);
    const { GET } = await import("./route");

    const req = {
      nextUrl: new URL(
        "http://localhost/api/admin/reports/export?report=promoter_performance&format=json",
      ),
      headers: new Headers({ Authorization: "Bearer token-123" }),
    } as any;
    const res = await GET(req);
    const payload = await res.json();

    expect(res.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.rows.length).toBe(1);
    expect(payload.rows[0].promoter_id).toBe("prom-1");
    expect(payload.rows[0].codes_generated).toBe(2);
    expect(payload.rows[0].scans_confirmed).toBe(1);
    expect(payload.rows[0].attendance_rate_percent).toBe(50);
  });

  it("event_sales: agrega pagos pagados por evento", async () => {
    const { supabase } = createSupabaseMock({
      "events.select": [
        {
          data: [
            {
              id: "event-1",
              name: "LOVE IS A DRUG",
              organizer_id: "org-1",
              organizer: { id: "org-1", name: "Baby Club", slug: "baby-club" },
            },
          ],
          error: null,
        },
      ],
      "payments.select": [
        {
          data: [
            {
              id: "pay-1",
              event_id: "event-1",
              status: "paid",
              amount: 1000,
              currency_code: "PEN",
              created_at: "2026-03-01T00:00:00.000Z",
            },
            {
              id: "pay-2",
              event_id: "event-1",
              status: "paid",
              amount: 500,
              currency_code: "PEN",
              created_at: "2026-03-01T00:10:00.000Z",
            },
          ],
          error: null,
        },
      ],
    });

    (createClient as any).mockReturnValue(supabase);
    const { GET } = await import("./route");

    const req = {
      nextUrl: new URL(
        "http://localhost/api/admin/reports/export?report=event_sales&format=json",
      ),
      headers: new Headers({ Authorization: "Bearer token-123" }),
    } as any;
    const res = await GET(req);
    const payload = await res.json();

    expect(res.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.rows.length).toBe(1);
    expect(payload.rows[0].paid_count).toBe(2);
    expect(payload.rows[0].total_amount_raw).toBe(1500);
    expect(payload.rows[0].total_amount_pen_est).toBe(15);
  });

  it("event_attendance CSV: exporta encabezados homologados en español", async () => {
    const { supabase } = createSupabaseMock({
      "events.select": [
        {
          data: [
            {
              id: "event-1",
              name: "LOVE IS A DRUG",
              organizer_id: "org-1",
              organizer: { id: "org-1", name: "Baby Club", slug: "baby-club" },
            },
          ],
          error: null,
        },
      ],
      "scan_logs.select": [
        {
          data: [
            {
              id: "scan-1",
              event_id: "event-1",
              ticket_id: "ticket-1",
              code_id: "code-1",
              raw_value: "ticket-1",
              result: "valid",
              created_at: "2026-03-01T00:00:00.000Z",
              code: { type: "courtesy" },
            },
          ],
          error: null,
        },
      ],
    });

    (createClient as any).mockReturnValue(supabase);
    const { GET } = await import("./route");

    const req = {
      nextUrl: new URL(
        "http://localhost/api/admin/reports/export?report=event_attendance&format=csv",
      ),
      headers: new Headers({ Authorization: "Bearer token-123" }),
    } as any;
    const res = await GET(req);
    const csv = await res.text();

    expect(res.status).toBe(200);
    expect(res.headers.get("content-disposition") || "").toContain(
      "reporte-asistencia-eventos.csv",
    );
    expect(csv.split("\n")[0]).toBe(
      "Organizador,Evento,Escaneos válidos,Admisiones únicas confirmadas,Tickets únicos,Códigos únicos,Escaneos QR general,Escaneos QR cortesía,Escaneos QR mesa,Escaneos QR free,Escaneos QR promotor (legado),Escaneos QR sin tipo identificado,Promotores activos con ingresos,Asistentes únicos con promotor,Asistentes únicos sin promotor,Escaneos sin promotor,Top promotores (asistencia/escaneos),Top códigos usados,Escaneos QR free/cortesía,Personas únicas QR free/cortesía,Primer ingreso (Lima),Último ingreso (Lima),Primer ingreso QR free/cortesía (Lima),Último ingreso QR free/cortesía (Lima)",
    );
  });

  it("promoter_performance CSV: exporta encabezados homologados en español", async () => {
    const { supabase } = createSupabaseMock({
      "events.select": [
        {
          data: [
            {
              id: "event-1",
              name: "LOVE IS A DRUG",
              organizer_id: "org-1",
              organizer: { id: "org-1", name: "Baby Club", slug: "baby-club" },
            },
          ],
          error: null,
        },
      ],
      "codes.select": [
        {
          data: [
            {
              id: "code-1",
              event_id: "event-1",
              promoter_id: "prom-1",
              created_at: "2026-03-01T00:00:00.000Z",
            },
          ],
          error: null,
        },
      ],
      "scan_logs.select": [
        {
          data: [
            {
              id: "scan-1",
              event_id: "event-1",
              ticket_id: "ticket-1",
              code_id: "code-1",
              raw_value: "ticket-1",
              result: "valid",
              created_at: "2026-03-01T01:00:00.000Z",
              code: { promoter_id: "prom-1" },
              ticket: null,
            },
          ],
          error: null,
        },
      ],
      "promoters.select": [
        {
          data: [
            {
              id: "prom-1",
              code: "PROM01",
              organizer_id: "org-1",
              person: { first_name: "Luis", last_name: "Perez" },
            },
          ],
          error: null,
        },
      ],
    });

    (createClient as any).mockReturnValue(supabase);
    const { GET } = await import("./route");

    const req = {
      nextUrl: new URL(
        "http://localhost/api/admin/reports/export?report=promoter_performance&format=csv",
      ),
      headers: new Headers({ Authorization: "Bearer token-123" }),
    } as any;
    const res = await GET(req);
    const csv = await res.text();

    expect(res.status).toBe(200);
    expect(res.headers.get("content-disposition") || "").toContain(
      "reporte-promotores.csv",
    );
    expect(csv.split("\n")[0]).toBe(
      "Organizador,Evento,Código promotor,Promotor,Códigos generados,Escaneos válidos,% de asistencia",
    );
  });

  it("event_sales CSV: exporta encabezados homologados en español", async () => {
    const { supabase } = createSupabaseMock({
      "events.select": [
        {
          data: [
            {
              id: "event-1",
              name: "LOVE IS A DRUG",
              organizer_id: "org-1",
              organizer: { id: "org-1", name: "Baby Club", slug: "baby-club" },
            },
          ],
          error: null,
        },
      ],
      "payments.select": [
        {
          data: [
            {
              id: "pay-1",
              event_id: "event-1",
              status: "paid",
              amount: 1000,
              currency_code: "PEN",
              created_at: "2026-03-01T00:00:00.000Z",
            },
          ],
          error: null,
        },
      ],
    });

    (createClient as any).mockReturnValue(supabase);
    const { GET } = await import("./route");

    const req = {
      nextUrl: new URL(
        "http://localhost/api/admin/reports/export?report=event_sales&format=csv",
      ),
      headers: new Headers({ Authorization: "Bearer token-123" }),
    } as any;
    const res = await GET(req);
    const csv = await res.text();

    expect(res.status).toBe(200);
    expect(res.headers.get("content-disposition") || "").toContain(
      "reporte-ventas-eventos.csv",
    );
    expect(csv.split("\n")[0]).toBe(
      "Organizador,Evento,Pagos confirmados,Ventas (S/),Moneda",
    );
  });
});
