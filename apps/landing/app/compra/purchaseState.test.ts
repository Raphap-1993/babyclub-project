import { describe, expect, it } from "vitest";
import {
  PURCHASE_STEPS,
  getTicketEmptyStateMessage,
  shouldShowTicketTypeEmptyState,
  getTicketSubmitLabel,
  getNextPurchaseStep,
  getPreviousPurchaseStep,
  normalizePurchaseStep,
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

describe("checkout step helpers", () => {
  it("defines the public checkout as four focused steps", () => {
    expect(PURCHASE_STEPS).toEqual([
      { id: 1, label: "Entradas" },
      { id: 2, label: "Datos" },
      { id: 3, label: "Resumen" },
      { id: 4, label: "Pago" },
    ]);
  });

  it("normalizes invalid steps into the supported range", () => {
    expect(normalizePurchaseStep(0)).toBe(1);
    expect(normalizePurchaseStep(3)).toBe(3);
    expect(normalizePurchaseStep(9)).toBe(4);
  });

  it("moves forward and backward without leaving the checkout range", () => {
    expect(getNextPurchaseStep(1)).toBe(2);
    expect(getNextPurchaseStep(4)).toBe(4);
    expect(getPreviousPurchaseStep(4)).toBe(3);
    expect(getPreviousPurchaseStep(1)).toBe(1);
  });
});

describe("getTicketSubmitLabel", () => {
  it("explains when there are no ticket events available yet", () => {
    const message = getTicketEmptyStateMessage({
      hasTicketEvents: false,
      ticketEventId: "",
      hasSelectedTicketType: false,
    });

    expect(message).toBe("No hay eventos con entradas disponibles ahora.");

    const label = getTicketSubmitLabel({
      loading: false,
      ticketSaleBlocked: false,
      ticketRequiresEvent: false,
      hasTicketEvents: false,
      ticketEventId: "",
      hasSelectedTicketType: false,
    });

    expect(label).toBe("Sin eventos disponibles");
  });

  it("asks for event selection before claiming there are no tickets", () => {
    const label = getTicketSubmitLabel({
      loading: false,
      ticketSaleBlocked: false,
      ticketRequiresEvent: true,
      hasTicketEvents: true,
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
      hasTicketEvents: true,
      ticketEventId: "event-1",
      hasSelectedTicketType: false,
    });

    expect(label).toBe("Venta bloqueada");
  });
});

describe("shouldShowTicketTypeEmptyState", () => {
  it("hides the duplicated empty-state card when there are no ticket events", () => {
    expect(
      shouldShowTicketTypeEmptyState({
        hasTicketEvents: false,
        hasSelectedTicketType: false,
      }),
    ).toBe(false);
  });
});
