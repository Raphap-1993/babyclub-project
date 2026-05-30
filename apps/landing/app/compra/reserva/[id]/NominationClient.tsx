"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { CheckCircle2, LoaderCircle, Save, Search } from "lucide-react";
import {
  DOCUMENT_TYPES,
  validateDocument,
  type DocumentType,
} from "shared/document";
import {
  getAssistantUnits,
  getBuyerDisplayName,
  getBuyerUnit,
} from "../../nominationWorkspace";
import { lookupNominationPerson } from "./nominationLookup";

type ReservationStatus =
  | "pending"
  | "approved"
  | "confirmed"
  | "paid"
  | "rejected"
  | "cancelled"
  | "unknown";

type UnitStatus =
  | "pending_nomination"
  | "nominated"
  | "issued"
  | "used"
  | "cancelled";

type ReservationSummary = {
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

type ReservationUnit = {
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
};

const ISSUE_READY_STATUSES = new Set<ReservationStatus>([
  "approved",
  "confirmed",
  "paid",
]);

const UNIT_TERMINAL_STATUSES = new Set<UnitStatus>(["used", "cancelled"]);

function readText(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function readNumber(value: unknown) {
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
    status === "cancelled"
  ) {
    return status;
  }
  return "pending_nomination";
}

function normalizeDocType(value: unknown): DocumentType {
  const docType = String(value || "")
    .trim()
    .toLowerCase();
  return DOCUMENT_TYPES.some((option) => option.value === docType)
    ? (docType as DocumentType)
    : "dni";
}

function formatDate(value: string | null) {
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
  });
}

function extractReservationSource(payload: any) {
  return payload?.reservation ?? payload?.ticket_reservation ?? payload ?? {};
}

function normalizeReservationSummary(
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

function mergeReservationSummary(
  current: ReservationSummary | null,
  payload: any,
  reservationId: string,
) {
  const next = normalizeReservationSummary(payload, reservationId);
  if (!current) return next;

  return {
    ...current,
    id: next.id || current.id,
    status: next.status !== "unknown" ? next.status : current.status,
    event_name: next.event_name ?? current.event_name,
    event_starts_at: next.event_starts_at ?? current.event_starts_at,
    event_location: next.event_location ?? current.event_location,
    ticket_type_label: next.ticket_type_label ?? current.ticket_type_label,
    package_quantity: next.package_quantity ?? current.package_quantity,
    total_ticket_units: next.total_ticket_units ?? current.total_ticket_units,
    buyer_full_name: next.buyer_full_name ?? current.buyer_full_name,
    buyer_email: next.buyer_email ?? current.buyer_email,
    buyer_phone: next.buyer_phone ?? current.buyer_phone,
    amount: next.amount ?? current.amount,
    currency_code: next.currency_code ?? current.currency_code,
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
  };
}

function extractUnits(payload: any): ReservationUnit[] {
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

function isUnitNominationValid(unit: ReservationUnit) {
  return (
    unit.full_name.trim().length > 0 &&
    validateDocument(unit.doc_type, unit.document)
  );
}

function unitValidationMessage(unit: ReservationUnit) {
  if (!unit.full_name.trim()) return "Ingresa el nombre completo.";
  if (!validateDocument(unit.doc_type, unit.document)) {
    return "Documento inválido.";
  }
  return null;
}

function isTerminalUnit(unit: ReservationUnit) {
  return UNIT_TERMINAL_STATUSES.has(unit.status);
}

function lookupButtonLabel(docType: DocumentType) {
  return docType === "dni" ? "Buscar DNI" : "Buscar documento";
}

function buildNominationProgress(
  reservation: ReservationSummary | null,
  units: ReservationUnit[],
) {
  const editableUnits = getAssistantUnits(units).filter(
    (unit) => !isTerminalUnit(unit),
  );
  const invalidUnits = editableUnits.filter((unit) => !isUnitNominationValid(unit));
  const pendingNominationCount = editableUnits.filter(
    (unit) => unit.status === "pending_nomination",
  ).length;
  const nominatedReadyCount = editableUnits.filter(
    (unit) => unit.status === "nominated" && !unit.ticket_id,
  ).length;

  return {
    editableUnits,
    invalidUnits,
    readyToAutoIssue: Boolean(
      reservation &&
        ISSUE_READY_STATUSES.has(reservation.status) &&
        invalidUnits.length === 0 &&
        pendingNominationCount === 0 &&
        nominatedReadyCount > 0,
    ),
  };
}

function UnitField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="space-y-1.5">
      <span className="block text-[11px] font-semibold uppercase tracking-[0.18em] text-white/45">
        {label}
      </span>
      {children}
    </label>
  );
}

export default function NominationClient({
  reservationId,
}: {
  reservationId: string;
}) {
  const [reservation, setReservation] = useState<ReservationSummary | null>(
    null,
  );
  const [units, setUnits] = useState<ReservationUnit[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveStep, setSaveStep] = useState<"saving" | "issuing" | null>(null);
  const [attemptedSave, setAttemptedSave] = useState(false);
  const [lookupLoadingByUnitId, setLookupLoadingByUnitId] = useState<
    Record<string, boolean>
  >({});
  const [lookupErrorByUnitId, setLookupErrorByUnitId] = useState<
    Record<string, string | null>
  >({});
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const loadUnits = async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(
        `/api/ticket-reservations/${encodeURIComponent(reservationId)}/units`,
        {
          cache: "no-store",
        },
      );
      const payload = await res.json().catch(() => ({}));
      if (!res.ok || !payload?.success) {
        throw new Error(
          payload?.error || "No se pudo cargar la reserva para nominación.",
        );
      }

      setReservation(normalizeReservationSummary(payload, reservationId));
      setUnits(extractUnits(payload));
    } catch (err: any) {
      setError(err?.message || "Error al cargar la reserva.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadUnits();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reservationId]);

  const buyerUnit = useMemo(() => getBuyerUnit(units), [units]);
  const buyerDisplayName = getBuyerDisplayName(reservation, buyerUnit);
  const progress = useMemo(
    () => buildNominationProgress(reservation, units),
    [reservation, units],
  );
  const editableUnits = progress.editableUnits;
  const invalidUnits = progress.invalidUnits;
  const assistantUnits = editableUnits;
  const primaryButtonLabel = useMemo(() => {
    if (saveStep === "issuing") return "Emitiendo QR...";
    if (saveStep === "saving") return "Guardando...";
    if (progress.readyToAutoIssue) return "Guardar y emitir QR";
    if (assistantUnits.some((unit) => unit.status === "issued")) {
      return "Guardar cambios";
    }
    return "Guardar nominaciones";
  }, [assistantUnits, progress.readyToAutoIssue, saveStep]);

  function clearLookupError(unitId: string) {
    setLookupErrorByUnitId((current) =>
      current[unitId]
        ? {
            ...current,
            [unitId]: null,
          }
        : current,
    );
  }

  function updateUnit(unitId: string, patch: Partial<ReservationUnit>) {
    clearLookupError(unitId);
    setUnits((current) =>
      current.map((unit) =>
        unit.id === unitId
          ? {
              ...unit,
              ...patch,
            }
          : unit,
      ),
    );
  }

  async function handleLookupDocument(unit: ReservationUnit) {
    setError(null);
    setSuccess(null);
    clearLookupError(unit.id);
    setLookupLoadingByUnitId((current) => ({
      ...current,
      [unit.id]: true,
    }));

    try {
      const person = await lookupNominationPerson({
        document: unit.document,
        docType: unit.doc_type,
      });

      if (!person) {
        setLookupErrorByUnitId((current) => ({
          ...current,
          [unit.id]: "No encontramos datos para ese documento.",
        }));
        return;
      }

      updateUnit(unit.id, {
        full_name: person.full_name || unit.full_name,
        email: unit.email.trim() || !person.email ? unit.email : person.email,
        phone: unit.phone.trim() || !person.phone ? unit.phone : person.phone,
      });
    } catch (err: any) {
      setLookupErrorByUnitId((current) => ({
        ...current,
        [unit.id]: err?.message || "No se pudo buscar el documento.",
      }));
    } finally {
      setLookupLoadingByUnitId((current) => ({
        ...current,
        [unit.id]: false,
      }));
    }
  }

  async function handleSave() {
    setAttemptedSave(true);
    setError(null);
    setSuccess(null);

    const firstInvalid = invalidUnits[0];
    if (firstInvalid) {
      setError(
        `Completa el asistente ${firstInvalid.unit_index}: ${unitValidationMessage(firstInvalid)}`,
      );
      return;
    }
    if (editableUnits.length === 0) {
      setSuccess("No hay asistentes pendientes por completar.");
      return;
    }

    setSaving(true);
    setSaveStep("saving");

    try {
      const saveRes = await fetch(
        `/api/ticket-reservations/${encodeURIComponent(reservationId)}/units`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            reservation_id: reservationId,
            units: editableUnits.map((unit) => ({
              id: unit.id,
              package_index: unit.package_index,
              person_index: unit.person_index,
              unit_index: unit.unit_index,
              full_name: unit.full_name.trim(),
              doc_type: unit.doc_type || "dni",
              document: unit.document.trim(),
              email: unit.email.trim() || null,
              phone: unit.phone.trim() || null,
            })),
          }),
        },
      );
      const savePayload = await saveRes.json().catch(() => ({}));
      if (!saveRes.ok || !savePayload?.success) {
        throw new Error(
          savePayload?.error || "No se pudieron guardar las nominaciones.",
        );
      }

      const savedUnits = extractUnits(savePayload);
      const nextUnits =
        savedUnits.length > 0
          ? savedUnits
          : units.map((unit) =>
              isTerminalUnit(unit)
                ? unit
                : { ...unit, status: "nominated" as UnitStatus },
            );
      const nextReservation = mergeReservationSummary(
        reservation,
        savePayload,
        reservationId,
      );

      setReservation(nextReservation);
      setUnits(nextUnits);

      if (buildNominationProgress(nextReservation, nextUnits).readyToAutoIssue) {
        setSaveStep("issuing");

        const issueRes = await fetch(
          `/api/ticket-reservations/${encodeURIComponent(reservationId)}/issue`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({}),
          },
        );
        const issuePayload = await issueRes.json().catch(() => ({}));
        if (!issueRes.ok || !issuePayload?.success) {
          throw new Error(
            issuePayload?.error
              ? `Se guardaron las nominaciones, pero no se pudieron emitir los QR. ${issuePayload.error}`
              : "Se guardaron las nominaciones, pero no se pudieron emitir los QR.",
          );
        }

        const issuedUnits = extractUnits(issuePayload);
        setReservation((current) =>
          mergeReservationSummary(current, issuePayload, reservationId),
        );
        if (issuedUnits.length > 0) {
          setUnits(issuedUnits);
        }
        setSuccess("Nominaciones guardadas. Los QR ya quedaron emitidos.");
      } else if (
        nextReservation &&
        !ISSUE_READY_STATUSES.has(nextReservation.status)
      ) {
        setSuccess(
          "Nominaciones guardadas. Los QR se emitirán cuando la reserva quede aprobada.",
        );
      } else {
        setSuccess("Nominaciones guardadas.");
      }
    } catch (err: any) {
      setError(err?.message || "Error al guardar nominaciones.");
    } finally {
      setSaving(false);
      setSaveStep(null);
    }
  }

  return (
    <main className="min-h-screen bg-black px-3 py-4 text-white sm:px-5 sm:py-6">
      <div className="mx-auto w-full max-w-4xl rounded-[28px] border border-white/10 bg-[#070707] p-4 shadow-[0_25px_80px_rgba(0,0,0,0.45)] sm:p-6">
        {error ? (
          <div className="mb-4 rounded-2xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-100">
            {error}
          </div>
        ) : null}

        {loading ? (
          <section className="flex min-h-[320px] items-center justify-center">
            <div className="flex items-center gap-3 text-sm text-white/70">
              <LoaderCircle className="h-5 w-5 animate-spin" />
              Cargando nominaciones...
            </div>
          </section>
        ) : (
          <div className="space-y-5">
            <header className="space-y-2 border-b border-white/10 pb-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/40">
                Completar asistentes
              </p>
              <h1 className="text-2xl font-semibold sm:text-3xl">
                {reservation?.event_name || "Reserva"}
              </h1>
              <div className="space-y-1 text-sm text-white/60 sm:flex sm:flex-wrap sm:items-center sm:gap-4 sm:space-y-0">
                <span>{formatDate(reservation?.event_starts_at || null)}</span>
                {reservation?.event_location ? (
                  <span>{reservation.event_location}</span>
                ) : null}
              </div>
            </header>

            <section className="space-y-3 rounded-3xl border border-white/10 bg-white/[0.03] p-4 sm:p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/45">
                    Comprador
                  </p>
                  <h2 className="mt-1 text-lg font-semibold">
                    {buyerDisplayName}
                  </h2>
                </div>

                {buyerUnit?.ticket_id ? (
                  <Link
                    href={
                      buyerUnit.ticket_url || `/ticket/${buyerUnit.ticket_id}`
                    }
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center justify-center rounded-2xl px-4 py-2 text-sm font-semibold btn-smoke-outline transition"
                  >
                    Ver ticket
                  </Link>
                ) : null}
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <UnitField label="Nombre completo">
                  <input
                    value={
                      buyerUnit?.full_name || reservation?.buyer_full_name || ""
                    }
                    readOnly
                    className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white/80 focus:outline-none"
                  />
                </UnitField>
                <UnitField label="Email">
                  <input
                    value={buyerUnit?.email || reservation?.buyer_email || ""}
                    readOnly
                    className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white/80 focus:outline-none"
                  />
                </UnitField>
                <UnitField label="Teléfono">
                  <input
                    value={buyerUnit?.phone || reservation?.buyer_phone || ""}
                    readOnly
                    className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white/80 focus:outline-none"
                  />
                </UnitField>
              </div>
            </section>

            <section className="space-y-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/45">
                  Nominaciones
                </p>
              </div>

              {assistantUnits.length === 0 ? (
                <div className="rounded-3xl border border-white/10 bg-white/[0.03] px-4 py-5 text-sm text-white/65">
                  No hay asistentes pendientes por completar.
                </div>
              ) : (
                assistantUnits.map((unit) => {
                  const validationMessage = unitValidationMessage(unit);
                  const showValidation =
                    attemptedSave &&
                    validationMessage &&
                    !isTerminalUnit(unit);
                  const lookupError = lookupErrorByUnitId[unit.id];
                  const lookupLoading = Boolean(lookupLoadingByUnitId[unit.id]);

                  return (
                    <article
                      key={unit.id}
                      className="rounded-3xl border border-white/10 bg-white/[0.03] p-4 sm:p-5"
                    >
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <h3 className="text-lg font-semibold">
                            Asistente {unit.unit_index}
                          </h3>
                          {unit.status === "issued" ? (
                            <p className="mt-1 text-xs text-white/55">
                              Si cambias estos datos y guardas, el QR se
                              reemitirá.
                            </p>
                          ) : null}
                        </div>

                        {unit.ticket_id ? (
                          <Link
                            href={unit.ticket_url || `/ticket/${unit.ticket_id}`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center justify-center rounded-2xl px-4 py-2 text-sm font-semibold btn-smoke-outline transition"
                          >
                            Ver ticket
                          </Link>
                        ) : null}
                      </div>

                      <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        <UnitField label="Tipo de documento">
                          <select
                            value={unit.doc_type}
                            onChange={(event) =>
                              updateUnit(unit.id, {
                                doc_type: event.target.value as DocumentType,
                                document: "",
                              })
                            }
                            disabled={saving}
                            className="w-full rounded-2xl border border-white/10 bg-[#111111] px-4 py-3 text-sm text-white focus:border-white focus:outline-none disabled:opacity-60"
                          >
                            {DOCUMENT_TYPES.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </UnitField>

                        <UnitField label="Documento">
                          <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr),auto]">
                            <input
                              value={unit.document}
                              onChange={(event) =>
                                updateUnit(unit.id, {
                                  document: event.target.value,
                                })
                              }
                              disabled={saving}
                              inputMode={
                                unit.doc_type === "dni" ||
                                unit.doc_type === "ruc"
                                  ? "numeric"
                                  : "text"
                              }
                              maxLength={
                                unit.doc_type === "dni"
                                  ? 8
                                  : unit.doc_type === "ruc"
                                    ? 11
                                    : 12
                              }
                              className="w-full rounded-2xl border border-white/10 bg-[#111111] px-4 py-3 text-sm text-white focus:border-white focus:outline-none disabled:opacity-60"
                            />
                            <button
                              type="button"
                              onClick={() => void handleLookupDocument(unit)}
                              disabled={saving || lookupLoading}
                              className="inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold btn-smoke-outline transition disabled:opacity-60"
                            >
                              {lookupLoading ? (
                                <LoaderCircle className="h-4 w-4 animate-spin" />
                              ) : (
                                <Search className="h-4 w-4" />
                              )}
                              {lookupButtonLabel(unit.doc_type)}
                            </button>
                          </div>
                        </UnitField>
                      </div>

                      <div className="mt-3 grid gap-3">
                        <UnitField label="Nombre completo">
                          <input
                            value={unit.full_name}
                            onChange={(event) =>
                              updateUnit(unit.id, {
                                full_name: event.target.value,
                              })
                            }
                            disabled={saving}
                            className="w-full rounded-2xl border border-white/10 bg-[#111111] px-4 py-3 text-sm text-white focus:border-white focus:outline-none disabled:opacity-60"
                          />
                        </UnitField>

                        <div className="grid gap-3 sm:grid-cols-2">
                          <UnitField label="Email">
                            <input
                              value={unit.email}
                              onChange={(event) =>
                                updateUnit(unit.id, {
                                  email: event.target.value,
                                })
                              }
                              disabled={saving}
                              type="email"
                              className="w-full rounded-2xl border border-white/10 bg-[#111111] px-4 py-3 text-sm text-white focus:border-white focus:outline-none disabled:opacity-60"
                            />
                          </UnitField>
                          <UnitField label="Teléfono">
                            <input
                              value={unit.phone}
                              onChange={(event) =>
                                updateUnit(unit.id, {
                                  phone: event.target.value,
                                })
                              }
                              disabled={saving}
                              className="w-full rounded-2xl border border-white/10 bg-[#111111] px-4 py-3 text-sm text-white focus:border-white focus:outline-none disabled:opacity-60"
                            />
                          </UnitField>
                        </div>
                      </div>

                      {lookupError ? (
                        <p className="mt-3 text-xs font-semibold text-amber-100">
                          {lookupError}
                        </p>
                      ) : null}
                      {showValidation ? (
                        <p className="mt-3 text-xs font-semibold text-[#ff9a9a]">
                          {validationMessage}
                        </p>
                      ) : null}
                    </article>
                  );
                })
              )}
            </section>

            {editableUnits.length > 0 ? (
              <div className="sticky bottom-3 z-10 -mx-1 border-t border-white/10 bg-[#070707]/95 px-1 pt-4 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:px-0 sm:pt-0 sm:backdrop-blur-none">
                <button
                  type="button"
                  onClick={() => void handleSave()}
                  disabled={saving}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold btn-smoke transition disabled:opacity-60"
                >
                  {saveStep ? (
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  {primaryButtonLabel}
                </button>
              </div>
            ) : null}
          </div>
        )}
      </div>

      {success ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4 py-6">
          <div className="w-full max-w-md space-y-4 rounded-3xl border border-emerald-500/25 bg-gradient-to-b from-[#111111] to-[#050505] p-6 text-white shadow-[0_30px_90px_rgba(16,185,129,0.22)]">
            <div className="space-y-2 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-emerald-500/30 bg-emerald-500/10">
                <CheckCircle2 className="h-7 w-7 text-emerald-300" />
              </div>
              <h3 className="text-xl font-semibold text-white">
                Nominaciones guardadas
              </h3>
              <p className="text-sm leading-relaxed text-emerald-100/90">
                {success}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSuccess(null)}
              className="w-full rounded-2xl px-4 py-3 text-center text-sm font-semibold btn-smoke transition"
            >
              Entendido
            </button>
          </div>
        </div>
      ) : null}
    </main>
  );
}
