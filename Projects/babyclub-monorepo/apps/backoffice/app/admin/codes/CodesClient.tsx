"use client";

import { useEffect, useMemo, useState } from "react";
import { supabaseClient } from "@/lib/supabaseClient";
import DatePickerSimple from "@/components/ui/DatePickerSimple";

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
  start_date: string;
  end_date: string;
  page: number;
  pageSize: number;
};

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

const PAGE_SIZES = [10, 20, 50, 100, 200];

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
    start_date: "",
    end_date: "",
    page: 1,
    pageSize: 20,
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
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState<string | null>(null);

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

  useEffect(() => {
    if (!filters.event_id) {
      setCodes([]);
      setTotal(0);
      return;
    }
    fetchCodes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    filters.event_id,
    filters.type,
    filters.promoter_id,
    filters.status,
    filters.batch_id,
    filters.start_date,
    filters.end_date,
    filters.page,
    filters.pageSize,
  ]);

  const activeBatchId = filters.batch_id || selectedBatchId || generated?.batchId || "";
  useEffect(() => {
    if (activeBatchId) {
      setExpanded((prev) => {
        if (prev.has(activeBatchId)) return prev;
        const next = new Set(prev);
        next.add(activeBatchId);
        return next;
      });
    }
  }, [activeBatchId]);

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
      if (filters.start_date) params.set("start_date", filters.start_date);
      if (filters.end_date) params.set("end_date", filters.end_date);
      params.set("page", String(filters.page));
      params.set("pageSize", String(filters.pageSize));

      const res = await fetch(`/api/codes/list?${params.toString()}`, {
        headers: await getAuthHeaders(),
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok || !payload?.success) {
        throw new Error(payload?.error || "No se pudieron cargar los códigos");
      }
      setCodes(payload.data || []);
      setTotal(payload.total || (payload.data?.length ?? 0));
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
      if (filters.start_date) params.set("start_date", filters.start_date);
      if (filters.end_date) params.set("end_date", filters.end_date);
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
    setFilters((prev) => ({ ...prev, batch_id: batchId, page: 1 }));
    setSelectedBatchId(batchId);
  }

  const filteredPromoters = useMemo(() => {
    if (!filters.type) return [];
    return promoters;
  }, [promoters, filters.type]);

  return (
    <main className="min-h-screen bg-black px-4 py-8 text-white sm:px-6 lg:px-10">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/60">Gestión</p>
          <h1 className="text-3xl font-semibold">Códigos y lotes</h1>
          {activeBatchId && (
            <p className="mt-1 text-xs text-white/50">
              Batch activo: <span className="font-mono">{activeBatchId}</span>
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setShowModal(true)}
            className="rounded-full bg-gradient-to-r from-[#e91e63] to-[#ff77b6] px-4 py-2 text-sm font-semibold text-white shadow-[0_12px_35px_rgba(233,30,99,0.35)] transition hover:shadow-[0_14px_38px_rgba(233,30,99,0.45)]"
          >
            Generar lote
          </button>
          <button
            onClick={handleDeactivate}
            disabled={deactivating || !activeBatchId}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
              deactivating || !activeBatchId
                ? "cursor-not-allowed border border-white/10 text-white/50"
                : "border border-white/20 text-white hover:border-white"
            }`}
          >
            {deactivating ? "Desactivando..." : "Desactivar lote"}
          </button>
          <button
            onClick={handleExport}
            disabled={exporting || !filters.event_id}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
              exporting || !filters.event_id
                ? "cursor-not-allowed border border-white/10 text-white/50"
                : "border border-white/20 text-white hover:border-white"
            }`}
          >
            {exporting ? "Exportando..." : "Export CSV"}
          </button>
        </div>
      </div>

      <section className="mb-4 grid gap-3 rounded-3xl border border-white/10 bg-[#0c0c0c] p-4 shadow-[0_20px_80px_rgba(0,0,0,0.45)] lg:grid-cols-6">
        <div className="flex flex-col gap-2 lg:col-span-2">
          <label className="text-xs font-semibold uppercase tracking-[0.18em] text-white/60">Evento</label>
          <select
            value={filters.event_id}
            onChange={(e) => setFilters((prev) => ({ ...prev, event_id: e.target.value, page: 1 }))}
            className="w-full rounded-2xl border border-white/15 bg-[#0a0a0a] px-3 py-2 text-sm text-white outline-none focus:border-white"
          >
            <option value="">Selecciona evento</option>
            {events.map((ev) => (
              <option key={ev.id} value={ev.id}>
                {ev.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-xs font-semibold uppercase tracking-[0.18em] text-white/60">Tipo</label>
          <select
            value={filters.type}
            onChange={(e) => setFilters((prev) => ({ ...prev, type: e.target.value, page: 1 }))}
            className="w-full rounded-2xl border border-white/15 bg-[#0a0a0a] px-3 py-2 text-sm text-white outline-none focus:border-white"
          >
            {TYPE_OPTIONS.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-xs font-semibold uppercase tracking-[0.18em] text-white/60">Promotor</label>
          <select
            value={filters.promoter_id}
            onChange={(e) => setFilters((prev) => ({ ...prev, promoter_id: e.target.value, page: 1 }))}
            disabled={!filters.type}
            className="w-full rounded-2xl border border-white/15 bg-[#0a0a0a] px-3 py-2 text-sm text-white outline-none focus:border-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            <option value="">{filters.type ? "Selecciona promotor" : "No aplica"}</option>
            {filteredPromoters.map((pr) => (
              <option key={pr.id} value={pr.id}>
                {pr.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-xs font-semibold uppercase tracking-[0.18em] text-white/60">Estado</label>
          <select
            value={filters.status}
            onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.value as Filters["status"], page: 1 }))}
            className="w-full rounded-2xl border border-white/15 bg-[#0a0a0a] px-3 py-2 text-sm text-white outline-none focus:border-white"
          >
            {STATUS_OPTIONS.map((st) => (
              <option key={st.value} value={st.value}>
                {st.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-xs font-semibold uppercase tracking-[0.18em] text-white/60">Batch ID</label>
          <input
            value={filters.batch_id}
            onChange={(e) => setFilters((prev) => ({ ...prev, batch_id: e.target.value.trim(), page: 1 }))}
            placeholder="Filtrar por batch"
            className="w-full rounded-2xl border border-white/15 bg-[#0a0a0a] px-3 py-2 text-sm text-white outline-none focus:border-white"
          />
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-xs font-semibold uppercase tracking-[0.18em] text-white/60">Rango fecha (creación)</label>
          <div className="grid grid-cols-2 gap-2">
            <DatePickerSimple
              value={filters.start_date}
              onChange={(next) => setFilters((prev) => ({ ...prev, start_date: next, page: 1 }))}
            />
            <DatePickerSimple
              value={filters.end_date}
              onChange={(next) => setFilters((prev) => ({ ...prev, end_date: next, page: 1 }))}
            />
          </div>
        </div>
      </section>

      <div className="mb-3 flex flex-wrap items-center justify-between gap-3 text-sm text-white/70">
        <div className="flex items-center gap-2">
          <span className="rounded-full border border-white/10 px-3 py-1">Total: {total}</span>
          <span className="rounded-full border border-white/10 px-3 py-1">Página {currentPage} / {totalPages}</span>
          {error && <span className="rounded-full border border-red-500/40 px-3 py-1 text-red-200">{error}</span>}
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs uppercase tracking-[0.12em] text-white/50">Filas</label>
          <select
            value={filters.pageSize}
            onChange={(e) => setFilters((prev) => ({ ...prev, pageSize: Number(e.target.value), page: 1 }))}
            className="rounded-xl border border-white/15 bg-[#0a0a0a] px-3 py-1 text-sm text-white outline-none focus:border-white"
          >
            {PAGE_SIZES.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setFilters((prev) => ({ ...prev, page: Math.max(1, currentPage - 1) }))}
              disabled={currentPage <= 1}
              className="rounded-full border border-white/15 px-3 py-1 text-white transition disabled:cursor-not-allowed disabled:opacity-50"
            >
              ←
            </button>
            <button
              onClick={() => setFilters((prev) => ({ ...prev, page: Math.min(totalPages, currentPage + 1) }))}
              disabled={currentPage >= totalPages}
              className="rounded-full border border-white/15 px-3 py-1 text-white transition disabled:cursor-not-allowed disabled:opacity-50"
            >
              →
            </button>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {loading && (
          <div className="rounded-3xl border border-white/10 bg-[#0c0c0c] p-6 text-center text-white/70 shadow-[0_20px_80px_rgba(0,0,0,0.45)]">
            Cargando códigos...
          </div>
        )}
        {!loading && groupedCodes.length === 0 && (
          <div className="rounded-3xl border border-white/10 bg-[#0c0c0c] p-6 text-center text-white/70 shadow-[0_20px_80px_rgba(0,0,0,0.45)]">
            No hay códigos con los filtros actuales.
          </div>
        )}

        {!loading &&
          groupedCodes.map((group) => {
            const sample = group.codes[0];
            const expiredCount = group.codes.filter((c) => c.expires_at && new Date(c.expires_at) < new Date()).length;
            const activeCount = group.codes.filter((c) => c.is_active && !(c.expires_at && new Date(c.expires_at) < new Date())).length;
            const totalUses = group.codes.reduce((acc, c) => acc + (c.uses ?? 0), 0);
            const totalMax = group.codes.reduce((acc, c) => acc + (c.max_uses ?? 1), 0);
            const lotLabel = sample.promoter_name || sample.event_name || sample.promoter_code || "Lote";
            return (
              <div
                key={group.batchId}
                className="rounded-3xl border border-white/10 bg-[#0c0c0c] p-5 shadow-[0_20px_80px_rgba(0,0,0,0.45)]"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div
                    className="flex cursor-pointer flex-col"
                    onClick={() => {
                      setExpanded((prev) => {
                        const next = new Set(prev);
                        next.has(group.batchId) ? next.delete(group.batchId) : next.add(group.batchId);
                        return next;
                      });
                    }}
                  >
                    <p className="text-xs uppercase tracking-[0.15em] text-white/60">
                      {group.batchId === "no-batch" ? "Sin batch" : "Lote"}
                    </p>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-lg font-semibold text-white">
                        {lotLabel}
                      </span>
                      <span className="text-xs text-white/50">{expanded.has(group.batchId) ? "Contraer" : "Expandir"}</span>
                    </div>
                    <p className="text-xs text-white/50">
                      {group.batchId !== "no-batch" && <span className="font-mono text-white/60">{group.batchId}</span>}
                      {group.batchId !== "no-batch" && " · "}
                      Evento: {sample.event_name || "—"} · Promotor: {sample.promoter_name || sample.promoter_code || "—"} ·
                      Tipo: {sample.type || "—"}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-white/70">
                    <span className="rounded-full border border-white/10 px-3 py-1">
                      Activos {activeCount}/{group.codes.length}
                    </span>
                    <span className="rounded-full border border-white/10 px-3 py-1">
                      Expirados {expiredCount}/{group.codes.length}
                    </span>
                    <span className="rounded-full border border-white/10 px-3 py-1">
                      Usos {totalUses}/{totalMax}
                    </span>
                    {group.batchId !== "no-batch" && (
                      <button
                        onClick={() => handleDeleteBatch(group.batchId)}
                        disabled={deleting === group.batchId}
                        className="rounded-full border border-red-500/40 px-3 py-1 text-xs font-semibold text-red-200 transition hover:border-red-400 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {deleting === group.batchId ? "Eliminando..." : "Eliminar lote"}
                      </button>
                    )}
                  </div>
                </div>

                {expanded.has(group.batchId) && (
                  <div className="mt-4 overflow-x-auto rounded-2xl border border-white/5 bg-black/20">
                    <table className="min-w-full table-fixed divide-y divide-white/10 text-sm">
                      <thead className="bg-white/[0.02] text-xs uppercase tracking-[0.08em] text-white/60">
                        <tr>
                          <th className="w-[20%] px-4 py-3 text-left">Código</th>
                          <th className="w-[12%] px-4 py-3 text-left">Estado</th>
                          <th className="w-[12%] px-4 py-3 text-left">Usos</th>
                          <th className="w-[18%] px-4 py-3 text-left">Expira</th>
                          <th className="w-[18%] px-4 py-3 text-left">Creado</th>
                          <th className="w-[20%] px-4 py-3 text-left">Batch</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {group.codes.map((row) => {
                          const expired = row.expires_at ? new Date(row.expires_at) < new Date() : false;
                          const statusLabel = expired ? "Expirado" : row.is_active ? "Activo" : "Inactivo";
                          const statusClass = expired
                            ? "bg-orange-500/20 text-orange-200"
                            : row.is_active
                              ? "bg-[#e91e63]/15 text-[#e91e63]"
                              : "bg-white/5 text-white/70";
                          return (
                            <tr key={row.id} className="hover:bg-white/[0.02]">
                              <td className="truncate px-4 py-3 font-mono text-[13px] text-white" title={row.code}>
                                {row.code}
                              </td>
                              <td className="px-4 py-3">
                                <span className={`rounded-full px-3 py-1 text-[12px] font-semibold ${statusClass}`}>{statusLabel}</span>
                              </td>
                              <td className="px-4 py-3 text-white/80">
                                {row.uses ?? 0}/{row.max_uses ?? 1}
                              </td>
                              <td className="px-4 py-3 text-white/80">{formatDate(row.expires_at)}</td>
                              <td className="px-4 py-3 text-white/80">{formatDate(row.created_at)}</td>
                              <td className="px-4 py-3 text-white/80">
                                {row.batch_id ? (
                                  <button
                                    onClick={() => {
                                      setSelectedBatchId(row.batch_id || "");
                                      setFilters((prev) => ({ ...prev, batch_id: row.batch_id || "", page: 1 }));
                                    }}
                                    className="rounded-full border border-white/15 px-3 py-1 font-mono text-xs text-white/80 transition hover:border-white"
                                  >
                                    {row.batch_id.slice(0, 8)}…
                                  </button>
                                ) : (
                                  "—"
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
      </div>

      {generated && (
        <div className="mt-4 rounded-2xl border border-white/15 bg-[#0c0c0c] p-4 text-sm text-white/80">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.15em] text-white/60">Lote generado</p>
              <p className="font-semibold">Batch {generated.batchId}</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => copyToClipboard(generated.codes.join("\n"))}
                className="rounded-full border border-white/20 px-3 py-1 text-xs font-semibold text-white transition hover:border-white"
              >
                Copiar todo
              </button>
              <button
                onClick={() => {
                  setFilters((prev) => ({ ...prev, batch_id: generated.batchId, page: 1 }));
                  setSelectedBatchId(generated.batchId);
                }}
                className="rounded-full border border-[#e91e63]/50 px-3 py-1 text-xs font-semibold text-[#e91e63] transition hover:border-[#e91e63]"
              >
                Ver lote
              </button>
            </div>
          </div>
          <div className="mt-3 grid gap-2 text-xs font-mono text-white/70 md:grid-cols-2 lg:grid-cols-3">
            {generated.codes.map((c) => (
              <span key={c} className="rounded-xl border border-white/10 bg-black/30 px-3 py-2">
                {c}
              </span>
            ))}
          </div>
        </div>
      )}

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
          <button onClick={onClose} className="rounded-full border border-white/15 px-3 py-1 text-sm text-white">
            Cerrar
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="flex flex-col gap-2">
              <label className="text-xs uppercase tracking-[0.15em] text-white/60">Evento</label>
              <select
                value={eventId}
                onChange={(e) => setEventId(e.target.value)}
                className="w-full rounded-2xl border border-white/15 bg-[#0a0a0a] px-3 py-2 text-sm text-white outline-none focus:border-white"
              >
                <option value="">Selecciona evento</option>
                {events.map((ev) => (
                  <option key={ev.id} value={ev.id}>
                    {ev.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-xs uppercase tracking-[0.15em] text-white/60">Promotor</label>
              <select
                value={promoterId}
                onChange={(e) => setPromoterId(e.target.value)}
                className="w-full rounded-2xl border border-white/15 bg-[#0a0a0a] px-3 py-2 text-sm text-white outline-none focus:border-white"
              >
                <option value="">Selecciona promotor</option>
                {filteredPromoters.map((pr) => (
                  <option key={pr.id} value={pr.id}>
                    {pr.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-xs uppercase tracking-[0.15em] text-white/60">Cantidad</label>
              <input
                type="number"
                min={1}
                max={200}
                value={quantity}
                onChange={(e) => setQuantity(Number(e.target.value))}
                className="w-full rounded-2xl border border-white/15 bg-[#0a0a0a] px-3 py-2 text-sm text-white outline-none focus:border-white"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-xs uppercase tracking-[0.15em] text-white/60">Notas</label>
              <input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Contexto interno"
                className="w-full rounded-2xl border border-white/15 bg-[#0a0a0a] px-3 py-2 text-sm text-white outline-none focus:border-white"
              />
            </div>
          </div>

          {error && <p className="text-sm text-red-300">{error}</p>}

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={submitting}
              className="rounded-full bg-gradient-to-r from-[#e91e63] to-[#ff77b6] px-4 py-2 text-sm font-semibold text-white transition hover:shadow-[0_12px_35px_rgba(233,30,99,0.35)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? "Generando..." : "Generar"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-white/20 px-4 py-2 text-sm font-semibold text-white transition hover:border-white"
            >
              Cancelar
            </button>
          </div>

          {batchId && generatedCodes.length > 0 && (
            <div className="mt-4 space-y-2 rounded-2xl border border-white/10 bg-black/40 p-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-white">Batch {batchId}</p>
                <button
                  type="button"
                  onClick={() => copyToClipboard(generatedCodes.join("\n"))}
                  className="rounded-full border border-white/20 px-3 py-1 text-xs font-semibold text-white transition hover:border-white"
                >
                  Copiar todo
                </button>
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
