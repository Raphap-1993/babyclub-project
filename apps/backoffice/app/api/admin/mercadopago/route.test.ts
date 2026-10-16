import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createSupabaseMock } from "../../../../../../tests/utils/supabaseMock";
import { ADMIN_ROLES } from "shared/auth/roles";

vi.mock("@supabase/supabase-js", () => ({ createClient: vi.fn() }));
vi.mock("shared/auth/requireStaff", () => ({ requireStaffRole: vi.fn() }));
const { createClient } = await import("@supabase/supabase-js");
const { requireStaffRole } = await import("shared/auth/requireStaff");
const { GET, PATCH } = await import("./route");
const request = (body: unknown) =>
  new Request("http://localhost/api/admin/mercadopago", {
    method: "PATCH",
    body: JSON.stringify(body),
  });
const control = {
  paused: false,
  version: 2,
  updated_at: "2026-10-15T00:00:00Z",
  updated_by: null,
};

describe("Mercado Pago admin API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("SUPABASE_URL", "http://127.0.0.1:64321");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "local-test-key");
    vi.stubEnv("VERCEL_ENV", "");
    vi.mocked(requireStaffRole).mockResolvedValue({
      ok: true,
      context: { staffId: "trusted-admin", role: "admin" },
    } as any);
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it.each([401, 403])(
    "denies reads and changes without admin authorization (%s)",
    async (status) => {
      vi.mocked(requireStaffRole).mockResolvedValue({
        ok: false,
        status,
        error: "denied",
      } as any);
      expect((await GET(new Request("http://localhost"))).status).toBe(status);
      expect((await PATCH(request({ paused: true, version: 2 }))).status).toBe(
        status,
      );
      expect(requireStaffRole).toHaveBeenCalledWith(
        expect.any(Request),
        ADMIN_ROLES,
      );
      expect(createClient).not.toHaveBeenCalled();
    },
  );

  it.each([
    { paused: true, version: 2, environment: "test" },
    { paused: true, version: 2, staffId: "someone-else" },
    { paused: true, version: 2, landingUrl: "http://other-server" },
    { paused: "true", version: 2 },
    { paused: false, version: -1 },
  ])("rejects unsafe or malformed changes: %j", async (body) => {
    expect((await PATCH(request(body))).status).toBe(400);
    expect(createClient).not.toHaveBeenCalled();
  });

  it.each(["", "preview"])(
    "cannot change a real database from a local/preview deployment (%s)",
    async (deployment) => {
      vi.stubEnv("SUPABASE_URL", "https://wtwnhqbbcocpnqqsybln.supabase.co");
      vi.stubEnv("VERCEL_ENV", deployment);
      expect((await PATCH(request({ paused: true, version: 2 }))).status).toBe(
        403,
      );
      expect(createClient).not.toHaveBeenCalled();
    },
  );

  it("uses the authenticated administrator and rejects stale state", async () => {
    const { supabase, calls } = createSupabaseMock({
      "mp_set_sales_paused.rpc": {
        data: null,
        error: { message: "sales_control_conflict" },
      },
    });
    vi.mocked(createClient).mockReturnValue(supabase as any);
    const response = await PATCH(request({ paused: true, version: 2 }));
    expect(response.status).toBe(409);
    expect(calls[0]).toMatchObject({
      op: "rpc",
      payload: { p_paused: true, p_version: 2, p_staff: "trusted-admin" },
    });
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it("returns safe runtime fields and only local test links", async () => {
    const { supabase } = createSupabaseMock({
      "mp_sales_control.select": { data: control, error: null },
      "mp_sales_control_audit.select": { data: [], error: null },
    });
    vi.mocked(createClient).mockReturnValue(supabase as any);
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        Response.json({
          success: true,
          providers: {
            mercadopago: {
              environment: "test",
              enabled: true,
              publicKey: "not-relayed",
              secret: "not-relayed",
            },
          },
        }),
      );
    vi.stubGlobal("fetch", fetchMock);
    const response = await GET(new Request("http://localhost"));
    const json = await response.json();
    expect(json.provider).toEqual({
      environment: "test",
      configured: true,
      enabled: true,
    });
    expect(new URL(json.testUrl).hostname).toBe("127.0.0.1");
    expect(new URL(json.testPanelUrl).hostname).toBe("127.0.0.1");
    expect(JSON.stringify(json)).not.toContain("not-relayed");
  });

  it("does not claim an active mode when the landing reports a different environment", async () => {
    const { supabase } = createSupabaseMock({
      "mp_sales_control.select": { data: control, error: null },
      "mp_sales_control_audit.select": { data: [], error: null },
    });
    vi.mocked(createClient).mockReturnValue(supabase as any);
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          Response.json({
            success: true,
            providers: { mercadopago: { environment: "live", enabled: true } },
          }),
        ),
    );
    expect(
      (await (await GET(new Request("http://localhost"))).json()).provider,
    ).toBeNull();
  });
});
