import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("shared/auth/requireStaff", () => ({
  requireStaffRole: vi.fn(),
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(),
}));

const { createClient } = await import("@supabase/supabase-js");
const { requireStaffRole } = await import("shared/auth/requireStaff");

function createGenerateSupabaseMock(policy: { code_type: string; requires_expiration: boolean } | null) {
  const rpc = vi.fn().mockResolvedValue({
    data: [
      {
        batch_id: "batch-1",
        generated_code: "PROMO-1",
        code: "PROMO-1",
      },
    ],
    error: null,
  });

  const supabase = {
    from(_table: string) {
      const chain: any = {
        select: () => chain,
        eq: () => chain,
        maybeSingle: () =>
          Promise.resolve({
            data: policy,
            error: null,
          }),
      };
      chain.then = (resolve: any, reject: any) =>
        Promise.resolve({ data: policy, error: null }).then(resolve, reject);
      return chain;
    },
    rpc,
  };

  return { supabase, rpc };
}

describe("POST /api/codes/batches/generate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.SUPABASE_URL = "http://localhost:54321";
    process.env.SUPABASE_ANON_KEY = "test-key";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-key";
    (requireStaffRole as any).mockResolvedValue({
      ok: true,
      context: { user: { id: "user-1" }, staffId: "staff-1", role: "admin", staff: {} },
    });
  });

  it("rechaza batches sin expires_at cuando la política lo requiere", async () => {
    const { supabase, rpc } = createGenerateSupabaseMock({ code_type: "promoter", requires_expiration: true });
    (createClient as any).mockReturnValue(supabase);

    const { POST } = await import("./route");
    const res = await POST(
      new Request("http://localhost/api/codes/batches/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer token-123",
        },
        body: JSON.stringify({
          event_id: "event-1",
          promoter_id: "promoter-1",
          type: "promoter",
          quantity: 5,
          max_uses: 1,
          prefix: null,
          notes: null,
          expires_at: null,
        }),
      }) as any,
    );
    const payload = await res.json();

    expect(res.status).toBe(400);
    expect(payload.success).toBe(false);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("rechaza expires_at inválido cuando la política lo requiere", async () => {
    const { supabase, rpc } = createGenerateSupabaseMock({ code_type: "promoter", requires_expiration: true });
    (createClient as any).mockReturnValue(supabase);

    const { POST } = await import("./route");
    const res = await POST(
      new Request("http://localhost/api/codes/batches/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer token-123",
        },
        body: JSON.stringify({
          event_id: "event-1",
          promoter_id: "promoter-1",
          type: "promoter",
          quantity: 5,
          max_uses: 1,
          prefix: null,
          notes: null,
          expires_at: "not-a-date",
        }),
      }) as any,
    );
    const payload = await res.json();

    expect(res.status).toBe(400);
    expect(payload.success).toBe(false);
    expect(rpc).not.toHaveBeenCalled();
  });
});
