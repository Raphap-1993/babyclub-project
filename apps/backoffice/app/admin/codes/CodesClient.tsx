"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Layers3, Ticket, TicketSlash, Download, Filter, Search, Eye } from "lucide-react";
import { supabaseClient } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SelectNative } from "@/components/ui/select-native";
import { ScreenHeader } from "../components/ScreenHeader";
import { ExternalPagination } from "../components/ExternalPagination";

type Option = { id: string; name: string };

type CodeRow = {
  id: string;
  code: string;
  type: string;
  event_id: string;
  event_name?: string | null;
  promoter_id?: string | null;
  promoter_code?: string | null;
  promoter_name?: string | null;
  is_active: boolean;
  max_uses: number | null;
  uses: number | null;
  expires_at: string | null;
  created_at: string;
  batch_id: string | null;
};

type Filters = {
  event_id: string;
  type: string;
  promoter_id: string;
  status: "active" | "inactive" | "expired" | "all";
  batch_id: string;
  page: number;
  pageSize: number;
};

type ViewMode = "lots" | "codes";

const TYPE_OPTIONS = [
  { value: "courtesy", label: "Cortesía (promotores)" },
  { value: "promoter", label: "Promotor" },
];

const STATUS_OPTIONS = [
  { value: "active", label: "Activos" },
  { value: "inactive", label: "Inactivos" },
  { value: "expired", label: "Expirados" },
  { value: "all", label: "Todos" },
];

const PAGE_SIZES = [10, 20, 30, 50, 100];
const LOTS_MIN_PAGE_SIZE = 30;

async function getAuthHeaders(): Promise<Record<string, string>> {
  if (!supabaseClient) return {};
  const { data } = await supabaseClient.auth.getSession();
  const token = data?.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export default function CodesClient({ events, promoters }: { events: Option[]; promoters: Option[] }) {
  const [filters, setFilters] = useState<Filters>(() => ({
    event_id: events[0]?.id ?? "",
    type: "courtesy",
    promoter_id: "",
    status: "active",
    batch_id: "",
    page: 1,
    pageSize: 10,
  }));
  const [codes, setCodes] = useState<CodeRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedBatchId, setSelectedBatchId] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [deactivating, setDeactivating] = useState(false);
  const [generated, setGenerated] = useState<{ batchId: string; codes: string[] } | null>(null);
  const [lotDetailBatchId, setLotDetailBatchId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("lots");
  const [showGeneratedCodes, setShowGeneratedCodes] = useState(false);
  const [totalCodesInLots, setTotalCodesInLots] = useState(0);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / filters.pageSize)), [total, filters.pageSize]);
  const currentPage = Math.min(filters.page, totalPages);

  const groupedCodes = useMemo(() => {
    const map = new Map<string, CodeRow[]>();
    codes.forEach((c) => {
      const key = c.batch_id || "no-batch";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(c);
    });
    return Array.from(map.entries()).map(([batchId, list]) => ({
      batchId,
      codes: [...list].sort((a, b) => b.created_at.localeCompare(a.created_at)),
    }));
  }, [codes]);

  const quickCodes = useMemo(() => [...codes].sort((a, b) => b.created_at.localeCompare(a.created_at)), [codes]);
  const generatedCodesSet = useMemo(() => new Set(generated?.codes ?? []), [generated]);
  const pageSizeOptions = useMemo(
    () => (viewMode === "lots" ? [30, 50, 100, 200] : PAGE_SIZES),
    [viewMode]
  );
  const lotDetailGroup = useMemo(
    () => groupedCodes.find((group) => group.batchId === lotDetailBatchId) || null,
    [groupedCodes, lotDetailBatchId]
  );

  useEffect(() => {
    if (filters.page <= totalPages) return;
    setFilters((prev) => ({ ...prev, page: totalPages }));
  }, [filters.page, totalPages]);

  useEffect(() => {
    if (!filters.event_id) {
      setCodes([]);
      setTotal(0);
      return;
    }
    fetchCodes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    viewMode,
    filters.event_id,
    filters.type,
    filters.promoter_id,
    filters.status,
    filters.batch_id,
    filters.page,
    filters.pageSize,
  ]);

  useEffect(() => {
    if (viewMode !== "lots") return;
    if (filters.pageSize >= LOTS_MIN_PAGE_SIZE) return;
    setFilters((prev) => ({
      ...prev,
      pageSize: LOTS_MIN_PAGE_SIZE,
      page: 1,
    }));
  }, [viewMode, filters.pageSize]);

  const activeBatchId = filters.batch_id || selectedBatchId || generated?.batchId || "";

  async function fetchCodes() {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("event_id", filters.event_id);
      if (filters.type) params.set("type", filters.type);
      if (filters.promoter_id) params.set("promoter_id", filters.promoter_id);
      if (filters.status) params.set("status", filters.status);
      if (filters.batch_id) params.set("batch_id", filters.batch_id.trim());
      if (viewMode === "lots") params.set("view", "lots");
      params.set("page", String(filters.page));
      params.set("pageSize", String(filters.pageSize));

      const res = await fetch(`/api/codes/list?${params.toString()}`, {
        headers: await getAuthHeaders(),
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok || !payload?.success) {
        throw new Error(payload?.error || "No se pudieron cargar los códigos");
      }
      const fetchedCodes = payload.data || [];
      const fetchedTotal = payload.total || fetchedCodes.length || 0;
      setCodes(fetchedCodes);
      setTotal(fetchedTotal);
      setTotalCodesInLots(payload.total_codes || fetchedCodes.length || 0);
    } catch (err: any) {
      setError(err?.message || "Error al cargar códigos");
    } finally {
      setLoading(false);
    }
  }

  async function handleExport() {
    if (!filters.event_id) return;
    setExporting(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("event_id", filters.event_id);
      if (filters.type) params.set("type", filters.type);
      if (filters.promoter_id) params.set("promoter_id", filters.promoter_id);
      if (filters.status) params.set("status", filters.status);
      if (filters.batch_id) params.set("batch_id", filters.batch_id.trim());
      params.set("format", "csv");

      const res = await fetch(`/api/codes/list?${params.toString()}`, {
        headers: await getAuthHeaders(),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        throw new Error(payload?.error || "No se pudo exportar");
      }
      const csv = await res.text();
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `codes-${filters.event_id}.csv`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setError(err?.message || "Error al exportar");
    } finally {
      setExporting(false);
    }
  }

  async function handleDeactivate() {
    const batchId = activeBatchId.trim();
    if (!batchId) {
      setError("Selecciona un batch para desactivar");
      return;
    }
    setDeactivating(true);
    setError(null);
    try {
      const res = await fetch("/api/codes/batches/deactivate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(await getAuthHeaders()),
        },
        body: JSON.stringify({ batch_id: batchId }),
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok || !payload?.success) {
        throw new Error(payload?.error || "No se pudo desactivar el lote");
      }
      await fetchCodes();
    } catch (err: any) {
      setError(err?.message || "Error al desactivar lote");
    } finally {
      setDeactivating(false);
    }
  }

  async function handleDeleteBatch(batchId: string) {
    const id = batchId.trim();
    if (!id) {
      setError("Selecciona un batch para eliminar");
      return;
    }
    if (!window.confirm("¿Eliminar este lote y todos sus códigos? Esta acción es permanente.")) return;
    setDeleting(id);
    setError(null);
    try {
      const res = await fetch("/api/codes/batches/delete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(await getAuthHeaders()),
        },
        body: JSON.stringify({ batch_id: id }),
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok || !payload?.success) {
        throw new Error(payload?.error || "No se pudo eliminar el lote");
      }
      setSelectedBatchId("");
      setFilters((prev) => ({ ...prev, batch_id: "", page: 1 }));
      await fetchCodes();
    } catch (err: any) {
      setError(err?.message || "Error al eliminar lote");
    } finally {
      setDeleting(null);
    }
  }

  function onGenerated(batchId: string, codes: string[]) {
    setGenerated({ batchId, codes });
    setShowGeneratedCodes(false);
    setFilters((prev) => ({ ...prev, batch_id: batchId, page: 1 }));
    setSelectedBatchId(batchId);
  }

  function getCodeState(row: CodeRow) {
    const expired = row.expires_at ? new Date(row.expires_at) < new Date() : false;
    if (expired) return { label: "Expirado", className: "bg-rose-500/20 text-rose-200" };
    if (row.is_active) return { label: "Activo", className: "bg-[#e91e63]/15 text-[#e91e63]" };
    return { label: "Inactivo", className: "bg-white/5 text-white/70" };
  }

  const filteredPromoters = useMemo(() => {
    if (!filters.type) return [];
    return promoters;
  }, [promoters, filters.type]);

  return (
    <main className="space-y-4 lg:space-y-5">
      <ScreenHeader
        icon={TicketSlash}
        kicker="Codes Management"
        title="Códigos y Lotes"
        description={
          activeBatchId
            ? `Batch activo: ${activeBatchId}`
            : "Gestiona lotes, códigos de cortesía y activaciones por promotor."
        }
        actions={
          <>
            <Link
              href="/admin"
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-neutral-600 px-4 py-2 text-sm font-semibold text-neutral-200 transition-all hover:border-neutral-500 hover:bg-neutral-800"
            >
              ← Dashboard
            </Link>
            <Button
              onClick={() => setShowModal(true)}
              className="bg-gradient-to-r from-rose-500 to-pink-600 text-white hover:from-rose-400 hover:to-pink-500"
            >
              Generar lote
            </Button>
            <Button
              onClick={handleDeactivate}
              disabled={deactivating || !activeBatchId}
              variant="outline"
              className="border-neutral-600 text-neutral-200 hover:border-neutral-500 hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {deactivating ? "Desactivando..." : "Desactivar lote"}
            </Button>
            <Button
              onClick={handleExport}
              disabled={exporting || !filters.event_id}
              variant="outline"
              className="border-neutral-600 text-neutral-200 hover:border-neutral-500 hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Download className="h-4 w-4" />
              {exporting ? "Exportando..." : "Exportar"}
            </Button>
          </>
        }
      />

      <section className="space-y-3">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-5">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-neutral-300">Evento</label>
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
              <SelectNative
                value={filters.event_id}
                onChange={(e) => setFilters((prev) => ({ ...prev, event_id: e.target.value, page: 1 }))}
                className="h-10 pl-10 text-sm"
              >
                <option value="">Selecciona evento</option>
                {events.map((ev) => (
                  <option key={ev.id} value={ev.id}>
                    {ev.name}
                  </option>
                ))}
              </SelectNative>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-neutral-300">Tipo</label>
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
              <SelectNative
                value={filters.type}
                onChange={(e) => setFilters((prev) => ({ ...prev, type: e.target.value, page: 1 }))}
                className="h-10 pl-10 text-sm"
              >
                {TYPE_OPTIONS.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </SelectNative>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-neutral-300">Promotor</label>
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
              <SelectNative
                value={filters.promoter_id}
                onChange={(e) => setFilters((prev) => ({ ...prev, promoter_id: e.target.value, page: 1 }))}
                disabled={!filters.type}
                className="h-10 pl-10 text-sm disabled:cursor-not-allowed disabled:opacity-60"
              >
                <option value="">{filters.type ? "Selecciona promotor" : "No aplica"}</option>
                {filteredPromoters.map((pr) => (
                  <option key={pr.id} value={pr.id}>
                    {pr.name}
                  </option>
                ))}
              </SelectNative>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-neutral-300">Estado</label>
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
              <SelectNative
                value={filters.status}
                onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.value as Filters["status"], page: 1 }))}
                className="h-10 pl-10 text-sm"
              >
                {STATUS_OPTIONS.map((st) => (
                  <option key={st.value} value={st.value}>
                    {st.label}
                  </option>
                ))}
              </SelectNative>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-neutral-300">Batch ID</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
              <Input
                value={filters.batch_id}
                onChange={(e) => setFilters((prev) => ({ ...prev, batch_id: e.target.value, page: 1 }))}
                placeholder="Filtrar por batch"
                className="h-10 pl-10"
              />
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="rounded-lg border border-white/10 bg-black/40 px-3 py-1.5 text-xs text-white/75">
              {viewMode === "lots"
                ? `${total} lotes · ${totalCodesInLots} códigos · página ${currentPage}/${totalPages}`
                : `${total} códigos · página ${currentPage}/${totalPages}`}
            </span>
            {error ? (
              <span className="rounded-lg border border-red-500/30 bg-red-500/20 px-3 py-2 text-sm text-red-400">
                ⚠️ {error}
              </span>
            ) : null}
          </div>

          <div className="inline-flex rounded-xl border border-white/10 bg-black/30 p-1">
            <Button
              type="button"
              onClick={() => {
                setViewMode("lots");
                setFilters((prev) => ({ ...prev, page: 1 }));
              }}
              variant="ghost"
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                viewMode === "lots" ? "bg-[#e91e63]/20 text-[#ff77b6]" : "text-white/70 hover:text-white"
              }`}
            >
              <span className="inline-flex items-center gap-1.5">
                <Layers3 className="h-3.5 w-3.5" />
                Vista lotes
              </span>
            </Button>
            <Button
              type="button"
              onClick={() => {
                setViewMode("codes");
                setFilters((prev) => ({ ...prev, page: 1 }));
              }}
              variant="ghost"
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                viewMode === "codes" ? "bg-[#e91e63]/20 text-[#ff77b6]" : "text-white/70 hover:text-white"
              }`}
            >
              <span className="inline-flex items-center gap-1.5">
                <Ticket className="h-3.5 w-3.5" />
                Códigos rápidos
              </span>
            </Button>
          </div>
        </div>
      </section>

      <section className="overflow-x-hidden rounded-2xl border border-white/10 bg-[#0b0b0b]/75 p-3 shadow-[0_20px_70px_rgba(0,0,0,0.4)]">
        <div className="max-h-[calc(100vh-24rem)] overflow-y-auto pr-1">
          <div className="space-y-3">
        {loading && (
          <div className="rounded-2xl border border-white/10 bg-[#0c0c0c] p-6 text-center text-white/70 shadow-[0_20px_80px_rgba(0,0,0,0.45)]">
            Cargando códigos...
          </div>
        )}
        {!loading &&
          ((viewMode === "lots" && groupedCodes.length === 0) || (viewMode === "codes" && quickCodes.length === 0)) && (
          <div className="rounded-2xl border border-white/10 bg-[#0c0c0c] p-6 text-center text-white/70 shadow-[0_20px_80px_rgba(0,0,0,0.45)]">
            No hay códigos con los filtros actuales.
          </div>
          )}

        {!loading && viewMode === "lots" && (
          <div className="space-y-1.5">
            {groupedCodes.map((group) => {
              const sample = group.codes[0];
              const expiredCount = group.codes.filter((c) => c.expires_at && new Date(c.expires_at) < new Date()).length;
              const activeCount = group.codes.filter((c) => c.is_active && !(c.expires_at && new Date(c.expires_at) < new Date())).length;
              const totalUses = group.codes.reduce((acc, c) => acc + (c.uses ?? 0), 0);
              const totalMax = group.codes.reduce((acc, c) => acc + (c.max_uses ?? 1), 0);
              const lotLabel = sample.promoter_name || sample.event_name || sample.promoter_code || "Lote";
              const previewCodes = group.codes
                .slice(0, 3)
                .map((row) => row.code)
                .join(" · ");

              return (
                <div
                  key={group.batchId}
                  className="rounded-lg border border-white/10 bg-[#0c0c0c] px-3 py-2 shadow-[0_10px_30px_rgba(0,0,0,0.25)]"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-mono text-[14px] font-semibold text-white">{lotLabel}</span>
                        <span className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] uppercase tracking-wide text-white/55">
                          {group.batchId === "no-batch" ? "Sin batch" : "Lote"}
                        </span>
                        <span className="text-[11px] text-white/45">
                          A {activeCount}/{group.codes.length} · E {expiredCount}/{group.codes.length} · U {totalUses}/{totalMax}
                        </span>
                      </div>

                      <p className="truncate text-[11px] text-white/55">
                        Evento: {sample.event_name || "—"} · Promotor: {sample.promoter_name || sample.promoter_code || "—"} · Tipo:{" "}
                        {sample.type || "—"}
                      </p>
                      {previewCodes ? (
                        <p className="truncate font-mono text-[11px] text-white/45" title={previewCodes}>
                          {previewCodes}
                        </p>
                      ) : null}
                    </div>

                    <div className="flex items-center gap-1.5">
                      <Button
                        onClick={() => {
                          setSelectedBatchId(group.batchId === "no-batch" ? "" : group.batchId);
                          setLotDetailBatchId(group.batchId);
                        }}
                        variant="outline"
                        size="sm"
                        className="h-6 rounded-full border-white/20 px-2.5 py-0 text-[11px] font-semibold text-white/90 hover:border-white"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        Ver
                      </Button>
                      <Button
                        onClick={() => copyToClipboard(sample.code)}
                        variant="outline"
                        size="sm"
                        className="h-6 rounded-full border-white/20 px-2.5 py-0 text-[11px] font-semibold text-white/90 hover:border-white"
                      >
                        Copiar
                      </Button>
                      {group.batchId !== "no-batch" && (
                        <Button
                          onClick={() => handleDeleteBatch(group.batchId)}
                          disabled={deleting === group.batchId}
                          variant="danger"
                          size="sm"
                          className="h-6 rounded-full border-red-500/40 px-2.5 py-0 text-[11px] font-semibold text-red-200 hover:border-red-400 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {deleting === group.batchId ? "Elim..." : "Eliminar"}
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {!loading && viewMode === "codes" && (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {quickCodes.map((row) => {
              const status = getCodeState(row);
              const isNew = generatedCodesSet.has(row.code);
              return (
                <article
                  key={row.id}
                  className="rounded-2xl border border-white/10 bg-[#0c0c0c] p-3 shadow-[0_14px_42px_rgba(0,0,0,0.35)]"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${status.className}`}>{status.label}</span>
                    {isNew && (
                      <span className="rounded-full border border-[#e91e63]/40 bg-[#e91e63]/15 px-2.5 py-1 text-[11px] font-semibold text-[#ff77b6]">
                        Nuevo
                      </span>
                    )}
                  </div>

                  <p className="mt-2 truncate font-mono text-[15px] text-white" title={row.code}>
                    {row.code}
                  </p>
                  <p className="mt-1 truncate text-xs text-white/65">
                    {row.promoter_name || row.promoter_code || "Sin promotor"} · {row.event_name || "Sin evento"}
                  </p>

                  <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-white/60">
                    <span className="rounded-full border border-white/10 px-2.5 py-1">
                      Usos {row.uses ?? 0}/{row.max_uses ?? 1}
                    </span>
                    <span className="rounded-full border border-white/10 px-2.5 py-1">Creado {formatDate(row.created_at)}</span>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      onClick={() => copyToClipboard(row.code)}
                      variant="outline"
                      size="sm"
                      className="h-7 rounded-full border-white/15 px-3 py-1 text-xs font-semibold text-white/90 hover:border-white"
                    >
                      Copiar
                    </Button>
                    {row.batch_id && (
                      <Button
                        type="button"
                        onClick={() => {
                          setSelectedBatchId(row.batch_id || "");
                          setFilters((prev) => ({ ...prev, batch_id: row.batch_id || "", page: 1 }));
                          setViewMode("lots");
                        }}
                        variant="outline"
                        size="sm"
                        className="h-7 rounded-full border-[#e91e63]/45 px-3 py-1 text-xs font-semibold text-[#ff77b6] hover:border-[#ff77b6]"
                      >
                        Ver lote
                      </Button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
          </div>
        </div>

        <div className="mt-3 border-t border-white/10 pt-3">
          <ExternalPagination
            currentPage={currentPage}
            totalItems={total}
            itemsPerPage={filters.pageSize}
            onPageChange={(nextPage) => setFilters((prev) => ({ ...prev, page: nextPage }))}
            onPageSizeChange={(size) =>
              setFilters((prev) => ({
                ...prev,
                pageSize: viewMode === "lots" ? Math.max(size, LOTS_MIN_PAGE_SIZE) : size,
                page: 1,
              }))
            }
            itemLabel={viewMode === "lots" ? "lotes" : "códigos"}
            pageSizeOptions={pageSizeOptions}
          />
        </div>
      </section>

      {generated && (
        <div className="rounded-2xl border border-white/15 bg-[#0c0c0c] p-3 text-sm text-white/80">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.15em] text-white/60">Lote generado</p>
              <p className="font-semibold">Batch {generated.batchId}</p>
              <p className="text-xs text-white/55">{generated.codes.length} códigos generados</p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                onClick={() => copyToClipboard(generated.codes.join("\n"))}
                variant="outline"
                size="sm"
                className="h-7 rounded-full border-white/20 px-3 py-1 text-xs font-semibold text-white hover:border-white"
              >
                Copiar todo
              </Button>
              <Button
                onClick={() => {
                  setFilters((prev) => ({ ...prev, batch_id: generated.batchId, page: 1 }));
                  setSelectedBatchId(generated.batchId);
                }}
                variant="outline"
                size="sm"
                className="h-7 rounded-full border-[#e91e63]/50 px-3 py-1 text-xs font-semibold text-[#e91e63] hover:border-[#e91e63]"
              >
                Ver lote
              </Button>
              <Button
                onClick={() => setShowGeneratedCodes((prev) => !prev)}
                variant="outline"
                size="sm"
                className="h-7 rounded-full border-white/20 px-3 py-1 text-xs font-semibold text-white hover:border-white"
              >
                {showGeneratedCodes ? "Ocultar códigos" : "Ver códigos"}
              </Button>
            </div>
          </div>

          {showGeneratedCodes ? (
            <div className="mt-3 grid max-h-32 gap-2 overflow-y-auto pr-1 text-xs font-mono text-white/70 md:grid-cols-2 lg:grid-cols-3">
              {generated.codes.map((c) => (
                <span key={c} className="rounded-xl border border-white/10 bg-black/30 px-3 py-2">
                  {c}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      )}

      {lotDetailGroup ? (
        <LotDetailModal
          group={lotDetailGroup}
          onClose={() => setLotDetailBatchId(null)}
          onSelectBatch={(batchId) => {
            setSelectedBatchId(batchId);
            setFilters((prev) => ({ ...prev, batch_id: batchId, page: 1 }));
            setLotDetailBatchId(null);
          }}
        />
      ) : null}

      {showModal && (
        <GenerateBatchModal
          events={events}
          promoters={promoters}
          defaultEventId={filters.event_id}
          onClose={() => setShowModal(false)}
          onCreated={(batchId, list) => {
            setShowModal(false);
            onGenerated(batchId, list);
          }}
        />
      )}
    </main>
  );
}

function formatDate(dateString: string | null) {
  if (!dateString) return "—";
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("es-PE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

async function copyToClipboard(text: string) {
  if (navigator?.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
  }
}

function LotDetailModal({
  group,
  onClose,
  onSelectBatch,
}: {
  group: { batchId: string; codes: CodeRow[] };
  onClose: () => void;
  onSelectBatch: (batchId: string) => void;
}) {
  const sample = group.codes[0];
  const lotLabel = sample?.promoter_name || sample?.event_name || sample?.promoter_code || "Lote";
  const activeCount = group.codes.filter((row) => {
    const expired = row.expires_at ? new Date(row.expires_at) < new Date() : false;
    return row.is_active && !expired;
  }).length;
  const expiredCount = group.codes.filter((row) => (row.expires_at ? new Date(row.expires_at) < new Date() : false)).length;
  const totalUses = group.codes.reduce((acc, row) => acc + (row.uses ?? 0), 0);
  const totalMax = group.codes.reduce((acc, row) => acc + (row.max_uses ?? 1), 0);
  const isBatch = group.batchId !== "no-batch";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-5xl rounded-2xl border border-white/15 bg-[#0b0b0b] p-4 shadow-[0_24px_100px_rgba(0,0,0,0.55)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-white/10 pb-3">
          <div className="min-w-0 space-y-1">
            <p className="truncate font-mono text-lg font-semibold text-white">{lotLabel}</p>
            <p className="truncate text-xs text-white/55">
              Evento: {sample?.event_name || "—"} · Promotor: {sample?.promoter_name || sample?.promoter_code || "—"} · Tipo:{" "}
              {sample?.type || "—"}
            </p>
            <div className="flex flex-wrap items-center gap-2 text-xs text-white/70">
              <span className="rounded-full border border-white/15 px-2 py-1">Activos {activeCount}/{group.codes.length}</span>
              <span className="rounded-full border border-white/15 px-2 py-1">Expirados {expiredCount}/{group.codes.length}</span>
              <span className="rounded-full border border-white/15 px-2 py-1">Usos {totalUses}/{totalMax}</span>
              <span className="rounded-full border border-white/15 px-2 py-1 font-mono">
                {isBatch ? group.batchId : "sin-batch"}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isBatch ? (
              <Button
                type="button"
                onClick={() => onSelectBatch(group.batchId)}
                variant="outline"
                className="h-8 rounded-full border-[#e91e63]/45 px-3 text-xs font-semibold text-[#ff77b6] hover:border-[#ff77b6]"
              >
                Filtrar por lote
              </Button>
            ) : null}
            <Button
              type="button"
              onClick={onClose}
              variant="outline"
              className="h-8 rounded-full border-white/20 px-3 text-xs font-semibold text-white hover:border-white"
            >
              Cerrar
            </Button>
          </div>
        </div>

        <div className="mt-3 max-h-[62vh] overflow-y-auto pr-1">
          <div className="grid gap-2 md:grid-cols-2">
            {group.codes.map((row) => {
              const expired = row.expires_at ? new Date(row.expires_at) < new Date() : false;
              const isActive = row.is_active && !expired;
              const statusLabel = expired ? "Expirado" : isActive ? "Activo" : "Inactivo";
              const statusClass = expired
                ? "bg-rose-500/20 text-rose-200"
                : isActive
                  ? "bg-[#e91e63]/15 text-[#ff77b6]"
                  : "bg-white/10 text-white/70";

              return (
                <article
                  key={row.id}
                  className="rounded-xl border border-white/10 bg-[#0d0d0d] p-3 shadow-[0_10px_20px_rgba(0,0,0,0.25)]"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="truncate font-mono text-sm text-white" title={row.code}>
                      {row.code}
                    </p>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusClass}`}>{statusLabel}</span>
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-white/70">
                    <span className="rounded-full border border-white/15 px-2 py-0.5">Usos {row.uses ?? 0}/{row.max_uses ?? 1}</span>
                    <span className="rounded-full border border-white/15 px-2 py-0.5">Creado {formatDate(row.created_at)}</span>
                    <span className="rounded-full border border-white/15 px-2 py-0.5">
                      Expira {row.expires_at ? formatDate(row.expires_at) : "—"}
                    </span>
                  </div>

                  <div className="mt-2 flex justify-end">
                    <Button
                      type="button"
                      onClick={() => copyToClipboard(row.code)}
                      variant="outline"
                      size="sm"
                      className="h-7 rounded-full border-white/20 px-3 py-1 text-xs font-semibold text-white hover:border-white"
                    >
                      Copiar
                    </Button>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function GenerateBatchModal({
  events,
  promoters,
  defaultEventId,
  onClose,
  onCreated,
}: {
  events: Option[];
  promoters: Option[];
  defaultEventId: string;
  onClose: () => void;
  onCreated: (batchId: string, codes: string[]) => void;
}) {
  const [eventId, setEventId] = useState(defaultEventId);
  const [promoterId, setPromoterId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatedCodes, setGeneratedCodes] = useState<string[]>([]);
  const [batchId, setBatchId] = useState<string | null>(null);

  const filteredPromoters = useMemo(() => {
    return promoters;
  }, [promoters]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!eventId) {
      setError("Selecciona evento");
      return;
    }
    if (!promoterId) {
      setError("Selecciona promotor");
      return;
    }
    if (quantity < 1 || quantity > 500) {
      setError("Cantidad debe estar entre 1 y 500");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/codes/batches/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(await getAuthHeaders()),
        },
        body: JSON.stringify({
          event_id: eventId,
          promoter_id: promoterId || null,
          type: "promoter",
          quantity,
          expires_at: null,
          max_uses: 1,
          prefix: null,
          notes: notes || null,
        }),
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok || !payload?.success) {
        throw new Error(payload?.error || "No se pudo generar el lote");
      }
      setGeneratedCodes(payload.codes || []);
      setBatchId(payload.batch_id || null);
      onCreated(payload.batch_id, payload.codes || []);
    } catch (err: any) {
      setError(err?.message || "Error al generar lote");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-3xl rounded-3xl border border-white/15 bg-[#0b0b0b] p-6 shadow-[0_20px_80px_rgba(0,0,0,0.55)]">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-white/60">Nuevo lote</p>
            <h2 className="text-2xl font-semibold text-white">Generar códigos</h2>
            <p className="text-xs text-white/50">Expiran automáticamente 1 día después del evento y son de 1 uso.</p>
          </div>
          <Button onClick={onClose} variant="outline" size="sm" className="rounded-full border-white/15 text-white">
            Cerrar
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="flex flex-col gap-2">
              <label className="text-xs uppercase tracking-[0.15em] text-white/60">Evento</label>
              <SelectNative
                value={eventId}
                onChange={(e) => setEventId(e.target.value)}
                className="h-10 rounded-2xl border-white/15 bg-[#0a0a0a] text-sm text-white focus:border-white"
              >
                <option value="">Selecciona evento</option>
                {events.map((ev) => (
                  <option key={ev.id} value={ev.id}>
                    {ev.name}
                  </option>
                ))}
              </SelectNative>
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-xs uppercase tracking-[0.15em] text-white/60">Promotor</label>
              <SelectNative
                value={promoterId}
                onChange={(e) => setPromoterId(e.target.value)}
                className="h-10 rounded-2xl border-white/15 bg-[#0a0a0a] text-sm text-white focus:border-white"
              >
                <option value="">Selecciona promotor</option>
                {filteredPromoters.map((pr) => (
                  <option key={pr.id} value={pr.id}>
                    {pr.name}
                  </option>
                ))}
              </SelectNative>
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-xs uppercase tracking-[0.15em] text-white/60">Cantidad</label>
              <Input
                type="number"
                min={1}
                max={200}
                value={quantity}
                onChange={(e) => setQuantity(Number(e.target.value))}
                className="h-10 rounded-2xl border-white/15 bg-[#0a0a0a] text-sm text-white focus:border-white"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-xs uppercase tracking-[0.15em] text-white/60">Notas</label>
              <Input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Contexto interno"
                className="h-10 rounded-2xl border-white/15 bg-[#0a0a0a] text-sm text-white focus:border-white"
              />
            </div>
          </div>

          {error && <p className="text-sm text-red-300">{error}</p>}

          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="submit"
              disabled={submitting}
              className="rounded-full bg-gradient-to-r from-[#e91e63] to-[#ff77b6] text-sm font-semibold text-white transition hover:shadow-[0_12px_35px_rgba(233,30,99,0.35)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? "Generando..." : "Generar"}
            </Button>
            <Button
              type="button"
              onClick={onClose}
              variant="outline"
              className="rounded-full border-white/20 text-sm font-semibold text-white hover:border-white"
            >
              Cancelar
            </Button>
          </div>

          {batchId && generatedCodes.length > 0 && (
            <div className="mt-4 space-y-2 rounded-2xl border border-white/10 bg-black/40 p-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-white">Batch {batchId}</p>
                <Button
                  type="button"
                  onClick={() => copyToClipboard(generatedCodes.join("\n"))}
                  variant="outline"
                  size="sm"
                  className="h-7 rounded-full border-white/20 px-3 py-1 text-xs font-semibold text-white hover:border-white"
                >
                  Copiar todo
                </Button>
              </div>
              <div className="grid gap-2 text-xs font-mono text-white/70 md:grid-cols-2">
                {generatedCodes.map((c) => (
                  <span key={c} className="rounded-xl border border-white/10 bg-black/30 px-3 py-2">
                    {c}
                  </span>
                ))}
              </div>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
