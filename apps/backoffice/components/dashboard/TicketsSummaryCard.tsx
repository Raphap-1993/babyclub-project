"use client";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, Select } from "@repo/ui";
import { authedFetch } from "@/lib/authedFetch";
import type { QRSummary } from "@repo/api-logic/qr-summary";

function TicketsSummaryCard() {
  const typeLabelMap: Record<string, string> = {
    table: "Mesa",
    courtesy: "Cortesia",
    general: "General",
    free: "Free",
  };
  const [events, setEvents] = useState<QRSummary[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [event, setEvent] = useState<QRSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingEvent, setLoadingEvent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const formatEventDate = (rawDate: string) => {
    if (!rawDate) return "";
    const parsed = new Date(rawDate);
    if (Number.isNaN(parsed.getTime())) return rawDate;
    return parsed.toLocaleString("es-PE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Fetch all events (for Select)
  const fetchEvents = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await authedFetch("/api/qr-summary-all", { cache: "no-store" });
      const json = (await res.json()) as { events?: QRSummary[]; error?: string };
      if (!res.ok) {
        throw new Error(json.error || "No se pudo cargar el resumen de eventos");
      }
      setEvents(Array.isArray(json.events) ? json.events : []);
    } catch (err) {
      setEvents([]);
      setEvent(null);
      setSelected("");
      setError(err instanceof Error ? err.message : "Error desconocido al cargar eventos");
    } finally {
      setLoading(false);
    }
  };

  // Fetch details for selected event
  const fetchEventDetails = async (eventId: string) => {
    setLoadingEvent(true);
    // En este caso, los detalles ya están en el array, pero si en el futuro hay endpoint por evento, aquí se haría el fetch
    const found = events.find(e => e.event_id === eventId);
    setEvent(found || null);
    setLoadingEvent(false);
  };

  useEffect(() => {
    fetchEvents();
  }, []);

  useEffect(() => {
    if (selected) {
      fetchEventDetails(selected);
    } else if (events.length > 0) {
      setSelected(events[0].event_id);
      setEvent(events[0]);
    } else {
      setEvent(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, events]);

  const noEvents = !loading && events.length === 0;

  return (
    <Card className="mb-4 bg-gradient-to-br from-neutral-900 to-neutral-800 border-0">
      <CardHeader>
        <div className="flex items-center gap-4">
          <CardTitle className="text-lg font-semibold text-white flex-1">
            Tickets generados por evento
          </CardTitle>
          <Select
            value={selected}
            onChange={e => setSelected(e.target.value)}
            className="w-64 text-neutral-900 [color-scheme:light]"
            options={events.map(ev => ({ value: ev.event_id, label: ev.name || ev.event_id.slice(0, 8) }))}
            placeholder="Selecciona evento"
            disabled={noEvents || loading}
          />
          <button
            onClick={fetchEvents}
            disabled={loading}
            title="Refrescar"
            className="ml-2 flex items-center gap-1 px-4 py-1.5 rounded-lg border border-neutral-500 bg-neutral-900 text-neutral-100 font-medium text-sm shadow-sm transition-colors duration-150 hover:bg-neutral-800 hover:text-white focus:outline-none focus:ring-2 focus:ring-neutral-400 focus:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <svg className={"w-4 h-4 mr-1 "+(loading?"animate-spin text-neutral-200":"text-neutral-300")} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582M20 20v-5h-.581M5.635 17.657A9 9 0 1 1 18.364 6.343" />
            </svg>
            {loading ? "Cargando..." : "Refrescar"}
          </button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-neutral-400 py-8 text-center">Cargando...</div>
        ) : error ? (
          <div className="text-red-300 py-8 text-center">
            <div className="text-sm font-semibold mb-1">No se pudo cargar el resumen</div>
            <div className="text-xs text-red-200/80">{error}</div>
          </div>
        ) : noEvents ? (
          <div className="text-neutral-400 py-8 text-center">
            <div className="text-lg font-semibold mb-2">No hay eventos próximos</div>
            <div className="text-xs text-neutral-500">Crea un evento activo y con fecha futura para verlo aquí.</div>
          </div>
        ) : loadingEvent ? (
          <div className="text-neutral-400 py-8 text-center">Cargando evento...</div>
        ) : event ? (
          <div className="flex flex-col items-center gap-2 py-2">
            <div className="text-4xl font-bold text-neutral-400">
              {event.total_qr}
            </div>
            <div className="text-xs text-neutral-400 mb-2">Tickets generados</div>
            <div className="flex gap-6">
              {Object.entries(event.by_type).map(([type, count]) => (
                <div key={type} className="text-center">
                  <div className="text-lg font-semibold text-white">{count}</div>
                  <div className="text-xs text-neutral-400">{typeLabelMap[type] || type}</div>
                </div>
              ))}
            </div>
            <div className="text-xs text-neutral-500 mt-2">{formatEventDate(event.date)}</div>
            {event.error ? (
              <div className="text-xs text-amber-300 mt-1">{event.error}</div>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

export default TicketsSummaryCard;
