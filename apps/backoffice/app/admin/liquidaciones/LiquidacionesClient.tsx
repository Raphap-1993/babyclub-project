"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Banknote,
  Check,
  CheckCircle2,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  X,
} from "lucide-react";
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
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/ui";

type Option = { id: string; label: string; organizer_id?: string | null };

type SettlementCandidateItem = {
  source_type: "ticket" | "reservation" | "manual";
  source_id: string;
  event_id: string;
  promoter_id: string;
  attendee_name?: string | null;
  attendee_document?: string | null;
  access_kind?: string | null;
  reward_kind?: "cash" | "drink" | "mixed" | "manual";
  cash_amount_cents?: number;
  drink_units?: number;
  used_at?: string | null;
  metadata?: Record<string, unknown>;
};

type SettlementCandidate = {
  metric_version?: string;
  organizer_id?: string | null;
  event_id: string;
  event_name?: string | null;
  promoter_id: string;
  promoter_name?: string | null;
  promoter_code?: string | null;
  ticket_commission_count?: number;
  free_commission_count?: number;
  table_commission_count?: number;
  pending_settlement_item_count?: number;
  settled_item_count?: number;
  commission_amount_cents?: number;
  commission_amount_pen?: number;
  settlement_items?: SettlementCandidateItem[];
  data_quality_flags?: string | null;
};

type SettlementRecord = {
  id: string;
  event_name?: string | null;
  promoter_name?: string | null;
  promoter_code?: string | null;
  status: string;
  currency_code?: string | null;
  cash_total_cents: number;
  cash_units: number;
  drink_units: number;
  notes?: string | null;
  created_at?: string | null;
  settled_at?: string | null;
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

function centsToPen(value: unknown) {
  const cents = Number(value || 0);
  if (!Number.isFinite(cents)) return "0.00";
  return (cents / 100).toFixed(2);
}

function penToCents(value: string) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) return 0;
  return Math.round(numeric * 100);
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

function getCandidateItems(candidate: SettlementCandidate | null) {
  return Array.isArray(candidate?.settlement_items)
    ? candidate.settlement_items
    : [];
}

function getItemPromoterLinkCode(item: SettlementCandidateItem) {
  const rawValue = item.metadata?.promoter_link_code;
  return typeof rawValue === "string" ? rawValue.trim() : "";
}

function compactItemLabel(item: SettlementCandidateItem) {
  const name = item.attendee_name || item.attendee_document || item.source_id;
  const source =
    item.source_type === "reservation"
      ? "Reserva"
      : item.source_type === "ticket"
        ? "Ticket"
        : "Manual";
  return `${name} · ${source}`;
}

export default function LiquidacionesClient({ events, promoters }: Props) {
  const [settlements, setSettlements] = useState<SettlementRecord[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [candidateLoading, setCandidateLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [voidTarget, setVoidTarget] = useState<SettlementRecord | null>(null);
  const [voidConfirmStep, setVoidConfirmStep] = useState<1 | 2>(1);

  const [filterEventId, setFilterEventId] = useState("");
  const [filterPromoterId, setFilterPromoterId] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  const [eventId, setEventId] = useState("");
  const [promoterSearch, setPromoterSearch] = useState("");
  const [promoterId, setPromoterId] = useState("");
  const [candidate, setCandidate] = useState<SettlementCandidate | null>(null);
  const [cashTotalPen, setCashTotalPen] = useState("0.00");
  const [settlementStatus, setSettlementStatus] = useState("paid");
  const [notes, setNotes] = useState("");

  const selectedPromoter = useMemo(
    () => promoters.find((promoter) => promoter.id === promoterId) || null,
    [promoters, promoterId],
  );

  const filteredPromoters = useMemo(() => {
    const search = promoterSearch.trim().toLowerCase();
    return promoters
      .filter((promoter) => {
        if (!search) return true;
        return promoter.label.toLowerCase().includes(search);
      })
      .slice(0, 8);
  }, [promoters, promoterSearch]);

  const candidateItems = getCandidateItems(candidate);
  const canCreate =
    Boolean(candidate) &&
    candidateItems.length > 0 &&
    !saving &&
    !candidateLoading;

  const loadSettlements = async () => {
    setListLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (filterEventId) params.set("event_id", filterEventId);
      if (filterPromoterId) params.set("promoter_id", filterPromoterId);
      if (filterStatus) params.set("status", filterStatus);
      const res = await authedFetch(
        `/api/admin/promoter-settlements?${params.toString()}`,
        { cache: "no-store" as RequestCache },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || "No se pudo cargar liquidaciones");
      }
      setSettlements(Array.isArray(data?.settlements) ? data.settlements : []);
    } catch (err: any) {
      setSettlements([]);
      setError(err?.message || "Error cargando liquidaciones");
    } finally {
      setListLoading(false);
    }
  };

  useEffect(() => {
    void loadSettlements();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const resetCreateForm = () => {
    setEventId("");
    setPromoterSearch("");
    setPromoterId("");
    setCandidate(null);
    setCashTotalPen("0.00");
    setSettlementStatus("paid");
    setNotes("");
    setError(null);
  };

  const openCreate = () => {
    resetCreateForm();
    setCreateOpen(true);
  };

  const loadCandidate = async () => {
    if (!eventId || !promoterId) {
      setError("Selecciona un evento y un promotor para calcular pendientes.");
      return;
    }
    setCandidateLoading(true);
    setCandidate(null);
    setError(null);
    try {
      const params = new URLSearchParams({
        report: "promoter_settlement",
        format: "json",
        event_id: eventId,
        promoter_id: promoterId,
      });
      const res = await authedFetch(
        `/api/admin/reports/export?${params.toString()}`,
        { cache: "no-store" as RequestCache },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || "No se pudo calcular pendientes");
      }
      const row = Array.isArray(data?.rows)
        ? (data.rows.find(
            (item: SettlementCandidate) =>
              item.event_id === eventId && item.promoter_id === promoterId,
          ) as SettlementCandidate | undefined)
        : undefined;
      if (!row) {
        setCashTotalPen("0.00");
        setCandidate(null);
        setError("No hay pendientes liquidables para ese promotor y evento.");
        return;
      }
      setCandidate(row);
      setCashTotalPen(centsToPen(row.commission_amount_cents));
    } catch (err: any) {
      setError(err?.message || "Error calculando pendientes");
    } finally {
      setCandidateLoading(false);
    }
  };

  const createSettlement = async () => {
    if (!candidate) return;
    const items = getCandidateItems(candidate);
    if (items.length === 0) return;
    setSaving(true);
    setError(null);
    try {
      const res = await authedFetch("/api/admin/promoter-settlements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event_id: candidate.event_id,
          promoter_id: candidate.promoter_id,
          organizer_id: candidate.organizer_id || null,
          event_name: candidate.event_name || null,
          promoter_name: candidate.promoter_name || null,
          promoter_code: candidate.promoter_code || null,
          status: settlementStatus,
          currency_code: "PEN",
          cash_units: items.filter(
            (item) => Number(item.cash_amount_cents || 0) > 0,
          ).length,
          cash_total_cents: penToCents(cashTotalPen),
          drink_units: 0,
          notes,
          items,
          metadata: {
            source_report: "promoter_settlement",
            metric_version: candidate.metric_version || null,
            data_quality_flags: candidate.data_quality_flags || null,
          },
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || "No se pudo crear la liquidación");
      }
      setCreateOpen(false);
      resetCreateForm();
      await loadSettlements();
    } catch (err: any) {
      setError(err?.message || "Error creando liquidación");
    } finally {
      setSaving(false);
    }
  };

  const updateSettlementStatus = async (id: string, status: string) => {
    setSaving(true);
    setError(null);
    try {
      const res = await authedFetch(`/api/admin/promoter-settlements/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || "No se pudo actualizar");
      }
      await loadSettlements();
      return true;
    } catch (err: any) {
      setError(err?.message || "Error actualizando liquidación");
      return false;
    } finally {
      setSaving(false);
    }
  };

  const openVoidConfirm = (settlement: SettlementRecord) => {
    setVoidTarget(settlement);
    setVoidConfirmStep(1);
    setError(null);
  };

  const closeVoidConfirm = () => {
    setVoidTarget(null);
    setVoidConfirmStep(1);
  };

  const confirmVoidSettlement = async () => {
    if (!voidTarget) return;
    if (voidConfirmStep === 1) {
      setVoidConfirmStep(2);
      return;
    }
    const updated = await updateSettlementStatus(voidTarget.id, "void");
    if (updated) closeVoidConfirm();
  };

  return (
    <>
      <Card className="border-[#2b2b2b]">
        <CardHeader className="border-b border-[#252525] pb-3 pt-3">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <CardTitle className="text-base">
                Liquidaciones registradas
              </CardTitle>
              <CardDescription className="text-xs text-white/55">
                Grilla operativa para revisar liquidaciones creadas y cambiar
                estado.
              </CardDescription>
            </div>
            <Button type="button" size="sm" onClick={openCreate}>
              <Plus className="h-4 w-4" />
              Nueva liquidación
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 p-4">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[1fr_1fr_180px_auto]">
            <label className="space-y-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/55">
                Evento
              </span>
              <SelectNative
                value={filterEventId}
                onChange={(event) => setFilterEventId(event.target.value)}
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
                value={filterPromoterId}
                onChange={(event) => setFilterPromoterId(event.target.value)}
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
                value={filterStatus}
                onChange={(event) => setFilterStatus(event.target.value)}
              >
                {STATUS_OPTIONS.map((status) => (
                  <option key={status.value || "all"} value={status.value}>
                    {status.label}
                  </option>
                ))}
              </SelectNative>
            </label>
            <div className="flex items-end gap-2">
              <Button
                type="button"
                size="sm"
                onClick={loadSettlements}
                disabled={listLoading}
              >
                <Search className="h-4 w-4" />
                Consultar
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={loadSettlements}
                disabled={listLoading}
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {error ? <p className="text-sm text-red-300">{error}</p> : null}

          <Table
            containerClassName="max-h-[58dvh] min-h-[260px] overflow-auto"
            className="min-w-[920px]"
          >
            <TableHeader className="[&_th]:sticky [&_th]:top-0 [&_th]:z-[1] [&_th]:bg-[#111111]">
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Evento</TableHead>
                <TableHead>Promotor</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Items</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Acción</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {settlements.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="py-12 text-center text-white/55"
                  >
                    {listLoading
                      ? "Cargando liquidaciones..."
                      : "Aún no hay liquidaciones con los filtros actuales."}
                  </TableCell>
                </TableRow>
              ) : (
                settlements.map((settlement) => (
                  <TableRow key={settlement.id}>
                    <TableCell className="py-2.5 text-white/70">
                      {formatDate(settlement.created_at)}
                    </TableCell>
                    <TableCell className="py-2.5 text-white/85">
                      {settlement.event_name || "—"}
                    </TableCell>
                    <TableCell className="py-2.5">
                      <div className="font-medium text-white/90">
                        {settlement.promoter_name ||
                          settlement.promoter_code ||
                          "Promotor"}
                      </div>
                      <div className="text-xs text-white/45">
                        {settlement.promoter_code || "Sin código"}
                      </div>
                    </TableCell>
                    <TableCell className="py-2.5 text-white/80">
                      {formatStatus(settlement.status)}
                    </TableCell>
                    <TableCell className="py-2.5 text-white/75">
                      {settlement.cash_units.toLocaleString("es-PE")}
                    </TableCell>
                    <TableCell className="py-2.5 font-semibold text-white">
                      S/ {centsToPen(settlement.cash_total_cents)}
                    </TableCell>
                    <TableCell className="py-2.5">
                      <div className="flex items-center gap-1.5">
                        {settlement.status !== "paid" ? (
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            title="Marcar como pagado"
                            aria-label="Marcar como pagado"
                            onClick={() =>
                              updateSettlementStatus(settlement.id, "paid")
                            }
                            disabled={saving}
                          >
                            <CheckCircle2 className="h-4 w-4 text-emerald-300" />
                          </Button>
                        ) : null}
                        {settlement.status !== "void" ? (
                          <Button
                            type="button"
                            size="icon"
                            variant="danger"
                            title="Anular liquidación"
                            aria-label="Anular liquidación"
                            onClick={() => openVoidConfirm(settlement)}
                            disabled={saving}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        ) : null}
                        {settlement.status === "void" ? (
                          <span className="text-white/35">—</span>
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog
        open={createOpen}
        onOpenChange={(open) => {
          setCreateOpen(open);
          if (!open) resetCreateForm();
        }}
        className="max-w-5xl border-[#303030] bg-[#101010]"
      >
        <DialogHeader className="border-b border-[#252525]">
          <DialogTitle>Nueva liquidación</DialogTitle>
        </DialogHeader>
        <DialogContent className="max-h-[78dvh] overflow-y-auto space-y-4 text-white/80">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
            <div className="space-y-4">
              <div className="rounded-lg border border-[#303030] bg-[#121212] p-3">
                <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-white/55">
                  1. Selecciona origen
                </div>
                <label className="block space-y-1.5">
                  <span className="text-sm font-medium text-white/85">
                    Evento
                  </span>
                  <SelectNative
                    value={eventId}
                    onChange={(event) => {
                      setEventId(event.target.value);
                      setCandidate(null);
                    }}
                  >
                    <option value="">Selecciona evento</option>
                    {events.map((event) => (
                      <option key={event.id} value={event.id}>
                        {event.label}
                      </option>
                    ))}
                  </SelectNative>
                </label>
              </div>

              <div className="rounded-lg border border-[#303030] bg-[#121212] p-3">
                <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-white/55">
                  2. Busca promotor
                </div>
                <Input
                  value={promoterSearch}
                  onChange={(event) => {
                    setPromoterSearch(event.target.value);
                    setCandidate(null);
                  }}
                  placeholder="Nombre o código del promotor"
                />
                <div className="mt-3 max-h-60 space-y-2 overflow-auto">
                  {filteredPromoters.map((promoter) => (
                    <button
                      key={promoter.id}
                      type="button"
                      onClick={() => {
                        setPromoterId(promoter.id);
                        setPromoterSearch(promoter.label);
                        setCandidate(null);
                      }}
                      className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm transition ${
                        promoter.id === promoterId
                          ? "border-rose-500/70 bg-rose-500/15 text-white"
                          : "border-white/10 bg-black/20 text-white/75 hover:border-white/25"
                      }`}
                    >
                      <span className="truncate">{promoter.label}</span>
                      {promoter.id === promoterId ? (
                        <Check className="h-4 w-4 text-rose-300" />
                      ) : null}
                    </button>
                  ))}
                  {filteredPromoters.length === 0 ? (
                    <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-5 text-center text-sm text-white/45">
                      No hay promotores para esa búsqueda.
                    </div>
                  ) : null}
                </div>
                <Button
                  type="button"
                  className="mt-3 w-full"
                  onClick={loadCandidate}
                  disabled={!eventId || !promoterId || candidateLoading}
                >
                  <Banknote className="h-4 w-4" />
                  {candidateLoading ? "Calculando..." : "Calcular pendientes"}
                </Button>
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-lg border border-[#303030] bg-[#121212] p-3">
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/55">
                      3. Revisa y liquida
                    </div>
                    <div className="mt-1 text-sm text-white/60">
                      {selectedPromoter?.label || "Promotor no seleccionado"}
                    </div>
                  </div>
                  <div className="rounded-full border border-rose-500/30 bg-rose-500/10 px-3 py-1 text-sm font-semibold text-rose-200">
                    S/ {cashTotalPen}
                  </div>
                </div>

                {candidate ? (
                  <>
                    <div className="grid gap-2 sm:grid-cols-4">
                      <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-2">
                        <div className="text-[11px] uppercase tracking-[0.08em] text-white/45">
                          Entradas
                        </div>
                        <div className="text-lg font-semibold text-white">
                          {Number(
                            candidate.ticket_commission_count || 0,
                          ).toLocaleString("es-PE")}
                        </div>
                      </div>
                      <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-2">
                        <div className="text-[11px] uppercase tracking-[0.08em] text-white/45">
                          QR free
                        </div>
                        <div className="text-lg font-semibold text-white">
                          {Number(
                            candidate.free_commission_count || 0,
                          ).toLocaleString("es-PE")}
                        </div>
                      </div>
                      <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-2">
                        <div className="text-[11px] uppercase tracking-[0.08em] text-white/45">
                          Mesas
                        </div>
                        <div className="text-lg font-semibold text-white">
                          {Number(
                            candidate.table_commission_count || 0,
                          ).toLocaleString("es-PE")}
                        </div>
                      </div>
                      <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-2">
                        <div className="text-[11px] uppercase tracking-[0.08em] text-white/45">
                          Pendientes
                        </div>
                        <div className="text-lg font-semibold text-white">
                          {candidateItems.length.toLocaleString("es-PE")}
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <label className="space-y-1.5">
                        <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/55">
                          Total efectivo
                        </span>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={cashTotalPen}
                          onChange={(event) =>
                            setCashTotalPen(event.target.value)
                          }
                        />
                      </label>
                      <label className="space-y-1.5">
                        <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/55">
                          Estado inicial
                        </span>
                        <SelectNative
                          value={settlementStatus}
                          onChange={(event) =>
                            setSettlementStatus(event.target.value)
                          }
                        >
                          <option value="pending">Pendiente</option>
                          <option value="paid">Pagado</option>
                          <option value="delivered">Entregado</option>
                          <option value="closed">Cerrado</option>
                        </SelectNative>
                      </label>
                    </div>

                    <label className="mt-3 block space-y-1.5">
                      <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/55">
                        Nota interna
                      </span>
                      <textarea
                        value={notes}
                        onChange={(event) => setNotes(event.target.value)}
                        rows={3}
                        className="w-full rounded-lg border border-[#303030] bg-[#101010] px-3 py-2 text-sm text-white outline-none focus:border-[#505050]"
                      />
                    </label>
                  </>
                ) : (
                  <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-10 text-center text-sm text-white/45">
                    Selecciona evento y promotor para calcular pendientes.
                  </div>
                )}
              </div>

              <div className="rounded-lg border border-[#303030]">
                <div className="border-b border-[#252525] px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-white/55">
                  Items liquidables
                </div>
                <div className="max-h-64 overflow-auto">
                  {candidateItems.length === 0 ? (
                    <div className="px-3 py-8 text-center text-sm text-white/45">
                      No hay items cargados.
                    </div>
                  ) : (
                    candidateItems.map((item) => {
                      const promoterLinkCode = getItemPromoterLinkCode(item);
                      return (
                        <div
                          key={`${item.source_type}:${item.source_id}`}
                          className="grid gap-2 border-b border-white/5 px-3 py-2 text-xs text-white/70 last:border-b-0 sm:grid-cols-[1fr_90px]"
                        >
                          <div className="min-w-0">
                            <div className="truncate text-white/85">
                              {compactItemLabel(item)}
                            </div>
                            <div className="truncate text-white/45">
                              {item.access_kind || "sin tipo"}
                              {promoterLinkCode
                                ? ` · link ${promoterLinkCode}`
                                : ""}
                            </div>
                          </div>
                          <div className="font-medium text-white">
                            S/ {centsToPen(item.cash_amount_cents)}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
        <DialogFooter className="border-t border-[#252525]">
          <Button
            type="button"
            variant="ghost"
            onClick={() => setCreateOpen(false)}
            disabled={saving}
          >
            <X className="h-4 w-4" />
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={createSettlement}
            disabled={!canCreate}
          >
            <Check className="h-4 w-4" />
            {saving ? "Guardando..." : "Crear liquidación"}
          </Button>
        </DialogFooter>
      </Dialog>

      <Dialog
        open={Boolean(voidTarget)}
        onOpenChange={(open) => {
          if (!open) closeVoidConfirm();
        }}
        className="max-w-lg border-red-500/30 bg-[#101010]"
      >
        <DialogHeader className="border-b border-red-500/20">
          <DialogTitle>
            {voidConfirmStep === 1
              ? "Confirmar anulación"
              : "Última confirmación"}
          </DialogTitle>
        </DialogHeader>
        <DialogContent className="space-y-4 text-white/80">
          <div className="rounded-lg border border-red-500/25 bg-red-500/10 p-3">
            <div className="text-sm font-semibold text-red-100">
              {voidConfirmStep === 1
                ? "Esta acción anulará la liquidación seleccionada."
                : "La liquidación y sus items dejarán de contar como activos."}
            </div>
            <div className="mt-2 text-sm text-white/65">
              {voidTarget?.promoter_name ||
                voidTarget?.promoter_code ||
                "Promotor"}{" "}
              · {voidTarget?.event_name || "Evento"} · S/{" "}
              {centsToPen(voidTarget?.cash_total_cents)}
            </div>
          </div>
          <p className="text-sm text-white/60">
            {voidConfirmStep === 1
              ? "Primera confirmación: revisa que sea la liquidación correcta antes de continuar."
              : "Segunda confirmación: esta anulación queda registrada y libera los items para una nueva liquidación si corresponde."}
          </p>
        </DialogContent>
        <DialogFooter className="border-t border-[#252525]">
          <Button
            type="button"
            variant="ghost"
            onClick={closeVoidConfirm}
            disabled={saving}
          >
            <X className="h-4 w-4" />
            Cancelar
          </Button>
          <Button
            type="button"
            variant="danger"
            onClick={confirmVoidSettlement}
            disabled={saving}
          >
            <Trash2 className="h-4 w-4" />
            {voidConfirmStep === 1
              ? "Continuar"
              : saving
                ? "Anulando..."
                : "Sí, anular"}
          </Button>
        </DialogFooter>
      </Dialog>
    </>
  );
}
