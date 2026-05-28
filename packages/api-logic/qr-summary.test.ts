import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSupabaseMock } from "../../tests/utils/supabaseMock";

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(),
}));

const { createClient } = await import("@supabase/supabase-js");

describe("getQrSummaryAll", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("no clasifica ticket-only como mesa solo por tener table_reservation_id", async () => {
    const { supabase } = createSupabaseMock({
      "events.select": [
        {
          data: [
            {
              id: "event-1",
              name: "Baby Friday",
              starts_at: "2099-02-01T04:00:00.000Z",
              is_active: true,
              force_closed: false,
              deleted_at: null,
            },
          ],
          error: null,
        },
      ],
      "tickets.select": [
        {
          data: [
            {
              event_id: "event-1",
              code_id: "code-1",
              table_id: null,
            },
            {
              event_id: "event-1",
              code_id: "code-2",
              table_id: null,
            },
          ],
          error: null,
        },
      ],
      "codes.select": [
        {
          data: [
            {
              id: "code-1",
              type: "courtesy",
              table_reservation_id: "res-ticket-1",
              is_active: true,
            },
            {
              id: "code-2",
              type: "courtesy",
              table_reservation_id: "res-ticket-1",
              is_active: true,
            },
          ],
          error: null,
        },
      ],
    });

    (supabase as any).rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { message: "function public.get_qr_summary_all does not exist" },
    });
    (createClient as any).mockReturnValue(supabase);

    const { getQrSummaryAll } = await import("./qr-summary");
    const summaries = await getQrSummaryAll({
      supabaseUrl: "http://localhost:54321",
      supabaseKey: "test-key",
    });

    expect(summaries).toHaveLength(1);
    expect(summaries[0]).toMatchObject({
      event_id: "event-1",
      total_qr: 2,
      by_type: {
        courtesy: 2,
      },
    });
    expect(summaries[0].by_type.table).toBeUndefined();
  });
});
