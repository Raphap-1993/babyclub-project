"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowDownToLine,
  RefreshCw,
  Users,
  Ticket,
  Gift,
  Armchair,
} from "lucide-react";
import { Select } from "@repo/ui";
import { Button } from "@/components/ui/button";
import { authedFetch } from "@/lib/authedFetch";
import {
  eventCloseCsv,
  formatLima,
  formatPen,
  type EventCloseReport,
  type EventRow,
} from "@/lib/reports/eventClose";

import {
  reportPage,
  reportSelectionQuery,
  reportView,
  reportViews as views,
  type ReportView as View,
} from "../navigation";
import ReportPanel from "./ReportPanel";
import PromotersPanel from "./PromotersPanel";
import SettlementsPanel from "./SettlementsPanel";

const colors = [
  "bg-rose-400",
  "bg-violet-400",
  "bg-sky-400",
  "bg-emerald-400",
  "bg-amber-400",
  "bg-neutral-400",
];
const number = (value: number) => value.toLocaleString("es-PE");

function Stat({
  label,
  value,
  note,
  icon: Icon,
}: {
  label: string;
  value: number;
  note: string;
  icon: typeof Users;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#111111] p-4 sm:p-5">
      <div className="flex items-center justify-between gap-2 text-xs text-neutral-300">
        <span>{label}</span>
        <Icon
          size={16}
          className="shrink-0 text-neutral-500"
          aria-hidden="true"
        />
      </div>
      <p className="mt-3 text-3xl font-semibold tracking-tight text-white tabular-nums sm:text-4xl">
        {number(value)}
      </p>
      <p className="mt-2 text-xs leading-5 text-neutral-400">{note}</p>
    </div>
  );
}

function Breakdown({ report }: { report: EventCloseReport }) {
  const { attendance } = report;
  return (
    <ReportPanel
      title="Cómo ingresaron"
      description="Distribución de accesos por tipo de entrada."
    >
      {attendance.confirmed > 0 ? (
        <>
          <div
            className="mb-5 flex h-3 overflow-hidden rounded-full bg-white/5"
            aria-hidden="true"
          >
            {attendance.categories.map((row, i) => (
              <div
                key={row.key}
                className={colors[i]}
                style={{
                  width: `${(row.count / attendance.confirmed) * 100}%`,
                }}
              />
            ))}
          </div>
          <ul>
            {attendance.categories.map((row, i) => (
              <li
                key={row.key}
                className="flex items-center justify-between gap-3 py-2.5 text-sm"
              >
                <span className="flex items-center gap-2.5">
                  <span
                    className={`h-2 w-2 shrink-0 rounded-full ${colors[i]}`}
                  />
                  {row.label}
                </span>
                <span className="flex shrink-0 items-baseline gap-4 tabular-nums">
                  <strong className="font-semibold">{number(row.count)}</strong>
                  <span className="w-11 text-right text-xs text-neutral-500">
                    {Math.round((row.count / attendance.confirmed) * 100)}%
                  </span>
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex justify-between border-t border-white/10 pt-4 text-sm font-semibold">
            <span>Total de accesos</span>
            <span className="tabular-nums">{number(attendance.confirmed)}</span>
          </div>
        </>
      ) : (
        <p className="rounded-xl bg-white/[0.03] p-5 text-sm leading-6 text-neutral-400">
          Todavía no se han registrado accesos a este evento.
        </p>
      )}
    </ReportPanel>
  );
}

function Income({
  report,
  compact = false,
}: {
  report: EventCloseReport;
  compact?: boolean;
}) {
  const { sales } = report;
  return (
    <ReportPanel
      title="Reservas y pagos"
      description="Valor de las entradas aprobadas y pagos registrados, presentados por separado."
    >
      <div className="space-y-4">
        <div className="rounded-xl border border-white/10 bg-white/[0.025] p-4">
          <p className="text-xs text-neutral-300">
            Valor de reservas aprobadas
          </p>
          <p className="mt-2 text-3xl font-semibold tracking-tight tabular-nums">
            {sales.approvedTicketReservations === 0
              ? "Sin reservas aprobadas"
              : sales.approvedWithoutAmount === sales.approvedTicketReservations
                ? "Sin importe registrado"
                : formatPen(sales.declaredTicketAmountCents)}
          </p>
          <p className="mt-2 text-xs leading-5 text-neutral-400">
            {number(sales.approvedTicketReservations)}{" "}
            {sales.approvedTicketReservations === 1
              ? "reserva de entradas aprobada"
              : "reservas de entradas aprobadas"}
          </p>
          {sales.approvedWithoutAmount > 0 && (
            <p className="mt-2 text-xs text-neutral-400">
              {number(sales.approvedWithoutAmount)} con importe pendiente de
              registrar.
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-start justify-between gap-3 px-1">
          <div>
            <p className="text-sm text-neutral-300">
              Pagos registrados en soles
            </p>
            <p className="mt-1 text-xs text-neutral-500">
              {number(sales.confirmedPaymentCount)}{" "}
              {sales.confirmedPaymentCount === 1
                ? "pago confirmado"
                : "pagos confirmados"}{" "}
              · sin devoluciones
            </p>
          </div>
          <strong className="text-xl font-semibold tabular-nums">
            {sales.confirmedPaymentCount > 0
              ? formatPen(sales.confirmedPaymentAmountCents)
              : "Sin pagos registrados"}
          </strong>
        </div>
        {!compact && (
          <>
            <div className="grid gap-3 border-t border-white/10 pt-4 sm:grid-cols-2">
              <div>
                <p className="text-xs text-neutral-400">Cobros en puerta</p>
                <p className="mt-1 font-medium">Sin registro</p>
              </div>
              <div>
                <p className="text-xs text-neutral-400">Ganancia neta</p>
                <p className="mt-1 font-medium">No calculada</p>
              </div>
            </div>
            <p className="text-xs leading-5 text-neutral-400">
              La ganancia neta considera los ingresos y gastos del evento.
            </p>
            {(sales.otherCurrencyPayments > 0 ||
              sales.paymentsWithoutAmount > 0) && (
              <p className="text-xs leading-5 text-neutral-400">
                Pagos fuera del total en soles: {sales.otherCurrencyPayments}{" "}
                con otra moneda o moneda sin indicar;{" "}
                {sales.paymentsWithoutAmount} con importe pendiente de
                registrar.
              </p>
            )}
            {sales.refundedPaymentCount > 0 && (
              <p className="text-xs leading-5 text-neutral-400">
                {sales.refundedPaymentCount} pagos con devolución. Importe
                original de los pagos:{" "}
                {formatPen(sales.refundedPaymentAmountCents)}. Devoluciones
                parciales no desglosadas.
              </p>
            )}
          </>
        )}
      </div>
    </ReportPanel>
  );
}

function Invitations({ report }: { report: EventCloseReport }) {
  const rows = [
    ["Invitaciones emitidas", report.invitations.issued],
    ["Con ingreso confirmado", report.invitations.attended],
    ["Sin ingreso registrado", report.invitations.withoutAdmission],
    ["Usadas sin confirmación de ingreso", report.invitations.usageWithoutScan],
  ] as const;
  return (
    <ReportPanel
      title="Invitaciones"
      description="Entradas de cortesía y free emitidas para este evento."
    >
      <dl className="divide-y divide-white/5">
        {rows.map(([label, value]) => (
          <div key={label} className="flex justify-between gap-3 py-3 text-sm">
            <dt className="text-neutral-300">{label}</dt>
            <dd className="font-semibold tabular-nums">{number(value)}</dd>
          </div>
        ))}
      </dl>
      {report.invitations.codeOnlyAdmissions > 0 && (
        <p className="mt-4 text-sm leading-6 text-sky-200">
          {number(report.invitations.codeOnlyAdmissions)} accesos adicionales
          con código de invitación, incluidos en la asistencia total.
        </p>
      )}
      <p className="mt-4 rounded-xl bg-white/[0.03] p-3 text-xs leading-5 text-neutral-400">
        {report.event.closed_at
          ? "Asistencia final del evento."
          : "La asistencia se actualiza hasta el cierre del evento."}
      </p>
    </ReportPanel>
  );
}

function Tables({ report }: { report: EventCloseReport }) {
  const rows = [
    ["Reservas de mesa aprobadas", report.tables.approvedReservations],
    ["Mesas reservadas", report.tables.distinctTables],
    ["Invitados que ingresaron", report.tables.admittedGuests],
  ] as const;
  return (
    <ReportPanel
      title="Reservas de mesas"
      description="Mesas reservadas e invitados que asistieron al evento."
    >
      <div className="grid gap-4 sm:grid-cols-3">
        {rows.map(([label, value]) => (
          <div key={label}>
            <p className="text-xs text-neutral-400">{label}</p>
            <p className="mt-2 text-3xl font-semibold tabular-nums">
              {number(value)}
            </p>
          </div>
        ))}
      </div>
      <div className="mt-6 rounded-xl border border-white/10 bg-white/[0.025] p-4">
        <p className="text-sm font-medium text-neutral-200">
          Consumo de mesas: sin registro
        </p>
        <p className="mt-2 text-xs leading-5 text-neutral-400">
          El consumo se presenta por separado del valor de la reserva.
        </p>
      </div>
    </ReportPanel>
  );
}

function Quality({ report }: { report: EventCloseReport }) {
  const items = [
    {
      label: "Accesos sin modalidad indicada",
      value: report.quality.unclassifiedAdmissions,
      note: "Incluye QR generales y otros accesos sin indicación de pago o gratuidad.",
    },
    {
      label: "Reservas del historial de cierre",
      value: report.quality.archivedReservationsIncluded,
      note: "Reservas conservadas en el historial del evento, en todos sus estados.",
    },
    {
      label: "Reservas con importe pendiente",
      value: report.sales.approvedWithoutAmount,
      note: "Reservas aprobadas cuyo importe aún no está registrado.",
    },
  ];
  return (
    <ReportPanel
      title="Detalle del cierre"
      description="Información complementaria del evento."
    >
      <dl className="divide-y divide-white/5">
        {items.map((item) => (
          <div
            key={item.label}
            className="flex items-start justify-between gap-4 py-4"
          >
            <div>
              <dt className="text-sm font-medium">{item.label}</dt>
              <p className="mt-1 text-xs leading-5 text-neutral-400">
                {item.note}
              </p>
            </div>
            <dd className="text-lg font-semibold tabular-nums">
              {number(item.value)}
            </dd>
          </div>
        ))}
      </dl>
      <details className="mt-6 border-t border-white/10 pt-4 text-xs text-neutral-400">
        <summary className="cursor-pointer py-1 text-neutral-300">
          Acerca de este reporte
        </summary>
        <div className="mt-3 space-y-2 leading-5">
          <p>Cada entrada validada cuenta una sola vez en la asistencia.</p>
          <p>
            Las entradas con compra aprobada se muestran en Con compra. Las
            cortesías y entradas free se presentan por separado.
          </p>
          <p>
            El valor de las reservas y los pagos registrados son importes
            independientes y no se suman entre sí.
          </p>
          <p>
            Los accesos sin modalidad indicada se incluyen en la asistencia
            total, sin asignarlos a entradas pagadas o gratuitas.
          </p>
          <p>
            Actualizado el {formatLima(report.generatedAt, true)} · Hora de
            Lima.
          </p>
        </div>
      </details>
    </ReportPanel>
  );
}

export default function EventCloseWorkspace({
  initialView = "summary",
  initialEventId = "",
  previewReports,
}: {
  initialView?: View;
  initialEventId?: string;
  previewReports?: EventCloseReport[];
}) {
  const [events, setEvents] = useState<EventRow[]>(
    previewReports?.map((report) => report.event) || [],
  );
  const searchParams = useSearchParams();
  const query = searchParams.toString();
  const view = reportView(searchParams, initialView);
  const eventId =
    searchParams.get("event_id") ||
    initialEventId ||
    events.find(
      (event) => event.starts_at && Date.parse(event.starts_at) <= Date.now(),
    )?.id ||
    events[0]?.id ||
    "";
  const promoterId = searchParams.get("promoter_id") || "";
  const promoterPage = reportPage(searchParams.get("promoter_page"));
  const settlementPage = reportPage(searchParams.get("settlement_page"));

  // Next syncs native history with useSearchParams. The URL is the only selection
  // state, so browser Back/Forward cannot compete with a second state effect.
  const changeSelection = (
    changes: Parameters<typeof reportSelectionQuery>[1],
  ) => {
    const next = reportSelectionQuery(window.location.search, changes);
    if (next !== window.location.search.slice(1)) {
      window.history.pushState(null, "", `${window.location.pathname}?${next}`);
    }
  };

  useEffect(() => {
    if (!eventId || new URLSearchParams(query).has("event_id")) return;
    const next = reportSelectionQuery(query, { eventId, view });
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}?${next}`,
    );
  }, [eventId, query, view]);
  const [report, setReport] = useState<EventCloseReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const run = async () => {
      setError(null);
      try {
        let options = previewReports?.map((item) => item.event);
        if (!options) {
          const response = await authedFetch("/api/admin/reports/event-close", {
            signal: controller.signal,
            cache: "no-store",
          });
          const payload = await response.json();
          if (!response.ok)
            throw new Error(
              payload.error || "No se pudieron cargar los eventos.",
            );
          options = payload.events as EventRow[];
        }
        if (controller.signal.aborted) return;
        setEvents(options);
        if (!options.length) setLoading(false);
      } catch (caught) {
        if (!controller.signal.aborted) {
          setError(
            caught instanceof Error
              ? caught.message
              : "No se pudieron cargar los eventos.",
          );
          setLoading(false);
        }
      }
    };
    void run();
    return () => controller.abort();
  }, [previewReports, reload]);

  useEffect(() => {
    if (!eventId) return;
    const controller = new AbortController();
    setLoading(true);
    setReport(null);
    setError(null);
    const run = async () => {
      try {
        let next = previewReports?.find((item) => item.event.id === eventId);
        if (!previewReports) {
          const response = await authedFetch(
            `/api/admin/reports/event-close?event_id=${encodeURIComponent(eventId)}`,
            { signal: controller.signal, cache: "no-store" },
          );
          const payload = await response.json();
          if (!response.ok)
            throw new Error(payload.error || "No se pudo cargar el cierre.");
          next = payload.report;
        }
        if (!next || next.event.id !== eventId)
          throw new Error(
            "El cierre recibido no corresponde al evento seleccionado.",
          );
        if (!controller.signal.aborted) setReport(next);
      } catch (caught) {
        if (!controller.signal.aborted)
          setError(
            caught instanceof Error
              ? caught.message
              : "No se pudo cargar el cierre.",
          );
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };
    void run();
    return () => controller.abort();
  }, [eventId, previewReports, reload]);

  const visible = report?.event.id === eventId && !error ? report : null;
  const categoryCount = (key: string) =>
    visible?.attendance.categories.find((row) => row.key === key)?.count || 0;
  const download = (
    blob: Blob,
    snapshot: EventCloseReport,
    extension: "csv" | "xlsx",
  ) => {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `cierre-${snapshot.event.name.replace(/[^a-zA-Z0-9-]/g, "-")}-${snapshot.generatedAt.slice(0, 10)}.${extension}`;
    document.body.appendChild(anchor);
    anchor.click();
    window.setTimeout(() => {
      anchor.remove();
      URL.revokeObjectURL(url);
    }, 1000);
  };
  const exportCsv = () => {
    if (!visible) return;
    setExportError(null);
    download(
      new Blob([eventCloseCsv(visible)], { type: "text/csv;charset=utf-8;" }),
      visible,
      "csv",
    );
  };
  const exportExcel = async () => {
    if (!visible || exporting) return;
    const snapshot = visible;
    setExporting(true);
    setExportError(null);
    try {
      const { eventCloseExcel } = await import("@/lib/reports/eventCloseExcel");
      const bytes = await eventCloseExcel(snapshot);
      download(
        new Blob([bytes.buffer], {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        }),
        snapshot,
        "xlsx",
      );
    } catch {
      setExportError(
        "No se pudo generar el Excel. Vuelve a intentar la descarga.",
      );
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-5 pb-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Reportes por evento
          </h1>
          <p className="mt-2 text-sm text-neutral-400">
            Asistencia, ingresos, mesas, promotores y liquidaciones del evento.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={exportCsv}
            disabled={!visible || loading || exporting}
          >
            CSV
          </Button>
          <Button
            onClick={exportExcel}
            disabled={!visible || loading || exporting}
          >
            <ArrowDownToLine size={16} />
            {exporting ? "Generando Excel…" : "Descargar Excel"}
          </Button>
        </div>
      </header>
      {exportError && (
        <p
          role="alert"
          className="rounded-xl border border-rose-300/25 bg-rose-300/5 p-4 text-sm text-rose-100"
        >
          {exportError}
        </p>
      )}
      {previewReports && (
        <div className="rounded-xl border border-sky-300/20 bg-sky-300/5 px-4 py-3 text-xs leading-5 text-sky-100">
          Vista previa de solo lectura · datos agregados del corte auditado.
          Actualizar vuelve a mostrar esta misma captura.
        </div>
      )}
      <div className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-[#111111] p-4 sm:flex-row sm:items-end sm:justify-between sm:p-5">
        <div className="min-w-0 flex-1 sm:max-w-xl">
          <label
            htmlFor="close-event"
            className="mb-2 block text-xs font-medium text-neutral-400"
          >
            Evento
          </label>
          <Select
            id="close-event"
            value={eventId}
            disabled={!events.length}
            onChange={(event) =>
              changeSelection({ eventId: event.target.value })
            }
            placeholder={events.length ? undefined : "Sin eventos disponibles"}
            options={events.map((event) => ({
              value: event.id,
              label: `${event.name} · ${formatLima(event.starts_at)}`,
            }))}
            className="w-full min-w-0 border-white/15 bg-[#191919] text-sm text-white [color-scheme:dark] focus:border-rose-400 focus:ring-rose-400/20 disabled:bg-neutral-900"
          />
        </div>
        <div className="flex items-center justify-between gap-4 sm:justify-end">
          {visible && (
            <span
              className={`rounded-full px-3 py-1.5 text-xs ${visible.event.closed_at ? "bg-white/5 text-neutral-300" : "bg-emerald-300/10 text-emerald-200"}`}
            >
              {visible.event.closed_at ? "Evento cerrado" : "Evento abierto"}
            </span>
          )}
          <Button
            variant="ghost"
            onClick={() => setReload((value) => value + 1)}
            disabled={loading}
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            Actualizar
          </Button>
        </div>
      </div>
      {error && (
        <div
          role="alert"
          className="rounded-xl border border-rose-300/25 bg-rose-300/5 p-5"
        >
          <p className="font-medium">No se pudo cargar el cierre</p>
          <p className="mt-2 text-sm leading-6 text-neutral-300">{error}</p>
          <Button
            className="mt-4"
            onClick={() => setReload((value) => value + 1)}
          >
            Reintentar
          </Button>
        </div>
      )}
      {loading && (
        <div
          role="status"
          className="rounded-2xl border border-white/10 p-8 text-sm text-neutral-400"
        >
          Cargando reporte…
        </div>
      )}
      {!loading && !error && !events.length && (
        <ReportPanel
          title="Todavía no hay eventos"
          description="El cierre estará disponible cuando exista un evento registrado."
        >
          <Link
            href="/admin/events"
            className="text-sm text-rose-200 underline underline-offset-4"
          >
            Ir a eventos
          </Link>
        </ReportPanel>
      )}
      {visible && !loading && (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat
              label="Accesos confirmados"
              value={visible.attendance.confirmed}
              note="Entradas validadas en puerta"
              icon={Users}
            />
            <Stat
              label="Con compra"
              value={categoryCount("purchase")}
              note="Ingresaron con entrada comprada"
              icon={Ticket}
            />
            <Stat
              label="Invitaciones y free"
              value={categoryCount("courtesy") + categoryCount("free")}
              note="Cortesías y entradas gratuitas"
              icon={Gift}
            />
            <Stat
              label="Reservas de mesa"
              value={visible.tables.approvedReservations}
              note={`${number(visible.tables.admittedGuests)} invitados ingresaron`}
              icon={Armchair}
            />
          </div>
          <nav
            aria-label="Secciones del reporte"
            className="flex gap-1 overflow-x-auto border-b border-white/10 pb-1"
          >
            {views.map((item) => (
              <button
                key={item.key}
                type="button"
                aria-pressed={view === item.key}
                onClick={() => changeSelection({ view: item.key })}
                className={`shrink-0 rounded-lg px-4 py-3 text-sm transition focus-visible:outline focus-visible:outline-rose-300 ${view === item.key ? "bg-white/10 font-medium text-white" : "text-neutral-400 hover:bg-white/5 hover:text-white"}`}
              >
                {item.label}
              </button>
            ))}
          </nav>
          <div aria-live="polite">
            {view === "summary" && (
              <div className="grid items-start gap-4 lg:grid-cols-[1.1fr_1fr]">
                <Breakdown report={visible} />
                <Income report={visible} compact />
              </div>
            )}
            {view === "attendance" && (
              <div className="grid items-start gap-4 lg:grid-cols-2">
                <Breakdown report={visible} />
                <Invitations report={visible} />
              </div>
            )}
            {view === "income" && <Income report={visible} />}
            {view === "tables" && <Tables report={visible} />}
            {view === "promoters" && (
              <PromotersPanel
                report={visible}
                promoterId={promoterId}
                page={promoterPage}
                onPromoterChange={(value) =>
                  changeSelection({ promoterId: value })
                }
                onPageChange={(value) =>
                  changeSelection({ promoterPage: value })
                }
              />
            )}
            {view === "settlements" && (
              <SettlementsPanel
                report={visible}
                promoterId={promoterId}
                onPromoterChange={(value) =>
                  changeSelection({ promoterId: value })
                }
                page={settlementPage}
                onPageChange={(value) =>
                  changeSelection({ settlementPage: value })
                }
              />
            )}
            {view === "quality" && <Quality report={visible} />}
          </div>
          <footer className="flex flex-wrap justify-between gap-2 px-1 text-[11px] leading-5 text-neutral-500">
            <span>{formatLima(visible.event.starts_at)} · Horario de Lima</span>
            <span>Actualizado: {formatLima(visible.generatedAt, true)}</span>
          </footer>
        </>
      )}
    </div>
  );
}
