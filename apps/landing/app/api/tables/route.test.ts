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

  it.skip("aplica filtro por event_id cuando viene en query", async () => {
    const { supabase, calls } = createSupabaseMock({
      "tables.select": [{ data: [], error: null }],
    });
    (createClient as any).mockReturnValue(supabase);

    const { GET } = await import("./route");
    const req = { nextUrl: new URL("http://localhost/api/tables?event_id=event-1") };
    const res = await GET(req as any);
    expect(res.status).toBe(200);

    const tableCall = calls.find((c) => c.table === "tables" && c.op === "select");
    const hasEventFilter = tableCall?.filters?.some(
      (f) => f.type === "eq" && f.args[0] === "event_id" && f.args[1] === "event-1"
    );
    expect(hasEventFilter).toBe(true);
  });

  it("retorna 200 con lista vacia si Supabase falla por timeout transitorio", async () => {
    const timeoutHtml = "<!DOCTYPE html><title>error code 522</title><body>Connection timed out</body>";
    const { supabase } = createSupabaseMock({
      "tables.select": [
        { data: null, error: { message: timeoutHtml } },
        { data: null, error: { message: timeoutHtml } },
      ],
    });
    (createClient as any).mockReturnValue(supabase);

    const { GET } = await import("./route");
    const req = { nextUrl: new URL("http://localhost/api/tables") };
    const res = await GET(req as any);
    const payload = await res.json();

    expect(res.status).toBe(200);
    expect(payload.tables).toEqual([]);
    expect(payload.warning).toBe("temporarily_unavailable");
  });
});
