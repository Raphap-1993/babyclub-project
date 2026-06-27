import { describe, expect, it } from "vitest";
import { resolveReservationTicketQuantity } from "./reservationTicketQuantity";

describe("resolveReservationTicketQuantity", () => {
  it("prioriza total_ticket_units sobre codesCount legado inflado", () => {
    expect(
      resolveReservationTicketQuantity({
        totalTicketUnits: 1,
        ticketQuantity: 1,
        codesCount: 3,
        liveTableTicketCount: 12,
        minimum: 1,
      }),
    ).toBe(1);
  });

  it("usa ticket_quantity cuando aún no existe total_ticket_units", () => {
    expect(
      resolveReservationTicketQuantity({
        totalTicketUnits: null,
        ticketQuantity: 2,
        codesCount: 5,
        liveTableTicketCount: 12,
        minimum: 1,
      }),
    ).toBe(2);
  });

  it("solo cae a codesCount cuando no hay snapshot persistido", () => {
    expect(
      resolveReservationTicketQuantity({
        totalTicketUnits: null,
        ticketQuantity: null,
        codesCount: 4,
        liveTableTicketCount: 12,
        minimum: 1,
      }),
    ).toBe(4);
  });
});
