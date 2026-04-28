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

type SettlementRecord = {
  id: string;
  event_id?: string | null;
  event_name?: string | null;
  promoter_id?: string | null;
  promoter_name?: string | null;
  promoter_code?: string | null;
  status: string;
  cash_total_cents: number;
  cash_units: number;
  drink_units: number;
  created_at?: string | null;
  settled_at?: string | null;
};

type SummaryRow = {
  key: string;
  eventName: string;
  promoterName: string;
  count: number;
  pendingCents: number;
  paidCents: number;
  voidCents: number;
  activeCents: number;
};

type Props = {
  events: Option[];
  promoters: Option[];
};

const STATUS_OPTIONS = [
  { value: "", label: "Todos" },
  { value: "pending", label: "Pendiente" },
  { value: "paid", label: "Pagado" },
  { value: "delivered", label: "Entregado" },
  { value: "closed", label: "Cerrado" },
  { value: "void", label: "Anulado" },
];

const SETTLED_STATUSES = new Set(["paid", "delivered", "closed"]);
const PENDING_STATUSES = new Set(["draft", "pending"]);

function centsToPen(value: unknown) {
  const cents = Number(value || 0);
  if (!Number.isFinite(cents)) return "0.00";
  return (cents / 100).toFixed(2);
}

function formatMoney(cents: number) {
  return `S/ ${centsToPen(cents)}`;
}

function formatStatus(status: string) {
  const labels: Record<string, string> = {
    draft: "Borrador",
    pending: "Pendiente",
    paid: "Pagado",
    delivered: "Entregado",
    closed: "Cerrado",
    void: "Anulado",
  };
  return labels[status] || status;
}

function formatDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("es-PE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function csvEscape(value: unknown) {
  const raw = String(value ?? "");
  return `"${raw.replace(/"/g, '""')}"`;
}

function downloadCsv(filename: string, rows: SettlementRecord[]) {
  const headers = [
    "Fecha",
    "Evento",
    "Promotor",
    "Codigo",
    "Estado",
    "Items",
    "Total",
    "Liquidado en",
  ];
  const body = rows.map((row) => [
    formatDate(row.created_at),
    row.event_name || "",
    row.promoter_name || "",
    row.promoter_code || "",
    formatStatus(row.status),
    row.cash_units,
    centsToPen(row.cash_total_cents),
    formatDate(row.settled_at),
  ]);
  const csv = [headers, ...body]
    .map((row) => row.map(csvEscape).join(","))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export default function LiquidacionesReportClient({
  events,
  promoters,
}: Props) {
  const [eventId, setEventId] = useState("");
  const [promoterId, setPromoterId] = useState("");
  const [status, setStatus] = useState("");
  const [rows, setRows] = useState<SettlementRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totals = useMemo(() => {
    return rows.reduce(
      (acc, row) => {
        const cents = Number(row.cash_total_cents || 0);
        acc.count += 1;
        acc.items += Number(row.cash_units || 0);
        if (row.status === "void") {
          acc.voidCents += cents;
        } else if (SETTLED_STATUSES.has(row.status)) {
          acc.paidCents += cents;
        } else if (PENDING_STATUSES.has(row.status)) {
          acc.pendingCents += cents;
        }
        return acc;
      },
      { count: 0, items: 0, paidCents: 0, pendingCents: 0, voidCents: 0 },
    );
  }, [rows]);

  const summaryRows = useMemo(() => {
    const summary = new Map<string, SummaryRow>();
    for (const row of rows) {
      const key = `${row.event_id || row.event_name}:${row.promoter_id || row.promoter_code}`;
      if (!summary.has(key)) {
        summary.set(key, {
          key,
          eventName: row.event_name || "Sin evento",
          promoterName:
            row.promoter_name || row.promoter_code || "Sin promotor",
          count: 0,
          pendingCents: 0,
          paidCents: 0,
          voidCents: 0,
          activeCents: 0,
        });
      }
      const target = summary.get(key)!;
      const cents = Number(row.cash_total_cents || 0);
      target.count += 1;
      if (row.status === "void") {
        target.voidCents += cents;
      } else {
        target.activeCents += cents;
      }
      if (SETTLED_STATUSES.has(row.status)) target.paidCents += cents;
      if (PENDING_STATUSES.has(row.status)) target.pendingCents += cents;
    }
    return Array.from(summary.values()).sort((a, b) => {
      if (a.eventName !== b.eventName)
        return a.eventName.localeCompare(b.eventName);
      return a.promoterName.localeCompare(b.promoterName);
    });
  }, [rows]);

  const loadReport = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        include_void: "true",
        limit: "1000",
      });
      if (eventId) params.set("event_id", eventId);
      if (promoterId) params.set("promoter_id", promoterId);
      if (status) params.set("status", status);
      const res = await authedFetch(
        `/api/admin/promoter-settlements?${params.toString()}`,
        { cache: "no-store" as RequestCache },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || "No se pudo cargar el reporte");
      }
      setRows(Array.isArray(data?.settlements) ? data.settlements : []);
    } catch (err: any) {
      setRows([]);
      setError(err?.message || "Error cargando reporte");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="border-[#2b2b2b]">
      <CardHeader className="border-b border-[#252525] pb-3 pt-3">
        <CardTitle className="text-base">
          Consolidado de liquidaciones
        </CardTitle>
        <CardDescription className="text-xs text-white/55">
          Resume importes pagados, pendientes y anulados desde el ledger de
          liquidaciones.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 p-4">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[1fr_1fr_180px_auto]">
          <label className="space-y-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/55">
              Evento
            </span>
            <SelectNative
              value={eventId}
              onChange={(event) => setEventId(event.target.value)}
            >
              <option value="">Todos</option>
              {events.map((event) => (
                <option key={event.id} value={event.id}>
                  {event.label}
                </option>
              ))}
            </SelectNative>
          </label>
          <label className="space-y-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/55">
              Promotor
            </span>
            <SelectNative
              value={promoterId}
              onChange={(event) => setPromoterId(event.target.value)}
            >
              <option value="">Todos</option>
              {promoters.map((promoter) => (
                <option key={promoter.id} value={promoter.id}>
                  {promoter.label}
                </option>
              ))}
            </SelectNative>
          </label>
          <label className="space-y-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/55">
              Estado
            </span>
            <SelectNative
              value={status}
              onChange={(event) => setStatus(event.target.value)}
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value || "all"} value={option.value}>
                  {option.label}
                </option>
              ))}
            </SelectNative>
          </label>
          <div className="flex items-end gap-2">
            <Button
              type="button"
              size="sm"
              onClick={loadReport}
              disabled={loading}
            >
              <Search className="h-4 w-4" />
              {loading ? "Consultando..." : "Consultar"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() =>
                downloadCsv("reporte-liquidaciones-promotores.csv", rows)
              }
              disabled={rows.length === 0}
            >
              <Download className="h-4 w-4" />
              CSV
            </Button>
          </div>
        </div>

        {error ? <p className="text-sm text-red-300">{error}</p> : null}

        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-lg border border-[#303030] bg-[#121212] px-3 py-2">
            <div className="text-[11px] uppercase tracking-[0.08em] text-white/60">
              Liquidaciones
            </div>
            <div className="text-lg font-semibold text-white">
              {totals.count.toLocaleString("es-PE")}
            </div>
          </div>
          <div className="rounded-lg border border-[#303030] bg-[#121212] px-3 py-2">
            <div className="text-[11px] uppercase tracking-[0.08em] text-white/60">
              Pagado / cerrado
            </div>
            <div className="text-lg font-semibold text-white">
              {formatMoney(totals.paidCents)}
            </div>
          </div>
          <div className="rounded-lg border border-[#303030] bg-[#121212] px-3 py-2">
            <div className="text-[11px] uppercase tracking-[0.08em] text-white/60">
              Pendiente
            </div>
            <div className="text-lg font-semibold text-white">
              {formatMoney(totals.pendingCents)}
            </div>
          </div>
          <div className="rounded-lg border border-[#303030] bg-[#121212] px-3 py-2">
            <div className="text-[11px] uppercase tracking-[0.08em] text-white/60">
              Anulado
            </div>
            <div className="text-lg font-semibold text-white">
              {formatMoney(totals.voidCents)}
            </div>
          </div>
        </div>

        <section className="space-y-2">
          <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/55">
            Resumen por evento y promotor
          </div>
          <Table
            containerClassName="max-h-72 overflow-auto"
            className="min-w-[780px]"
          >
            <TableHeader className="[&_th]:sticky [&_th]:top-0 [&_th]:z-[1] [&_th]:bg-[#111111]">
              <TableRow>
                <TableHead>Evento</TableHead>
                <TableHead>Promotor</TableHead>
                <TableHead>Liquidaciones</TableHead>
                <TableHead>Pendiente</TableHead>
                <TableHead>Pagado</TableHead>
                <TableHead>Anulado</TableHead>
                <TableHead>Total activo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {summaryRows.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="py-8 text-center text-white/55"
                  >
                    Ejecuta una consulta para ver el consolidado.
                  </TableCell>
                </TableRow>
              ) : (
                summaryRows.map((row) => (
                  <TableRow key={row.key}>
                    <TableCell className="py-2.5 text-white/85">
                      {row.eventName}
                    </TableCell>
                    <TableCell className="py-2.5 text-white/85">
                      {row.promoterName}
                    </TableCell>
                    <TableCell className="py-2.5 text-white/70">
                      {row.count.toLocaleString("es-PE")}
                    </TableCell>
                    <TableCell className="py-2.5 text-white/70">
                      {formatMoney(row.pendingCents)}
                    </TableCell>
                    <TableCell className="py-2.5 text-white/70">
                      {formatMoney(row.paidCents)}
                    </TableCell>
                    <TableCell className="py-2.5 text-white/70">
                      {formatMoney(row.voidCents)}
                    </TableCell>
                    <TableCell className="py-2.5 font-semibold text-white">
                      {formatMoney(row.activeCents)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </section>

        <section className="space-y-2">
          <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/55">
            Detalle
          </div>
          <Table
            containerClassName="max-h-[52dvh] min-h-[240px] overflow-auto"
            className="min-w-[900px]"
          >
            <TableHeader className="[&_th]:sticky [&_th]:top-0 [&_th]:z-[1] [&_th]:bg-[#111111]">
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Evento</TableHead>
                <TableHead>Promotor</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Items</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Liquidado en</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="py-10 text-center text-white/55"
                  >
                    {loading
                      ? "Cargando liquidaciones..."
                      : "Ejecuta una consulta para ver resultados."}
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="py-2.5 text-white/70">
                      {formatDate(row.created_at)}
                    </TableCell>
                    <TableCell className="py-2.5 text-white/85">
                      {row.event_name || "—"}
                    </TableCell>
                    <TableCell className="py-2.5 text-white/85">
                      {row.promoter_name || row.promoter_code || "—"}
                    </TableCell>
                    <TableCell className="py-2.5 text-white/75">
                      {formatStatus(row.status)}
                    </TableCell>
                    <TableCell className="py-2.5 text-white/70">
                      {Number(row.cash_units || 0).toLocaleString("es-PE")}
                    </TableCell>
                    <TableCell className="py-2.5 font-semibold text-white">
                      {formatMoney(Number(row.cash_total_cents || 0))}
                    </TableCell>
                    <TableCell className="py-2.5 text-white/70">
                      {formatDate(row.settled_at)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </section>
      </CardContent>
    </Card>
  );
}
