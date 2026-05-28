import { describe, expect, it } from "vitest";

import { getTicketKindPresentation } from "./ticketKindPresentation";

describe("ticketKindPresentation", () => {
  it("trata tickets emitidos desde compra por paquetes como entrada comprada aunque el code type sea courtesy", () => {
    const presentation = getTicketKindPresentation({
      codeType: "courtesy",
      reservationSaleOrigin: "ticket",
      ticketTypeLabel: "Smoke Trio",
    });

    expect(presentation.kind).toBe("purchased");
    expect(presentation.label).toBe("Smoke Trio");
    expect(presentation.kicker).toBe("Entrada comprada");
  });

  it("prioriza la mesa cuando existe contexto de mesa", () => {
    const presentation = getTicketKindPresentation({
      codeType: "courtesy",
      reservationSaleOrigin: "table",
      hasTableContext: true,
    });

    expect(presentation.kind).toBe("table");
    expect(presentation.label).toBe("Mesa / Box");
  });

  it("mantiene diferenciado el QR libre", () => {
    const presentation = getTicketKindPresentation({
      codeType: "free",
    });

    expect(presentation.kind).toBe("free");
    expect(presentation.label).toBe("QR libre");
  });

  it("mantiene diferenciado el QR cortesia cuando no viene de una compra", () => {
    const presentation = getTicketKindPresentation({
      codeType: "courtesy",
    });

    expect(presentation.kind).toBe("courtesy");
    expect(presentation.label).toBe("QR cortesía");
  });
});
