import { describe, expect, it } from "vitest";
import { deriveTicketPurchaseConfirmation } from "./ticketPurchaseConfirmation";

describe("deriveTicketPurchaseConfirmation", () => {
  it("prioritizes the buyer ticket and leaves workspace as follow-up when attendees remain pending", () => {
    const result = deriveTicketPurchaseConfirmation({
      reservationId: "res-ticket-1",
      units: [
        { unit_index: 1, status: "issued", ticket_id: "ticket-buyer-1" },
        { unit_index: 2, status: "pending_nomination", ticket_id: null },
      ],
    });

    expect(result).toMatchObject({
      buyerTicketId: "ticket-buyer-1",
      pendingNominationCount: 1,
      eyebrow: "✓ Compra confirmada",
      title: "Tu entrada ya fue emitida",
      primaryAction: {
        label: "Ver mi ticket",
        href: "/ticket/ticket-buyer-1",
      },
      secondaryAction: {
        label: "Completar asistentes",
        href: "/compra?reservationId=res-ticket-1",
      },
    });
    expect(result.description).toContain("ticket del comprador");
    expect(result.description).toContain("Completa la nominación");
  });

  it("removes the workspace CTA when no attendee units remain pending", () => {
    const result = deriveTicketPurchaseConfirmation({
      reservationId: "res-ticket-2",
      units: [
        { unit_index: 1, status: "issued", ticket_id: "ticket-buyer-2" },
        { unit_index: 2, status: "issued", ticket_id: "ticket-guest-2" },
      ],
    });

    expect(result).toMatchObject({
      buyerTicketId: "ticket-buyer-2",
      pendingNominationCount: 0,
      primaryAction: {
        label: "Ver mi ticket",
        href: "/ticket/ticket-buyer-2",
      },
      secondaryAction: null,
    });
    expect(result.description).not.toContain("Completa la nominación");
  });

  it("falls back to the workspace when the buyer ticket could not be resolved", () => {
    const result = deriveTicketPurchaseConfirmation({
      reservationId: "res-ticket-3",
      units: [
        { unit_index: 1, status: "pending_nomination", ticket_id: null },
        { unit_index: 2, status: "pending_nomination", ticket_id: null },
      ],
    });

    expect(result).toMatchObject({
      buyerTicketId: null,
      pendingNominationCount: 1,
      eyebrow: "✓ Compra registrada",
      title: "Tu compra quedó guardada",
      primaryAction: {
        label: "Ir a mi compra",
        href: "/compra?reservationId=res-ticket-3",
      },
      secondaryAction: null,
    });
    expect(result.description).toContain("No pudimos emitir el ticket");
  });
});
