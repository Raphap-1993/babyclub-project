export type EntryMode = "access" | "nomination";

export function getAccessCodeViewState(mode: EntryMode) {
  if (mode === "nomination") {
    return {
      emptyError: "Ingresa un código o link",
      loadingLabel: "Abriendo...",
      placeholder: "Código o link",
      submitLabel: "Completar nominación",
    };
  }

  return {
    emptyError: "Ingresa un código",
    loadingLabel: "Validando...",
    placeholder: "Código de acceso",
    submitLabel: "Entrar",
  };
}
