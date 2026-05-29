"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  LoaderCircle,
  RefreshCw,
  Save,
  Ticket,
} from "lucide-react";
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
import { LegalFooterLinks } from "../../../legal/LegalFooterLinks";

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

type IssuedTicketLink = {
  ticket_id: string;
  url: string | null;
};

const ISSUE_READY_STATUSES = new Set<ReservationStatus>([
  "approved",
  "confirmed",
  "paid",
]);

const UNIT_TERMINAL_STATUSES = new Set<UnitStatus>([
  "used",
  "cancelled",
]);

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

function formatMoney(value: number | null, currencyCode: string | null) {
  if (value == null) return "—";
  return new Intl.NumberFormat("es-PE", {
    style: "currency",
    currency: currencyCode || "PEN",
    minimumFractionDigits: 2,
  }).format(value);
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

function extractIssuedTickets(payload: any): IssuedTicketLink[] {
  const candidates = [
    payload?.issued_tickets,
    payload?.tickets,
    payload?.issued,
  ];
  const rawTickets = candidates.find((candidate) => Array.isArray(candidate));
  if (!Array.isArray(rawTickets)) return [];

  const normalizedTickets = rawTickets
    .map((ticket: any): IssuedTicketLink | null => {
      const ticketId =
        readText(ticket?.ticket_id) ?? readText(ticket?.id) ?? readText(ticket);
      if (!ticketId) return null;
      return {
        ticket_id: ticketId,
        url:
          readText(ticket?.url) ??
          readText(ticket?.ticket_url) ??
          `/ticket/${ticketId}`,
      };
    })
    .filter((ticket: IssuedTicketLink | null): ticket is IssuedTicketLink =>
      Boolean(ticket),
    );

  return normalizedTickets;
}

function buildFallbackIssuedTickets(
  units: ReservationUnit[],
): IssuedTicketLink[] {
  return units
    .filter((unit) => unit.ticket_id)
    .map((unit) => ({
      ticket_id: unit.ticket_id as string,
      url: unit.ticket_url || `/ticket/${unit.ticket_id}`,
    }));
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

function statusLabel(status: ReservationStatus | UnitStatus) {
  switch (status) {
    case "pending":
      return "Pendiente";
    case "approved":
      return "Aprobada";
    case "confirmed":
      return "Confirmada";
    case "paid":
      return "Pagada";
    case "rejected":
      return "Rechazada";
    case "cancelled":
      return "Cancelada";
    case "pending_nomination":
      return "Pendiente de completar";
    case "nominated":
      return "Nominada";
    case "issued":
      return "Emitida";
    case "used":
      return "Usada";
    default:
      return "Sin estado";
  }
}

function StatusBadge({ status }: { status: ReservationStatus | UnitStatus }) {
  const palette =
    status === "approved" ||
    status === "confirmed" ||
    status === "paid" ||
    status === "issued" ||
    status === "used"
      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
      : status === "rejected" || status === "cancelled"
        ? "border-red-500/30 bg-red-500/10 text-red-200"
        : "border-white/10 bg-white/5 text-white/75";

  return (
    <span
      className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${palette}`}
    >
      {statusLabel(status)}
    </span>
  );
}

function ReservationStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/30 px-3 py-2.5 sm:px-4 sm:py-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/45 sm:text-xs sm:tracking-[0.18em]">
        {label}
      </p>
      <p className="mt-1.5 text-sm font-semibold leading-5 text-white sm:mt-2">
        {value}
      </p>
    </div>
  );
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
      <span className="block text-xs font-semibold uppercase tracking-[0.16em] text-white/50">
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
  const [issuedTickets, setIssuedTickets] = useState<IssuedTicketLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [issuing, setIssuing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const loadUnits = async (keepSuccess = false) => {
    setLoading(true);
    setError(null);
    if (!keepSuccess) setSuccess(null);

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

      const nextUnits = extractUnits(payload);
      const nextReservation = normalizeReservationSummary(
        payload,
        reservationId,
      );
      const nextIssuedTickets = extractIssuedTickets(payload);

      setReservation(nextReservation);
      setUnits(nextUnits);
      setIssuedTickets(
        nextIssuedTickets.length > 0
          ? nextIssuedTickets
          : buildFallbackIssuedTickets(nextUnits),
      );
    } catch (err: any) {
      setError(err?.message || "Error al cargar la reserva.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Reservation id is the only navigation input for this workspace.
    void loadUnits();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reservationId]);

  const invalidUnits = useMemo(
    () =>
      units.filter(
        (unit) =>
          unit.unit_index !== 1 &&
          !UNIT_TERMINAL_STATUSES.has(unit.status) &&
          !isUnitNominationValid(unit),
      ),
    [units],
  );
  const buyerUnit = useMemo(() => getBuyerUnit(units), [units]);
  const assistantUnits = useMemo(() => getAssistantUnits(units), [units]);
  const editableUnits = assistantUnits;
  const pendingAssistantUnits = useMemo(
    () => assistantUnits.filter((unit) => unit.status === "pending_nomination"),
    [assistantUnits],
  );
  const editableIssuedUnits = useMemo(
    () => assistantUnits.filter((unit) => unit.status === "issued"),
    [assistantUnits],
  );
  const pendingNominationCount = useMemo(
    () =>
      editableUnits.filter((unit) => unit.status === "pending_nomination")
        .length,
    [editableUnits],
  );
  const nominatedReadyCount = useMemo(
    () =>
      editableUnits.filter(
        (unit) => unit.status === "nominated" && !unit.ticket_id,
      ).length,
    [editableUnits],
  );
  const readyToIssue = Boolean(
    reservation &&
      ISSUE_READY_STATUSES.has(reservation.status) &&
      invalidUnits.length === 0 &&
      pendingNominationCount === 0 &&
      nominatedReadyCount > 0,
  );
  const issuedCount = useMemo(
    () =>
      units.filter((unit) => unit.status === "issued" || unit.status === "used")
        .length,
    [units],
  );
  const allAssistantsCompleted = pendingNominationCount === 0;
  const buyerDisplayName = getBuyerDisplayName(reservation, buyerUnit);
  const saveButtonLabel =
    editableIssuedUnits.length > 0
      ? "Guardar y reemitir QR"
      : "Completar asistentes";

  function updateUnit(unitId: string, patch: Partial<ReservationUnit>) {
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

  async function handleSave() {
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
    try {
      const res = await fetch(
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
      const payload = await res.json().catch(() => ({}));
      if (!res.ok || !payload?.success) {
        throw new Error(
          payload?.error || "No se pudieron guardar las nominaciones.",
        );
      }

      const returnedUnits = extractUnits(payload);
      if (returnedUnits.length > 0) {
        setUnits(returnedUnits);
      } else {
        setUnits((current) =>
          current.map((unit) =>
            UNIT_TERMINAL_STATUSES.has(unit.status)
              ? unit
              : { ...unit, status: "nominated" },
          ),
        );
      }

      setReservation((current) =>
        mergeReservationSummary(current, payload, reservationId),
      );
      setSuccess(
        "Asistentes guardados. Puedes volver cuando necesites editar.",
      );
    } catch (err: any) {
      setError(err?.message || "Error al guardar nominaciones.");
    } finally {
      setSaving(false);
    }
  }

  async function handleIssue() {
    if (!reservation) return;

    setIssuing(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch(
        `/api/ticket-reservations/${encodeURIComponent(reservationId)}/issue`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        },
      );
      const payload = await res.json().catch(() => ({}));
      if (!res.ok || !payload?.success) {
        throw new Error(payload?.error || "No se pudieron emitir los QR.");
      }

      const returnedUnits = extractUnits(payload);
      const nextUnits = returnedUnits.length > 0 ? returnedUnits : units;
      const nextIssuedTickets = extractIssuedTickets(payload);

      setReservation((current) =>
        mergeReservationSummary(current, payload, reservationId),
      );
      setUnits(nextUnits);
      setIssuedTickets(
        nextIssuedTickets.length > 0
          ? nextIssuedTickets
          : buildFallbackIssuedTickets(nextUnits),
      );
      setSuccess("QR emitidos. Ya puedes compartir las entradas generadas.");

      if (returnedUnits.length === 0) {
        await loadUnits(true);
      }
    } catch (err: any) {
      setError(err?.message || "Error al emitir los QR.");
    } finally {
      setIssuing(false);
    }
  }

  return (
    <main className="flex min-h-screen items-start justify-center bg-black px-2 py-2 text-white sm:px-4 sm:py-4 lg:px-8 lg:py-6">
      <div className="w-full max-w-6xl space-y-3 overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-b from-[#0f0f0f] to-[#050505] p-3 shadow-[0_25px_80px_rgba(0,0,0,0.45)] sm:space-y-4 sm:p-4 lg:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1.5">
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-white/45">
              BABY
            </p>
            <div className="space-y-1">
              <h1 className="text-2xl font-semibold sm:text-3xl">
                Completar asistentes
              </h1>
              <p className="text-sm text-white/65">
                Reserva{" "}
                <span className="block font-mono text-xs text-white sm:inline sm:text-sm">
                  {reservationId}
                </span>
              </p>
            </div>
          </div>

          <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap sm:items-center">
            <Link
              href="/compra"
              className="inline-flex items-center justify-center gap-2 rounded-full px-3 py-2 text-sm font-semibold btn-smoke-outline transition sm:px-4"
            >
              <ArrowLeft className="h-4 w-4" />
              Volver a compra
            </Link>
            <button
              type="button"
              onClick={() => void loadUnits()}
              disabled={loading || saving || issuing}
              className="inline-flex items-center justify-center gap-2 rounded-full px-3 py-2 text-sm font-semibold btn-smoke-outline transition disabled:opacity-60 sm:px-4"
            >
              <RefreshCw
                className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
              />
              Recargar
            </button>
          </div>
        </div>

        {reservation ? (
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={reservation.status} />
            {reservation.ticket_type_label ? (
              <span className="inline-flex rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-white/75">
                {reservation.ticket_type_label}
              </span>
            ) : null}
          </div>
        ) : null}

        {error ? (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        ) : null}
        {success ? (
          <div className="flex items-center gap-2 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
            <CheckCircle2 className="h-4 w-4" />
            {success}
          </div>
        ) : null}

        {loading ? (
          <section className="flex min-h-[320px] items-center justify-center rounded-3xl border border-white/10 bg-[#0a0a0a]">
            <div className="flex items-center gap-3 text-sm text-white/70">
              <LoaderCircle className="h-5 w-5 animate-spin" />
              Cargando reserva y unidades...
            </div>
          </section>
        ) : (
          <>
            <section className="grid grid-cols-2 gap-2 sm:grid-cols-2 sm:gap-3 xl:grid-cols-5">
              <ReservationStat
                label="Evento"
                value={reservation?.event_name || "—"}
              />
              <ReservationStat
                label="Fecha"
                value={formatDate(reservation?.event_starts_at || null)}
              />
              <ReservationStat
                label="Primer asistente"
                value={buyerDisplayName}
              />
              <ReservationStat
                label="Paquetes / asistentes"
                value={`${reservation?.package_quantity ?? "—"} / ${reservation?.total_ticket_units ?? units.length}`}
              />
              <ReservationStat
                label="Monto"
                value={formatMoney(
                  reservation?.amount ?? null,
                  reservation?.currency_code ?? "PEN",
                )}
              />
            </section>

            <section className="rounded-3xl border border-white/10 bg-[#0a0a0a] p-3 sm:p-4 sm:p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="text-lg font-semibold sm:text-xl">
                    Comprador y asistentes
                  </h2>
                  <p className="mt-1 text-sm leading-6 text-white/60">
                    {pendingAssistantUnits.length > 0
                      ? "Tus códigos QR se generarán automáticamente cuando completes los datos de los asistentes restantes."
                      : editableIssuedUnits.length > 0
                        ? "Ya puedes corregir asistentes emitidos y, al guardar, se reemitirá su QR con los nuevos datos."
                        : "Tu QR ya fue generado automáticamente. Aquí puedes revisar al comprador y cerrar la reserva cuando quieras."}
                  </p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white/70 sm:max-w-xs">
                  {issuedCount > 0 ? (
                    <span>{issuedCount} QR ya emitidos.</span>
                  ) : allAssistantsCompleted && buyerUnit ? (
                    <span>
                      El comprador queda registrado y no hay asistentes
                      pendientes.
                    </span>
                  ) : invalidUnits.length === 0 ? (
                    <span>
                      Todo listo para guardar o emitir cuando aplique.
                    </span>
                  ) : (
                    <span>
                      Faltan {invalidUnits.length} unidades por completar.
                    </span>
                  )}
                </div>
              </div>

              <div className="mt-4 space-y-3 sm:mt-5 sm:space-y-4">
                {buyerUnit ? (
                  <article className="rounded-2xl border border-emerald-500/20 bg-emerald-500/8 p-3 sm:p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-base font-semibold text-white">
                            Comprador / primer asistente
                          </h3>
                          <span className="inline-flex rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-100">
                            Solo lectura
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-white/50">
                          Se registra automáticamente y recibe su QR al
                          aprobarse la compra.
                        </p>
                      </div>

                      {buyerUnit.ticket_id ? (
                        <Link
                          href={
                            buyerUnit.ticket_url ||
                            `/ticket/${buyerUnit.ticket_id}`
                          }
                          className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-semibold btn-smoke-outline transition"
                        >
                          <Ticket className="h-3.5 w-3.5" />
                          Ver ticket {buyerUnit.ticket_id}
                        </Link>
                      ) : null}
                    </div>

                        <div className="mt-3 grid gap-3 sm:mt-4 sm:grid-cols-2 lg:grid-cols-3">
                          <UnitField label="Nombre completo">
                        <input
                          value={
                            buyerUnit.full_name ||
                            reservation?.buyer_full_name ||
                            ""
                          }
                          readOnly
                          className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white/80 focus:outline-none"
                        />
                      </UnitField>
                      <UnitField label="Email">
                        <input
                          value={
                            buyerUnit.email || reservation?.buyer_email || ""
                          }
                          readOnly
                          className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white/80 focus:outline-none"
                        />
                      </UnitField>
                      <UnitField label="Teléfono">
                        <input
                          value={
                            buyerUnit.phone || reservation?.buyer_phone || ""
                          }
                          readOnly
                          className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white/80 focus:outline-none"
                        />
                      </UnitField>
                    </div>
                  </article>
                ) : null}

                {assistantUnits.length === 0 ? (
                  <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-5 text-sm text-white/65">
                    No hay asistentes pendientes por completar.
                  </div>
                ) : (
                  assistantUnits.map((unit) => {
                    const validationMessage = unitValidationMessage(unit);
                    const unitLocked =
                      unit.status === "used" || unit.status === "cancelled";

                    return (
                      <article
                        key={unit.id}
                        className="rounded-2xl border border-white/10 bg-black/30 p-3 sm:p-4"
                      >
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="text-base font-semibold text-white">
                                Asistente {unit.unit_index}
                              </h3>
                              <StatusBadge status={unit.status} />
                            </div>
                            <p className="mt-1 text-xs text-white/50">
                              Paquete {unit.package_index} · Persona{" "}
                              {unit.person_index}
                            </p>
                          </div>

                          {unit.ticket_id ? (
                            <Link
                              href={
                                unit.ticket_url || `/ticket/${unit.ticket_id}`
                              }
                              className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-semibold btn-smoke-outline transition"
                            >
                              <Ticket className="h-3.5 w-3.5" />
                              Ver ticket {unit.ticket_id}
                            </Link>
                          ) : null}
                        </div>

                        <div className="mt-3 grid gap-3 sm:mt-4 sm:grid-cols-2 lg:grid-cols-[0.65fr,1fr,1fr]">
                          <UnitField label="Tipo de documento">
                            <select
                              value={unit.doc_type}
                              onChange={(event) =>
                                updateUnit(unit.id, {
                                  doc_type: event.target.value as DocumentType,
                                  document: "",
                                })
                              }
                              disabled={unitLocked || issuing}
                              className="w-full rounded-xl border border-white/10 bg-[#111111] px-4 py-3 text-sm text-white focus:border-white focus:outline-none disabled:opacity-60"
                            >
                              {DOCUMENT_TYPES.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          </UnitField>
                          <UnitField label="Documento">
                            <input
                              value={unit.document}
                              onChange={(event) =>
                                updateUnit(unit.id, {
                                  document: event.target.value,
                                })
                              }
                              disabled={unitLocked || issuing}
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
                              className="w-full rounded-xl border border-white/10 bg-[#111111] px-4 py-3 text-sm text-white focus:border-white focus:outline-none disabled:opacity-60"
                            />
                          </UnitField>
                          <UnitField label="Nombre completo">
                            <input
                              value={unit.full_name}
                              onChange={(event) =>
                                updateUnit(unit.id, {
                                  full_name: event.target.value,
                                })
                              }
                              disabled={unitLocked || issuing}
                              className="w-full rounded-xl border border-white/10 bg-[#111111] px-4 py-3 text-sm text-white focus:border-white focus:outline-none disabled:opacity-60"
                            />
                          </UnitField>
                        </div>

                        <div className="mt-3 grid gap-3 sm:grid-cols-2">
                          <UnitField label="Email">
                            <input
                              value={unit.email}
                              onChange={(event) =>
                                updateUnit(unit.id, {
                                  email: event.target.value,
                                })
                              }
                              disabled={unitLocked || issuing}
                              type="email"
                              className="w-full rounded-xl border border-white/10 bg-[#111111] px-4 py-3 text-sm text-white focus:border-white focus:outline-none disabled:opacity-60"
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
                              disabled={unitLocked || issuing}
                              className="w-full rounded-xl border border-white/10 bg-[#111111] px-4 py-3 text-sm text-white focus:border-white focus:outline-none disabled:opacity-60"
                            />
                          </UnitField>
                        </div>

                        {unit.status === "issued" ? (
                          <p className="mt-3 text-xs leading-6 text-amber-100/90">
                            Si corriges este asistente y guardas, el QR anterior
                            se reemitirá con los nuevos datos.
                          </p>
                        ) : null}

                        {validationMessage &&
                        !UNIT_TERMINAL_STATUSES.has(unit.status) ? (
                          <p className="mt-3 text-xs font-semibold text-[#ff9a9a]">
                            {validationMessage}
                          </p>
                        ) : null}
                      </article>
                    );
                  })
                )}
              </div>
            </section>

            <section className="rounded-3xl border border-white/10 bg-[#0a0a0a] p-3 sm:p-4 sm:p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="text-lg font-semibold sm:text-xl">
                    Emisión de QR
                  </h2>
                  <p className="mt-1 text-sm leading-6 text-white/60">
                    Cuando la reserva esté aprobada, confirmada o pagada podrás
                    emitir los QR desde aquí.
                  </p>
                </div>
                {reservation ? (
                  <StatusBadge status={reservation.status} />
                ) : null}
              </div>

              <div className="mt-3 space-y-3 sm:mt-4">
                {reservation &&
                !ISSUE_READY_STATUSES.has(reservation.status) ? (
                  <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white/65">
                    El estado actual es{" "}
                    {statusLabel(reservation.status).toLowerCase()}. La emisión
                    se habilita cuando la reserva esté aprobada, confirmada o
                    pagada.
                  </div>
                ) : null}
                {reservation &&
                ISSUE_READY_STATUSES.has(reservation.status) &&
                (invalidUnits.length > 0 || pendingNominationCount > 0) ? (
                  <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white/65">
                    Completa primero los asistentes restantes para emitir los
                    QR.
                  </div>
                ) : null}
                {reservation &&
                ISSUE_READY_STATUSES.has(reservation.status) &&
                invalidUnits.length === 0 &&
                pendingNominationCount === 0 &&
                nominatedReadyCount === 0 &&
                issuedCount > 0 ? (
                  <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white/65">
                    Todos los QR disponibles ya fueron emitidos para esta
                    reserva.
                  </div>
                ) : null}

                <div className="grid gap-2 sm:flex sm:flex-wrap">
                  <button
                    type="button"
                    onClick={() => void handleSave()}
                    disabled={saving || issuing || editableUnits.length === 0}
                    className="inline-flex items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-semibold btn-smoke transition disabled:opacity-60"
                  >
                    <Save className="h-4 w-4" />
                    {saving ? "Guardando..." : saveButtonLabel}
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleIssue()}
                    disabled={!readyToIssue || issuing || units.length === 0}
                    className="inline-flex items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-semibold btn-smoke-outline transition disabled:opacity-60"
                  >
                    <Ticket className="h-4 w-4" />
                    {issuing ? "Emitiendo..." : "Emitir QR"}
                  </button>
                </div>

                {issuedTickets.length > 0 ? (
                  <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4">
                    <div className="flex items-center gap-2 text-sm font-semibold text-emerald-100">
                      <CheckCircle2 className="h-4 w-4" />
                      Entradas emitidas
                    </div>
                    <div className="mt-3 grid gap-2">
                      {issuedTickets.map((ticket) => (
                        <div
                          key={ticket.ticket_id}
                          className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-emerald-500/20 bg-black/30 px-4 py-3 text-sm text-white"
                        >
                          <span className="font-mono">{ticket.ticket_id}</span>
                          {ticket.url ? (
                            <Link
                              href={ticket.url}
                              className="text-xs font-semibold text-emerald-200 underline-offset-4 hover:underline"
                            >
                              Ver ticket
                            </Link>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            </section>
          </>
        )}

        <LegalFooterLinks className="pt-2" compact />
      </div>
    </main>
  );
}
