import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSupabaseMock } from "../../tests/utils/supabaseMock";

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(),
}));

const { createClient } = await import("@supabase/supabase-js");
const { getQrSummaryAll } = await import("./qr-summary");

describe("getQrSummaryAll", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("consume la RPC y agrega las unidades vendidas por evento", async () => {
    const { supabase } = createSupabaseMock({
      "get_qr_summary_all.rpc": [
        {
          data: [
            {
              event_id: "evt-1",
              name: "BABY RAVE | ABYSS",
              date: "2026-05-30T22:00:00.000Z",
              total_qr: 12,
              free_qr: 2,
              courtesy_qr: 3,
              sold_qr: 7,
              table_qr: 0,
              table_count: 0,
              by_type: {
                general: 10,
                promoter_link: 2,
              },
            },
          ],
          error: null,
        },
      ],
      "table_reservations.select": [
        {
          data: [
            {
              event_id: "evt-1",
              sale_origin: "ticket",
              status: "approved",
              total_ticket_units: 59,
              ticket_quantity: null,
              package_quantity: null,
            },
          ],
          error: null,
        },
      ],
    });
    vi.mocked(createClient).mockReturnValue(supabase as never);

    const summaries = await getQrSummaryAll({
      supabaseUrl: "https://supabase.test",
      supabaseKey: "service-role",
    });

    expect(summaries).toEqual([
      expect.objectContaining({
        event_id: "evt-1",
        total_qr: 12,
        sold_qr: 7,
        sold_units: 59,
        courtesy_qr: 3,
        free_qr: 2,
        by_type: {
          sold: 7,
          courtesy: 3,
          free: 2,
          table: 0,
        },
      }),
    ]);
  });
});
