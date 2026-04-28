"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  BadgeDollarSign,
  CheckCircle2,
  RefreshCw,
  Save,
  Ticket,
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

export default function TicketTypesClient({
  events,
  selectedEventId,
  initialTicketTypes,
  error: initialError,
}: TicketTypesClientProps) {
  const router = useRouter();
  const [eventId, setEventId] = useState(selectedEventId);
  const [ticketTypes, setTicketTypes] =
    useState<AdminTicketType[]>(initialTicketTypes);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(initialError || null);
  const [success, setSuccess] = useState<string | null>(null);

  const selectedEvent = useMemo(
    () => events.find((event) => event.id === eventId) || null,
    [eventId, events],
  );
  const activeCount = useMemo(
    () => ticketTypes.filter((ticketType) => ticketType.is_active).length,
    [ticketTypes],
  );

  useEffect(() => {
    if (!selectedEventId) return;
    setEventId(selectedEventId);
    setTicketTypes(initialTicketTypes);
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
      setTicketTypes(payload.ticket_types || []);
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
    code: string,
    patch: Partial<Pick<AdminTicketType, "label" | "description" | "price" | "is_active">>,
  ) {
    setTicketTypes((current) =>
      current.map((ticketType) =>
        ticketType.code === code ? { ...ticketType, ...patch } : ticketType,
      ),
    );
  }

  async function handleSave() {
    if (!eventId) return;

    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await authedFetch(`/api/events/${eventId}/ticket-types`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticket_types: ticketTypes.map((ticketType) => ({
            code: ticketType.code,
            label: ticketType.label,
            description: ticketType.description,
            price: ticketType.price,
            is_active: ticketType.is_active,
          })),
        }),
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok || !payload?.success) {
        throw new Error(payload?.error || "No se pudieron guardar las entradas");
      }
      setTicketTypes(payload.ticket_types || ticketTypes);
      setSuccess("Precios guardados y sincronizados con la venta online.");
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
          description="Fuente de precios para landing, reservas y pasarela."
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
              onClick={() => loadTicketTypes(eventId)}
              disabled={!eventId || loading || saving}
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Recargar
            </Button>
            <Button
              type="button"
              onClick={handleSave}
              disabled={!eventId || loading || saving || ticketTypes.length === 0}
            >
              <Save className="h-4 w-4" />
              {saving ? "Guardando" : "Guardar"}
            </Button>
          </div>
        </section>

        {selectedEvent ? (
          <div className="grid gap-3 sm:grid-cols-3">
            <Metric label="Evento" value={selectedEvent.name} />
            <Metric label="Entradas activas" value={`${activeCount}`} />
            <Metric
              label="Precio mayor"
              value={formatMoney(
                Math.max(0, ...ticketTypes.map((ticketType) => ticketType.price)),
              )}
            />
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

        <section className="grid gap-4 lg:grid-cols-2">
          {ticketTypes.map((ticketType) => (
            <article
              key={ticketType.code}
              className="rounded-lg border border-white/10 bg-[#111111] p-4 shadow-sm"
            >
              <div className="mb-4 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-rose-300/80">
                    <Ticket className="h-3.5 w-3.5" />
                    {ticketType.sale_phase === "early_bird"
                      ? "Early Baby"
                      : "All Night"}
                  </p>
                  <h2 className="mt-1 truncate text-lg font-semibold text-white">
                    {ticketType.label || ticketType.code}
                  </h2>
                  <p className="text-sm text-neutral-400">
                    {ticketType.ticket_quantity} QR · {formatMoney(ticketType.price)}
                  </p>
                </div>
                <label className="flex shrink-0 cursor-pointer items-center gap-2 rounded-md border border-white/10 px-3 py-2 text-sm text-neutral-200">
                  <input
                    type="checkbox"
                    checked={ticketType.is_active}
                    onChange={(event) =>
                      updateTicketType(ticketType.code, {
                        is_active: event.target.checked,
                      })
                    }
                    className="h-4 w-4 rounded border-neutral-600 bg-neutral-800 text-rose-500 focus:ring-rose-500/40"
                  />
                  Activo
                </label>
              </div>

              <div className="grid gap-3 sm:grid-cols-[1fr_140px]">
                <Field label="Etiqueta">
                  <Input
                    value={ticketType.label}
                    onChange={(event) =>
                      updateTicketType(ticketType.code, {
                        label: event.target.value,
                      })
                    }
                  />
                </Field>
                <Field label="Precio S/">
                  <Input
                    type="number"
                    min={1}
                    step="0.01"
                    value={String(ticketType.price)}
                    onChange={(event) =>
                      updateTicketType(ticketType.code, {
                        price: Number(event.target.value),
                      })
                    }
                  />
                </Field>
              </div>

              <Field label="Mensaje">
                <textarea
                  value={ticketType.description}
                  onChange={(event) =>
                    updateTicketType(ticketType.code, {
                      description: event.target.value,
                    })
                  }
                  rows={3}
                  className="flex min-h-20 w-full rounded-lg border border-[#2d2d2d] bg-[#161616] px-3 py-2 text-sm text-white outline-none transition-all placeholder:text-neutral-500 focus:border-[#a60c2f]/60 focus:ring-2 focus:ring-[#a60c2f]/18"
                />
              </Field>
            </article>
          ))}
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
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="space-y-1.5">
      <span className="block text-sm font-medium text-neutral-300">{label}</span>
      {children}
    </label>
  );
}
