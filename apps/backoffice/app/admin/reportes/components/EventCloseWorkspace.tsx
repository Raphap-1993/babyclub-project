"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  ArrowDownToLine,
  ArrowRight,
  CircleAlert,
  RefreshCw,
  Users,
  Ticket,
  Gift,
  Armchair,
  Check,
} from "lucide-react";
import {
  Select,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@repo/ui";
import { Button } from "@/components/ui/button";
import { authedFetch } from "@/lib/authedFetch";
import {
  eventCloseCsv,
  formatLima,
  formatPen,
  type EventCloseReport,
  type EventRow,
} from "@/lib/reports/eventClose";

const views = [
  { key: "summary", label: "Resumen" },
  { key: "attendance", label: "Asistencia" },
  { key: "income", label: "Ingresos" },
  { key: "tables", label: "Mesas" },
  { key: "promoters", label: "Promotores" },
  { key: "quality", label: "Calidad del cierre" },
] as const;
type View = (typeof views)[number]["key"];
const colors = [
  "bg-rose-400",
  "bg-violet-400",
  "bg-sky-400",
  "bg-emerald-400",
  "bg-amber-400",
  "bg-neutral-400",
];
const number = (value: number) => value.toLocaleString("es-PE");

function Panel({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="min-w-0 rounded-2xl border border-white/10 bg-[#111111] p-5">
      <h2 className="text-base font-semibold text-white">{title}</h2>
      {description && (
        <p className="mt-1 max-w-xl text-xs leading-5 text-neutral-400">
          {description}
        </p>
      )}
      <div className="mt-5">{children}</div>
    </section>
  );
}

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
    <Panel
      title="Cómo ingresaron"
      description="Cada ingreso aparece una sola vez, según la compra o invitación asociada."
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
            <span>Total conciliado</span>
            <span className="tabular-nums">{number(attendance.confirmed)}</span>
          </div>
        </>
      ) : (
        <p className="rounded-xl bg-white/[0.03] p-5 text-sm leading-6 text-neutral-400">
          Este evento todavía no tiene ingresos confirmados. Los intentos de
          escaneo no se cuentan como asistencia.
        </p>
      )}
    </Panel>
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
    <Panel
      title="Dinero registrado"
      description="Dos fuentes para conciliar. Sus importes pueden corresponder a las mismas compras y no se suman."
    >
      <div className="space-y-4">
        <div className="rounded-xl border border-white/10 bg-white/[0.025] p-4">
          <p className="text-xs text-neutral-300">
            Monto en reservas de entradas aprobadas
          </p>
          <p className="mt-2 text-3xl font-semibold tracking-tight tabular-nums">
            {sales.approvedWithoutAmount > 0 &&
            sales.approvedWithoutAmount === sales.approvedTicketReservations
              ? "Sin importe registrado"
              : formatPen(sales.declaredTicketAmountCents)}
          </p>
          <p className="mt-2 text-xs leading-5 text-neutral-400">
            {number(sales.approvedTicketReservations)} reservas aprobadas ·
            importe declarado, pendiente de conciliar con caja.
          </p>
          {sales.approvedWithoutAmount > 0 && (
            <p className="mt-2 text-xs text-amber-200">
              {number(sales.approvedWithoutAmount)} reservas sin importe quedan
              fuera de esta suma.
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-start justify-between gap-3 px-1">
          <div>
            <p className="text-sm text-neutral-300">
              Pagos confirmados en el sistema
            </p>
            <p className="mt-1 text-xs text-neutral-500">
              {number(sales.confirmedPaymentCount)} registros en soles, sin
              reembolso
            </p>
          </div>
          <strong className="text-xl font-semibold tabular-nums">
            {formatPen(sales.confirmedPaymentAmountCents)}
          </strong>
        </div>
        {sales.confirmedPaymentCount === 0 && (
          <p className="text-xs leading-5 text-amber-200/90">
            No hay pagos confirmados en esta fuente. Esto no demuestra que la
            fiesta no haya recaudado.
          </p>
        )}
        {!compact && (
          <>
            <div className="grid gap-3 border-t border-white/10 pt-4 sm:grid-cols-2">
              <div>
                <p className="text-xs text-neutral-400">Cobros en puerta</p>
                <p className="mt-1 font-medium">Sin registro conciliable</p>
              </div>
              <div>
                <p className="text-xs text-neutral-400">Ganancia neta</p>
                <p className="mt-1 font-medium">No disponible</p>
              </div>
            </div>
            <p className="text-xs leading-5 text-neutral-400">
              Para calcular ganancia se necesita consolidar todos los cobros,
              consumos, devoluciones y gastos del evento.
            </p>
            {(sales.otherCurrencyPayments > 0 ||
              sales.paymentsWithoutAmount > 0) && (
              <p className="text-xs leading-5 text-amber-200">
                Por revisar: {sales.otherCurrencyPayments} pagos con otra moneda
                o sin moneda y {sales.paymentsWithoutAmount} pagos en soles sin
                importe válido.
              </p>
            )}
            {sales.refundedPaymentCount > 0 && (
              <p className="text-xs leading-5 text-neutral-400">
                {sales.refundedPaymentCount} pagos con devolución. Importe
                original registrado en soles:{" "}
                {formatPen(sales.refundedPaymentAmountCents)}. El importe exacto
                devuelto requiere conciliación.
              </p>
            )}
          </>
        )}
      </div>
    </Panel>
  );
}

function Invitations({ report }: { report: EventCloseReport }) {
  const rows = [
    ["Invitaciones emitidas", report.invitations.issued],
    ["Con ingreso confirmado", report.invitations.attended],
    ["Sin ingreso registrado", report.invitations.withoutAdmission],
    ["Uso pendiente de conciliar", report.invitations.usageWithoutScan],
  ] as const;
  return (
    <Panel
      title="Invitaciones con ticket"
      description="Tickets de cortesía y free explícitos. Excluye compras, QR generales y tickets anulados sin ingreso."
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
          Además, {number(report.invitations.codeOnlyAdmissions)} cortesías o
          free ingresaron con código sin ticket individual. Están incluidos en
          el total de asistencia.
        </p>
      )}
      <p className="mt-4 rounded-xl bg-white/[0.03] p-3 text-xs leading-5 text-neutral-400">
        {report.event.closed_at
          ? "La ausencia se revisa sobre el evento cerrado."
          : "El evento aún no tiene cierre: estos accesos no son ausencias definitivas."}{" "}
        Un QR marcado como usado sin escaneo conciliado queda por revisar.
      </p>
    </Panel>
  );
}

function Tables({ report }: { report: EventCloseReport }) {
  const rows = [
    ["Reservas de mesa aprobadas", report.tables.approvedReservations],
    ["Mesas distintas reservadas", report.tables.distinctTables],
    ["Invitados que ingresaron", report.tables.admittedGuests],
  ] as const;
  return (
    <Panel
      title="Mesas y consumo"
      description="Las reservas, los invitados y el consumo son medidas diferentes."
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
      <div className="mt-6 rounded-xl border border-amber-300/15 bg-amber-300/[0.04] p-4">
        <p className="text-sm font-medium text-amber-100">
          Consumo por mesa: sin registro conciliable
        </p>
        <p className="mt-2 text-xs leading-5 text-neutral-400">
          Una reserva o el precio del paquete no permiten saber qué se sirvió y
          cobró. El cierre necesita los consumos, pagos y saldos de cada mesa.
        </p>
      </div>
    </Panel>
  );
}

function Quality({ report }: { report: EventCloseReport }) {
  const items = [
    {
      title: `${number(report.quality.unclassifiedAdmissions)} ingresos por clasificar`,
      text: "Los generales no prueban gratuidad ni pago en puerta. Las relaciones incompletas quedan pendientes de revisión.",
      pending: report.quality.unclassifiedAdmissions > 0,
    },
    {
      title: `${number(report.quality.archivedReservationsIncluded)} reservas recuperadas del cierre`,
      text: "Incluidas para consultar el historial. Se excluyen las eliminadas en otro momento.",
      pending: false,
    },
    {
      title: `${number(report.sales.approvedWithoutAmount)} reservas aprobadas sin importe`,
      text: "No se sustituyen con precios actuales ni se inventa un cobro.",
      pending: report.sales.approvedWithoutAmount > 0,
    },
    {
      title: "Caja, consumo y gastos pendientes de consolidar",
      text: "Hasta tener estos registros no se puede confirmar la recaudación total ni la ganancia del evento.",
      pending: true,
    },
  ];
  return (
    <Panel
      title="Qué podemos confirmar"
      description="El cierre muestra los vacíos de información sin confundirlos con ceros."
    >
      <ul className="space-y-5">
        {items.map((item) => (
          <li key={item.title} className="flex items-start gap-3">
            {item.pending ? (
              <CircleAlert
                className="mt-0.5 shrink-0 text-amber-300"
                size={17}
              />
            ) : (
              <Check className="mt-0.5 shrink-0 text-emerald-300" size={17} />
            )}
            <div>
              <p className="text-sm font-medium">{item.title}</p>
              <p className="mt-1 text-xs leading-5 text-neutral-400">
                {item.text}
              </p>
            </div>
          </li>
        ))}
      </ul>
      <details className="mt-6 border-t border-white/10 pt-4 text-xs text-neutral-400">
        <summary className="cursor-pointer py-1 text-neutral-300">
          Cómo se calcula este cierre
        </summary>
        <div className="mt-3 space-y-2 leading-5">
          <p>
            Asistencia: confirmaciones de ingreso únicas por ticket o código. Se
            excluyen preconsultas e intentos fallidos.{" "}
            {number(report.quality.repeatedConfirmations)} confirmaciones
            repetidas fueron deduplicadas.
          </p>
          <p>
            {number(report.attendance.codeOnly)} accesos tienen código sin
            ticket individual; el total mide QR admitidos, no personas
            identificadas de forma única.
          </p>
          <p>
            Se incluyen reservas cuyo borrado coincide exactamente con el
            cierre. {number(report.quality.excludedDeletedReservations)}{" "}
            reservas eliminadas fuera del cierre quedan excluidas.
          </p>
          <p>
            Las compras se identifican antes que el tipo de QR. Un ticket
            comprado puede tener un QR de cortesía sin ser una invitación
            gratuita.
          </p>
          <p>
            Lectura iniciada: {formatLima(report.generatedAt, true)} (Lima). En
            un evento en curso los registros pueden cambiar durante la consulta.
          </p>
        </div>
      </details>
    </Panel>
  );
}

function Promoters({ report }: { report: EventCloseReport }) {
  const [page, setPage] = useState(0);
  const rows = report.promoters.slice(page * 10, (page + 1) * 10);
  return (
    <Panel
      title="Ingresos por promotor"
      description="Atribución del acceso confirmado. Estas cifras no calculan comisiones ni liquidaciones."
    >
      {rows.length ? (
        <>
          <div className="overflow-x-auto">
            <Table className="w-full min-w-[580px] text-left text-sm">
              <caption className="sr-only">
                Ingresos confirmados por promotor para {report.event.name}
              </caption>
              <TableHeader className="border-b border-white/10 text-xs text-neutral-400">
                <TableRow>
                  {[
                    "Promotor",
                    "Total",
                    "Con compra",
                    "Mesa",
                    "Invitación / free",
                    "Por revisar",
                  ].map((label) => (
                    <TableHead
                      key={label}
                      scope="col"
                      className="px-2 py-3 font-normal first:pl-0 [&:not(:first-child)]:text-right"
                    >
                      {label}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-white/5">
                {rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableHead scope="row" className="py-4 pr-4 font-medium">
                      {row.name}
                    </TableHead>
                    {[
                      row.confirmed,
                      row.purchase,
                      row.table,
                      row.courtesy + row.free,
                      row.unclassified + row.unknown,
                    ].map((value, index) => (
                      <TableCell
                        key={index}
                        className="px-2 py-4 text-right tabular-nums text-neutral-300"
                      >
                        {number(value)}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {report.promoters.length > 10 && (
            <div className="mt-4 flex items-center justify-between gap-3">
              <Button
                variant="ghost"
                disabled={page === 0}
                onClick={() => setPage(page - 1)}
              >
                Anterior
              </Button>
              <span className="text-xs text-neutral-400">
                {page + 1} / {Math.ceil(report.promoters.length / 10)}
              </span>
              <Button
                variant="ghost"
                disabled={(page + 1) * 10 >= report.promoters.length}
                onClick={() => setPage(page + 1)}
              >
                Siguiente
              </Button>
            </div>
          )}
        </>
      ) : (
        <p className="py-5 text-sm text-neutral-400">
          Todavía no hay ingresos para atribuir a promotores.
        </p>
      )}
    </Panel>
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
  const [eventId, setEventId] = useState(initialEventId);
  const [view, setView] = useState<View>(initialView);
  const [report, setReport] = useState<EventCloseReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);

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
        setEventId((current) =>
          options.some((event) => event.id === current)
            ? current
            : options.find(
                (event) =>
                  event.starts_at && Date.parse(event.starts_at) <= Date.now(),
              )?.id ||
              options[0]?.id ||
              "",
        );
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
  const exportCsv = () => {
    if (!visible) return;
    const url = URL.createObjectURL(
      new Blob([eventCloseCsv(visible)], { type: "text/csv;charset=utf-8;" }),
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `cierre-${visible.event.name.replace(/[^a-zA-Z0-9-]/g, "-")}-${visible.generatedAt.slice(0, 10)}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    window.setTimeout(() => {
      anchor.remove();
      URL.revokeObjectURL(url);
    }, 1000);
  };

  return (
    <div className="mx-auto max-w-7xl space-y-5 pb-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            href="/admin/reportes"
            className="text-xs text-neutral-400 hover:text-white"
          >
            Reportes
          </Link>
          <h1 className="mt-1.5 text-2xl font-semibold tracking-tight sm:text-3xl">
            Cierre de evento
          </h1>
          <p className="mt-2 text-sm text-neutral-400">
            Asistencia, compras y mesas en una sola lectura.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={exportCsv}
          disabled={!visible || loading}
        >
          <ArrowDownToLine size={16} />
          Exportar cierre
        </Button>
      </header>
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
            onChange={(event) => setEventId(event.target.value)}
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
              {visible.event.closed_at
                ? "Evento cerrado"
                : "Sin cierre registrado"}
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
          Consultando compras, invitaciones e ingresos del evento…
        </div>
      )}
      {!loading && !error && !events.length && (
        <Panel
          title="Todavía no hay eventos"
          description="El cierre estará disponible cuando exista un evento registrado."
        >
          <Link
            href="/admin/events"
            className="text-sm text-rose-200 underline underline-offset-4"
          >
            Ir a eventos
          </Link>
        </Panel>
      )}
      {visible && !loading && (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat
              label="Ingresos confirmados"
              value={visible.attendance.confirmed}
              note="QR únicos admitidos"
              icon={Users}
            />
            <Stat
              label="Con compra registrada"
              value={categoryCount("purchase")}
              note="Accesos asociados a compras"
              icon={Ticket}
            />
            <Stat
              label="Invitación / free"
              value={categoryCount("courtesy") + categoryCount("free")}
              note="Accesos gratuitos identificados"
              icon={Gift}
            />
            <Stat
              label="Reservas de mesa"
              value={visible.tables.approvedReservations}
              note={`${number(visible.tables.admittedGuests)} invitados ingresaron`}
              icon={Armchair}
            />
          </div>
          {visible.quality.unclassifiedAdmissions > 0 && (
            <div className="flex flex-col justify-between gap-3 rounded-xl border border-amber-300/20 bg-amber-300/[0.055] px-4 py-3 sm:flex-row sm:items-center">
              <div className="flex items-start gap-2.5">
                <CircleAlert
                  size={17}
                  className="mt-0.5 shrink-0 text-amber-200"
                />
                <p className="text-sm leading-6 text-amber-100">
                  <strong>
                    {number(visible.quality.unclassifiedAdmissions)} ingresos
                    necesitan clasificación.
                  </strong>
                  <span className="text-amber-100/70">
                    {" "}
                    Aún no se puede distinguir si fueron free o cobrados en
                    puerta.
                  </span>
                </p>
              </div>
              <button
                className="flex shrink-0 items-center gap-2 py-1 text-xs font-medium text-amber-100 underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-amber-200"
                onClick={() => setView("quality")}
              >
                Ver detalle
                <ArrowRight size={14} />
              </button>
            </div>
          )}
          <nav
            aria-label="Secciones del cierre"
            className="flex gap-1 overflow-x-auto border-b border-white/10 pb-1"
          >
            {views.map((item) => (
              <button
                key={item.key}
                type="button"
                aria-pressed={view === item.key}
                onClick={() => setView(item.key)}
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
              <Promoters key={visible.event.id} report={visible} />
            )}
            {view === "quality" && <Quality report={visible} />}
          </div>
          <footer className="flex flex-wrap justify-between gap-2 px-1 text-[11px] leading-5 text-neutral-500">
            <span>{formatLima(visible.event.starts_at)} · Horario de Lima</span>
            <span>
              Lectura: {formatLima(visible.generatedAt, true)} · El CSV conserva
              este corte
            </span>
          </footer>
        </>
      )}
    </div>
  );
}
