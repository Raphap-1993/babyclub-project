import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSupabaseMock } from "../../../../../tests/utils/supabaseMock";

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(),
}));

const { createClient } = await import("@supabase/supabase-js");

describe("GET /api/tables event filter", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env.SUPABASE_URL = "http://localhost:54321";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-key";
  });

  it("aplica filtro por event_id cuando viene en query", async () => {
    const { supabase, calls } = createSupabaseMock({
      "tables.select": [{ data: [], error: null }],
    });
    (createClient as any).mockReturnValue(supabase);

    const { GET } = await import("./route");
    const req = new Request("http://localhost/api/tables?event_id=event-1");
    const res = await GET(req as any);
    expect(res.status).toBe(200);

    const tableCall = calls.find((c) => c.table === "tables" && c.op === "select");
    const hasEventFilter = tableCall?.filters?.some(
      (f) => f.type === "eq" && f.args[0] === "event_id" && f.args[1] === "event-1"
    );
    expect(hasEventFilter).toBe(true);
  });
});
