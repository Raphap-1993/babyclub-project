import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  customerRecords,
  findCustomerIdentity,
  matchesCustomerDocument,
  readCustomerWallet,
} from "./customerTickets";

const event = (id: string, date: string) => ({
  id,
  name: id,
  starts_at: date,
  is_active: true,
  closed_at: null,
  deleted_at: null,
  location: "BABY",
});
const next = event("next", "2026-10-17T03:00:00Z"),
  later = event("later", "2026-10-31T03:00:00Z");
const ticket = (extra: any = {}) => ({
  id: "mine",
  event_id: "next",
  document: "00001234",
  doc_type: "dni",
  email: "customer@example.com",
  full_name: "Cliente local",
  is_active: true,
  payment_status: "paid",
  qr_token: "LOCAL_ONLY_QR",
  event: next,
  ...extra,
});
let data: Record<string, any[]>;
let queries: any[];
function db() {
  return {
    from: (table: string) => {
      const q: any = {};
      for (const method of [
        "select",
        "or",
        "eq",
        "is",
        "ilike",
        "gte",
        "order",
        "in",
      ])
        q[method] = vi.fn(() => q);
      q.limit = vi.fn(async () => ({ data: data[table] || [], error: null }));
      q.then = (resolve: any) =>
        Promise.resolve({ data: data[table] || [], error: null }).then(resolve);
      queries.push({ table, q });
      return q;
    },
  } as any;
}
beforeEach(() => {
  data = { tickets: [], table_reservations: [], ticket_reservation_units: [] };
  queries = [];
});
describe("DNI ticket ownership and upcoming event", () => {
  it("preserves leading zeros and rejects passports or conflicting legacy documents", () => {
    expect(
      matchesCustomerDocument(
        { document: "00001234", doc_type: "dni" },
        "00001234",
      ),
    ).toBe(true);
    expect(
      matchesCustomerDocument({ document: null, dni: "00001234" }, "00001234"),
    ).toBe(true);
    expect(
      matchesCustomerDocument(
        { document: "00001234", doc_type: "passport" },
        "00001234",
      ),
    ).toBe(false);
    expect(
      matchesCustomerDocument(
        { document: "12345678", dni: "00001234", doc_type: "dni" },
        "00001234",
      ),
    ).toBe(false);
  });
  it("never returns an attendee's other purchase just because the email matches", async () => {
    data.tickets = [
      ticket(),
      ticket({ id: "someone-else", document: "99999999" }),
      ticket({ id: "different-email", email: "someone@example.com" }),
    ];
    const rows = await customerRecords(
      db(),
      "00001234",
      "customer@example.com",
    );
    expect(rows.tickets.map((row: any) => row.id)).toEqual(["mine"]);
    for (const { q } of queries) {
      expect(q.eq).toHaveBeenCalledWith("event.is_active", true);
      expect(q.is).toHaveBeenCalledWith("event.closed_at", null);
      expect(q.gte).toHaveBeenCalledWith("event.starts_at", expect.any(String));
    }
  });
  it("chooses the registered recipient from the nearest owned event", async () => {
    data.tickets = [
      ticket({ id: "later", event: later, email: "old@example.com" }),
      ticket(),
    ];
    expect(await findCustomerIdentity(db(), "00001234")).toEqual({
      dni: "00001234",
      email: "customer@example.com",
    });
  });
  it("renders existing QR only for ready tickets, with no past or later event in the wallet", async () => {
    data.tickets = [
      ticket(),
      ticket({ id: "used", used: true }),
      ticket({ id: "cancelled", qr_token: "CANCELLED" }),
      ticket({ id: "later", event_id: "later", event: later }),
    ];
    data.ticket_reservation_units = [
      { ticket_id: "cancelled", status: "cancelled", deleted_at: null },
    ];
    const wallet = await readCustomerWallet(db(), {
      dni: "00001234",
      email: "customer@example.com",
    });
    expect(wallet.event?.name).toBe("next");
    expect(wallet.tickets).toHaveLength(3);
    expect(wallet.tickets[0].qr).toMatch(/^data:image\/png;base64,/);
    expect(wallet.tickets.find((row: any) => row.id === "used")).toMatchObject({
      state: "used",
      qr: null,
    });
    expect(
      wallet.tickets.find((row: any) => row.id === "cancelled"),
    ).toMatchObject({ state: "inactive", qr: null });
  });
  it("exposes the buyer's table management only after the same DNI and email match", async () => {
    data.table_reservations = [
      {
        id: "table",
        event_id: "next",
        event: next,
        document: "00001234",
        doc_type: "dni",
        email: "customer@example.com",
        table: { name: "Mesa 1" },
      },
      {
        id: "foreign",
        event_id: "next",
        event: next,
        document: "99999999",
        email: "customer@example.com",
      },
    ];
    const wallet = await readCustomerWallet(db(), {
      dni: "00001234",
      email: "customer@example.com",
    });
    expect(wallet.reservations).toEqual([
      { id: "table", label: "Mesa 1", href: "/compra?reservationId=table" },
    ]);
  });
  it("shows an empty wallet after the last active event disappears", async () => {
    expect(
      await readCustomerWallet(db(), {
        dni: "00001234",
        email: "customer@example.com",
      }),
    ).toEqual({ event: null, tickets: [], reservations: [] });
  });
  it("withholds QR when the unit relationship is ambiguous", async () => {
    data.tickets = [ticket()];
    data.ticket_reservation_units = [
      { ticket_id: "mine", status: "issued" },
      { ticket_id: "mine", status: "cancelled" },
    ];
    const wallet = await readCustomerWallet(db(), {
      dni: "00001234",
      email: "customer@example.com",
    });
    expect(wallet.tickets[0]).toMatchObject({ state: "pending", qr: null });
  });
});
