import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSupabaseMock } from "../../../../../../../tests/utils/supabaseMock";

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(),
}));
vi.mock("shared/auth/requireStaff", () => ({
  requireStaffRole: vi.fn(),
}));

const { createClient } = await import("@supabase/supabase-js");
const { requireStaffRole } = await import("shared/auth/requireStaff");

describe("POST /api/codes/batches/generate", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env.SUPABASE_URL = "http://localhost:54321";
    process.env.SUPABASE_ANON_KEY = "test-anon";
    (requireStaffRole as any).mockResolvedValue({
      ok: true,
      context: {
        role: "admin",
        staffId: "staff-1",
      },
    });
  });

  it("rechaza generar lotes cuando la politica exige expiracion y no se envia expires_at", async () => {
    const { supabase, calls } = createSupabaseMock({
      "code_type_policies.select": [
        {
          data: {
            code_type: "promoter",
            requires_expiration: true,
            updated_by_staff_id: "staff-1",
            updated_at: "2026-05-28T18:00:00.000Z",
          },
          error: null,
        },
      ],
    });
    (createClient as any).mockReturnValue(supabase);

    const { POST } = await import("./route");
    const req = new Request("http://localhost/api/codes/batches/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer test-token",
      },
      body: JSON.stringify({
        event_id: "event-1",
        type: "promoter",
        promoter_id: "prom-1",
        quantity: 2,
        max_uses: 1,
      }),
    });

    const res = await POST(req as any);
    const payload = await res.json();

    expect(res.status).toBe(400);
    expect(payload.success).toBe(false);
    expect(String(payload.error)).toContain("expires_at");
    expect(
      calls.find(
        (call) => call.table === "code_type_policies" && call.op === "select",
      ),
    ).toBeTruthy();
    expect(
      calls.find((call) => call.table === "code_batches" && call.op === "insert"),
    ).toBeFalsy();
  });

  it("permite generar cuando la expiracion requerida llega valida", async () => {
    const { supabase } = createSupabaseMock({
      "code_type_policies.select": [
        {
          data: {
            code_type: "promoter",
            requires_expiration: true,
            updated_by_staff_id: "staff-1",
            updated_at: "2026-05-28T18:00:00.000Z",
          },
          error: null,
        },
      ],
      "generate_codes_batch.upsert": [{ data: null, error: null }],
      "generate_codes_batch.rpc": [
        {
          data: [
            {
              batch_id: "batch-1",
              code_id: "code-1",
              generated_code: "promoter-123",
            },
          ],
          error: null,
        },
      ],
    });
    (createClient as any).mockReturnValue(supabase);

    const { POST } = await import("./route");
    const req = new Request("http://localhost/api/codes/batches/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer test-token",
      },
      body: JSON.stringify({
        event_id: "event-1",
        type: "promoter",
        promoter_id: "prom-1",
        quantity: 2,
        max_uses: 1,
        expires_at: "2026-05-28T20:00:00.000Z",
      }),
    });

    const res = await POST(req as any);
    const payload = await res.json();

    expect(res.status).toBe(200);
    expect(payload.success).toBe(true);
  });
});
