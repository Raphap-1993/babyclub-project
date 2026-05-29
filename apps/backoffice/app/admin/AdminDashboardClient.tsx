"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { authedFetch } from "@/lib/authedFetch";
import { buildAdminDashboardModel, type DashboardModel } from "./dashboardModel";
import type { QRSummary } from "@repo/api-logic/qr-summary";
import type { PromoterSummary } from "@repo/api-logic/promoter-summary";

const quickActions = [
  { label: "Crear Evento", href: "/admin/events/create" },
  { label: "Entradas/Precios", href: "/admin/ticket-types" },
  { label: "Escaneo QR", href: "/admin/scan" },
  { label: "Mesas/Croquis", href: "/admin/organizers" },
  { label: "Productos Mesa", href: "/admin/table-products" },
  { label: "Reportes", href: "/admin/reportes" },
];

const typeAccent: Record<string, string> = {
  general: "border-rose-500/30 bg-rose-500/10 text-rose-200",
  table: "border-amber-500/30 bg-amber-500/10 text-amber-200",
  courtesy: "border-sky-500/30 bg-sky-500/10 text-sky-200",
  free: "border-emerald-500/30 bg-emerald-500/10 text-emerald-200",
  unknown: "border-white/10 bg-white/5 text-white/70",
};

const demoQrEvents: QRSummary[] = [
  {
    event_id: "evt-demo-1",
    name: "Baby Club Sunrise",
    date: "2026-05-30T22:00:00.000Z",
    total_qr: 248,
    by_type: { entrada: 168, mesa: 56, cortesia: 24 },
  },
  {
    event_id: "evt-demo-2",
    name: "Abyss Session",
    date: "2026-06-01T22:00:00.000Z",
    total_qr: 132,
    by_type: { general: 90, table: 24, courtesy: 18 },
  },
];

const demoPromoterEvents: PromoterSummary[] = [
  {
    event_id: "evt-demo-1",
    name: "Baby Club Sunrise",
    date: "2026-05-30T22:00:00.000Z",
    total_tickets: 248,
    promoters: [
      { promoter_id: "p-1", name: "Lucia", tickets: 102 },
      { promoter_id: "p-2", name: "Martin", tickets: 88 },
      { promoter_id: "direct", name: "Invitacion directa", tickets: 58 },
    ],
  },
  {
    event_id: "evt-demo-2",
    name: "Abyss Session",
    date: "2026-06-01T22:00:00.000Z",
    total_tickets: 132,
    promoters: [
      { promoter_id: "p-3", name: "Sofía", tickets: 72 },
      { promoter_id: "direct", name: "Invitacion directa", tickets: 60 },
    ],
  },
];

function formatEventDate(rawDate: string) {
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
}

function MetricTile({
  title,
  value,
  description,
}: {
  title: string;
  value: number;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-neutral-800 bg-gradient-to-br from-neutral-900 to-neutral-800 p-4 shadow-lg">
      <div className="text-sm font-medium text-neutral-300">{title}</div>
      <div className="mt-3 text-3xl font-bold text-white">{value}</div>
      <p className="mt-2 text-xs text-neutral-400">{description}</p>
    </div>
  );
}

function EventCard({ event }: { event: DashboardModel["events"][number] }) {
  return (
    <article className="rounded-2xl border border-neutral-800 bg-neutral-950/80 p-5 shadow-lg">
      <header className="pb-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h3 className="text-lg font-semibold text-white">{event.name}</h3>
            <p className="mt-1 text-xs text-neutral-500">{formatEventDate(event.date)}</p>
          </div>
          <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-right">
            <div className="text-2xl font-bold text-white">{event.totalQr}</div>
            <div className="text-[11px] uppercase tracking-[0.16em] text-rose-200/75">QR emitidos</div>
          </div>
        </div>
      </header>
      <div className="space-y-4">
        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-xl border border-neutral-800 bg-neutral-900/70 p-4">
            <div className="mb-3 text-xs uppercase tracking-[0.16em] text-neutral-500">Clasificación QR</div>
            <div className="space-y-3">
              {event.qrBreakdown.map((item) => (
                <div key={item.key} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-neutral-300">{item.label}</span>
                    <span className="font-semibold text-white">{item.value}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-neutral-800">
                    <div
                      className={`h-full rounded-full ${typeAccent[item.key] || typeAccent.unknown}`}
                      style={{ width: `${event.totalQr > 0 ? Math.max((item.value / event.totalQr) * 100, item.value > 0 ? 6 : 0) : 0}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-neutral-800 bg-neutral-900/70 p-4">
            <div className="mb-3 text-xs uppercase tracking-[0.16em] text-neutral-500">Ventas por promotor</div>
            {event.promoters.length === 0 ? (
              <p className="text-sm text-neutral-500">Sin promotores registrados para este evento.</p>
            ) : (
              <div className="space-y-3">
                {event.promoters.map((promoter) => (
                  <div key={promoter.promoterId} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="truncate text-neutral-300">{promoter.name}</span>
                      <span className="font-semibold text-white">{promoter.tickets}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-neutral-800">
                      <div
                        className="h-full rounded-full bg-emerald-400"
                        style={{
                          width: `${event.totalTickets > 0 ? Math.max((promoter.tickets / event.totalTickets) * 100, promoter.tickets > 0 ? 6 : 0) : 0}%`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}

export default function AdminDashboardClient() {
  const [qrEvents, setQrEvents] = useState<QRSummary[]>([]);
  const [promoterEvents, setPromoterEvents] = useState<PromoterSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [qrRes, promoterRes] = await Promise.all([
        authedFetch("/api/qr-summary-all", { cache: "no-store" }),
        authedFetch("/api/promoter-summary-all", { cache: "no-store" }),
      ]);
      const [qrJson, promoterJson] = await Promise.all([
        qrRes.json(),
        promoterRes.json(),
      ]);

      if (!qrRes.ok) {
        throw new Error(qrJson?.error || "No se pudo cargar el resumen de QR");
      }
      if (!promoterRes.ok) {
        throw new Error(promoterJson?.error || "No se pudo cargar el resumen de promotores");
      }

      setQrEvents(Array.isArray(qrJson?.events) ? qrJson.events : []);
      setPromoterEvents(Array.isArray(promoterJson?.events) ? promoterJson.events : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido al cargar el dashboard");
      setQrEvents([]);
      setPromoterEvents([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const model = useMemo(
    () => buildAdminDashboardModel({ qrEvents, promoterEvents }),
    [qrEvents, promoterEvents],
  );

  const demoModel = useMemo(
    () => buildAdminDashboardModel({ qrEvents: demoQrEvents, promoterEvents: demoPromoterEvents }),
    [],
  );
  const showDemo = process.env.NODE_ENV !== "production" && error === "Supabase config missing";
  const dashboardModel = showDemo ? demoModel : model;

  return (
    <main className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          <p className="text-sm text-neutral-400">
            Resumen operativo y comercial normalizado por tipo de QR y promotor
          </p>
        </div>
        <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-2 lg:w-auto lg:grid-cols-3 xl:grid-cols-6">
          {quickActions.map((action) => {
            return (
              <Link key={action.href} href={action.href} className="w-full">
                <span className="flex w-full items-center justify-start rounded-lg border border-rose-500/30 bg-neutral-800/80 px-3 py-2 text-sm text-white transition-all hover:border-rose-500/50 hover:bg-rose-500/20 hover:text-white sm:justify-center lg:justify-start">
                  {action.label}
                </span>
              </Link>
            );
          })}
        </div>
      </div>

      {loading ? (
        <div className="rounded-2xl border border-neutral-800 bg-neutral-950/80 py-12 text-center text-sm text-neutral-400">
          Cargando métricas...
        </div>
      ) : (
        <>
          {showDemo ? (
            <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
              Modo demo local activo. La estructura visual está lista; conecta Supabase para ver datos reales.
            </div>
          ) : error ? (
            <div className="rounded-2xl border border-red-900/40 bg-red-950/40 py-4 text-center text-sm text-red-200">
              No se pudo cargar el dashboard: {error}
            </div>
          ) : null}

          <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <MetricTile
              title="QR emitidos"
              value={dashboardModel.globalTotals.totalQr}
              description="Total consolidado de tickets y accesos generados"
            />
            <MetricTile
              title="Entradas"
              value={dashboardModel.globalTotals.byType.general}
              description="Ventas directas y tickets normales normalizados"
            />
            <MetricTile
              title="Mesas"
              value={dashboardModel.globalTotals.byType.table}
              description="Reservas de mesa y box clasificadas"
            />
            <MetricTile
              title="Cortesías"
              value={dashboardModel.globalTotals.byType.courtesy}
              description="Cortesías y accesos gratuitos controlados"
            />
          </section>

          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-white">Eventos activos</h2>
                <p className="text-xs text-neutral-500">
                  Cada bloque resume QR, clasificación por tipo y ventas por promotor.
                </p>
              </div>
              <span className="rounded-full border border-rose-500/30 bg-rose-500/10 px-3 py-1 text-xs font-medium text-rose-200">
                {dashboardModel.events.length} eventos
              </span>
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
              {dashboardModel.events.map((event) => (
                <EventCard key={event.eventId} event={event} />
              ))}
            </div>
          </section>
        </>
      )}
    </main>
  );
}
