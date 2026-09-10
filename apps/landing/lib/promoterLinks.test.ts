import { describe, expect, it, vi } from "vitest";
import { getPermanentPromoterPage } from "./promoterLinks";
const id = "11111111-1111-4111-8111-111111111111";
function db(
  events: any[],
  promoter: any = { id, is_active: true },
  error: any = null,
  extra: Record<string, any> = {},
) {
  const rows: Record<string, any> = {
    promoters: promoter,
    events,
    tables: [],
    table_availability: [],
    table_reservations: [],
    ...extra,
  };
  return {
    from: vi.fn((table: string) => {
      const q: any = {
        select: () => q,
        eq: () => q,
        is: () => q,
        order: () => q,
        in: () => q,
        maybeSingle: async () => ({ data: rows[table], error }),
        then: (resolve: any) =>
          Promise.resolve({ data: rows[table], error }).then(resolve),
      };
      return q;
    }),
  };
}
describe("permanent promoter GET model", () => {
  it("lists available events using reads only, keeps current events selling", async () => {
    const client = db([
      { id: "a", name: "A", starts_at: "2020-01-01", is_active: true },
      { id: "b", name: "B", sale_status: "paused" },
      { id: "c", name: "C", closed_at: "2026-01-01" },
    ]);
    expect(
      (await getPermanentPromoterPage(client, id)).events.map((x) => x.id),
    ).toEqual(["a"]);
    expect(client.from.mock.calls.map((x) => x[0])).toEqual([
      "promoters",
      "events",
    ]);
  });
  it("omits events without an available ticket or table product", async () => {
    const client = db([
      {
        id: "a",
        name: "A",
        ticket_types: [
          {
            code: "all_night_1",
            label: "Entry",
            price: 20,
            ticket_quantity: 1,
            is_active: false,
          },
        ],
      },
    ]);
    expect((await getPermanentPromoterPage(client, id)).events).toEqual([]);
  });
  it("offers table-only events with active products", async () => {
    const client = db(
      [
        {
          id: "a",
          name: "A",
          ticket_types: [
            {
              code: "all_night_1",
              label: "Entry",
              price: 20,
              ticket_quantity: 1,
              is_active: false,
            },
          ],
        },
      ],
      undefined,
      null,
      {
        tables: [
          {
            id: "t",
            event_id: "a",
            products: [{ id: "product", is_active: true }],
          },
        ],
      },
    );
    expect(
      (await getPermanentPromoterPage(client, id)).events[0].purchaseUrl,
    ).toContain("tab=mesa");
  });
  it("does not offer an already reserved table", async () => {
    const client = db(
      [
        {
          id: "a",
          name: "A",
          ticket_types: [
            {
              code: "all_night_1",
              label: "Entry",
              price: 20,
              ticket_quantity: 1,
              is_active: false,
            },
          ],
        },
      ],
      undefined,
      null,
      {
        tables: [
          {
            id: "t",
            event_id: "a",
            products: [{ id: "product", is_active: true }],
          },
        ],
        table_reservations: [{ table_id: "t", status: "paid" }],
      },
    );
    expect((await getPermanentPromoterPage(client, id)).events).toEqual([]);
  });
  it("keeps the same promoter reference when the event changes", async () => {
    const a = await getPermanentPromoterPage(db([{ id: "a", name: "A" }]), id);
    const b = await getPermanentPromoterPage(db([{ id: "b", name: "B" }]), id);
    expect(a.events[0].purchaseUrl).toContain(`promoter_ref=${id}`);
    expect(b.events[0].purchaseUrl).toContain(`promoter_ref=${id}`);
    expect(b.events[0].purchaseUrl).toContain("event_id=b");
  });
  it("returns a stable empty state when no events are on sale", async () =>
    expect((await getPermanentPromoterPage(db([]), id)).events).toEqual([]));
  it("does not expose contact information", async () =>
    expect(
      await getPermanentPromoterPage(
        db([], {
          id,
          is_active: true,
          email: "private",
          phone: "private",
          person: { dni: "private" },
        }),
        id,
      ),
    ).toEqual({ promoterId: id, events: [] }));
  it("distinguishes database failure from no events", async () =>
    await expect(
      getPermanentPromoterPage(db([], undefined, { message: "offline" }), id),
    ).rejects.toThrow());
  it("rejects inactive promoter before loading events", async () => {
    const client = db([], { id, is_active: false });
    await expect(getPermanentPromoterPage(client, id)).rejects.toThrow();
    expect(client.from).toHaveBeenCalledTimes(1);
  });
});
