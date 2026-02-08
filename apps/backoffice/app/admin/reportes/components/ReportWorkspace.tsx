"use client";

import { useMemo, useState } from "react";
import { Download, Search } from "lucide-react";
import { authedFetch } from "@/lib/authedFetch";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { SelectNative } from "@/components/ui/select-native";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type Option = { id: string; label: string; organizer_id?: string | null };

type ReportWorkspaceProps = {
  title: string;
  description: string;
  defaultReport: "promoter_performance" | "event_attendance" | "event_sales";
  allowReportSwitch?: boolean;
  organizers: Option[];
  events: Option[];
  promoters: Option[];
};

const REPORT_LABELS: Record<string, string> = {
  promoter_performance: "Rendimiento de promotores",
  event_attendance: "Asistencia por evento",
  event_sales: "Ventas por evento",
};

export default function ReportWorkspace({
  title,
  description,
  defaultReport,
  allowReportSwitch = false,
  organizers,
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
    () => (organizerId ? events.filter((event) => !event.organizer_id || event.organizer_id === organizerId) : events),
    [organizerId, events]
  );

  const filteredPromoters = useMemo(
    () => (organizerId ? promoters.filter((promoter) => !promoter.organizer_id || promoter.organizer_id === organizerId) : promoters),
    [organizerId, promoters]
  );

  const tableHeaders = useMemo(() => {
    if (rows.length === 0) return [] as string[];
    return Object.keys(rows[0]);
  }, [rows]);

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    params.set("report", report);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    if (organizerId) params.set("organizer_id", organizerId);
    if (eventId) params.set("event_id", eventId);
    if (promoterId && report === "promoter_performance") params.set("promoter_id", promoterId);
    return params.toString();
  }, [report, from, to, organizerId, eventId, promoterId]);

  const runReport = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await authedFetch(`/api/admin/reports/export?${queryString}&format=json`, { cache: "no-store" as RequestCache });
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
      const res = await authedFetch(`/api/admin/reports/export?${queryString}&format=csv`, { cache: "no-store" as RequestCache });
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
        <CardDescription className="text-xs text-white/55">{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 p-4">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
          {allowReportSwitch ? (
            <label className="space-y-1.5 xl:col-span-2">
              <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/55">Reporte</span>
              <SelectNative value={report} onChange={(e) => setReport(e.target.value as typeof report)}>
                <option value="promoter_performance">{REPORT_LABELS.promoter_performance}</option>
                <option value="event_attendance">{REPORT_LABELS.event_attendance}</option>
                <option value="event_sales">{REPORT_LABELS.event_sales}</option>
              </SelectNative>
            </label>
          ) : (
            <div className="xl:col-span-2">
              <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/55">Reporte</span>
              <div className="mt-1 rounded-lg border border-[#303030] bg-[#101010] px-3 py-2 text-sm text-white/80">
                {REPORT_LABELS[report]}
              </div>
            </div>
          )}

          <label className="space-y-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/55">Desde</span>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </label>
          <label className="space-y-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/55">Hasta</span>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </label>
          <label className="space-y-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/55">Organizador</span>
            <SelectNative
              value={organizerId}
              onChange={(e) => {
                setOrganizerId(e.target.value);
                setEventId("");
                setPromoterId("");
              }}
            >
              <option value="">Todos</option>
              {organizers.map((organizer) => (
                <option key={organizer.id} value={organizer.id}>
                  {organizer.label}
                </option>
              ))}
            </SelectNative>
          </label>
          <label className="space-y-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/55">Evento</span>
            <SelectNative value={eventId} onChange={(e) => setEventId(e.target.value)}>
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
              <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/55">Promotor</span>
              <SelectNative value={promoterId} onChange={(e) => setPromoterId(e.target.value)}>
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
          <div className="text-xs text-white/60">{rows.length} fila(s) cargadas</div>
          <div className="flex items-center gap-2">
            <Button type="button" size="sm" onClick={runReport} disabled={loading}>
              <Search className="h-4 w-4" />
              {loading ? "Consultando..." : "Consultar"}
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={exportCsv} disabled={exporting}>
              <Download className="h-4 w-4" />
              {exporting ? "Exportando..." : "Exportar CSV"}
            </Button>
          </div>
        </div>

        {error ? <p className="text-sm text-red-300">{error}</p> : null}

        <Table containerClassName="max-h-[55dvh] min-h-[220px]">
          <TableHeader className="[&_th]:sticky [&_th]:top-0 [&_th]:z-[1] [&_th]:bg-[#111111]">
            <TableRow>
              {tableHeaders.length === 0 ? <TableHead>Resultado</TableHead> : null}
              {tableHeaders.map((header) => (
                <TableHead key={header}>{header}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {tableHeaders.length === 0 ? (
              <TableRow>
                <TableCell className="py-10 text-center text-white/55">Ejecuta una consulta para ver resultados.</TableCell>
              </TableRow>
            ) : (
              rows.map((row, index) => (
                <TableRow key={`${index}-${String(row[tableHeaders[0]])}`}>
                  {tableHeaders.map((header) => (
                    <TableCell key={header} className="py-2.5 text-white/85">
                      {String(row[header] ?? "")}
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

