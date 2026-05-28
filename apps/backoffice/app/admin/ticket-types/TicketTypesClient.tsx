"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  BadgeDollarSign,
  CheckCircle2,
  Plus,
  RefreshCw,
  Save,
  Ticket,
  Trash2,
} from "lucide-react";
import { authedFetch } from "@/lib/authedFetch";
import type { AdminTicketType } from "@/lib/ticketTypesAdmin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SelectNative } from "@/components/ui/select-native";
import { ScreenHeader } from "../components/ScreenHeader";

export type TicketTypesEventOption = {
  id: string;
  name: string;
  starts_at: string | null;
  organizer_name: string | null;
};

type TicketTypesClientProps = {
  events: TicketTypesEventOption[];
  selectedEventId: string;
  initialTicketTypes: AdminTicketType[];
  error?: string;
};

type EditableTicketType = AdminTicketType & {
  client_id: string;
};

function eventLabel(event: TicketTypesEventOption) {
  const date = event.starts_at
    ? new Date(event.starts_at).toLocaleDateString("es-PE", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      })
    : "Sin fecha";
  const organizer = event.organizer_name ? ` · ${event.organizer_name}` : "";
  return `${event.name} · ${date}${organizer}`;
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("es-PE", {
    style: "currency",
    currency: "PEN",
    minimumFractionDigits: 2,
  }).format(Number.isFinite(value) ? value : 0);
}

function createClientId(seed = "ticket-type") {
  return `${seed}-${Math.random().toString(36).slice(2, 10)}`;
}

function sortTicketTypes<
  T extends { sort_order: number; label: string; code: string },
>(ticketTypes: T[]) {
  return [...ticketTypes].sort((a, b) => {
    if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
    const labelCompare = a.label.localeCompare(b.label);
    if (labelCompare !== 0) return labelCompare;
    return a.code.localeCompare(b.code);
  });
}

function toEditableTicketTypes(
  ticketTypes: AdminTicketType[],
): EditableTicketType[] {
  return sortTicketTypes(ticketTypes).map((ticketType, index) => ({
    ...ticketType,
    client_id:
      ticketType.id ||
      `${ticketType.code || "ticket"}-${index}-${createClientId("existing")}`,
  }));
}

function createEmptyTicketType(
  ticketTypes: EditableTicketType[],
): EditableTicketType {
  const maxSortOrder = Math.max(0, ...ticketTypes.map((row) => row.sort_order));

  return {
    client_id: createClientId(),
    id: null,
    code: "",
    label: "",
    description: "",
    sale_phase: null,
    ticket_quantity: 1,
    price: 1,
    currency_code: "PEN",
    is_active: true,
    sort_order: maxSortOrder + 10,
  };
}

function validateTicketTypes(ticketTypes: EditableTicketType[]) {
  if (ticketTypes.length === 0) {
    return "Agrega al menos un tipo de entrada.";
  }

  const seenCodes = new Set<string>();

  for (const ticketType of ticketTypes) {
    const code = ticketType.code.trim();
    const label = ticketType.label.trim();
    const currencyCode = ticketType.currency_code.trim();

    if (!code) return "Cada tipo necesita un code único.";
    if (seenCodes.has(code)) {
      return `El code "${code}" está repetido.`;
    }
    seenCodes.add(code);

    if (!label) return `El tipo ${code} necesita una etiqueta.`;
    if (
      !Number.isFinite(ticketType.ticket_quantity) ||
      ticketType.ticket_quantity < 1 ||
      !Number.isInteger(ticketType.ticket_quantity)
    ) {
      return `El tipo ${code || label} necesita ticket_quantity entero mayor a 0.`;
    }
    if (!Number.isFinite(ticketType.price) || ticketType.price <= 0) {
      return `El tipo ${code || label} necesita un price válido.`;
    }
    if (!currencyCode) {
      return `El tipo ${code || label} necesita currency_code.`;
    }
    if (!Number.isFinite(ticketType.sort_order)) {
      return `El tipo ${code || label} necesita sort_order válido.`;
    }
  }

  return null;
}

export default function TicketTypesClient({
  events,
  selectedEventId,
  initialTicketTypes,
  error: initialError,
}: TicketTypesClientProps) {
  const router = useRouter();
  const [eventId, setEventId] = useState(selectedEventId);
  const [ticketTypes, setTicketTypes] = useState<EditableTicketType[]>(() =>
    toEditableTicketTypes(initialTicketTypes),
  );
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(initialError || null);
  const [success, setSuccess] = useState<string | null>(null);

  const orderedTicketTypes = useMemo(
    () => sortTicketTypes(ticketTypes),
    [ticketTypes],
  );
  const selectedEvent = useMemo(
    () => events.find((event) => event.id === eventId) || null,
    [eventId, events],
  );
  const activeCount = useMemo(
    () =>
      orderedTicketTypes.filter((ticketType) => ticketType.is_active).length,
    [orderedTicketTypes],
  );
  const highestPrice = useMemo(
    () =>
      Math.max(0, ...orderedTicketTypes.map((ticketType) => ticketType.price)),
    [orderedTicketTypes],
  );

  useEffect(() => {
    if (!selectedEventId) return;
    setEventId(selectedEventId);
    setTicketTypes(toEditableTicketTypes(initialTicketTypes));
  }, [initialTicketTypes, selectedEventId]);

  async function loadTicketTypes(nextEventId: string) {
    if (!nextEventId) {
      setTicketTypes([]);
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await authedFetch(`/api/events/${nextEventId}/ticket-types`, {
        cache: "no-store",
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok || !payload?.success) {
        throw new Error(payload?.error || "No se pudieron cargar las entradas");
      }
      setTicketTypes(toEditableTicketTypes(payload.ticket_types || []));
    } catch (err: any) {
      setError(err?.message || "Error al cargar entradas");
    } finally {
      setLoading(false);
    }
  }

  function handleEventChange(nextEventId: string) {
    setEventId(nextEventId);
    router.replace(`/admin/ticket-types?event_id=${nextEventId}`, {
      scroll: false,
    });
    void loadTicketTypes(nextEventId);
  }

  function updateTicketType(
    clientId: string,
    patch: Partial<EditableTicketType>,
  ) {
    setTicketTypes((current) =>
      current.map((ticketType) =>
        ticketType.client_id === clientId
          ? {
              ...ticketType,
              ...patch,
            }
          : ticketType,
      ),
    );
  }

  function addTicketType() {
    setSuccess(null);
    setError(null);
    setTicketTypes((current) => [...current, createEmptyTicketType(current)]);
  }

  function removeTicketType(clientId: string) {
    setSuccess(null);
    setError(null);
    setTicketTypes((current) =>
      current.filter((ticketType) => ticketType.client_id !== clientId),
    );
  }

  async function handleSave() {
    if (!eventId) return;

    const validationError = validateTicketTypes(orderedTicketTypes);
    if (validationError) {
      setError(validationError);
      setSuccess(null);
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await authedFetch(`/api/events/${eventId}/ticket-types`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticket_types: orderedTicketTypes.map((ticketType) => ({
            code: ticketType.code.trim(),
            label: ticketType.label.trim(),
            description: ticketType.description.trim(),
            sale_phase: ticketType.sale_phase,
            ticket_quantity: ticketType.ticket_quantity,
            price: ticketType.price,
            currency_code: ticketType.currency_code.trim(),
            is_active: ticketType.is_active,
            sort_order: ticketType.sort_order,
          })),
        }),
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok || !payload?.success) {
        throw new Error(
          payload?.error || "No se pudieron guardar las entradas",
        );
      }
      setTicketTypes(toEditableTicketTypes(payload.ticket_types || []));
      setSuccess(
        "Tipos de entrada guardados y sincronizados con la venta online.",
      );
    } catch (err: any) {
      setError(err?.message || "Error al guardar entradas");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="relative overflow-hidden px-3 py-4 text-white sm:px-5 lg:px-8">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_16%_16%,rgba(166,12,47,0.10),transparent_32%),radial-gradient(circle_at_84%_0%,rgba(255,255,255,0.08),transparent_30%)]" />

      <div className="mx-auto w-full max-w-7xl space-y-5">
        <ScreenHeader
          icon={BadgeDollarSign}
          kicker="Ventas"
          title="Entradas y precios"
          description="Editor flexible para paquetes vendidos en landing y reservas."
          actions={
            <Link href="/admin/events">
              <Button variant="outline" size="sm">
                <ArrowLeft className="h-4 w-4" />
                Eventos
              </Button>
            </Link>
          }
        />

        <section className="grid gap-4 rounded-lg border border-white/10 bg-[#111111]/90 p-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div className="space-y-2">
            <label className="text-sm font-medium text-neutral-300">
              Evento
            </label>
            <SelectNative
              value={eventId}
              onChange={(event) => handleEventChange(event.target.value)}
              disabled={loading || saving || events.length === 0}
            >
              {events.length === 0 ? (
                <option value="">No hay eventos disponibles</option>
              ) : null}
              {events.map((event) => (
                <option key={event.id} value={event.id}>
                  {eventLabel(event)}
                </option>
              ))}
            </SelectNative>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={addTicketType}
              disabled={!eventId || loading || saving}
            >
              <Plus className="h-4 w-4" />
              Agregar tipo
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => loadTicketTypes(eventId)}
              disabled={!eventId || loading || saving}
            >
              <RefreshCw
                className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
              />
              Recargar
            </Button>
            <Button
              type="button"
              onClick={handleSave}
              disabled={
                !eventId || loading || saving || orderedTicketTypes.length === 0
              }
            >
              <Save className="h-4 w-4" />
              {saving ? "Guardando" : "Guardar"}
            </Button>
          </div>
        </section>

        {selectedEvent ? (
          <div className="grid gap-3 sm:grid-cols-4">
            <Metric label="Evento" value={selectedEvent.name} />
            <Metric label="Tipos activos" value={`${activeCount}`} />
            <Metric
              label="Total tipos"
              value={`${orderedTicketTypes.length}`}
            />
            <Metric label="Precio mayor" value={formatMoney(highestPrice)} />
          </div>
        ) : null}

        {error ? (
          <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        ) : null}
        {success ? (
          <div className="flex items-center gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
            <CheckCircle2 className="h-4 w-4" />
            {success}
          </div>
        ) : null}

        <section className="space-y-4">
          {orderedTicketTypes.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/10 bg-[#111111] px-5 py-10 text-center">
              <p className="text-sm text-neutral-400">
                Este evento todavía no tiene tipos de entrada configurados.
              </p>
              <Button
                type="button"
                className="mt-4"
                onClick={addTicketType}
                disabled={!eventId || loading || saving}
              >
                <Plus className="h-4 w-4" />
                Crear primer tipo
              </Button>
            </div>
          ) : (
            orderedTicketTypes.map((ticketType) => (
              <article
                key={ticketType.client_id}
                className="rounded-2xl border border-white/10 bg-[#111111] p-4 shadow-sm"
              >
                <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-rose-300/80">
                      <Ticket className="h-3.5 w-3.5" />
                      {ticketType.sale_phase === "early_bird"
                        ? "Early Bird"
                        : ticketType.sale_phase === "all_night"
                          ? "All Night"
                          : "Flexible"}
                    </p>
                    <h2 className="mt-1 truncate text-lg font-semibold text-white">
                      {ticketType.label.trim() ||
                        ticketType.code.trim() ||
                        "Nuevo tipo"}
                    </h2>
                    <p className="text-sm text-neutral-400">
                      {ticketType.ticket_quantity} QR por paquete ·{" "}
                      {formatMoney(ticketType.price)}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <label className="flex cursor-pointer items-center gap-2 rounded-md border border-white/10 px-3 py-2 text-sm text-neutral-200">
                      <input
                        type="checkbox"
                        checked={ticketType.is_active}
                        onChange={(event) =>
                          updateTicketType(ticketType.client_id, {
                            is_active: event.target.checked,
                          })
                        }
                        className="h-4 w-4 rounded border-neutral-600 bg-neutral-800 text-rose-500 focus:ring-rose-500/40"
                      />
                      Activo
                    </label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => removeTicketType(ticketType.client_id)}
                      disabled={loading || saving}
                    >
                      <Trash2 className="h-4 w-4" />
                      Remover
                    </Button>
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <Field label="Code">
                    <Input
                      value={ticketType.code}
                      onChange={(event) =>
                        updateTicketType(ticketType.client_id, {
                          code: event.target.value,
                        })
                      }
                      placeholder="all_night_4"
                    />
                  </Field>
                  <Field label="Sale phase">
                    <SelectNative
                      value={ticketType.sale_phase ?? ""}
                      onChange={(event) =>
                        updateTicketType(ticketType.client_id, {
                          sale_phase:
                            event.target.value === ""
                              ? null
                              : (event.target.value as
                                  | "early_bird"
                                  | "all_night"),
                        })
                      }
                    >
                      <option value="">Sin fase</option>
                      <option value="early_bird">early_bird</option>
                      <option value="all_night">all_night</option>
                    </SelectNative>
                  </Field>
                  <Field label="Ticket quantity">
                    <Input
                      type="number"
                      min={1}
                      step={1}
                      value={String(ticketType.ticket_quantity)}
                      onChange={(event) =>
                        updateTicketType(ticketType.client_id, {
                          ticket_quantity: Math.max(
                            1,
                            Math.floor(Number(event.target.value) || 1),
                          ),
                        })
                      }
                    />
                  </Field>
                  <Field label="Sort order">
                    <Input
                      type="number"
                      step={1}
                      value={String(ticketType.sort_order)}
                      onChange={(event) =>
                        updateTicketType(ticketType.client_id, {
                          sort_order: Math.floor(
                            Number(event.target.value) || 0,
                          ),
                        })
                      }
                    />
                  </Field>
                </div>

                <div className="mt-3 grid gap-3 md:grid-cols-[minmax(0,1.2fr)_160px_140px]">
                  <Field label="Label">
                    <Input
                      value={ticketType.label}
                      onChange={(event) =>
                        updateTicketType(ticketType.client_id, {
                          label: event.target.value,
                        })
                      }
                      placeholder="4 QR VIP"
                    />
                  </Field>
                  <Field label="Price">
                    <Input
                      type="number"
                      min={1}
                      step="0.01"
                      value={String(ticketType.price)}
                      onChange={(event) =>
                        updateTicketType(ticketType.client_id, {
                          price: Number(event.target.value) || 0,
                        })
                      }
                    />
                  </Field>
                  <Field label="Currency">
                    <Input
                      value={ticketType.currency_code}
                      onChange={(event) =>
                        updateTicketType(ticketType.client_id, {
                          currency_code: event.target.value.toUpperCase(),
                        })
                      }
                      placeholder="PEN"
                    />
                  </Field>
                </div>

                <Field label="Description" className="mt-3">
                  <textarea
                    value={ticketType.description}
                    onChange={(event) =>
                      updateTicketType(ticketType.client_id, {
                        description: event.target.value,
                      })
                    }
                    rows={3}
                    className="flex min-h-20 w-full rounded-lg border border-[#2d2d2d] bg-[#161616] px-3 py-2 text-sm text-white outline-none transition-all placeholder:text-neutral-500 focus:border-[#a60c2f]/60 focus:ring-2 focus:ring-[#a60c2f]/18"
                    placeholder="Describe el beneficio del paquete."
                  />
                </Field>
              </article>
            ))
          )}
        </section>
      </div>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-[#111111]/90 px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
        {label}
      </p>
      <p className="mt-1 truncate text-sm font-semibold text-white">{value}</p>
    </div>
  );
}

function Field({
  label,
  children,
  className = "",
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={`space-y-1.5 ${className}`}>
      <span className="block text-sm font-medium text-neutral-300">
        {label}
      </span>
      {children}
    </label>
  );
}
