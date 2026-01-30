export type DocumentType = "dni" | "ce" | "pasaporte" | "ruc" | "otro";

export const DOCUMENT_TYPES: { value: DocumentType; label: string }[] = [
  { value: "dni", label: "DNI" },
  { value: "ce", label: "Carné de extranjería" },
  { value: "pasaporte", label: "Pasaporte" },
  { value: "ruc", label: "RUC" },
  { value: "otro", label: "Otro" },
];

export function validateDocument(docType: DocumentType, value: string) {
  const v = (value || "").trim();
  if (!v) return false;
  const onlyDigits = /^\d+$/;
  const alphaNum = /^[A-Za-z0-9]+$/;
  switch (docType) {
    case "dni":
      return v.length === 8 && onlyDigits.test(v);
    case "ce":
      return v.length >= 9 && v.length <= 12 && alphaNum.test(v);
    case "pasaporte":
      return v.length >= 6 && v.length <= 12 && alphaNum.test(v);
    case "ruc":
      return v.length === 11 && onlyDigits.test(v);
    default:
      return v.length > 0 && v.length <= 20;
  }
}

export function normalizeDocument(docType?: string | null, document?: string | null) {
  const type = (docType || "dni").toLowerCase() as DocumentType;
  const value = (document || "").trim();
  return { docType: type, document: value };
}

