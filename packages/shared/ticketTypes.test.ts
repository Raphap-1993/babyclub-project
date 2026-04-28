import { describe, expect, it } from "vitest";
import {
  normalizeTicketTypesFromEvent,
  resolveTicketTypeSelection,
} from "./ticketTypes";

describe("ticketTypes", () => {
  it("normaliza ticket_types persistidos y filtra inactivos", () => {
    const options = normalizeTicketTypesFromEvent({
      ticket_types: [
        {
          id: "type-1",
          code: "early_bird_1",
          label: "Early Solo",
          description: "Mensaje editable",
          sale_phase: "early_bird",
          ticket_quantity: 1,
          price: 18,
          currency_code: "PEN",
          is_active: true,
          sort_order: 20,
        },
        {
          id: "type-2",
          code: "early_bird_2",
          label: "Early Duo",
          description: "No visible",
          sale_phase: "early_bird",
          ticket_quantity: 2,
          price: 30,
          is_active: false,
          sort_order: 10,
        },
      ],
    });

    expect(options).toHaveLength(1);
    expect(options[0]).toMatchObject({
      code: "early_bird_1",
      label: "Early Solo",
      description: "Mensaje editable",
      salePhase: "early_bird",
      ticketQuantity: 1,
      price: 18,
    });
  });

  it("deriva opciones legacy desde columnas del evento cuando no hay tabla nueva", () => {
    const options = normalizeTicketTypesFromEvent({
      early_bird_enabled: false,
      early_bird_price_1: 16,
      all_night_price_1: 24,
      all_night_price_2: 40,
    });

    expect(options.map((option) => option.code)).toEqual([
      "all_night_1",
      "all_night_2",
    ]);
    expect(options[0]).toMatchObject({
      salePhase: "all_night",
      ticketQuantity: 1,
      price: 24,
    });
  });

  it("resuelve seleccion por codigo o por compatibilidad phase/cantidad", () => {
    const event = {
      ticket_types: [
        {
          code: "all_night_2",
          label: "All Night Duo",
          sale_phase: "all_night",
          ticket_quantity: 2,
          price: 42,
          is_active: true,
        },
      ],
    };

    expect(
      resolveTicketTypeSelection(event, { code: "all_night_2" })?.price,
    ).toBe(42);
    expect(
      resolveTicketTypeSelection(event, {
        salePhase: "all_night",
        ticketQuantity: 2,
      })?.code,
    ).toBe("all_night_2");
  });
});
