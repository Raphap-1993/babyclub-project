import { describe, expect, it } from "vitest";
import {
  buildTicketSelectionSnapshot,
  hasTicketSelectionDrifted,
  reconcileTicketTypeCode,
} from "./ticketSelection";

describe("reconcileTicketTypeCode", () => {
  it("preselecciona la primera opcion solo cuando aun no habia seleccion", () => {
    expect(
      reconcileTicketTypeCode("", [
        { code: "all_night_1" } as any,
        { code: "all_night_2" } as any,
      ]),
    ).toEqual({
      nextCode: "all_night_1",
      invalidated: false,
    });
  });

  it("mantiene la opcion elegida si sigue disponible", () => {
    expect(
      reconcileTicketTypeCode("all_night_2", [
        { code: "all_night_1" } as any,
        { code: "all_night_2" } as any,
      ]),
    ).toEqual({
      nextCode: "all_night_2",
      invalidated: false,
    });
  });

  it("limpia la seleccion si la opcion desaparece para evitar fallback silencioso", () => {
    expect(
      reconcileTicketTypeCode("all_night_2", [
        { code: "all_night_1" } as any,
        { code: "all_night_3" } as any,
      ]),
    ).toEqual({
      nextCode: "",
      invalidated: true,
    });
  });

  it("no autoselecciona otra opcion cuando la pantalla ya exige reeleccion explicita", () => {
    expect(
      reconcileTicketTypeCode("", [{ code: "all_night_1" } as any], false),
    ).toEqual({
      nextCode: "",
      invalidated: false,
    });
  });
});

describe("buildTicketSelectionSnapshot", () => {
  it("congela codigo, cantidad y total del paquete elegido", () => {
    expect(
      buildTicketSelectionSnapshot(
        {
          id: "type-2",
          code: "all_night_2",
          label: "ALL NIGHT DUO",
          ticketQuantity: 2,
          price: 45,
          currencyCode: "PEN",
        } as any,
        1,
      ),
    ).toEqual({
      ticketTypeId: "type-2",
      ticketTypeCode: "all_night_2",
      ticketTypeLabel: "ALL NIGHT DUO",
      ticketQuantity: 2,
      price: 45,
      currencyCode: "PEN",
      packageQuantity: 1,
      totalUnits: 2,
      totalPrice: 45,
    });
  });
});

describe("hasTicketSelectionDrifted", () => {
  it("detecta drift aunque el mismo codigo siga existiendo con otra cantidad o precio", () => {
    const snapshot = buildTicketSelectionSnapshot(
      {
        id: "type-2",
        code: "all_night_2",
        label: "ALL NIGHT DUO",
        ticketQuantity: 2,
        price: 45,
        currencyCode: "PEN",
      } as any,
      1,
    );

    expect(
      hasTicketSelectionDrifted(snapshot, {
        id: "type-2",
        code: "all_night_2",
        label: "ALL NIGHT DUO",
        ticketQuantity: 3,
        price: 60,
        currencyCode: "PEN",
      } as any),
    ).toBe(true);
  });

  it("mantiene estable la seleccion si el paquete no cambió", () => {
    const snapshot = buildTicketSelectionSnapshot(
      {
        id: "type-2",
        code: "all_night_2",
        label: "ALL NIGHT DUO",
        ticketQuantity: 2,
        price: 45,
        currencyCode: "PEN",
      } as any,
      2,
    );

    expect(
      hasTicketSelectionDrifted(snapshot, {
        id: "type-2",
        code: "all_night_2",
        label: "ALL NIGHT DUO",
        ticketQuantity: 2,
        price: 45,
        currencyCode: "PEN",
      } as any),
    ).toBe(false);
  });
});
