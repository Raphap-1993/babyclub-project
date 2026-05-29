import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("shared/auth/requireStaff", () => ({
  requireStaffRole: vi.fn(),
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(),
}));

const { createClient } = await import("@supabase/supabase-js");
const { requireStaffRole } = await import("shared/auth/requireStaff");

function makeSupabaseMock() {
  const calls: any[] = [];
  const selectResult = {
    data: [
      {
        code_type: "promoter",
        requires_expiration: true,
        updated_by_staff_id: "staff-1",
        updated_at: "2026-05-28T12:00:00.000Z",
      },
    ],
    error: null,
  };
  const supabase = {
    from(table: string) {
      const state: any = { table, op: "select" };
      const chain: any = {
        select() {
          state.op = "select";
          return chain;
        },
        order() {
          return chain;
        },
        eq(...args: any[]) {
          state.filters = state.filters || [];
          state.filters.push({ type: "eq", args });
          return chain;
        },
        upsert(payload: any, options: any) {
          state.op = "upsert";
          state.payload = payload;
          state.options = options;
          calls.push({ ...state });
          return Promise.resolve({
            data: payload,
            error: null,
          });
        },
      };
      chain.then = (resolve: any, reject: any) => {
        calls.push({ ...state });
        return Promise.resolve(selectResult).then(resolve, reject);
      };
      return chain;
    },
  };

  return { supabase, calls };
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.SUPABASE_URL = "http://localhost:54321";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-key";
});

describe("GET /api/codes/policies", () => {
  it("lista las politicas de codigo visibles para staff", async () => {
    (requireStaffRole as any).mockResolvedValue({
      ok: true,
      context: { staffId: "staff-1" },
    });
    const { supabase } = makeSupabaseMock();
    (createClient as any).mockReturnValue(supabase);

    const { GET } = await import("./route");
    const req = new NextRequest("http://localhost/api/codes/policies");
    const res = await GET(req);
    const payload = await res.json();

    expect(res.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.data).toEqual([
      {
        code_type: "promoter",
        requires_expiration: true,
        updated_by_staff_id: "staff-1",
        updated_at: "2026-05-28T12:00:00.000Z",
      },
    ]);
    expect(payload.policies).toEqual(payload.data);
  });
});

describe("PUT /api/codes/policies", () => {
  it("upserta politicas por code_type", async () => {
    (requireStaffRole as any).mockResolvedValue({
      ok: true,
      context: { staffId: "staff-1" },
    });
    const { supabase, calls } = makeSupabaseMock();
    (createClient as any).mockReturnValue(supabase);

    const { PUT } = await import("./route");
    const req = new NextRequest("http://localhost/api/codes/policies", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code_type: "courtesy", requires_expiration: false }),
    });
    const res = await PUT(req);
    const payload = await res.json();

    expect(res.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.policy).toEqual(
      expect.objectContaining({ code_type: "courtesy", requires_expiration: false, updated_by_staff_id: "staff-1" }),
    );

    const upsertCall = calls.find((call) => call.op === "upsert");
    expect(upsertCall?.table).toBe("code_type_policies");
    expect(upsertCall?.options).toEqual({ onConflict: "code_type" });
    expect(upsertCall?.payload).toEqual(
      expect.objectContaining({ code_type: "courtesy", requires_expiration: false, updated_by_staff_id: "staff-1" }),
    );
  });
});
