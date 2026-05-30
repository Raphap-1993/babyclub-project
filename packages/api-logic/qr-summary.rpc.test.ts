import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(),
}));

const { createClient } = await import("@supabase/supabase-js");
const { getQrSummaryAll } = await import("./qr-summary");

describe("getQrSummaryAll", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("consume la RPC aunque solo devuelva total_qr y by_type", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [
        {
          event_id: "evt-1",
          name: "BABY RAVE | ABYSS",
          date: "2026-05-30T22:00:00.000Z",
          total_qr: 12,
          by_type: {
            general: 10,
            courtesy: 2,
          },
        },
      ],
      error: null,
    });

    vi.mocked(createClient).mockReturnValue({
      rpc,
    } as never);

    const summaries = await getQrSummaryAll({
      supabaseUrl: "https://supabase.test",
      supabaseKey: "service-role",
    });

    expect(rpc).toHaveBeenCalledWith("get_qr_summary_all", expect.any(Object));
    expect(summaries).toEqual([
      expect.objectContaining({
        event_id: "evt-1",
        total_qr: 12,
        sold_qr: 10,
        courtesy_qr: 2,
        free_qr: 0,
        by_type: {
          sold: 10,
          courtesy: 2,
          free: 0,
          table: 0,
        },
      }),
    ]);
  });
});
