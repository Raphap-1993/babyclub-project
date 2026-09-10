import {
  DOCUMENT_TYPES,
  validateDocument,
  type DocumentType,
} from "shared/document";
import type { TicketAccessState } from "shared/ticketAccess";

export type ReservationStatus =
  | "pending"
  | "approved"
  | "confirmed"
  | "paid"
  | "rejected"
  | "cancelled"
  | "unknown";

export type UnitStatus =
  | "pending_nomination"
  | "nominated"
  | "issued"
  | "used"
  | "cancelled"
  | "expired"
  | "unknown";

export type ReservationSummary = {
  id: string;
  status: ReservationStatus;
  event_name: string | null;
  event_starts_at: string | null;
  event_location: string | null;
  ticket_type_label: string | null;
  package_quantity: number | null;
  total_ticket_units: number | null;
  buyer_full_name: string | null;
  buyer_email: string | null;
  buyer_phone: string | null;
  amount: number | null;
  currency_code: string | null;
};

export type ReservationUnit = {
  id: string;
  package_index: number;
  person_index: number;
  unit_index: number;
  status: UnitStatus;
  full_name: string;
  doc_type: DocumentType;
  document: string;
  email: string;
  phone: string;
  ticket_id: string | null;
  ticket_url: string | null;
  updated_at: string | null;
  used_at: string | null;
  access_status: TicketAccessState["state"] | null;
  access_reason: string | null;
  expired_at: string | null;
  claim_code: string | null;
  claim_url: string | null;
};

export const ISSUE_READY_STATUSES = new Set<ReservationStatus>([
  "approved",
  "confirmed",
  "paid",
]);

function readText(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function readNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

function readFirstRelation<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function normalizeReservationStatus(value: unknown): ReservationStatus {
  const status = String(value || "")
    .trim()
    .toLowerCase();
  if (
    status === "pending" ||
    status === "approved" ||
    status === "confirmed" ||
    status === "paid" ||
    status === "rejected" ||
    status === "cancelled"
  ) {
    return status;
  }
  return "unknown";
}

function normalizeUnitStatus(value: unknown): UnitStatus {
  const status = String(value || "")
    .trim()
    .toLowerCase();
  if (
    status === "pending_nomination" ||
    status === "nominated" ||
    status === "issued" ||
    status === "used" ||
    status === "cancelled" ||
    status === "expired"
  ) {
    return status;
  }
  return "unknown";
}

function normalizeDocType(value: unknown): DocumentType {
  const docType = String(value || "")
    .trim()
    .toLowerCase();
  return DOCUMENT_TYPES.some((option) => option.value === docType)
    ? (docType as DocumentType)
    : "dni";
}

export function formatEventDate(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("es-PE", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "America/Lima",
  });
}

function extractReservationSource(payload: any) {
  return payload?.reservation ?? payload?.ticket_reservation ?? payload ?? {};
}

export function normalizeReservationSummary(
  payload: any,
  reservationId: string,
): ReservationSummary {
  const source = extractReservationSource(payload);
  const eventSource =
    readFirstRelation(source?.event) ??
    readFirstRelation(source?.event_fallback) ??
    readFirstRelation(payload?.event);

  return {
    id: readText(source?.id) || reservationId,
    status: normalizeReservationStatus(source?.status ?? payload?.status),
    event_name: readText(eventSource?.name),
    event_starts_at: readText(eventSource?.starts_at),
    event_location: readText(eventSource?.location),
    ticket_type_label:
      readText(source?.ticket_type_label) ??
      readText(payload?.ticket_type_label),
    package_quantity:
      readNumber(source?.package_quantity) ??
      readNumber(payload?.package_quantity),
    total_ticket_units:
      readNumber(source?.total_ticket_units) ??
      readNumber(payload?.total_ticket_units),
    buyer_full_name:
      readText(source?.buyer_full_name) ??
      readText(source?.full_name) ??
      readText(payload?.buyer_full_name),
    buyer_email: readText(source?.email) ?? readText(payload?.buyer_email),
    buyer_phone: readText(source?.phone) ?? readText(payload?.buyer_phone),
    amount:
      readNumber(source?.ticket_total_amount) ??
      readNumber(source?.amount) ??
      readNumber(payload?.amount),
    currency_code:
      readText(source?.currency_code) ?? readText(payload?.currency_code),
  };
}

function normalizeUnit(raw: any, index: number): ReservationUnit | null {
  const id = readText(raw?.id) || `unit-${index + 1}`;
  const ticketId = readText(raw?.ticket_id);
  const explicitTicketUrl =
    readText(raw?.ticket_url) ??
    readText(raw?.ticket_href) ??
    readText(raw?.url);

  return {
    id,
    package_index: readNumber(raw?.package_index) ?? 1,
    person_index: readNumber(raw?.person_index) ?? index + 1,
    unit_index: readNumber(raw?.unit_index) ?? index + 1,
    status: normalizeUnitStatus(raw?.status),
    full_name: readText(raw?.full_name) ?? "",
    doc_type: normalizeDocType(raw?.doc_type),
    document: readText(raw?.document) ?? "",
    email: readText(raw?.email) ?? "",
    phone: readText(raw?.phone) ?? "",
    ticket_id: ticketId,
    ticket_url: explicitTicketUrl || (ticketId ? `/ticket/${ticketId}` : null),
    updated_at: readText(raw?.updated_at),
    used_at: readText(raw?.used_at),
    access_status: ["ready", "used", "inactive", "expired", "pending"].includes(
      raw?.access_status,
    )
      ? raw.access_status
      : null,
    access_reason: readText(raw?.access_reason),
    expired_at: readText(raw?.expired_at),
    claim_code: readText(raw?.claim_code),
    claim_url: readText(raw?.claim_url),
  };
}

export function extractUnits(payload: any): ReservationUnit[] {
  const candidates = [
    payload?.units,
    payload?.ticket_reservation_units,
    payload?.reservation_units,
    payload?.data?.units,
  ];
  const rawUnits = candidates.find((candidate) => Array.isArray(candidate));
  if (!Array.isArray(rawUnits)) return [];

  return rawUnits
    .map((unit, index) => normalizeUnit(unit, index))
    .filter((unit: ReservationUnit | null): unit is ReservationUnit =>
      Boolean(unit),
    )
    .sort((a, b) => a.unit_index - b.unit_index);
}

export type UnitDraft = Partial<
  Pick<
    ReservationUnit,
    "full_name" | "doc_type" | "document" | "email" | "phone" | "updated_at"
  >
>;
export type NominationState = {
  units: ReservationUnit[];
  drafts: Record<string, UnitDraft>;
};
export type NominationAction =
  | { type: "loaded"; units: ReservationUnit[] }
  | { type: "edit"; id: string; patch: UnitDraft }
  | { type: "saved"; id: string; submitted: UnitDraft }
  | { type: "reset" }
  | { type: "discard"; id: string }
  | { type: "issued"; id: string; ticketId: string };

export function nominationReducer(
  state: NominationState,
  action: NominationAction,
): NominationState {
  if (action.type === "reset") return { units: [], drafts: {} };
  if (action.type === "discard") {
    const drafts = { ...state.drafts };
    delete drafts[action.id];
    return { ...state, drafts };
  }
  if (action.type === "issued")
    return {
      ...state,
      units: state.units.map((unit) =>
        unit.id === action.id
          ? {
              ...unit,
              status: "issued",
              ticket_id: action.ticketId,
              ticket_url: `/ticket/${action.ticketId}`,
            }
          : unit,
      ),
    };
  if (action.type === "loaded") return { ...state, units: action.units };
  if (action.type === "edit")
    return {
      ...state,
      drafts: {
        ...state.drafts,
        [action.id]: {
          ...(state.units.find((unit) => unit.id === action.id)?.updated_at
            ? {
                updated_at: state.units.find((unit) => unit.id === action.id)!
                  .updated_at,
              }
            : {}),
          ...state.drafts[action.id],
          ...action.patch,
        },
      },
    };
  const draft = state.drafts[action.id];
  if (
    !draft ||
    Object.entries(draft).some(
      ([key, value]) => action.submitted[key as keyof UnitDraft] !== value,
    )
  )
    return state;
  const drafts = { ...state.drafts };
  delete drafts[action.id];
  return { ...state, drafts };
}

export const reservationStatusLabel = (status: string) =>
  ({
    pending: "Pago en revisión",
    approved: "Compra aprobada",
    confirmed: "Compra confirmada",
    paid: "Pago confirmado",
    rejected: "Compra rechazada",
    cancelled: "Compra anulada",
  })[status] || "Estado de compra por confirmar";

export function entryPresentation(
  unit: ReservationUnit,
  reservationStatus: string,
) {
  const labels: Record<string, string> = {
    used: "Entrada utilizada",
    cancelled: "Entrada anulada",
    expired: "Entrada vencida",
    inactive: "Entrada no disponible",
    unknown: "Estado por confirmar",
  };
  const blocked = !ISSUE_READY_STATUSES.has(
    reservationStatus as ReservationStatus,
  );
  const terminalStatus =
    unit.status === "used" || unit.access_status === "used"
      ? "used"
      : ["cancelled", "expired", "unknown"].includes(unit.status)
        ? unit.status
        : ["inactive", "expired"].includes(unit.access_status || "")
          ? unit.access_status
          : null;
  const terminal = Boolean(terminalStatus);
  const accessPending = Boolean(
    unit.ticket_id && unit.access_status === "pending",
  );
  const canEdit = !blocked && !terminal && !accessPending;
  const canIssue = canEdit;
  const ready = canIssue && unit.status === "issued" && Boolean(unit.ticket_id);
  const label =
    (terminalStatus ? labels[terminalStatus] : null) ||
    (blocked
      ? reservationStatusLabel(reservationStatus)
      : ready
        ? "QR listo"
        : accessPending
          ? "QR pendiente de confirmación"
          : unit.status === "issued"
            ? "QR pendiente de aprobación"
            : unit.status === "nominated"
              ? "Datos guardados"
              : "Falta completar esta entrada");
  return { label, canEdit, canIssue, ready, terminal };
}

export function countReadyEntries(
  units: ReservationUnit[],
  reservationStatus: string,
) {
  return units.filter(
    (unit) => entryPresentation(unit, reservationStatus).ready,
  ).length;
}

export function identityChanged(unit: ReservationUnit, draft: ReservationUnit) {
  return (
    unit.full_name.trim() !== draft.full_name.trim() ||
    unit.doc_type !== draft.doc_type ||
    unit.document.trim() !== draft.document.trim()
  );
}

export function validateUnit(
  unit: ReservationUnit,
): { field: "full_name" | "document" | "email"; message: string } | null {
  if (!validateDocument(unit.doc_type, unit.document))
    return {
      field: "document",
      message:
        unit.doc_type === "dni"
          ? "El DNI debe tener 8 números."
          : "Revisa el número de documento.",
    };
  if (!unit.full_name.trim())
    return { field: "full_name", message: "Ingresa el nombre completo." };
  if (
    unit.email.trim() &&
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(unit.email.trim())
  )
    return {
      field: "email",
      message: "Revisa el correo o déjalo vacío para usar el del comprador.",
    };
  return null;
}
