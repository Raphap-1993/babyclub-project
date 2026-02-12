import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSupabaseMock } from "../../../../../tests/utils/supabaseMock";

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(),
}));

const { createClient } = await import("@supabase/supabase-js");

describe("GET /api/layout resilience", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env.SUPABASE_URL = "http://localhost:54321";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-key";
    delete process.env.NEXT_PUBLIC_ORGANIZER_ID;
  });

  it("retorna 200 con layout null cuando Supabase falla por timeout transitorio", async () => {
    const timeoutHtml = "<!DOCTYPE html><title>error code 522</title><body>Connection timed out</body>";
    const { supabase } = createSupabaseMock({
      "layout_settings.select": [
        { data: null, error: { message: timeoutHtml } },
        { data: null, error: { message: timeoutHtml } },
      ],
    });
    (createClient as any).mockReturnValue(supabase);

    const { GET } = await import("./route");
    const req = { nextUrl: new URL("http://localhost/api/layout") };
    const res = await GET(req as any);
    const payload = await res.json();

    expect(res.status).toBe(200);
    expect(payload.layout_url).toBeNull();
    expect(payload.warning).toBe("temporarily_unavailable");
  });

  it("retorna 500 en error no transitorio", async () => {
    const { supabase } = createSupabaseMock({
      "layout_settings.select": [{ data: null, error: { message: "column layout_url does not exist" } }],
    });
    (createClient as any).mockReturnValue(supabase);

    const { GET } = await import("./route");
    const req = { nextUrl: new URL("http://localhost/api/layout") };
    const res = await GET(req as any);
    const payload = await res.json();

    expect(res.status).toBe(500);
    expect(payload.layout_url).toBeNull();
    expect(payload.error).toContain("column layout_url does not exist");
  });
});
