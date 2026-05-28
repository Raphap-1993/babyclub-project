import { describe, expect, it } from "vitest";
import { buildReservationUnits } from "./ticketReservationUnits";

describe("ticketReservationUnits", () => {
  it("builds one pending nomination unit per QR derived from package quantity", () => {
    expect(
      buildReservationUnits({
        reservationId: "res-1",
        eventId: "event-1",
        packageQuantity: 2,
        unitsPerPackage: 3,
      }),
    ).toEqual([
      {
        reservationId: "res-1",
        eventId: "event-1",
        unitNumber: 1,
        packageIndex: 1,
        unitIndexInPackage: 1,
        status: "pending_nomination",
        metadata: {
          packageQuantity: 2,
          unitsPerPackage: 3,
          totalTicketUnits: 6,
        },
      },
      {
        reservationId: "res-1",
        eventId: "event-1",
        unitNumber: 2,
        packageIndex: 1,
        unitIndexInPackage: 2,
        status: "pending_nomination",
        metadata: {
          packageQuantity: 2,
          unitsPerPackage: 3,
          totalTicketUnits: 6,
        },
      },
      {
        reservationId: "res-1",
        eventId: "event-1",
        unitNumber: 3,
        packageIndex: 1,
        unitIndexInPackage: 3,
        status: "pending_nomination",
        metadata: {
          packageQuantity: 2,
          unitsPerPackage: 3,
          totalTicketUnits: 6,
        },
      },
      {
        reservationId: "res-1",
        eventId: "event-1",
        unitNumber: 4,
        packageIndex: 2,
        unitIndexInPackage: 1,
        status: "pending_nomination",
        metadata: {
          packageQuantity: 2,
          unitsPerPackage: 3,
          totalTicketUnits: 6,
        },
      },
      {
        reservationId: "res-1",
        eventId: "event-1",
        unitNumber: 5,
        packageIndex: 2,
        unitIndexInPackage: 2,
        status: "pending_nomination",
        metadata: {
          packageQuantity: 2,
          unitsPerPackage: 3,
          totalTicketUnits: 6,
        },
      },
      {
        reservationId: "res-1",
        eventId: "event-1",
        unitNumber: 6,
        packageIndex: 2,
        unitIndexInPackage: 3,
        status: "pending_nomination",
        metadata: {
          packageQuantity: 2,
          unitsPerPackage: 3,
          totalTicketUnits: 6,
        },
      },
    ]);
  });

  it("rejects non-positive package math", () => {
    expect(() =>
      buildReservationUnits({
        reservationId: "res-1",
        eventId: "event-1",
        packageQuantity: 0,
        unitsPerPackage: 2,
      }),
    ).toThrow("packageQuantity must be a positive integer");

    expect(() =>
      buildReservationUnits({
        reservationId: "res-1",
        eventId: "event-1",
        packageQuantity: 2,
        unitsPerPackage: 0,
      }),
    ).toThrow("unitsPerPackage must be a positive integer");
  });
});
