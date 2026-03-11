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

  it("promoter_performance: usa tickets activos/usados como métrica canónica", async () => {
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
        {
          data: [
            {
              id: "code-1",
              promoter_id: "prom-1",
            },
            {
              id: "code-2",
              promoter_id: "prom-1",
            },
          ],
          error: null,
        },
      ],
      "tickets.select": [
        {
          data: [
            {
              id: "ticket-1",
              event_id: "event-1",
              promoter_id: null,
              code_id: "code-1",
              is_active: true,
              used: true,
              created_at: "2026-03-01T01:00:00.000Z",
            },
            {
              id: "ticket-2",
              event_id: "event-1",
              promoter_id: "prom-1",
              code_id: "code-2",
              is_active: true,
              used: false,
              created_at: "2026-03-01T01:10:00.000Z",
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
    expect(payload.rows[0].qrs_assigned).toBe(2);
    expect(payload.rows[0].qrs_entered).toBe(1);
    expect(payload.rows[0].codes_generated).toBe(2);
    expect(payload.rows[0].attendance_rate_percent).toBe(50);
  });

  it("free_qr_no_show: agrupa por cliente y marca bloqueo si tuvo no-show histórico", async () => {
    const { supabase } = createSupabaseMock({
      "events.select": [
        {
          data: [
            {
              id: "event-1",
              name: "LOVE IS A DRUG",
              organizer_id: "org-1",
              starts_at: "2025-03-01T03:00:00.000Z",
              organizer: { id: "org-1", name: "Baby Club", slug: "baby-club" },
            },
            {
              id: "event-2",
              name: "NEON RITUAL",
              organizer_id: "org-1",
              starts_at: "2025-04-01T03:00:00.000Z",
              organizer: { id: "org-1", name: "Baby Club", slug: "baby-club" },
            },
            {
              id: "event-3",
              name: "FUTURE PARTY",
              organizer_id: "org-1",
              starts_at: "2099-04-01T03:00:00.000Z",
              organizer: { id: "org-1", name: "Baby Club", slug: "baby-club" },
            },
          ],
          error: null,
        },
      ],
      "tickets.select": [
        {
          data: [
            {
              id: "ticket-1",
              event_id: "event-1",
              person_id: "person-ana",
              full_name: "Ana Perez",
              doc_type: "dni",
              document: "12345678",
              dni: "12345678",
              email: "ana@test.com",
              phone: "999111222",
              used: false,
              is_active: true,
              created_at: "2025-03-01T01:00:00.000Z",
              code: { type: "courtesy" },
            },
            {
              id: "ticket-2",
              event_id: "event-2",
              person_id: "person-ana",
              full_name: "Ana Perez",
              doc_type: "dni",
              document: "12345678",
              dni: "12345678",
              email: "ana@test.com",
              phone: "999111222",
              used: true,
              is_active: true,
              created_at: "2025-04-01T01:00:00.000Z",
              code: { type: "courtesy" },
            },
            {
              id: "ticket-3",
              event_id: "event-1",
              person_id: "person-bob",
              full_name: "Bob Diaz",
              doc_type: "dni",
              document: "87654321",
              dni: "87654321",
              email: "bob@test.com",
              phone: "999333444",
              used: false,
              is_active: true,
              created_at: "2025-03-01T01:10:00.000Z",
              code: { type: "promoter" },
            },
            {
              id: "ticket-4",
              event_id: "event-3",
              person_id: "person-carla",
              full_name: "Carla Future",
              doc_type: "dni",
              document: "45678912",
              dni: "45678912",
              email: "carla@test.com",
              phone: "999555666",
              used: false,
              is_active: true,
              created_at: "2099-04-01T01:00:00.000Z",
              code: { type: "courtesy" },
            },
            {
              id: "ticket-5",
              event_id: "event-1",
              person_id: "person-diego",
              full_name: "Diego General",
              doc_type: "dni",
              document: "45612378",
              dni: "45612378",
              email: "diego@test.com",
              phone: "999777888",
              used: false,
              is_active: true,
              created_at: "2025-03-01T01:20:00.000Z",
              code: { type: "general" },
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
        "http://localhost/api/admin/reports/export?report=free_qr_no_show&format=json",
      ),
      headers: new Headers({ Authorization: "Bearer token-123" }),
    } as any;
    const res = await GET(req);
    const payload = await res.json();

    expect(res.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.rows.length).toBe(2);
    expect(payload.rows[0].full_name).toBe("Bob Diaz");
    expect(payload.rows[0].free_qr_assigned).toBe(1);
    expect(payload.rows[0].free_qr_attended).toBe(0);
    expect(payload.rows[0].free_qr_no_show).toBe(1);
    expect(payload.rows[0].no_show_rate_percent).toBe(100);
    expect(payload.rows[0].block_next_free_qr).toBe("Sí");
    expect(payload.rows[1].full_name).toBe("Ana Perez");
    expect(payload.rows[1].free_qr_assigned).toBe(2);
    expect(payload.rows[1].free_qr_attended).toBe(1);
    expect(payload.rows[1].free_qr_no_show).toBe(1);
    expect(payload.rows[1].no_show_rate_percent).toBe(50);
    expect(payload.rows[1].last_free_qr_event).toBe("NEON RITUAL");
    expect(payload.rows[1].last_free_qr_status).toBe("Asistió");
    expect(payload.rows[1].last_no_show_event).toBe("LOVE IS A DRUG");
    expect(payload.rows[1].block_next_free_qr).toBe("Sí");
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
        {
          data: [
            {
              id: "code-1",
              promoter_id: "prom-1",
            },
          ],
          error: null,
        },
      ],
      "tickets.select": [
        {
          data: [
            {
              id: "ticket-1",
              event_id: "event-1",
              promoter_id: null,
              code_id: "code-1",
              is_active: true,
              used: true,
              created_at: "2026-03-01T01:00:00.000Z",
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
      "Organizador,Evento,Código promotor,Promotor,QRs asignados,Ingresaron,% de conversión,Códigos generados (auditoría)",
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

  it("free_qr_no_show CSV: exporta encabezados homologados en español", async () => {
    const { supabase } = createSupabaseMock({
      "events.select": [
        {
          data: [
            {
              id: "event-1",
              name: "LOVE IS A DRUG",
              organizer_id: "org-1",
              starts_at: "2025-03-01T03:00:00.000Z",
              organizer: { id: "org-1", name: "Baby Club", slug: "baby-club" },
            },
          ],
          error: null,
        },
      ],
      "tickets.select": [
        {
          data: [
            {
              id: "ticket-1",
              event_id: "event-1",
              person_id: "person-1",
              full_name: "Ana Perez",
              doc_type: "dni",
              document: "12345678",
              dni: "12345678",
              email: "ana@test.com",
              phone: "999111222",
              used: false,
              is_active: true,
              created_at: "2025-03-01T01:00:00.000Z",
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
        "http://localhost/api/admin/reports/export?report=free_qr_no_show&format=csv",
      ),
      headers: new Headers({ Authorization: "Bearer token-123" }),
    } as any;
    const res = await GET(req);
    const csv = await res.text();

    expect(res.status).toBe(200);
    expect(res.headers.get("content-disposition") || "").toContain(
      "reporte-no-show-qr-free.csv",
    );
    expect(csv.split("\n")[0]).toBe(
      "Organizador,Cliente,Tipo doc.,Documento,Email,Teléfono,QR free asignados,Asistió,No asistió,% no-show,Último evento free,Estado último QR free,Fecha último evento free (Lima),Último evento no-show,Fecha último no-show (Lima),Bloquear siguiente QR free",
    );
  });
});
