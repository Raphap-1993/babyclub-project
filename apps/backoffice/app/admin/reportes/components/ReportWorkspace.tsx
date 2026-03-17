"use client";

import { useMemo, useState } from "react";
import { Download, Search } from "lucide-react";
import { authedFetch } from "@/lib/authedFetch";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { SelectNative } from "@/components/ui/select-native";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/ui";

type Option = { id: string; label: string; organizer_id?: string | null };

type ReportWorkspaceProps = {
  title: string;
  description: string;
  defaultReport:
    | "promoter_performance"
    | "event_attendance"
    | "free_qr_no_show";
  allowReportSwitch?: boolean;
  showDateRange?: boolean;
  events: Option[];
  promoters: Option[];
};

const REPORT_LABELS: Record<string, string> = {
  promoter_performance: "Rendimiento de promotores",
  event_attendance: "Asistencia por evento",
  free_qr_no_show: "No-show de QR free",
};

const HIDDEN_UI_COLUMNS = new Set([
  "organizer_id",
  "organizer_name",
  "event_id",
  "promoter_id",
  "total_amount_raw",
  "sales_source",
  "last_free_qr_status",
  "free_qr_assigned",
  "free_qr_attended",
  "free_qr_no_show",
  "no_show_rate_percent",
]);

const COLUMN_LABELS: Record<string, string> = {
  event_name: "Evento",
  promoter_code: "Código promotor",
  promoter_name: "Promotor",
  qrs_assigned: "QRs asignados",
  qrs_entered: "Ingresaron",
  attendance_rate_percent: "% de conversión",
  asistentes: "Asistentes",
  via_general: "Vía QR general",
  via_mesa: "Vía QR mesa",

  via_cortesia: "Vía promotor/cortesía",
  full_name: "Cliente",
  doc_type: "Tipo doc.",
  document: "Documento",
  phone: "Teléfono",
  free_qr_assigned: "QR asignado",
  free_qr_attended: "Asistió",
  free_qr_no_show: "No asistió",
  no_show_rate_percent: "% no-show",
  last_free_qr_event: "Evento",
  asistio: "Asistió",
  last_free_qr_status: "Estado último QR free",
  paid_count: "Ventas confirmadas",
  total_amount_pen_est: "Ventas (S/)",
  currency: "Moneda",
};

function prettifyHeader(header: string) {
  if (COLUMN_LABELS[header]) return COLUMN_LABELS[header];
  return header
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatReportValue(header: string, value: unknown) {
  if (value == null || value === "") return "—";
  if (
    [
      "qrs_assigned",
      "qrs_entered",
      "asistentes",
      "via_general",
      "via_mesa",
      "via_promotor",
      "free_qr_assigned",
      "free_qr_attended",
      "free_qr_no_show",
      "paid_count",
    ].includes(header)
  ) {
    return Number(value).toLocaleString("es-PE");
  }
  if (
    header === "attendance_rate_percent" ||
    header === "no_show_rate_percent"
  ) {
    const numeric = Number(value);
    return `${numeric.toLocaleString("es-PE", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}%`;
  }
  if (header === "total_amount_pen_est") {
    const numeric = Number(value);
    return `S/ ${numeric.toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  return String(value);
}

export default function ReportWorkspace({
  title,
  description,
  defaultReport,
  allowReportSwitch = false,
  showDateRange = false,
  events,
  promoters,
}: ReportWorkspaceProps) {
  const [report, setReport] = useState(defaultReport);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [organizerId, setOrganizerId] = useState("");
  const [eventId, setEventId] = useState("");
  const [promoterId, setPromoterId] = useState("");
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [error, setError] = useState<string | null>(null);

  const filteredEvents = useMemo(
    () =>
      organizerId
        ? events.filter(
            (event) =>
              !event.organizer_id || event.organizer_id === organizerId,
          )
        : events,
    [organizerId, events],
  );

  const filteredPromoters = useMemo(
    () =>
      organizerId
        ? promoters.filter(
            (promoter) =>
              !promoter.organizer_id || promoter.organizer_id === organizerId,
          )
        : promoters,
    [organizerId, promoters],
  );

  const tableHeaders = useMemo(() => {
    if (rows.length === 0) return [] as string[];
    return Object.keys(rows[0]);
  }, [rows]);

  const visibleHeaders = useMemo(
    () => tableHeaders.filter((header) => !HIDDEN_UI_COLUMNS.has(header)),
    [tableHeaders],
  );

  const attendanceSummary = useMemo(() => {
    if (report !== "event_attendance" || rows.length === 0) return null;
    const total = (key: string) =>
      rows.reduce(
        (acc, row) =>
          acc + Number((row?.[key] as number | string | null | undefined) || 0),
        0,
      );
    return {
      asistentes: total("asistentes"),

      viaCortesia: total("via_cortesia"),
      viaGeneral: total("via_general"),
    };
  }, [report, rows]);

  const freeQrNoShowSummary = useMemo(() => {
    if (report !== "free_qr_no_show" || rows.length === 0) return null;
    const total = (key: string) =>
      rows.reduce(
        (acc, row) =>
          acc + Number((row?.[key] as number | string | null | undefined) || 0),
        0,
      );
    return {
      qrsFreeAsignados: total("free_qr_assigned"),
      asistieron: total("free_qr_attended"),
      noShow: total("free_qr_no_show"),
    };
  }, [report, rows]);

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    params.set("report", report);
    if (showDateRange && from) params.set("from", from);
    if (showDateRange && to) params.set("to", to);
    if (organizerId) params.set("organizer_id", organizerId);
    if (eventId) params.set("event_id", eventId);
    if (promoterId && report === "promoter_performance")
      params.set("promoter_id", promoterId);
    return params.toString();
  }, [report, from, to, organizerId, eventId, promoterId, showDateRange]);

  const runReport = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await authedFetch(
        `/api/admin/reports/export?${queryString}&format=json`,
        { cache: "no-store" as RequestCache },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || "No se pudo generar el reporte");
      }
      setRows(Array.isArray(data?.rows) ? data.rows : []);
    } catch (err: any) {
      setRows([]);
      setError(err?.message || "Error inesperado");
    } finally {
      setLoading(false);
    }
  };

  const exportCsv = async () => {
    setExporting(true);
    setError(null);
    try {
      const res = await authedFetch(
        `/api/admin/reports/export?${queryString}&format=csv`,
        { cache: "no-store" as RequestCache },
      );
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload?.error || "No se pudo exportar");
      }
      const blob = await res.blob();
      const contentDisposition = res.headers.get("content-disposition") || "";
      const fileMatch = contentDisposition.match(/filename=\"?([^"]+)\"?/i);
      const filename = fileMatch?.[1] || `report-${report}.csv`;
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setError(err?.message || "Error exportando");
    } finally {
      setExporting(false);
    }
  };

  return (
    <Card className="border-[#2b2b2b]">
      <CardHeader className="border-b border-[#252525] pb-3 pt-3">
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription className="text-xs text-white/55">
          {description}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 p-4">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
          {allowReportSwitch ? (
            <label className="space-y-1.5 xl:col-span-2">
              <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/55">
                Reporte
              </span>
              <SelectNative
                value={report}
                onChange={(e) => setReport(e.target.value as typeof report)}
              >
                <option value="promoter_performance">
                  {REPORT_LABELS.promoter_performance}
                </option>
                <option value="event_attendance">
                  {REPORT_LABELS.event_attendance}
                </option>
                <option value="free_qr_no_show">
                  {REPORT_LABELS.free_qr_no_show}
                </option>
              </SelectNative>
            </label>
          ) : (
            <div className="xl:col-span-2">
              <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/55">
                Reporte
              </span>
              <div className="mt-1 rounded-lg border border-[#303030] bg-[#101010] px-3 py-2 text-sm text-white/80">
                {REPORT_LABELS[report]}
              </div>
            </div>
          )}

          {showDateRange ? (
            <>
              <label className="space-y-1.5">
                <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/55">
                  Desde
                </span>
                <Input
                  type="date"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/55">
                  Hasta
                </span>
                <Input
                  type="date"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                />
              </label>
            </>
          ) : null}
          <label className="space-y-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/55">
              Evento
            </span>
            <SelectNative
              value={eventId}
              onChange={(e) => setEventId(e.target.value)}
            >
              <option value="">Todos</option>
              {filteredEvents.map((event) => (
                <option key={event.id} value={event.id}>
                  {event.label}
                </option>
              ))}
            </SelectNative>
          </label>
          {report === "promoter_performance" ? (
            <label className="space-y-1.5 xl:col-span-2">
              <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/55">
                Promotor
              </span>
              <SelectNative
                value={promoterId}
                onChange={(e) => setPromoterId(e.target.value)}
              >
                <option value="">Todos</option>
                {filteredPromoters.map((promoter) => (
                  <option key={promoter.id} value={promoter.id}>
                    {promoter.label}
                  </option>
                ))}
              </SelectNative>
            </label>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-xs text-white/60">
            Resultados cargados: {rows.length}
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              onClick={runReport}
              disabled={loading}
            >
              <Search className="h-4 w-4" />
              {loading ? "Consultando..." : "Consultar"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={exportCsv}
              disabled={exporting}
            >
              <Download className="h-4 w-4" />
              {exporting ? "Exportando..." : "Exportar CSV"}
            </Button>
          </div>
        </div>

        {error ? <p className="text-sm text-red-300">{error}</p> : null}

        {report === "event_attendance" ? (
          <div className="rounded-lg border border-[#303030] bg-[#121212] px-3 py-2 text-xs text-white/70">
            <strong className="text-white/90">Cómo leer este reporte:</strong>{" "}
            <span>
              Todas las columnas muestran <strong>personas únicas</strong>, no
              escaneos. <strong>Asistentes</strong> = total de personas que
              ingresaron al evento. <strong>Vía QR promotor</strong> = personas
              cuyo ticket tenía un promotor asociado.{" "}
              <strong>Vía promotor/cortesía</strong> = personas que ingresaron
              con un QR de cortesía o free (distribuidos por promotores).{" "}
              <strong>Vía QR mesa</strong> = personas con reserva de mesa.{" "}
              <strong>Vía QR general</strong> = compras directas sin promotor ni
              beneficio especial.
            </span>
          </div>
        ) : null}

        {report === "free_qr_no_show" ? (
          <div className="rounded-lg border border-[#303030] bg-[#121212] px-3 py-2 text-xs text-white/70">
            <strong className="text-white/90">Cómo leer este reporte:</strong>{" "}
            <span>
              <strong>QR free asignados</strong> = tickets free/cortesía de
              eventos ya ocurridos. <strong>Asistió</strong> = tickets con
              `used = true`. <strong>No asistió</strong> = tickets free de
              eventos pasados que nunca fueron usados.{" "}
              <strong>Bloquear siguiente QR free</strong> sigue una regla
              estricta en esta primera versión: si la persona tiene al menos un
              no-show histórico, queda marcada para revisión o bloqueo manual.
            </span>
          </div>
        ) : null}

        {attendanceSummary ? (
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-lg border border-[#303030] bg-[#121212] px-3 py-2">
              <div className="text-[11px] uppercase tracking-[0.08em] text-white/60">
                Asistentes totales
              </div>
              <div className="text-lg font-semibold text-white">
                {attendanceSummary.asistentes.toLocaleString("es-PE")}
              </div>
            </div>
            <div className="rounded-lg border border-[#303030] bg-[#121212] px-3 py-2">
              <div className="text-[11px] uppercase tracking-[0.08em] text-white/60">
                Vía promotor/cortesía
              </div>
              <div className="text-lg font-semibold text-white">
                {attendanceSummary.viaCortesia.toLocaleString("es-PE")}
              </div>
            </div>
            <div className="rounded-lg border border-[#303030] bg-[#121212] px-3 py-2">
              <div className="text-[11px] uppercase tracking-[0.08em] text-white/60">
                Vía QR general
              </div>
              <div className="text-lg font-semibold text-white">
                {attendanceSummary.viaGeneral.toLocaleString("es-PE")}
              </div>
            </div>
          </div>
        ) : null}

        {freeQrNoShowSummary ? (
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-lg border border-[#303030] bg-[#121212] px-3 py-2">
              <div className="text-[11px] uppercase tracking-[0.08em] text-white/60">
                QR free asignados
              </div>
              <div className="text-lg font-semibold text-white">
                {freeQrNoShowSummary.qrsFreeAsignados.toLocaleString("es-PE")}
              </div>
            </div>
            <div className="rounded-lg border border-[#303030] bg-[#121212] px-3 py-2">
              <div className="text-[11px] uppercase tracking-[0.08em] text-white/60">
                Asistieron
              </div>
              <div className="text-lg font-semibold text-white">
                {freeQrNoShowSummary.asistieron.toLocaleString("es-PE")}
              </div>
            </div>
            <div className="rounded-lg border border-[#303030] bg-[#121212] px-3 py-2">
              <div className="text-[11px] uppercase tracking-[0.08em] text-white/60">
                No-show
              </div>
              <div className="text-lg font-semibold text-white">
                {freeQrNoShowSummary.noShow.toLocaleString("es-PE")}
              </div>
            </div>
          </div>
        ) : null}

        {report === "promoter_performance" ? (
          <div className="rounded-lg border border-[#303030] bg-[#121212] px-3 py-2 text-xs text-white/70">
            <strong className="text-white/90">Cómo leer este reporte:</strong>{" "}
            <span>
              <strong>QRs asignados</strong> = tickets activos del promotor para
              el evento. <strong>Ingresaron</strong> = tickets marcados como
              usados en puerta. <strong>% de conversión</strong> = ingresaron /
              QRs asignados.
            </span>
          </div>
        ) : null}


        <Table containerClassName="max-h-[55dvh] min-h-[220px] overflow-y-auto" className="min-w-[640px]">
          <TableHeader className="[&_th]:sticky [&_th]:top-0 [&_th]:z-[1] [&_th]:bg-[#111111]">
            <TableRow>
              {visibleHeaders.length === 0 ? (
                <TableHead>Resultado</TableHead>
              ) : null}
              {visibleHeaders.map((header) => (
                <TableHead key={header}>{prettifyHeader(header)}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibleHeaders.length === 0 ? (
              <TableRow>
                <TableCell className="py-10 text-center text-white/55">
                  Ejecuta una consulta para ver resultados.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row, index) => (
                <TableRow key={`${index}-${String(row[visibleHeaders[0]])}`}>
                  {visibleHeaders.map((header) => (
                    <TableCell key={header} className="py-2.5 text-white/85">
                      {formatReportValue(header, row[header])}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
