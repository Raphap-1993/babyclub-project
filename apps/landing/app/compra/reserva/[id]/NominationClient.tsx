"use client";

import { useEffect, useReducer, useRef, useState } from "react";
import { LoaderCircle } from "lucide-react";
import NominationEntry, {
  type EntryFeedback,
  type EntryDelivery,
} from "./NominationEntry";
import {
  countReadyEntries,
  ISSUE_READY_STATUSES,
  entryPresentation,
  extractUnits,
  formatEventDate,
  nominationReducer,
  normalizeReservationSummary,
  reservationStatusLabel,
  type ReservationSummary,
} from "./nominationModel";
import {
  nominationRequest,
  saveEntry,
  sendEntryEmail,
} from "./nominationActions";

const buttonClass =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-black hover:bg-neutral-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-rose-300 disabled:opacity-50";

export default function NominationClient({
  reservationId,
}: {
  reservationId: string;
}) {
  const [reservation, setReservation] = useState<ReservationSummary | null>(
    null,
  );
  const [state, dispatch] = useReducer(nominationReducer, {
    units: [],
    drafts: {},
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [needsPreparation, setNeedsPreparation] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [action, setAction] = useState<{
    id: string;
    kind: "saving" | "email";
  } | null>(null);
  const [feedback, setFeedback] = useState<Record<string, EntryFeedback>>({});
  const [deliveries, setDeliveries] = useState<Record<string, EntryDelivery>>(
    {},
  );
  const loadSequence = useRef(0);
  const currentReservation = useRef(reservationId);
  currentReservation.current = reservationId;
  const mutationLock = useRef(false);
  const endpoint = `/api/ticket-reservations/${encodeURIComponent(reservationId)}/units`;

  function applyPayload(payload: any) {
    setReservation(normalizeReservationSummary(payload, reservationId));
    const units = extractUnits(payload);
    dispatch({ type: "loaded", units });
    setNeedsPreparation(Boolean(payload.needsPreparation));
    return units;
  }

  async function refresh(foreground = false) {
    const sequence = ++loadSequence.current;
    if (foreground) {
      setLoading(true);
      setError(null);
    }
    try {
      const payload = await nominationRequest(endpoint, "GET");
      if (
        sequence !== loadSequence.current ||
        currentReservation.current !== reservationId
      )
        return;
      return applyPayload(payload);
    } catch (caught) {
      if (
        sequence !== loadSequence.current ||
        currentReservation.current !== reservationId
      )
        return;
      const message =
        caught instanceof Error
          ? caught.message
          : "No pudimos cargar tus entradas.";
      if (foreground) setError(message);
      else
        setNotice(
          "No pudimos actualizar la lista. Tus datos guardados y borradores se conservan. Vuelve a actualizarla.",
        );
    } finally {
      if (foreground && sequence === loadSequence.current) setLoading(false);
    }
  }

  useEffect(() => {
    dispatch({ type: "reset" });
    setReservation(null);
    setEditingId(null);
    setFeedback({});
    setDeliveries({});
    setNotice(null);
    void refresh(true);
    return () => {
      loadSequence.current++;
    };
    // Opening this page only reads. Preparation and issuance require an explicit action.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reservationId]);

  async function prepare() {
    if (
      mutationLock.current ||
      !reservation ||
      !ISSUE_READY_STATUSES.has(reservation.status)
    )
      return;
    mutationLock.current = true;
    setPreparing(true);
    setError(null);
    try {
      const payload = await nominationRequest(endpoint, "POST", {
        action: "prepare",
      });
      if (currentReservation.current !== reservationId) return;
      applyPayload(payload);
      setNotice(
        "Tus entradas están preparadas. Puedes completar cada titular por separado.",
      );
    } catch (caught) {
      if (currentReservation.current === reservationId)
        setError(
          caught instanceof Error
            ? caught.message
            : "No pudimos preparar tus entradas. Inténtalo de nuevo.",
        );
    } finally {
      mutationLock.current = false;
      setPreparing(false);
    }
  }

  async function save(unitId: string) {
    if (mutationLock.current || !reservation) return;
    const original = state.units.find((unit) => unit.id === unitId);
    if (!original) return;
    const unit = { ...original, ...state.drafts[unitId] };
    mutationLock.current = true;
    setAction({ id: unitId, kind: "saving" });
    setFeedback((current) => {
      const next = { ...current };
      delete next[unitId];
      return next;
    });
    const result = await saveEntry({
      reservationId,
      original,
      unit,
      reservationStatus: reservation.status,
    });
    if (currentReservation.current !== reservationId) {
      mutationLock.current = false;
      return;
    }
    if (result.saved) {
      setNotice(null);
      if (result.savedPayload?.units) applyPayload(result.savedPayload);
      dispatch({ type: "saved", id: unitId, submitted: unit });
      if (result.mailDelivery) {
        dispatch({
          type: "issued",
          id: unitId,
          ticketId: result.mailDelivery.ticketId,
        });
        setDeliveries((current) => ({
          ...current,
          [unitId]: {
            status: result.mailDelivery!.status,
            target: unit.email.trim() || reservation.buyer_email || "",
          },
        }));
      } else if (unit.email !== original.email) {
        // A previous successful delivery is not evidence for a newly edited address.
        setDeliveries((current) => {
          const next = { ...current };
          delete next[unitId];
          return next;
        });
      }
      setEditingId((current) => (current === unitId ? null : current));
    }
    const message = result.error
      ? `${result.saved ? "Datos guardados. " : ""}${result.error}`
      : result.issueSucceeded
        ? "Tu QR está listo. Puedes abrirlo desde esta entrada."
        : original.ticket_id
          ? "Datos guardados. Tu QR se conserva. Puedes enviar el correo a la dirección indicada."
          : "Datos guardados. Puedes obtener el QR desde esta entrada.";
    setFeedback((current) => ({
      ...current,
      [unitId]: { kind: result.error ? "error" : "success", message },
    }));
    // Read after a partial outcome: if emission succeeded but its response was lost,
    // the actual QR is still surfaced; local drafts belong to a separate state map.
    await refresh();
    mutationLock.current = false;
    setAction(null);
  }

  async function sendEmail(unitId: string) {
    if (mutationLock.current || !reservation) return;
    const unit = state.units.find((item) => item.id === unitId);
    if (!unit) return;
    mutationLock.current = true;
    setAction({ id: unitId, kind: "email" });
    const target = unit.email.trim() || reservation.buyer_email || "";
    const result = await sendEntryEmail({
      reservationId,
      unit,
      reservationStatus: reservation.status,
    });
    if (currentReservation.current !== reservationId) {
      mutationLock.current = false;
      return;
    }
    setDeliveries((current) => ({
      ...current,
      [unitId]: {
        status:
          result.mailDelivery?.status || (result.error ? "failed" : "unknown"),
        target,
      },
    }));
    setFeedback((current) => ({
      ...current,
      [unitId]: {
        kind:
          result.error || result.mailDelivery?.status === "failed"
            ? "error"
            : "success",
        message: result.error
          ? "No pudimos confirmar el envío. Tu QR sigue disponible; puedes reintentar el correo."
          : result.mailDelivery?.status === "sent"
            ? `Correo enviado a ${target}. Tu QR sigue siendo el mismo.`
            : result.mailDelivery?.status === "failed"
              ? "No pudimos enviar el correo. Tu QR sigue disponible."
              : result.mailDelivery?.status === "skipped"
                ? "No se envió un correo. Revisa la dirección en Editar datos."
                : "Tu QR sigue disponible. No recibimos confirmación del envío.",
      },
    }));
    mutationLock.current = false;
    setAction(null);
  }

  const ready = reservation
    ? countReadyEntries(state.units, reservation.status)
    : 0;
  const total = Math.max(
    state.units.length,
    reservation?.total_ticket_units || 0,
  );
  const busy = Boolean(action) || preparing;
  return (
    <main className="min-h-screen bg-[#050505] px-4 py-7 text-white sm:px-6 sm:py-10">
      <div className="mx-auto max-w-[780px]">
        <header>
          <p className="mb-5 text-xs font-semibold tracking-[0.32em] text-neutral-400">
            BABY
          </p>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Mis entradas
          </h1>
          {reservation && (
            <>
              <p className="mt-3 text-lg font-medium">
                {reservation.event_name || "Tu evento"}
              </p>
              <p className="mt-1 text-sm leading-6 text-neutral-400">
                {formatEventDate(reservation.event_starts_at)} · Hora de Lima
                {reservation.event_location && (
                  <>
                    <br />
                    {reservation.event_location}
                  </>
                )}
              </p>
              <p
                className={`mt-4 inline-flex rounded-full border px-3 py-1.5 text-xs ${["approved", "confirmed", "paid"].includes(reservation.status) ? "border-emerald-300/25 bg-emerald-300/5 text-emerald-200" : "border-white/20 bg-white/5 text-neutral-300"}`}
              >
                {reservationStatusLabel(reservation.status)}
              </p>
            </>
          )}
        </header>
        {loading ? (
          <p
            role="status"
            className="flex items-center gap-3 py-12 text-sm text-neutral-400"
          >
            <LoaderCircle className="h-5 w-5 animate-spin" aria-hidden="true" />
            Cargando tus entradas…
          </p>
        ) : (
          <>
            {reservation && (
              <section
                className="mt-7 border-b border-white/15 pb-5"
                aria-label="Estado de tus entradas"
              >
                <p className="text-lg font-semibold">
                  {ready} de {total}{" "}
                  {total === 1 ? "entrada lista" : "entradas listas"}
                </p>
                <p className="mt-1 text-sm text-neutral-400">
                  Un QR por persona. Completar una entrada no depende de las
                  demás.
                </p>
                {reservation.status === "pending" && (
                  <p className="mt-3 text-sm leading-6 text-neutral-400">
                    Estamos revisando el pago. Cuando se apruebe, podrás
                    completar los titulares y obtener sus QR aquí.
                  </p>
                )}
                {["rejected", "cancelled"].includes(reservation.status) && (
                  <p className="mt-3 text-sm leading-6 text-neutral-400">
                    Esta compra no permite emitir ni usar entradas. Contacta al
                    equipo de BabyClub si necesitas revisarla.
                  </p>
                )}
              </section>
            )}
            {needsPreparation && reservation && (
              <NominationPreparation
                status={reservation.status}
                busy={busy}
                preparing={preparing}
                onPrepare={() => void prepare()}
              />
            )}
            {state.units.map((unit) => (
              <NominationEntry
                key={unit.id}
                unit={unit}
                draft={{ ...unit, ...state.drafts[unit.id] }}
                reservationStatus={reservation?.status || "unknown"}
                buyerEmail={reservation?.buyer_email || null}
                editing={editingId === unit.id}
                hasDraft={Boolean(state.drafts[unit.id])}
                busy={action?.id === unit.id ? action.kind : null}
                actionsDisabled={busy}
                feedback={feedback[unit.id]}
                delivery={deliveries[unit.id]}
                onEdit={() => {
                  if (!busy) setEditingId(unit.id);
                }}
                onDiscard={() => dispatch({ type: "discard", id: unit.id })}
                onClose={() => {
                  setEditingId(null);
                  if (state.drafts[unit.id])
                    setNotice(
                      "Tu borrador se conserva mientras tengas abierta esta página.",
                    );
                }}
                onChange={(patch) =>
                  dispatch({ type: "edit", id: unit.id, patch })
                }
                onSave={() => void save(unit.id)}
                onSendEmail={() => void sendEmail(unit.id)}
              />
            ))}
            {reservation && !state.units.length && !needsPreparation && (
              <p className="py-8 text-sm text-neutral-400">
                No hay entradas disponibles para mostrar en esta compra.
              </p>
            )}
          </>
        )}
        {error && (
          <div
            role="alert"
            className="mt-5 rounded-xl border border-rose-300/25 p-4 text-sm text-rose-100"
          >
            <p>{error}</p>
            <button
              type="button"
              className={`${buttonClass} mt-3`}
              disabled={busy}
              onClick={() => void refresh(true)}
            >
              Volver a intentar
            </button>
          </div>
        )}
        {notice && (
          <div
            role="status"
            className="mt-4 text-sm leading-6 text-neutral-400"
          >
            <p>{notice}</p>
            {notice.startsWith("No pudimos actualizar") && (
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setNotice(null);
                  void refresh();
                }}
                className="min-h-11 rounded py-2 text-neutral-200 underline underline-offset-4"
              >
                Actualizar lista
              </button>
            )}
          </div>
        )}
        {reservation && (
          <footer className="mt-6 text-xs leading-6 text-neutral-400">
            <p>
              Cada persona debe presentar su propia entrada y documento para
              ingresar.
            </p>
            <details className="mt-3">
              <summary className="min-h-11 cursor-pointer py-2 text-sm">
                Datos de la compra
              </summary>
              <p>
                Comprador:{" "}
                {reservation.buyer_full_name || "Sin nombre indicado"}
              </p>
              {reservation.buyer_email && (
                <p className="break-words">Correo: {reservation.buyer_email}</p>
              )}
              <p>
                Los titulares de las entradas pueden ser personas distintas del
                comprador.
              </p>
            </details>
          </footer>
        )}
      </div>
    </main>
  );
}

export function NominationPreparation({
  status,
  busy,
  preparing,
  onPrepare,
}: {
  status: ReservationSummary["status"];
  busy: boolean;
  preparing: boolean;
  onPrepare: () => void;
}) {
  if (!ISSUE_READY_STATUSES.has(status)) return null;
  return (
    <section className="mt-5 rounded-xl border border-white/20 bg-white/[0.025] p-4">
      <h2 className="font-medium">Prepara tus entradas</h2>
      <p className="mt-2 text-sm leading-6 text-neutral-400">
        Esta compra necesita preparar sus entradas antes de continuar.
        Conservaremos los datos del comprador para que puedas revisarlos.
      </p>
      <button
        type="button"
        className={`${buttonClass} mt-4`}
        disabled={busy}
        onClick={onPrepare}
      >
        {preparing ? "Preparando…" : "Preparar mis entradas"}
      </button>
    </section>
  );
}
