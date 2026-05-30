import { validateDocument, type DocumentType } from "shared/document";

export type NominationLookupPerson = {
  full_name: string;
  email: string;
  phone: string;
};

function readText(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

function buildLookupError(docType: DocumentType) {
  if (docType === "dni") {
    return "Ingresa un DNI valido de 8 digitos.";
  }
  return "Documento invalido.";
}

export async function lookupNominationPerson({
  document,
  docType,
  fetchImpl = fetch,
}: {
  document: string;
  docType: DocumentType;
  fetchImpl?: typeof fetch;
}): Promise<NominationLookupPerson | null> {
  const cleanDocument = document.trim();
  if (!validateDocument(docType, cleanDocument)) {
    throw new Error(buildLookupError(docType));
  }

  const res = await fetchImpl(
    `/api/persons?document=${encodeURIComponent(cleanDocument)}&doc_type=${docType}`,
    { cache: "no-store" },
  );
  const payload = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(
      readText(payload?.error) || "No se pudo buscar el documento.",
    );
  }

  const person = payload?.person;
  if (!person) return null;

  const fullName = [readText(person?.first_name), readText(person?.last_name)]
    .filter(Boolean)
    .join(" ")
    .trim();

  if (!fullName) return null;

  return {
    full_name: fullName,
    email: readText(person?.email),
    phone: readText(person?.phone),
  };
}
