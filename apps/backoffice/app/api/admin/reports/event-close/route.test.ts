import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("shared/auth/requireStaff", () => ({ requireStaffRole: vi.fn() }));
vi.mock("@supabase/supabase-js", () => ({ createClient: vi.fn(() => ({})) }));
vi.mock("@/lib/reports/loadEventClose", () => ({
  loadEventClose: vi.fn(),
  loadReportEvents: vi.fn(),
}));
const { requireStaffRole } = await import("shared/auth/requireStaff");
const { loadEventClose, loadReportEvents } = await import(
  "@/lib/reports/loadEventClose"
);
const { GET } = await import("./route");
const eventId = "b2ca4921-4634-4bdc-a6a9-1772eb988557";
const request = (query = "") =>
  new NextRequest(`http://localhost/api/admin/reports/event-close${query}`);

describe("API privada de cierre", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.SUPABASE_URL = "http://localhost:54321";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-only";
    vi.mocked(requireStaffRole).mockResolvedValue({
      ok: true,
      context: { role: "admin" },
    } as any);
  });
  it.each([401, 403])(
    "deniega acceso %i sin consultar los datos",
    async (status) => {
      vi.mocked(requireStaffRole).mockResolvedValue({
        ok: false,
        status,
        error: "Sin permiso",
      });
      const response = await GET(request());
      expect(response.status).toBe(status);
      expect(loadReportEvents).not.toHaveBeenCalled();
      expect(loadEventClose).not.toHaveBeenCalled();
      expect(requireStaffRole).toHaveBeenCalledWith(expect.anything(), [
        "admin",
        "superadmin",
      ]);
      expect(response.headers.get("cache-control")).toContain("no-store");
    },
  );
  it("valida el evento antes de consultar", async () => {
    expect((await GET(request("?event_id=not-an-id"))).status).toBe(400);
    expect(loadEventClose).not.toHaveBeenCalled();
  });
  it("lista los eventos con respuesta privada", async () => {
    vi.mocked(loadReportEvents).mockResolvedValue([]);
    const response = await GET(request());
    expect(await response.json()).toEqual({ events: [] });
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });
  it("devuelve 404 si el evento no existe", async () => {
    vi.mocked(loadEventClose).mockResolvedValue(null);
    expect((await GET(request(`?event_id=${eventId}`))).status).toBe(404);
  });
  it("devuelve el cierre calculado sin transformar sus métricas", async () => {
    const report = { event: { id: eventId }, attendance: { confirmed: 108 } };
    vi.mocked(loadEventClose).mockResolvedValue(report as any);
    const response = await GET(request(`?event_id=${eventId}`));
    expect(await response.json()).toEqual({ report });
  });
  it("no expone errores internos ni responde con ceros cuando falla una fuente", async () => {
    vi.mocked(loadEventClose).mockRejectedValue(
      new Error("internal database details"),
    );
    const response = await GET(request(`?event_id=${eventId}`));
    expect(response.status).toBe(502);
    expect(await response.text()).not.toContain("internal database details");
  });
});
