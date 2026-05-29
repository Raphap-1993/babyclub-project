import { describe, expect, it } from "vitest";
import { getQrKindLabel, getQrKindPresentation } from "./scanPresentation";

describe("scanPresentation", () => {
  it("mantiene el label backend para tipos comerciales custom", () => {
    expect(getQrKindLabel("ticket_all_night", "Smoke Trio")).toBe(
      "Smoke Trio",
    );
  });

  it("devuelve una presentacion enfatica para mesa / box", () => {
    const presentation = getQrKindPresentation("table");

    expect(presentation.label).toBe("Mesa / Box");
    expect(presentation.kicker).toBe("Mesa / Box");
    expect(presentation.panelClass).toContain("cyan");
  });

  it("marca la entrada general con pista de horario", () => {
    const presentation = getQrKindPresentation("ticket_general");

    expect(presentation.kicker).toBe("Entrada General");
    expect(presentation.hint).toContain("hora límite");
  });
});
