import { describe, expect, it } from "vitest";
import { getAccessCodeViewState } from "./accessCodeViewState";

describe("getAccessCodeViewState", () => {
  it("mantiene el modo de acceso con copy corto y directo", () => {
    expect(getAccessCodeViewState("access")).toEqual({
      emptyError: "Ingresa un código",
      loadingLabel: "Validando...",
      placeholder: "Código de acceso",
      submitLabel: "Entrar",
    });
  });

  it("da una señal visual mínima cuando el usuario entra por nominación", () => {
    expect(getAccessCodeViewState("nomination")).toEqual({
      emptyError: "Ingresa un código o link",
      loadingLabel: "Abriendo...",
      placeholder: "Código o link",
      submitLabel: "Completar nominación",
    });
  });
});
