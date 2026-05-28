import { describe, expect, it } from "vitest";
import {
  getTicketSubmitLabel,
  resolveInitialTicketEventId,
} from "./purchaseState";

describe("resolveInitialTicketEventId", () => {
  it("does not auto-select the first active event when multiple options exist", () => {
    const result = resolveInitialTicketEventId("", [
      { id: "event-older", name: "Older Event" },
      { id: "event-current", name: "Current Event" },
    ]);

    expect(result).toBe("");
  });

  it("keeps the current selection when one already exists", () => {
    const result = resolveInitialTicketEventId("event-current", [
      { id: "event-older", name: "Older Event" },
      { id: "event-current", name: "Current Event" },
    ]);

    expect(result).toBe("event-current");
  });

  it("auto-selects the only event available", () => {
    const result = resolveInitialTicketEventId("", [
      { id: "event-only", name: "Only Event" },
    ]);

    expect(result).toBe("event-only");
  });
});

describe("getTicketSubmitLabel", () => {
  it("asks for event selection before claiming there are no tickets", () => {
    const label = getTicketSubmitLabel({
      loading: false,
      ticketSaleBlocked: false,
      ticketRequiresEvent: true,
      ticketEventId: "",
      hasSelectedTicketType: false,
    });

    expect(label).toBe("Selecciona evento");
  });

  it("keeps the sold out copy when sale is blocked", () => {
    const label = getTicketSubmitLabel({
      loading: false,
      ticketSaleBlocked: true,
      ticketRequiresEvent: true,
      ticketEventId: "event-1",
      hasSelectedTicketType: false,
    });

    expect(label).toBe("Venta bloqueada");
  });
});
