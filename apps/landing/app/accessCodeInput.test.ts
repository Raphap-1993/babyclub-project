import { describe, expect, it } from "vitest";
import { extractAccessCodeInput } from "./accessCodeInput";

describe("extractAccessCodeInput", () => {
  it("retorna el texto limpio cuando recibe un código plano", () => {
    expect(extractAccessCodeInput("  BABYPR7204  ")).toBe("BABYPR7204");
  });

  it("extrae el code desde un link de registro", () => {
    expect(
      extractAccessCodeInput(
        "https://babyclubaccess.com/registro?code=BABYPR7204",
      ),
    ).toBe("BABYPR7204");
  });

  it("extrae el code incluso si el usuario pega un query parcial", () => {
    expect(extractAccessCodeInput("/registro?code=BABYPR7204&foo=1")).toBe(
      "BABYPR7204",
    );
  });
});
