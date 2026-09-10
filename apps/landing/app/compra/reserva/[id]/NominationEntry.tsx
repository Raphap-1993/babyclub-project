"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { LoaderCircle, Search } from "lucide-react";
import { DOCUMENT_TYPES, type DocumentType } from "shared/document";
import { lookupNominationPerson } from "./nominationLookup";
import {
  entryPresentation,
  formatEventDate,
  identityChanged,
  validateUnit,
  type ReservationUnit,
  type UnitDraft,
} from "./nominationModel";
import type { MailDelivery } from "./nominationActions";

export type EntryFeedback = { kind: "success" | "error"; message: string };
export type EntryDelivery = {
  status: MailDelivery["status"] | "unknown";
  target: string;
};
const primary =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-black transition hover:bg-neutral-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-rose-300 disabled:opacity-50";
const secondary =
  "min-h-11 rounded-lg py-2 text-left text-sm text-neutral-300 underline underline-offset-4 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-rose-300 disabled:opacity-50";
const inputClass =
  "mt-2 block min-h-12 w-full min-w-0 rounded-lg border border-white/25 bg-[#191919] px-3 py-2 text-base text-white outline-none focus:border-rose-400 focus:ring-1 focus:ring-rose-400 disabled:opacity-60";

export default function NominationEntry({
  unit,
  draft,
  reservationStatus,
  buyerEmail,
  editing,
  hasDraft,
  busy,
  actionsDisabled,
  feedback,
  delivery,
  onEdit,
  onDiscard,
  onClose,
  onChange,
  onSave,
  onSendEmail,
}: {
  unit: ReservationUnit;
  draft: ReservationUnit;
  reservationStatus: string;
  buyerEmail: string | null;
  editing: boolean;
  hasDraft: boolean;
  actionsDisabled: boolean;
  busy: "saving" | "email" | null;
  feedback?: EntryFeedback;
  delivery?: EntryDelivery;
  onEdit: () => void;
  onDiscard: () => void;
  onClose: () => void;
  onChange: (patch: UnitDraft) => void;
  onSave: () => void;
  onSendEmail: () => void;
}) {
  const state = entryPresentation(unit, reservationStatus);
  const [validation, setValidation] =
    useState<ReturnType<typeof validateUnit>>(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupMessage, setLookupMessage] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const sectionRef = useRef<HTMLElement>(null);
  const wasEditing = useRef(false);
  useEffect(() => {
    const shouldRestore = wasEditing.current && !editing;
    wasEditing.current = editing;
    const frame = requestAnimationFrame(() => {
      if (editing)
        formRef.current
          ?.querySelector<HTMLInputElement>('input[name="document"]')
          ?.focus();
      else if (shouldRestore)
        sectionRef.current
          ?.querySelector<HTMLElement>("[data-entry-primary]")
          ?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [editing]);
  const latestDraft = useRef(draft);
  latestDraft.current = draft;
  const lookupSequence = useRef(0);
  useEffect(
    () => () => {
      lookupSequence.current++;
    },
    [],
  );
  const changingIdentity = Boolean(
    unit.ticket_id && identityChanged(unit, draft),
  );
  const target = unit.email.trim() || buyerEmail || "";
  const displayedTarget = delivery?.target || target;
  const readyToObtain =
    state.canIssue && !state.ready && !hasDraft && !validateUnit(unit);
  const isBusy = Boolean(busy) || actionsDisabled;

  function change(patch: UnitDraft) {
    setValidation(null);
    setLookupMessage(null);
    onChange(patch);
  }
  function submit(event: FormEvent) {
    event.preventDefault();
    if (isBusy || !state.canEdit) return;
    const error = validateUnit(draft);
    setValidation(error);
    if (error) {
      (
        formRef.current?.elements.namedItem(
          error.field,
        ) as HTMLInputElement | null
      )?.focus();
      return;
    }
    onSave();
  }
  async function lookup() {
    if (lookupLoading || isBusy) return;
    const sequence = ++lookupSequence.current;
    const requested = draft;
    setLookupLoading(true);
    setLookupMessage(null);
    try {
      const person = await lookupNominationPerson({
        document: requested.document,
        docType: requested.doc_type,
      });
      if (sequence !== lookupSequence.current) return;
      const latest = latestDraft.current;
      if (
        latest.document !== requested.document ||
        latest.doc_type !== requested.doc_type
      )
        return;
      if (!person) {
        setLookupMessage("No encontramos datos. Puedes completarlos a mano.");
        return;
      }
      const patch: UnitDraft = {};
      if (!latest.full_name.trim()) patch.full_name = person.full_name;
      // Lookup is a convenience, never an overwrite of a name/contact already entered.
      if (!latest.email.trim() && person.email) patch.email = person.email;
      if (!latest.phone.trim() && person.phone) patch.phone = person.phone;
      onChange(patch);
      setLookupMessage(
        Object.keys(patch).length
          ? "Datos encontrados. Revísalos antes de guardar."
          : "Conservamos los datos que ya escribiste.",
      );
    } catch (error) {
      if (sequence === lookupSequence.current)
        setLookupMessage(
          error instanceof Error
            ? error.message
            : "No pudimos buscar el documento. Puedes completar los datos a mano.",
        );
    } finally {
      if (sequence === lookupSequence.current) setLookupLoading(false);
    }
  }
  const field = (
    name: "document" | "full_name" | "email" | "phone",
    label: string,
    type = "text",
  ) => (
    <div>
      <label
        htmlFor={`${unit.id}-${name}`}
        className="block text-sm font-medium text-neutral-200"
      >
        {label}
      </label>
      <input
        id={`${unit.id}-${name}`}
        name={name}
        value={draft[name]}
        onChange={(event) => change({ [name]: event.target.value })}
        type={type}
        disabled={isBusy}
        className={inputClass}
        autoComplete={
          name === "full_name"
            ? "name"
            : name === "email"
              ? "email"
              : name === "phone"
                ? "tel"
                : "off"
        }
        inputMode={
          name === "document" && ["dni", "ruc"].includes(draft.doc_type)
            ? "numeric"
            : undefined
        }
        maxLength={
          name === "document"
            ? draft.doc_type === "dni"
              ? 8
              : draft.doc_type === "ruc"
                ? 11
                : 20
            : undefined
        }
        aria-invalid={validation?.field === name || undefined}
        aria-describedby={
          validation?.field === name
            ? `${unit.id}-validation`
            : name === "email"
              ? `${unit.id}-email-help`
              : undefined
        }
      />
    </div>
  );
  return (
    <section
      ref={sectionRef}
      className="border-b border-white/15 py-6"
      aria-labelledby={`entry-${unit.id}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-4 sm:items-center">
        <div className="flex min-w-0 gap-3.5">
          <span
            className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/25 text-sm text-neutral-300"
            aria-hidden="true"
          >
            {unit.unit_index}
          </span>
          <div className="min-w-0">
            <h2
              id={`entry-${unit.id}`}
              className="break-words text-base font-semibold"
            >
              {unit.full_name || `Entrada ${unit.unit_index}`}
            </h2>
            <p
              className={`mt-1 text-sm ${state.ready ? "text-emerald-300" : "text-neutral-400"}`}
            >
              {state.label}
            </p>
            {unit.access_status === "expired" && unit.expired_at && (
              <p className="mt-1 text-xs text-neutral-400">
                Venció: {formatEventDate(unit.expired_at)} · Lima
              </p>
            )}
            {unit.document && (
              <p className="mt-1 text-xs text-neutral-400">
                {unit.doc_type.toUpperCase()} {unit.document}
              </p>
            )}
            {hasDraft && !editing && (
              <p className="mt-1 text-xs text-neutral-400">
                Tienes cambios sin guardar
              </p>
            )}
          </div>
        </div>
        {!editing &&
          (state.ready ? (
            <Link
              data-entry-primary
              className={`${primary} ml-12 sm:ml-0`}
              href={`/ticket/${encodeURIComponent(unit.ticket_id!)}`}
            >
              Ver QR
              <span className="sr-only"> de la entrada {unit.unit_index}</span>
            </Link>
          ) : state.canEdit ? (
            <button
              type="button"
              disabled={isBusy}
              data-entry-primary
              onClick={readyToObtain ? onSave : onEdit}
              className={`${primary} ml-12 sm:ml-0`}
            >
              {busy === "saving" && (
                <LoaderCircle
                  className="h-4 w-4 animate-spin"
                  aria-hidden="true"
                />
              )}
              {busy === "saving"
                ? "Guardando…"
                : readyToObtain
                  ? "Obtener QR"
                  : hasDraft
                    ? "Continuar entrada"
                    : "Completar entrada"}
              <span className="sr-only"> {unit.unit_index}</span>
            </button>
          ) : unit.ticket_id ? (
            <Link
              className={`${secondary} ml-12 sm:ml-0`}
              href={`/ticket/${encodeURIComponent(unit.ticket_id)}`}
            >
              Ver detalle
              <span className="sr-only"> de la entrada {unit.unit_index}</span>
            </Link>
          ) : null)}
      </div>
      {!editing && state.canEdit && (state.ready || readyToObtain) && (
        <div className="ml-12 mt-1">
          <button
            type="button"
            className={secondary}
            disabled={isBusy}
            onClick={onEdit}
          >
            Editar datos
            <span className="sr-only"> de la entrada {unit.unit_index}</span>
          </button>
        </div>
      )}
      {state.ready && (
        <div className="ml-12 mt-2 text-sm text-neutral-400">
          <p className="break-words">
            {busy === "email"
              ? `Enviando a ${target}…`
              : delivery?.status === "sent"
                ? `Correo enviado a ${displayedTarget}`
                : delivery?.status === "failed"
                  ? `Tu QR está listo. No se pudo enviar a ${displayedTarget}.`
                  : delivery?.status === "skipped"
                    ? "Tu QR está listo. No se envió un correo."
                    : target
                      ? `Correo: ${target}`
                      : "Agrega un correo en Editar datos si quieres recibir tu QR por email."}
          </p>
          {target && (
            <button
              type="button"
              disabled={isBusy || editing}
              className={secondary}
              onClick={onSendEmail}
            >
              {busy === "email"
                ? "Enviando…"
                : delivery?.status === "failed"
                  ? "Reintentar correo"
                  : delivery?.status === "sent"
                    ? "Reenviar correo"
                    : "Enviar correo"}
              <span className="sr-only"> de la entrada {unit.unit_index}</span>
            </button>
          )}
        </div>
      )}
      {editing && state.canEdit && (
        <form
          ref={formRef}
          onSubmit={submit}
          noValidate
          aria-label={`Editar entrada ${unit.unit_index}`}
          className="mt-5 rounded-2xl border border-white/20 bg-[#111111] p-4 sm:ml-12 sm:p-6"
        >
          <h3 className="text-base font-semibold">Entrada {unit.unit_index}</h3>
          <p className="mt-1 text-sm text-neutral-400">
            La entrada quedará a nombre de esta persona.
          </p>
          {unit.unit_index === 1 && (
            <p className="mt-2 text-xs leading-5 text-neutral-400">
              Cambiar el titular no cambia los datos del comprador.
            </p>
          )}
          {changingIdentity && (
            <p className="mt-3 text-sm leading-6 text-amber-200">
              Al guardar el cambio de titular, el QR anterior dejará de servir.
              Comparte el QR actualizado.
            </p>
          )}
          {draft.updated_at !== unit.updated_at && hasDraft && (
            <div className="mt-3 rounded-lg border border-amber-300/20 p-3 text-sm leading-6 text-amber-100">
              <p>
                Esta entrada cambió mientras la editabas. Conservamos tu
                borrador; revisa los datos actuales antes de guardar.
              </p>
              <button
                type="button"
                disabled={isBusy}
                className={secondary}
                onClick={onDiscard}
              >
                Descartar mi borrador y ver los datos actuales
              </button>
            </div>
          )}
          <div className="mt-5 grid min-w-0 grid-cols-[minmax(0,0.7fr)_minmax(0,1fr)] gap-3">
            <div>
              <label
                htmlFor={`${unit.id}-type`}
                className="block text-sm font-medium text-neutral-200"
              >
                Tipo
              </label>
              <select
                id={`${unit.id}-type`}
                value={draft.doc_type}
                onChange={(event) =>
                  change({
                    doc_type: event.target.value as DocumentType,
                    document: "",
                  })
                }
                disabled={isBusy}
                className={inputClass}
              >
                {DOCUMENT_TYPES.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            {field("document", "Documento")}
          </div>
          <button
            type="button"
            disabled={isBusy || lookupLoading}
            onClick={() => void lookup()}
            className={`${secondary} mt-1 inline-flex items-center gap-2`}
          >
            {lookupLoading ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <Search className="h-4 w-4" />
            )}
            {lookupLoading
              ? "Buscando…"
              : draft.doc_type === "dni"
                ? "Buscar DNI"
                : "Buscar documento"}
          </button>
          {lookupMessage && (
            <p
              role="status"
              className="mb-3 text-xs leading-5 text-neutral-400"
            >
              {lookupMessage}
            </p>
          )}
          <div className="mt-3 space-y-4">
            {field("full_name", "Nombre completo")}
            {field("email", "Correo del asistente (opcional)", "email")}
            <p
              id={`${unit.id}-email-help`}
              className="break-words text-xs leading-5 text-neutral-400"
            >
              {buyerEmail
                ? `Si lo dejas vacío, enviaremos esta entrada al correo del comprador: ${buyerEmail}`
                : "Puedes ver el QR aquí aunque no indiques un correo."}
            </p>
            <details>
              <summary className="min-h-11 cursor-pointer py-2 text-sm text-neutral-400">
                Teléfono (opcional)
              </summary>
              {field("phone", "Teléfono", "tel")}
            </details>
          </div>
          {validation && (
            <p
              id={`${unit.id}-validation`}
              role="alert"
              className="mt-4 text-sm text-rose-200"
            >
              {validation.message}
            </p>
          )}
          <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-end">
            <button
              type="button"
              disabled={isBusy}
              onClick={onClose}
              className={secondary}
            >
              Volver a mis entradas
            </button>
            <button
              type="submit"
              disabled={isBusy || lookupLoading}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-rose-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-rose-300 disabled:opacity-50"
            >
              {busy === "saving" && (
                <LoaderCircle
                  className="h-4 w-4 animate-spin"
                  aria-hidden="true"
                />
              )}
              {busy === "saving"
                ? "Guardando…"
                : !state.canIssue
                  ? "Guardar datos"
                  : unit.ticket_id
                    ? changingIdentity
                      ? "Guardar cambios y actualizar QR"
                      : "Guardar cambios"
                    : "Guardar y obtener QR"}
            </button>
          </div>
        </form>
      )}
      {feedback && (
        <p
          role={feedback.kind === "error" ? "alert" : "status"}
          className={`mt-3 text-sm leading-6 sm:ml-12 ${feedback.kind === "error" ? "text-rose-200" : "text-neutral-300"}`}
        >
          {feedback.message}
        </p>
      )}
    </section>
  );
}
