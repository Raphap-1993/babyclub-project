import { describe, expect, it } from "vitest";
import { deriveTicketPurchaseConfirmation } from "./ticketPurchaseConfirmation";

describe("deriveTicketPurchaseConfirmation", () => {
  it("prioritizes the buyer QR and leaves group management as a follow-up when attendees remain pending", () => {
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
      title: "Tu QR ya está listo",
      primaryAction: {
        label: "Abrir mi QR",
        href: "/ticket/ticket-buyer-1",
      },
      secondaryAction: {
        label: "Gestionar grupo",
        href: "/compra?reservationId=res-ticket-1",
      },
    });
    expect(result.description).toContain("Abre tu QR");
    expect(result.description).toContain("asistente pendiente");
  });

  it("keeps only the buyer QR CTA when no attendee units remain pending", () => {
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
      title: "Tu QR ya está listo",
      primaryAction: {
        label: "Abrir mi QR",
        href: "/ticket/ticket-buyer-2",
      },
      secondaryAction: null,
    });
    expect(result.description).toContain("usar tu código");
  });

  it("falls back to group management when the buyer QR could not be resolved yet", () => {
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
        label: "Gestionar grupo",
        href: "/compra?reservationId=res-ticket-3",
      },
      secondaryAction: null,
    });
    expect(result.description).toContain("usar tus códigos");
  });
});
