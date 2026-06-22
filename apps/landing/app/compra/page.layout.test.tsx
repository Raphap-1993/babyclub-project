import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { PurchaseModeControls } from "./PurchaseModeControls";
import { PurchaseStepper } from "./PurchaseStepper";

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

  it("keeps the event section visible with an explicit empty-state message when there are no events", () => {
    const html = renderToStaticMarkup(
      <PurchaseModeControls
        mode="ticket"
        onModeChange={vi.fn()}
        ticketEventId=""
        onTicketEventChange={vi.fn()}
        ticketEventOptions={[]}
        ticketSaleBlock={null}
        resolveEventSaleBlock={() => null}
        selectedEventId=""
        onMesaEventChange={vi.fn()}
        mesaEventOptions={[]}
        mesaSaleBlock={null}
      />,
    );

    expect(html).toContain("Evento");
    expect(html).toContain("No hay eventos con entradas disponibles ahora.");
    expect(html).not.toContain("<select");
  });
});

describe("PurchaseStepper", () => {
  it("renders four checkout steps with the active one announced", () => {
    const html = renderToStaticMarkup(
      <PurchaseStepper
        currentStep={2}
        steps={[
          { id: 1, label: "Entradas" },
          { id: 2, label: "Datos" },
          { id: 3, label: "Resumen" },
          { id: 4, label: "Pago" },
        ]}
      />,
    );

    expect(html).toContain("Entradas");
    expect(html).toContain("Datos");
    expect(html).toContain("Resumen");
    expect(html).toContain("Pago");
    expect(html).toContain('aria-current="step"');
    expect(html).toContain("Paso 2 de 4");
  });

  it("marks completed steps and keeps future steps inactive", () => {
    const html = renderToStaticMarkup(
      <PurchaseStepper
        currentStep={3}
        steps={[
          { id: 1, label: "Entradas" },
          { id: 2, label: "Datos" },
          { id: 3, label: "Resumen" },
          { id: 4, label: "Pago" },
        ]}
      />,
    );

    expect(html).toContain('data-state="complete"');
    expect(html).toContain('data-state="active"');
    expect(html).toContain('data-state="upcoming"');
  });
});
