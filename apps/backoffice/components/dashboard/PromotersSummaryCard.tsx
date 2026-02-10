"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, Select } from "@repo/ui";
import { SimpleBarChart } from "@/components/dashboard/SimpleBarChart";
import type { PromoterSummary } from "@repo/api-logic/promoter-summary";

function PromotersSummaryCard() {
  const [events, setEvents] = useState<PromoterSummary[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [event, setEvent] = useState<PromoterSummary | null>(null);
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

  const chartData = useMemo(() => {
    if (!event) return [];
    return event.promoters.map((promoter) => ({
      name: promoter.name.length > 22 ? `${promoter.name.slice(0, 22)}...` : promoter.name,
      tickets: promoter.tickets,
    }));
  }, [event]);

  const fetchEvents = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/promoter-summary-all", { cache: "no-store" });
      const json = (await res.json()) as { events?: PromoterSummary[]; error?: string };
      if (!res.ok) {
        throw new Error(json.error || "No se pudo cargar el resumen de promotores");
      }
      setEvents(Array.isArray(json.events) ? json.events : []);
    } catch (err) {
      setEvents([]);
      setEvent(null);
      setSelected("");
      setError(err instanceof Error ? err.message : "Error desconocido al cargar promotores");
    } finally {
      setLoading(false);
    }
  };

  const fetchEventDetails = async (eventId: string) => {
    setLoadingEvent(true);
    const found = events.find((e) => e.event_id === eventId);
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
  const noPromoters = !loading && !loadingEvent && !!event && event.promoters.length === 0;

  return (
    <Card className="border-0 bg-gradient-to-br from-slate-900 to-slate-800 shadow-lg">
      <CardHeader className="pb-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex-1">
            <CardTitle className="text-base font-semibold text-white">
              Tickets por promotor (evento seleccionado)
            </CardTitle>
            <p className="mt-1 text-xs text-slate-400">
              Medicion en barras por promotor
            </p>
          </div>

          <Select
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            className="w-72 text-slate-900 [color-scheme:light]"
            options={events.map((ev) => ({ value: ev.event_id, label: ev.name || ev.event_id.slice(0, 8) }))}
            placeholder="Selecciona evento"
            disabled={noEvents || loading}
          />

          <button
            onClick={fetchEvents}
            disabled={loading}
            title="Refrescar"
            className="flex items-center gap-1 px-4 py-1.5 rounded-lg border border-blue-500 bg-blue-900 text-blue-100 font-medium text-sm shadow-sm transition-colors duration-150 hover:bg-blue-800 hover:text-white focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <svg
              className={`w-4 h-4 mr-1 ${loading ? "animate-spin text-blue-200" : "text-blue-300"}`}
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582M20 20v-5h-.581M5.635 17.657A9 9 0 1 1 18.364 6.343" />
            </svg>
            {loading ? "Cargando..." : "Refrescar"}
          </button>
        </div>
      </CardHeader>

      <CardContent>
        {loading ? (
          <div className="text-slate-400 py-10 text-center">Cargando...</div>
        ) : error ? (
          <div className="text-red-300 py-10 text-center">
            <div className="text-sm font-semibold mb-1">No se pudo cargar promotores</div>
            <div className="text-xs text-red-200/80">{error}</div>
          </div>
        ) : noEvents ? (
          <div className="text-slate-400 py-10 text-center">
            <div className="text-lg font-semibold mb-2">No hay eventos proximos</div>
            <div className="text-xs text-slate-500">Crea un evento activo y con fecha futura para analizar promotores.</div>
          </div>
        ) : loadingEvent ? (
          <div className="text-slate-400 py-10 text-center">Cargando evento...</div>
        ) : event ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-sm text-slate-300">{event.name}</div>
                <div className="text-xs text-slate-500">{formatEventDate(event.date)}</div>
              </div>
              <div className="text-right">
                <div className="text-3xl font-bold text-blue-400">{event.total_tickets}</div>
                <div className="text-xs text-slate-400">Tickets generados</div>
              </div>
            </div>

            {noPromoters ? (
              <div className="text-slate-400 py-10 text-center">
                No hay tickets generados para este evento.
              </div>
            ) : (
              <SimpleBarChart
                data={chartData}
                dataKeys={[{ key: "tickets", color: "#22c55e" }]}
                height={320}
              />
            )}

            {event.error ? <div className="text-xs text-amber-300">{event.error}</div> : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

export default PromotersSummaryCard;
