import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { TicketKindBadge } from "./TicketKindBadge";

describe("TicketKindBadge", () => {
  it("renderiza entradas compradas con la etiqueta comercial y el copy de comprada", () => {
    const html = renderToStaticMarkup(
      <TicketKindBadge
        codeType="courtesy"
        reservationSaleOrigin="ticket"
        ticketTypeLabel="Smoke Trio"
        showKicker
      />,
    );

    expect(html).toContain("Smoke Trio");
    expect(html).toContain("Entrada comprada");
  });

  it("renderiza un badge especifico para QR libre", () => {
    const html = renderToStaticMarkup(<TicketKindBadge codeType="free" />);

    expect(html).toContain("QR libre");
  });
});
