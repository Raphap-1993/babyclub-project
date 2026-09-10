import { describe, expect, it, vi } from "vitest";
import { resolvePurchaseAttribution } from "./promoterAttribution";

const promoterId = "11111111-1111-4111-8111-111111111111";
const eventId = "22222222-2222-4222-8222-222222222222";
const link = {
  id: "33333333-3333-4333-8333-333333333333",
  code: "LEGACY",
  type: "promoter_link",
  promoter_id: promoterId,
  event_id: eventId,
  is_active: true,
  deleted_at: null,
  expires_at: null,
  max_uses: null,
  uses: 0,
};
function db(overrides: Record<string, any> = {}) {
  const rows: Record<string, any> = {
    promoters: { id: promoterId, is_active: true },
    events: { id: eventId, is_active: true, sale_status: "on_sale" },
    codes: link,
    ...overrides,
  };
  return {
    from: vi.fn((table: string) => {
      const q: any = {
        select: () => q,
        eq: () => q,
        is: () => q,
        maybeSingle: async () => ({ data: rows[table], error: null }),
      };
      return q;
    }),
    rpc: vi.fn(async () => ({ data: [link], error: null })),
  };
}
describe("purchase attribution binding", () => {
  it("leaves direct purchases unattributed without reads or writes", async () => {
    const client = db();
    expect(await resolvePurchaseAttribution(client, eventId, {})).toEqual({
      promoterId: null,
      promoterLinkCodeId: null,
      promoterLinkCode: null,
    });
    expect(client.from).not.toHaveBeenCalled();
    expect(client.rpc).not.toHaveBeenCalled();
  });
  it("ensures a canonical internal link for the permanent reference", async () => {
    const client = db();
    expect(
      await resolvePurchaseAttribution(client, eventId, {
        promoter_ref: promoterId,
      }),
    ).toEqual({
      promoterId,
      promoterLinkCodeId: link.id,
      promoterLinkCode: link.code,
    });
    expect(client.rpc).toHaveBeenCalledWith("ensure_promoter_event_link", {
      p_promoter_id: promoterId,
      p_event_id: eventId,
    });
  });
  it("rejects a conflicting client promoter before creating a link", async () => {
    const client = db();
    await expect(
      resolvePurchaseAttribution(client, eventId, {
        promoter_ref: promoterId,
        promoter_id: eventId,
      }),
    ).rejects.toThrow(/coincide/);
    expect(client.rpc).not.toHaveBeenCalled();
  });
  it.each([
    { event_id: promoterId },
    { type: "courtesy" },
    { is_active: false },
    { deleted_at: "2026-01-01" },
    { expires_at: "2020-01-01" },
    { max_uses: 1, uses: 1 },
  ])("rejects invalid legacy link %j", async (change) => {
    const client = db({ codes: { ...link, ...change } });
    await expect(
      resolvePurchaseAttribution(client, eventId, {
        promoter_link_code_id: link.id,
        promoter_link_code: link.code,
      }),
    ).rejects.toThrow();
    expect(client.rpc).not.toHaveBeenCalled();
  });
  it("preserves valid legacy link snapshots without creating another", async () => {
    const client = db();
    expect(
      await resolvePurchaseAttribution(client, eventId, {
        promoter_id: promoterId,
        promoter_link_code_id: link.id,
        promoter_link_code: link.code,
      }),
    ).toEqual({
      promoterId,
      promoterLinkCodeId: link.id,
      promoterLinkCode: "LEGACY",
    });
    expect(client.rpc).not.toHaveBeenCalled();
  });
  it("rejects mismatched id and code", async () => {
    await expect(
      resolvePurchaseAttribution(db(), eventId, {
        promoter_link_code_id: link.id,
        promoter_link_code: "OTHER",
      }),
    ).rejects.toThrow();
  });
  it.each([{ is_active: false }, { deleted_at: "2026-01-01" }])(
    "rejects unavailable promoter %j",
    async (change) => {
      const client = db({ promoters: { id: promoterId, ...change } });
      await expect(
        resolvePurchaseAttribution(client, eventId, {
          promoter_ref: promoterId,
        }),
      ).rejects.toThrow();
      expect(client.rpc).not.toHaveBeenCalled();
    },
  );
  it.each([
    { closed_at: "2026-01-01" },
    { sale_status: "paused" },
    { sale_status: "sold_out" },
    { is_active: false },
  ])("rechecks event sale state on POST %j", async (change) => {
    const client = db({ events: { id: eventId, ...change } });
    await expect(
      resolvePurchaseAttribution(client, eventId, { promoter_ref: promoterId }),
    ).rejects.toThrow();
    expect(client.rpc).not.toHaveBeenCalled();
  });
});
