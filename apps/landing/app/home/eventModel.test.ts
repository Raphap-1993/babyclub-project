import { describe, expect, it } from "vitest";
import {
  eventPresentation,
  formatEventDate,
  type HomeEvent,
} from "./eventModel";
import type { TicketTypeOption } from "shared/ticketTypes";

const type = (price: number, ticketQuantity = 1): TicketTypeOption => ({
  code: "general",
  label: "General",
  price,
  ticketQuantity,
  isActive: true,
  currencyCode: "PEN",
  description: null,
  salePhase: null,
  sortOrder: 0,
});
const event = (patch: Partial<HomeEvent> = {}): HomeEvent => ({
  id: "sample",
  is_active: true,
  ticket_types: [type(40)],
  ...patch,
});
describe("public event presentation", () => {
  it("uses Lima dates independently of browser timezone and naive DB timestamps", () => {
    expect(formatEventDate("2026-10-18T03:00:00Z").label).toContain("17");
    expect(formatEventDate("2026-10-18T03:00:00")).toEqual(
      formatEventDate("2026-10-18T03:00:00Z"),
    );
    expect(formatEventDate("invalid").label).toBe("Fecha por confirmar");
  });
  it("labels the lowest available pack as a pack rather than per-person price", () => {
    const result = eventPresentation(
      event({ ticket_types: [type(40), type(30, 2)] }),
    );
    expect(result.price).toBe("Desde S/ 30 · pack de 2");
    expect(result.canBuy).toBe(true);
  });
  it("does not offer unavailable, inactive or foreign-currency prices", () => {
    for (const patch of [
      { sale_status: "sold_out" },
      { sale_status: "paused" },
      { closed_at: "2026-10-10T01:00:00Z" },
      { is_active: false },
    ]) {
      expect(eventPresentation(event(patch)).canBuy).toBe(false);
    }
    expect(
      eventPresentation(
        event({
          ticket_types: [
            { ...type(40), isActive: false },
            { ...type(20), currencyCode: "USD" },
          ],
        }),
      ).canBuy,
    ).toBe(false);
  });
});
