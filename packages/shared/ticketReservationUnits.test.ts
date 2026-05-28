import { describe, expect, it } from "vitest";
import { buildReservationUnits } from "./ticketReservationUnits";

describe("buildReservationUnits", () => {
  it("crea una unidad pendiente por cada QR derivado de package_quantity", () => {
    const rows = buildReservationUnits({
      reservationId: "res-1",
      eventId: "event-1",
      packageQuantity: 3,
      unitsPerPackage: 2,
    });

    expect(rows).toHaveLength(6);
    expect(rows[0]).toMatchObject({
      reservation_id: "res-1",
      event_id: "event-1",
      package_index: 1,
      person_index: 1,
      unit_index: 1,
      status: "pending_nomination",
    });
    expect(rows[5]).toMatchObject({
      package_index: 3,
      person_index: 2,
      unit_index: 6,
      status: "pending_nomination",
    });
  });

  it("rechaza package math no positivo", () => {
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
