import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { PurchaseModeControls } from "./PurchaseModeControls";

describe("PurchaseModeControls", () => {
  it("prioritizes the ticket event selector without rendering the legal trust strip", () => {
    const html = renderToStaticMarkup(
      <PurchaseModeControls
        mode="ticket"
        onModeChange={vi.fn()}
        ticketEventId=""
        onTicketEventChange={vi.fn()}
        ticketEventOptions={[
          {
            id: "event-1",
            name: "Baby Friday",
          },
        ]}
        ticketSaleBlock={null}
        resolveEventSaleBlock={() => null}
        selectedEventId=""
        onMesaEventChange={vi.fn()}
        mesaEventOptions={[
          {
            id: "mesa-1",
            name: "Mesa Friday",
          },
        ]}
        mesaSaleBlock={null}
      />,
    );

    expect(html).toContain("Solo entrada");
    expect(html).toContain("Reserva mesa");
    expect(html).toContain("Evento");
    expect(html).toContain("Selecciona el evento");
    expect(html).toContain("Baby Friday");
    expect(html).not.toContain("Compra segura y validada por BABY");
    expect(html.indexOf("Reserva mesa")).toBeLessThan(html.indexOf("Evento"));
  });

  it("shows the mesa selector and its sale warning in mesa mode", () => {
    const html = renderToStaticMarkup(
      <PurchaseModeControls
        mode="mesa"
        onModeChange={vi.fn()}
        ticketEventId=""
        onTicketEventChange={vi.fn()}
        ticketEventOptions={[
          {
            id: "event-1",
            name: "Baby Friday",
          },
        ]}
        ticketSaleBlock={null}
        resolveEventSaleBlock={(eventId) =>
          eventId === "mesa-1"
            ? {
                status: "paused",
                message: "Reserva temporalmente pausada.",
              }
            : null
        }
        selectedEventId="mesa-1"
        onMesaEventChange={vi.fn()}
        mesaEventOptions={[
          {
            id: "mesa-1",
            name: "Mesa Friday",
          },
        ]}
        mesaSaleBlock={{
          status: "paused",
          message: "Reserva temporalmente pausada.",
        }}
      />,
    );

    expect(html).toContain("Mesa Friday");
    expect(html).toContain("Reserva temporalmente pausada.");
    expect(html).not.toContain("Compra segura y validada por BABY");
  });
});
