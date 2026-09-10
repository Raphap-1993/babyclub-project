import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSupabaseMock } from "../../../../../../tests/utils/supabaseMock";
vi.mock("@supabase/supabase-js", () => ({ createClient: vi.fn() }));
vi.mock("shared/auth/requireStaff", () => ({ requireStaffRole: vi.fn() }));
const { createClient } = await import("@supabase/supabase-js");
const { requireStaffRole } = await import("shared/auth/requireStaff");
const id = "11111111-1111-4111-8111-111111111111";
function request(body: any) {
  return new Request("http://localhost/api/promoters/create-link", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
describe("permanent promoter link endpoint", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("SUPABASE_URL", "http://localhost:54321");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "synthetic-test-key");
    vi.stubEnv("NEXT_PUBLIC_LANDING_URL", "http://localhost:3001");
    vi.mocked(requireStaffRole).mockResolvedValue({
      ok: true,
      context: { role: "admin", staffId: "staff-1" },
    } as any);
  });
  it("returns the same link without an event, code, or database writes", async () => {
    const { supabase, calls } = createSupabaseMock({
      "promoters.select": { data: { id, is_active: true }, error: null },
    });
    vi.mocked(createClient).mockReturnValue(supabase as any);
    const { POST } = await import("./route");
    for (let index = 0; index < 2; index++) {
      const res = await POST(request({ promoter_id: id }) as any);
      expect(res.status).toBe(200);
      expect(await res.json()).toMatchObject({
        permanent: true,
        url: `http://localhost:3001/p/${id}`,
      });
    }
    expect(
      calls.every((call) => call.op === "select" && call.table === "promoters"),
    ).toBe(true);
  });
  it("rejects inactive promoters without writing", async () => {
    const { supabase, calls } = createSupabaseMock({
      "promoters.select": { data: { id, is_active: false }, error: null },
    });
    vi.mocked(createClient).mockReturnValue(supabase as any);
    const { POST } = await import("./route");
    expect((await POST(request({ promoter_id: id }) as any)).status).toBe(404);
    expect(calls.every((call) => call.op === "select")).toBe(true);
  });
  it("preserves staff authorization", async () => {
    vi.mocked(requireStaffRole).mockResolvedValue({
      ok: false,
      status: 401,
      error: "Unauthorized",
    } as any);
    const { POST } = await import("./route");
    expect((await POST(request({ promoter_id: id }) as any)).status).toBe(401);
    expect(createClient).not.toHaveBeenCalled();
  });
});
