import { describe, expect, it } from "vitest";
import { isReservationOwner } from "./reservationOwnership";

describe("isReservationOwner", () => {
  it("returns true when reservation and ticket share document", () => {
    expect(
      isReservationOwner(
        {
          document: "72158650",
          email: "guest@example.com",
          phone: "999-111-222",
        },
        {
          document: "72158650",
          email: "owner@example.com",
          phone: "999111333",
        }
      )
    ).toBe(true);
  });

  it("returns false when both documents exist but are different", () => {
    expect(
      isReservationOwner(
        {
          document: "72158650",
          email: "same@example.com",
          phone: "999111222",
        },
        {
          document: "77378843",
          email: "same@example.com",
          phone: "999111222",
        }
      )
    ).toBe(false);
  });

  it("falls back to email/phone/name when reservation has no document", () => {
    expect(
      isReservationOwner(
        {
          full_name: "Gianella Fernanda Brehaut",
          email: "giabrehaut@gmail.com",
          phone: "904 790 266",
        },
        {
          full_name: "Gianella Fernanda Brehaut",
          email: "giabrehaut@gmail.com",
          phone: "904790266",
          document: null,
        }
      )
    ).toBe(true);
  });
});
