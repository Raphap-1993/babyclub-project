import {
  entryPresentation,
  identityChanged,
  type ReservationUnit,
} from "./nominationModel";

export type MailDelivery = {
  unitId: string;
  ticketId: string;
  status: "sent" | "failed" | "skipped";
  error?: string;
};
export type EntryActionResult = {
  saved: boolean;
  savedPayload: any;
  issueSucceeded: boolean;
  mailDelivery: MailDelivery | null;
  error: string | null;
};
const emptyResult = (): EntryActionResult => ({
  saved: false,
  savedPayload: null,
  issueSucceeded: false,
  mailDelivery: null,
  error: null,
});

function readDelivery(payload: any, unitId: string): MailDelivery | null {
  const delivery = Array.isArray(payload?.mailDelivery)
    ? payload.mailDelivery.find((item: any) => item?.unitId === unitId)
    : null;
  return delivery && ["sent", "failed", "skipped"].includes(delivery.status)
    ? delivery
    : null;
}

export async function nominationRequest(
  url: string,
  method: "GET" | "POST" | "PUT",
  body?: unknown,
  fetchImpl: typeof fetch = fetch,
) {
  const response = await fetchImpl(url, {
    method,
    cache: "no-store",
    ...(body === undefined
      ? {}
      : {
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload?.success) {
    const message = [
      "REISSUE_UNAVAILABLE",
      "NOMINATION_UPDATE_UNAVAILABLE",
    ].includes(payload?.code)
      ? "No pudimos actualizar el titular ahora. Tu QR anterior se conserva. Vuelve a intentarlo más tarde."
      : payload?.error ||
        "No pudimos completar esta acción. Inténtalo de nuevo.";
    throw new Error(message);
  }
  return payload;
}

export async function saveEntry({
  reservationId,
  original,
  unit,
  reservationStatus,
  fetchImpl = fetch,
}: {
  reservationId: string;
  original: ReservationUnit;
  unit: ReservationUnit;
  reservationStatus: string;
  fetchImpl?: typeof fetch;
}): Promise<EntryActionResult> {
  const result = emptyResult();
  const state = entryPresentation(original, reservationStatus);
  if (!state.canEdit)
    return {
      ...result,
      error: "Esta entrada no permite cambios en su estado actual.",
    };
  try {
    result.savedPayload = await nominationRequest(
      `/api/ticket-reservations/${encodeURIComponent(reservationId)}/units`,
      "PUT",
      {
        reservation_id: reservationId,
        units: [
          {
            id: unit.id,
            package_index: unit.package_index,
            person_index: unit.person_index,
            unit_index: unit.unit_index,
            full_name: unit.full_name.trim(),
            doc_type: unit.doc_type,
            document: unit.document.trim(),
            email: unit.email.trim() || null,
            phone: unit.phone.trim() || null,
            expected_updated_at: unit.updated_at,
          },
        ],
      },
      fetchImpl,
    );
    result.saved = true;
    // Contact-only edits of an existing ticket preserve its QR and do not send mail.
    if (
      state.canIssue &&
      (!original.ticket_id || identityChanged(original, unit))
    ) {
      const issued = await nominationRequest(
        `/api/ticket-reservations/${encodeURIComponent(reservationId)}/units/${encodeURIComponent(unit.id)}/issue`,
        "POST",
        {},
        fetchImpl,
      );
      result.issueSucceeded = true;
      result.mailDelivery = readDelivery(issued, unit.id);
    }
  } catch (error) {
    result.error =
      error instanceof Error
        ? error.message
        : "No pudimos guardar esta entrada.";
  }
  return result;
}

export async function sendEntryEmail({
  reservationId,
  unit,
  reservationStatus,
  fetchImpl = fetch,
}: {
  reservationId: string;
  unit: ReservationUnit;
  reservationStatus: string;
  fetchImpl?: typeof fetch;
}): Promise<EntryActionResult> {
  const result = emptyResult();
  if (!entryPresentation(unit, reservationStatus).ready)
    return {
      ...result,
      error: "El correo estará disponible cuando tu QR esté listo.",
    };
  try {
    const payload = await nominationRequest(
      `/api/ticket-reservations/${encodeURIComponent(reservationId)}/units/${encodeURIComponent(unit.id)}/issue`,
      "POST",
      {},
      fetchImpl,
    );
    result.issueSucceeded = true;
    result.mailDelivery = readDelivery(payload, unit.id);
  } catch (error) {
    result.error =
      error instanceof Error
        ? error.message
        : "No pudimos enviar el correo. Tu QR sigue disponible.";
  }
  return result;
}
