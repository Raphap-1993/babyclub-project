import { describe, expect, it } from "vitest";
import {
  getAssistantUnits,
  getBuyerDisplayName,
  getBuyerUnit,
} from "./nominationWorkspace";

describe("nominationWorkspace", () => {
  it("keeps unit 1 as buyer and exposes the remaining units except used or cancelled", () => {
    const units = [
      {
        unit_index: 1,
        status: "pending_nomination",
        full_name: "Comprador",
        email: "buyer@example.com",
        phone: "999",
        ticket_id: null,
      },
      {
        unit_index: 2,
        status: "pending_nomination",
        full_name: "",
        email: "",
        phone: "",
        ticket_id: null,
      },
      {
        unit_index: 3,
        status: "issued",
        full_name: "Emitida",
        email: "",
        phone: "",
        ticket_id: "ticket-3",
      },
    ];

    expect(getBuyerUnit(units)).toEqual(units[0]);
    expect(getAssistantUnits(units)).toEqual([units[1], units[2]]);
  });

  it("prefers the reservation buyer name and falls back to the buyer unit", () => {
    expect(
      getBuyerDisplayName(
        { buyer_full_name: "Comprador de Reserva" },
        {
          unit_index: 1,
          status: "pending_nomination",
          full_name: "Comprador de Unidad",
          email: "",
          phone: "",
          ticket_id: null,
        },
      ),
    ).toBe("Comprador de Reserva");

    expect(
      getBuyerDisplayName(null, {
        unit_index: 1,
        status: "pending_nomination",
        full_name: "Comprador de Unidad",
        email: "",
        phone: "",
        ticket_id: null,
      }),
    ).toBe("Comprador de Unidad");
  });
});
