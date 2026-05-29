import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSupabaseMock } from "../../../../../../tests/utils/supabaseMock";

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(),
}));
vi.mock("shared/auth/requireStaff", () => ({
  requireStaffRole: vi.fn(),
}));

const { createClient } = await import("@supabase/supabase-js");
const { requireStaffRole } = await import("shared/auth/requireStaff");

describe("GET /api/codes/list", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env.SUPABASE_URL = "http://localhost:54321";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role";
    (requireStaffRole as any).mockResolvedValue({
      ok: true,
      context: {
        role: "admin",
        staffId: "staff-1",
      },
    });
  });

  it("expone el estado autoritativo del lote en el listado", async () => {
    const { supabase } = createSupabaseMock({
      "codes.select": [
        {
          data: [
            {
              id: "code-1",
              code: "PROMO-001",
              type: "promoter",
              event_id: "event-1",
              promoter_id: "prom-1",
              is_active: false,
              max_uses: 1,
              uses: 1,
              expires_at: "2026-05-28T12:00:00.000Z",
              created_at: "2026-05-28T10:00:00.000Z",
              batch_id: "batch-1",
              batch: {
                closed_at: "2026-05-28T11:00:00.000Z",
                closed_reason: "quota",
                expires_at: "2026-05-28T12:00:00.000Z",
              },
              event: { name: "Evento prueba" },
              promoter: {
                code: "PROMO",
                person: { first_name: "Ana", last_name: "Pérez" },
              },
            },
          ],
          error: null,
          count: 1,
        },
      ],
    });
    (createClient as any).mockReturnValue(supabase);

    const { GET } = await import("./route");
    const res = await GET(
      new Request("http://localhost/api/codes/list?event_id=event-1&view=codes") as any,
    );
    const payload = await res.json();

    expect(res.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.data[0]).toMatchObject({
      code: "PROMO-001",
      batch_id: "batch-1",
      batch_state: "closed",
      batch_close_reason: "quota",
    });
  });
});
