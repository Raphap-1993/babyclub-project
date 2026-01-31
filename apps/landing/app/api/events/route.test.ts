import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSupabaseMock } from "../../../../../tests/utils/supabaseMock";

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(),
}));

const { createClient } = await import("@supabase/supabase-js");

describe("GET /api/events soft delete filter", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env.SUPABASE_URL = "http://localhost:54321";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-key";
  });

  it("aplica filtro deleted_at IS NULL", async () => {
    const { supabase, calls } = createSupabaseMock({
      "events.select": [{ data: [{ id: "event-1", name: "Evento" }], error: null }],
    });
    (createClient as any).mockReturnValue(supabase);

    const { GET } = await import("./route");
    const res = await GET();
    expect(res.status).toBe(200);

    const eventCall = calls.find((c) => c.table === "events" && c.op === "select");
    const hasFilter = eventCall?.filters?.some((f) => f.type === "is" && f.args[0] === "deleted_at" && f.args[1] === null);
    expect(hasFilter).toBe(true);
  });
});
