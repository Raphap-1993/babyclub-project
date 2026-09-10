import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSupabaseMock } from "../../../../../tests/utils/supabaseMock";
vi.mock("@supabase/supabase-js", () => ({ createClient: vi.fn() }));
const { createClient } = await import("@supabase/supabase-js");
const promoterId = "11111111-1111-4111-8111-111111111111";
const eventId = "22222222-2222-4222-8222-222222222222";
const link = {
  id: "33333333-3333-4333-8333-333333333333",
  code: "INTERNAL",
  type: "promoter_link",
  promoter_id: promoterId,
  event_id: eventId,
  is_active: true,
};
const event = {
  id: eventId,
  is_active: true,
  sale_status: "on_sale",
  early_bird_enabled: true,
};
const buyer = {
  doc_type: "dni",
  document: "12345678",
  full_name: "Synthetic Buyer",
  nombre: "Synthetic",
  apellido_paterno: "Buyer",
  apellido_materno: "Test",
  email: "buyer@example.test",
  telefono: "999999999",
  phone: "999999999",
  event_id: eventId,
  promoter_ref: promoterId,
  voucher_url: "https://example.test/voucher.png",
  payment_method: "yape",
  ticket_type_code: "all_night_1",
  ticket_quantity: 1,
  package_quantity: 1,
  table_id: "table-1",
  product_id: "product-1",
};
function setup(overrides: Record<string, any> = {}) {
  const result = createSupabaseMock({
    "events.select": { data: event, error: null },
    "promoters.select": {
      data: { id: promoterId, is_active: true },
      error: null,
    },
    "ensure_promoter_event_link.rpc": { data: [link], error: null },
    "tables.select": {
      data: {
        id: "table-1",
        event_id: eventId,
        ticket_count: 1,
        is_active: true,
        event: { name: "Synthetic event" },
      },
      error: null,
    },
    "table_products.select": {
      data: [{ id: "product-1", table_id: "table-1", is_active: true }],
      error: null,
    },
    "table_reservations.insert": {
      data: { id: "reservation-synthetic" },
      error: null,
    },
    "codes.insert": {
      data: [{ id: "code-synthetic", code: "SYNTHETIC" }],
      error: null,
    },
    ...overrides,
  });
  vi.mocked(createClient).mockReturnValue(result.supabase as any);
  return result;
}
beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  vi.stubEnv("SUPABASE_URL", "http://localhost:54321");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "synthetic-key");
});
describe.each(["ticket", "table"])(
  "%s purchase permalink server binding",
  (kind) => {
    async function post(body: any) {
      const { POST } =
        kind === "ticket"
          ? await import("./route")
          : await import("../reservations/route");
      return POST(
        new Request(`http://localhost/api/${kind}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }) as any,
      );
    }
    it("persists canonical attribution returned by the event link RPC", async () => {
      const { calls } = setup();
      const res = await post(buyer);
      expect(res.status, JSON.stringify(await res.json())).toBe(200);
      expect(
        calls.find((c) => c.table === "table_reservations" && c.op === "insert")
          ?.payload,
      ).toMatchObject({
        event_id: eventId,
        promoter_id: promoterId,
        promoter_link_code_id: link.id,
        promoter_link_code: link.code,
      });
      expect(
        calls.filter((c) => c.table === "ensure_promoter_event_link"),
      ).toHaveLength(1);
    });
    it("rejects conflicting client fields without creating reservations or links", async () => {
      const { calls } = setup();
      const res = await post({ ...buyer, promoter_id: eventId });
      expect(res.status).toBe(400);
      expect(calls.some((c) => c.op === "insert" || c.op === "rpc")).toBe(
        false,
      );
    });
    it("rejects a legacy link bound to a different event", async () => {
      const { calls } = setup({
        "codes.select": {
          data: { ...link, event_id: promoterId },
          error: null,
        },
      });
      expect(
        (await post({ ...buyer, promoter_link_code_id: link.id })).status,
      ).toBe(409);
      expect(calls.some((c) => c.op === "insert" || c.op === "rpc")).toBe(
        false,
      );
    });
    it("rejects an event closed after the permalink was opened", async () => {
      const { calls } = setup({
        "events.select": {
          data: { ...event, closed_at: "2026-01-01" },
          error: null,
        },
      });
      expect((await post(buyer)).status).toBe(409);
      expect(calls.some((c) => c.op === "insert" || c.op === "rpc")).toBe(
        false,
      );
    });
  },
);
