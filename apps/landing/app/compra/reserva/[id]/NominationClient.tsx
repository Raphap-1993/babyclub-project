"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  ExternalLink,
  Link2,
  LoaderCircle,
  QrCode,
  Save,
  Search,
  Ticket,
  Users,
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
  claim_code: string | null;
  claim_url: string | null;
};

type ActionState = "saving" | "issuing" | null;

type FeedbackState = {
  title: string;
  message: string;
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
    claim_code: readText(raw?.claim_code),
    claim_url: readText(raw?.claim_url),
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

function getUnitStatusLabel(status: UnitStatus) {
  switch (status) {
    case "issued":
      return "QR listo";
    case "used":
      return "Ya usado";
    case "cancelled":
      return "Cancelado";
    case "nominated":
      return "Listo para emitir";
    default:
      return "Pendiente";
  }
}

function getUnitStatusClasses(status: UnitStatus) {
  switch (status) {
    case "issued":
      return "border-emerald-400/35 bg-emerald-400/10 text-emerald-50";
    case "used":
      return "border-cyan-400/35 bg-cyan-400/10 text-cyan-50";
    case "cancelled":
      return "border-red-400/35 bg-red-400/10 text-red-50";
    case "nominated":
      return "border-amber-400/35 bg-amber-400/10 text-amber-50";
    default:
      return "border-white/10 bg-white/5 text-white/70";
  }
}

function buildClaimHref(unit: ReservationUnit) {
  if (unit.claim_url) return unit.claim_url;
  if (unit.claim_code) {
    return `/codigo?code=${encodeURIComponent(unit.claim_code)}`;
  }
  return null;
}

function buildCopyableHref(href: string) {
  if (/^https?:\/\//i.test(href)) return href;
  if (typeof window === "undefined") return href;
  return new URL(href, window.location.origin).toString();
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
  const [lookupLoadingByUnitId, setLookupLoadingByUnitId] = useState<
    Record<string, boolean>
  >({});
  const [lookupErrorByUnitId, setLookupErrorByUnitId] = useState<
    Record<string, string | null>
  >({});
  const [actionByUnitId, setActionByUnitId] = useState<
    Record<string, ActionState>
  >({});
  const [attemptedUnitIds, setAttemptedUnitIds] = useState<
    Record<string, boolean>
  >({});
  const [revealedCodeByUnitId, setRevealedCodeByUnitId] = useState<
    Record<string, boolean>
  >({});
  const [copyFeedbackByUnitId, setCopyFeedbackByUnitId] = useState<
    Record<string, "idle" | "copied" | "error">
  >({});
  const [error, setError] = useState<FeedbackState | null>(null);
  const [success, setSuccess] = useState<FeedbackState | null>(null);

  const loadUnits = async ({ foreground = true } = {}) => {
    if (foreground) {
      setLoading(true);
      setError(null);
    }

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
          payload?.error || "No se pudo abrir esta compra en este momento.",
        );
      }

      setReservation(normalizeReservationSummary(payload, reservationId));
      setUnits(extractUnits(payload));
    } catch (err: any) {
      setError({
        title: "No pudimos abrir esta compra",
        message: err?.message || "Inténtalo de nuevo en un momento.",
      });
    } finally {
      if (foreground) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    void loadUnits();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reservationId]);

  const buyerUnit = useMemo(() => getBuyerUnit(units), [units]);
  const buyerDisplayName = getBuyerDisplayName(reservation, buyerUnit);
  const assistantUnits = useMemo(
    () => getAssistantUnits(units).filter((unit) => !isTerminalUnit(unit)),
    [units],
  );
  const pendingAssistantCount = assistantUnits.filter(
    (unit) => unit.status === "pending_nomination",
  ).length;
  const issueReady = Boolean(
    reservation && ISSUE_READY_STATUSES.has(reservation.status),
  );

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

  function clearCopyFeedback(unitId: string) {
    setCopyFeedbackByUnitId((current) =>
      current[unitId] && current[unitId] !== "idle"
        ? {
            ...current,
            [unitId]: "idle",
          }
        : current,
    );
  }

  function updateUnit(unitId: string, patch: Partial<ReservationUnit>) {
    clearLookupError(unitId);
    clearCopyFeedback(unitId);
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

  function markUnitAttempted(unitId: string) {
    setAttemptedUnitIds((current) => ({
      ...current,
      [unitId]: true,
    }));
  }

  function setUnitAction(unitId: string, action: ActionState) {
    setActionByUnitId((current) => ({
      ...current,
      [unitId]: action,
    }));
  }

  async function handleLookupDocument(unit: ReservationUnit) {
    setError(null);
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

  async function saveUnit(
    unit: ReservationUnit,
    { issueAfterSave = false }: { issueAfterSave?: boolean } = {},
  ) {
    markUnitAttempted(unit.id);
    setError(null);
    setSuccess(null);
    clearCopyFeedback(unit.id);

    const validationMessage = unitValidationMessage(unit);
    if (validationMessage) {
      setError({
        title: "Completa este asistente",
        message: `Asistente ${unit.unit_index}: ${validationMessage}`,
      });
      return;
    }

    setUnitAction(unit.id, issueAfterSave ? "issuing" : "saving");

    let saved = false;

    try {
      const saveRes = await fetch(
        `/api/ticket-reservations/${encodeURIComponent(reservationId)}/units`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            reservation_id: reservationId,
            units: [
              {
                id: unit.id,
                package_index: unit.package_index,
                person_index: unit.person_index,
                unit_index: unit.unit_index,
                full_name: unit.full_name.trim(),
                doc_type: unit.doc_type || "dni",
                document: unit.document.trim(),
                email: unit.email.trim() || null,
                phone: unit.phone.trim() || null,
              },
            ],
          }),
        },
      );
      const savePayload = await saveRes.json().catch(() => ({}));
      if (!saveRes.ok || !savePayload?.success) {
        throw new Error(
          savePayload?.error ||
            "No se pudieron guardar los datos de este asistente.",
        );
      }

      saved = true;

      if (!issueAfterSave) {
        await loadUnits({ foreground: false });
        setSuccess({
          title: "Datos guardados",
          message:
            "Guardamos este asistente. Cuando quieras, puedes emitir su QR o compartir su código.",
        });
        return;
      }

      if (!issueReady) {
        await loadUnits({ foreground: false });
        setSuccess({
          title: "Datos guardados",
          message:
            "Guardamos este asistente. Su QR se podrá emitir cuando la compra quede aprobada.",
        });
        return;
      }

      const issueRes = await fetch(
        `/api/ticket-reservations/${encodeURIComponent(
          reservationId,
        )}/units/${encodeURIComponent(unit.id)}/issue`,
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
            ? `Guardamos los datos, pero todavía no pudimos emitir el QR. ${issuePayload.error}`
            : "Guardamos los datos, pero todavía no pudimos emitir el QR.",
        );
      }

      await loadUnits({ foreground: false });
      setSuccess({
        title: "QR listo",
        message:
          "El QR de este asistente ya quedó listo. Puedes abrirlo o compartir su código.",
      });
    } catch (err: any) {
      setError({
        title:
          saved && issueAfterSave
            ? "No pudimos emitir este QR"
            : issueAfterSave
              ? "No pudimos preparar este QR"
              : "No pudimos guardar este asistente",
        message: err?.message || "Inténtalo de nuevo en un momento.",
      });
    } finally {
      setUnitAction(unit.id, null);
    }
  }

  async function handleCopyLink(unit: ReservationUnit) {
    const href = buildClaimHref(unit);
    setError(null);
    setSuccess(null);

    if (!href) {
      setCopyFeedbackByUnitId((current) => ({
        ...current,
        [unit.id]: "error",
      }));
      setError({
        title: "Link aún no disponible",
        message:
          "Todavía no tenemos un link para este asistente. Guarda sus datos y vuelve a intentar.",
      });
      return;
    }

    try {
      await navigator.clipboard.writeText(buildCopyableHref(href));
      setCopyFeedbackByUnitId((current) => ({
        ...current,
        [unit.id]: "copied",
      }));
    } catch {
      setCopyFeedbackByUnitId((current) => ({
        ...current,
        [unit.id]: "error",
      }));
      setError({
        title: "No pudimos copiar el link",
        message:
          "Copia el código manualmente o vuelve a intentar en unos segundos.",
      });
    }
  }

  function toggleCode(unitId: string) {
    setRevealedCodeByUnitId((current) => ({
      ...current,
      [unitId]: !current[unitId],
    }));
  }

  return (
    <main className="min-h-screen bg-black px-3 py-4 text-white sm:px-5 sm:py-6">
      <div className="mx-auto w-full max-w-5xl rounded-[28px] border border-white/10 bg-[#070707] p-4 shadow-[0_25px_80px_rgba(0,0,0,0.45)] sm:p-6">
        {loading ? (
          <section className="flex min-h-[320px] items-center justify-center">
            <div className="flex items-center gap-3 text-sm text-white/70">
              <LoaderCircle className="h-5 w-5 animate-spin" />
              Cargando tu compra...
            </div>
          </section>
        ) : (
          <div className="space-y-5">
            <header className="space-y-2 border-b border-white/10 pb-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/40">
                Gestionar grupo
              </p>
              <h1 className="text-2xl font-semibold sm:text-3xl">
                {reservation?.event_name || "Compra"}
              </h1>
              <div className="space-y-1 text-sm text-white/60 sm:flex sm:flex-wrap sm:items-center sm:gap-4 sm:space-y-0">
                <span>{formatDate(reservation?.event_starts_at || null)}</span>
                {reservation?.event_location ? (
                  <span>{reservation.event_location}</span>
                ) : null}
                {reservation?.ticket_type_label ? (
                  <span>{reservation.ticket_type_label}</span>
                ) : null}
              </div>
            </header>

            {success ? (
              <div className="rounded-3xl border border-emerald-500/25 bg-emerald-500/10 p-4 text-emerald-50">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-200/80">
                  {success.title}
                </p>
                <p className="mt-2 text-sm leading-relaxed">{success.message}</p>
              </div>
            ) : null}

            <section className="grid gap-3 lg:grid-cols-[1.1fr,0.9fr]">
              <article className="rounded-3xl border border-white/10 bg-white/[0.03] p-4 sm:p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/45">
                      Mi QR
                    </p>
                    <h2 className="mt-1 text-xl font-semibold">
                      {buyerDisplayName}
                    </h2>
                    <p className="mt-2 text-sm leading-relaxed text-white/65">
                      {buyerUnit?.ticket_id
                        ? "Tu entrada principal ya está lista. Ábrela cuando quieras y deja el resto del grupo para después."
                        : "Tu QR principal todavía no aparece aquí. Mientras tanto, puedes avanzar asistente por asistente y compartir sus códigos."}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-black/30 p-3 text-white/70">
                    <Ticket className="h-5 w-5" />
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-3">
                  {buyerUnit?.ticket_id ? (
                    <Link
                      href={buyerUnit.ticket_url || `/ticket/${buyerUnit.ticket_id}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-2 text-sm font-semibold btn-smoke transition"
                    >
                      <QrCode className="h-4 w-4" />
                      Abrir mi QR
                    </Link>
                  ) : (
                    <span className="inline-flex items-center rounded-2xl border border-white/10 bg-black/30 px-4 py-2 text-sm text-white/60">
                      Tu QR aparecerá aquí cuando quede emitido.
                    </span>
                  )}
                </div>
              </article>

              <article className="rounded-3xl border border-white/10 bg-white/[0.03] p-4 sm:p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/45">
                      Asistentes pendientes
                    </p>
                    <h2 className="mt-1 text-3xl font-semibold">
                      {pendingAssistantCount}
                    </h2>
                    <p className="mt-2 text-sm leading-relaxed text-white/65">
                      Guarda cada asistente por separado, emite su QR cuando
                      esté listo y comparte su código sin depender del resto del
                      grupo.
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-black/30 p-3 text-white/70">
                    <Users className="h-5 w-5" />
                  </div>
                </div>

                <div className="mt-4 rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white/70">
                  {issueReady
                    ? "La compra ya está aprobada. Puedes emitir un QR por asistente cuando quieras."
                    : "La compra aún no está aprobada. Guarda los datos y el QR se emitirá apenas cambie el estado."}
                </div>
              </article>
            </section>

            <section className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/45">
                    Gestionar grupo
                  </p>
                  <h2 className="mt-1 text-xl font-semibold">
                    Comparte o termina cada asistente a tu ritmo
                  </h2>
                </div>
              </div>

              {assistantUnits.length === 0 ? (
                <div className="rounded-3xl border border-white/10 bg-white/[0.03] px-4 py-5 text-sm text-white/65">
                  No tienes asistentes pendientes por completar.
                </div>
              ) : (
                assistantUnits.map((unit) => {
                  const validationMessage = unitValidationMessage(unit);
                  const showValidation =
                    attemptedUnitIds[unit.id] &&
                    validationMessage &&
                    !isTerminalUnit(unit);
                  const lookupError = lookupErrorByUnitId[unit.id];
                  const lookupLoading = Boolean(lookupLoadingByUnitId[unit.id]);
                  const action = actionByUnitId[unit.id];
                  const busy = Boolean(action) || lookupLoading;
                  const claimHref = buildClaimHref(unit);
                  const revealCode = Boolean(revealedCodeByUnitId[unit.id]);
                  const copyFeedback = copyFeedbackByUnitId[unit.id] || "idle";

                  return (
                    <article
                      key={unit.id}
                      className="rounded-3xl border border-white/10 bg-white/[0.03] p-4 sm:p-5"
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-lg font-semibold">
                              Asistente {unit.unit_index}
                            </h3>
                            <span
                              className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] ${getUnitStatusClasses(
                                unit.status,
                              )}`}
                            >
                              {getUnitStatusLabel(unit.status)}
                            </span>
                          </div>
                          <p className="mt-2 text-sm leading-relaxed text-white/60">
                            {unit.ticket_id
                              ? "Si cambias estos datos, guarda primero y luego emite el QR otra vez para reflejar la actualización."
                              : "Puedes guardar a este asistente ahora y emitir su QR cuando lo necesites."}
                          </p>
                        </div>

                        {unit.ticket_id ? (
                          <Link
                            href={unit.ticket_url || `/ticket/${unit.ticket_id}`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-2 text-sm font-semibold btn-smoke-outline transition"
                          >
                            <ExternalLink className="h-4 w-4" />
                            Abrir mi QR
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
                            disabled={busy}
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
                              disabled={busy}
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
                              disabled={busy}
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
                            disabled={busy}
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
                              disabled={busy}
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
                              disabled={busy}
                              className="w-full rounded-2xl border border-white/10 bg-[#111111] px-4 py-3 text-sm text-white focus:border-white focus:outline-none disabled:opacity-60"
                            />
                          </UnitField>
                        </div>
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => void saveUnit(unit)}
                          disabled={busy}
                          className="inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-2 text-sm font-semibold btn-smoke-outline transition disabled:opacity-60"
                        >
                          {action === "saving" ? (
                            <LoaderCircle className="h-4 w-4 animate-spin" />
                          ) : (
                            <Save className="h-4 w-4" />
                          )}
                          Guardar
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            void saveUnit(unit, { issueAfterSave: true })
                          }
                          disabled={busy}
                          className="inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-2 text-sm font-semibold btn-smoke transition disabled:opacity-60"
                        >
                          {action === "issuing" ? (
                            <LoaderCircle className="h-4 w-4 animate-spin" />
                          ) : (
                            <QrCode className="h-4 w-4" />
                          )}
                          Emitir QR
                        </button>

                        <button
                          type="button"
                          onClick={() => toggleCode(unit.id)}
                          className="inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-2 text-sm font-semibold btn-smoke-outline transition"
                        >
                          <Ticket className="h-4 w-4" />
                          {revealCode ? "Ocultar código" : "Mostrar código"}
                        </button>

                        <button
                          type="button"
                          onClick={() => void handleCopyLink(unit)}
                          className="inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-2 text-sm font-semibold btn-smoke-outline transition"
                        >
                          <Link2 className="h-4 w-4" />
                          Copiar link
                        </button>
                      </div>

                      {revealCode ? (
                        <div className="mt-4 rounded-2xl border border-white/10 bg-black/30 p-4">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/45">
                            Código del asistente
                          </p>
                          {unit.claim_code ? (
                            <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                              <code className="rounded-xl bg-black/40 px-3 py-2 font-mono text-sm text-white">
                                {unit.claim_code}
                              </code>
                              {claimHref ? (
                                <Link
                                  href={claimHref}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-2 text-sm font-semibold text-white/80 transition hover:text-white"
                                >
                                  <ExternalLink className="h-4 w-4" />
                                  Usar mi código
                                </Link>
                              ) : null}
                            </div>
                          ) : (
                            <p className="mt-2 text-sm leading-relaxed text-white/60">
                              Este código todavía no está disponible. Guarda los
                              datos y vuelve a intentar en unos segundos.
                            </p>
                          )}
                        </div>
                      ) : null}

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
                      {copyFeedback === "copied" ? (
                        <p className="mt-3 text-xs font-semibold text-emerald-200">
                          Link copiado.
                        </p>
                      ) : null}
                      {copyFeedback === "error" ? (
                        <p className="mt-3 text-xs font-semibold text-[#ff9a9a]">
                          No pudimos copiar el link.
                        </p>
                      ) : null}
                    </article>
                  );
                })
              )}
            </section>

            <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-4 sm:p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/45">
                    Titular de la compra
                  </p>
                  <h2 className="mt-1 text-lg font-semibold">
                    {buyerDisplayName}
                  </h2>
                  <p className="mt-2 text-sm leading-relaxed text-white/60">
                    Este bloque queda como referencia. La acción principal del
                    primer viewport está arriba: tu QR y la gestión del grupo.
                  </p>
                </div>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
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
          </div>
        )}
      </div>

      {error ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4 py-6">
          <div className="w-full max-w-md space-y-4 rounded-3xl border border-red-500/25 bg-gradient-to-b from-[#111111] to-[#050505] p-6 text-white shadow-[0_30px_90px_rgba(239,68,68,0.22)]">
            <div className="space-y-2 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-red-500/30 bg-red-500/10">
                <svg
                  className="h-7 w-7 text-red-300"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-white">
                {error.title}
              </h3>
              <p className="text-sm leading-relaxed text-red-100/90">
                {error.message}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setError(null)}
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
