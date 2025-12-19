"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import TicketActions from "./components/TicketActions";
import DatePickerSimple from "@/components/ui/DatePickerSimple";

type TicketRow = {
  id: string;
  created_at: string;
  dni: string | null;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  event_name: string | null;
  code_value: string | null;
  promoter_name: string | null;
};

export default function TicketsClient({
  initialTickets,
  error,
  filters,
  promoterOptions,
}: {
  initialTickets: TicketRow[];
  error: string | null;
  filters: { from: string; to: string; q: string; promoter_id: string; page: number; pageSize: number; total: number };
  promoterOptions: Array<{ id: string; label: string }>;
}) {
  const { from, to, q, promoter_id, page, pageSize, total } = filters;
  const [fromDate, setFromDate] = useState(from);
  const [toDate, setToDate] = useState(to);
  const [promoterId, setPromoterId] = useState(promoter_id);

  // Sincroniza el formulario cuando cambian los filtros por navegación
  useEffect(() => {
    setFromDate(from);
    setToDate(to);
    setPromoterId(promoter_id);
  }, [from, to, promoter_id]);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / pageSize)), [total, pageSize]);
  const currentPage = Math.min(page, totalPages);

  return (
    <main className="min-h-screen bg-black px-4 py-8 text-white sm:px-6 lg:px-10">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#f2f2f2]/60">Tickets / QR</p>
          <h1 className="text-3xl font-semibold">Listado de tickets</h1>
          <p className="text-sm text-white/60">Filtra por fecha o busca por DNI / nombre / email.</p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/admin"
            className="inline-flex items-center justify-center rounded-full border border-white/15 px-4 py-2 text-sm font-semibold text-white transition hover:border-white"
          >
            ← Volver
          </Link>
        </div>
      </div>

      <form
        className="mb-6 grid gap-3 rounded-3xl border border-white/10 bg-[#0c0c0c] p-4 shadow-[0_20px_80px_rgba(0,0,0,0.45)] lg:grid-cols-6"
        method="get"
        action="/admin/tickets"
      >
        <label className="space-y-2 text-sm font-semibold text-white">
          Desde
          <DatePickerSimple value={fromDate} onChange={setFromDate} name="from" />
        </label>
        <label className="space-y-2 text-sm font-semibold text-white">
          Hasta
          <DatePickerSimple value={toDate} onChange={setToDate} name="to" />
        </label>
        <label className="space-y-2 text-sm font-semibold text-white lg:col-span-2">
          Búsqueda
          <input
            type="text"
            name="q"
            defaultValue={q}
            placeholder="DNI, nombre o email"
            className="w-full rounded-xl border border-white/10 bg-[#111] px-3 py-2 text-sm text-white placeholder:text-white/40 focus:border-white focus:outline-none"
          />
        </label>
        <label className="space-y-2 text-sm font-semibold text-white">
          Promotor
          <select
            name="promoter_id"
            value={promoterId}
            onChange={(e) => setPromoterId(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-[#111] px-3 py-2 text-sm text-white focus:border-white focus:outline-none"
          >
            <option value="">Todos</option>
            {promoterOptions.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
        <input type="hidden" name="page" value="1" />
        <input type="hidden" name="pageSize" value={pageSize} />
        <div className="flex items-end gap-2">
          <button
            type="submit"
            className="w-full rounded-xl bg-gradient-to-r from-[#e91e63] to-[#ff77b6] px-4 py-2 text-sm font-semibold text-white shadow-[0_10px_30px_rgba(233,30,99,0.35)] transition hover:shadow-[0_12px_32px_rgba(233,30,99,0.45)]"
          >
            Filtrar
          </button>
          {(from || to || q || promoterId) && (
            <Link
              href="/admin/tickets"
              className="inline-flex items-center justify-center rounded-xl border border-white/15 px-3 py-2 text-sm font-semibold text-white hover:border-white"
            >
              Limpiar
            </Link>
          )}
        </div>
      </form>

      <div className="hidden overflow-x-auto rounded-3xl border border-white/10 bg-[#0c0c0c] shadow-[0_20px_80px_rgba(0,0,0,0.45)] lg:block">
        <table className="min-w-full table-fixed divide-y divide-white/10 text-sm">
          <thead className="bg-white/[0.02] text-xs uppercase tracking-[0.08em] text-white/60">
            <tr>
              <th className="w-[18%] px-4 py-3 text-left">Evento</th>
              <th className="w-[14%] px-4 py-3 text-left">DNI</th>
              <th className="w-[20%] px-4 py-3 text-left">Nombre</th>
              <th className="w-[18%] px-4 py-3 text-left">Email</th>
              <th className="w-[12%] px-4 py-3 text-left">Teléfono</th>
              <th className="w-[10%] px-4 py-3 text-left">Código</th>
              <th className="w-[12%] px-4 py-3 text-left">Promotor</th>
              <th className="w-[10%] px-4 py-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {initialTickets.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-center text-white/60">
                  {error ? `Error: ${error}` : "No hay tickets en este rango."}
                </td>
              </tr>
            )}
            {initialTickets.map((t) => (
              <tr key={t.id} className="hover:bg-white/[0.02]">
                <td className="px-4 py-3 font-semibold text-white">{t.event_name || "—"}</td>
                <td className="px-4 py-3 font-mono text-white/90">{t.dni || "—"}</td>
                <td className="px-4 py-3 text-white/90">{t.full_name || "—"}</td>
                <td className="px-4 py-3 break-words text-white/80">{t.email || "—"}</td>
                <td className="px-4 py-3 text-white/80">{t.phone || "—"}</td>
                <td className="px-4 py-3 text-white/80">{t.code_value || "—"}</td>
                <td className="px-4 py-3 text-white/80">{t.promoter_name || "—"}</td>
                <td className="px-4 py-3 text-right">
                  <TicketActions id={t.id} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <PaginationControls
        basePath="/admin/tickets"
        page={currentPage}
        totalPages={totalPages}
        pageSize={pageSize}
        filters={{ from, to, q, promoter_id: promoterId }}
      />

      <div className="space-y-3 lg:hidden">
        {initialTickets.length === 0 && (
          <div className="rounded-2xl border border-white/10 bg-[#0c0c0c] p-4 text-center text-white/70">
            {error ? `Error: ${error}` : "No hay tickets en este rango."}
          </div>
        )}
        {initialTickets.map((t) => (
          <div
            key={t.id}
            className="rounded-2xl border border-white/10 bg-[#0c0c0c] p-4 shadow-[0_12px_40px_rgba(0,0,0,0.45)]"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <p className="text-base font-semibold text-white">{t.full_name || "Sin nombre"}</p>
                <p className="text-sm font-mono text-white/80">{t.dni || "—"}</p>
              </div>
            </div>
            <div className="mt-3 space-y-1 text-sm text-white/80">
              <Info label="Evento" value={t.event_name || "—"} />
              <Info label="Email" value={t.email || "—"} />
              <Info label="Teléfono" value={t.phone || "—"} />
              <Info label="Código" value={t.code_value || "—"} />
              <Info label="Promotor" value={t.promoter_name || "—"} />
            </div>
            <div className="mt-3 flex justify-end">
              <TicketActions id={t.id} compact />
            </div>
          </div>
        ))}
      </div>
      <PaginationControls
        basePath="/admin/tickets"
        page={currentPage}
        totalPages={totalPages}
        pageSize={pageSize}
        filters={{ from, to, q, promoter_id: promoterId }}
        isMobile
      />
    </main>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <p className="text-sm text-white/80">
      <span className="text-white/50">{label}: </span>
      <span className="font-semibold text-white">{value}</span>
    </p>
  );
}

function PaginationControls({
  basePath,
  page,
  totalPages,
  pageSize,
  filters,
  isMobile,
}: {
  basePath: string;
  page: number;
  totalPages: number;
  pageSize: number;
  filters: { from: string; to: string; q: string; promoter_id: string };
  isMobile?: boolean;
}) {
  const options = [5, 10, 15, 20, 30];
  const qs = (nextPage: number, size: number) => {
    const params = new URLSearchParams();
    if (filters.from) params.set("from", filters.from);
    if (filters.to) params.set("to", filters.to);
    if (filters.q) params.set("q", filters.q);
    if (filters.promoter_id) params.set("promoter_id", filters.promoter_id);
    params.set("page", String(nextPage));
    params.set("pageSize", String(size));
    return `${basePath}?${params.toString()}`;
  };

  return (
    <div
      className={`mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-white/80 ${
        isMobile ? "flex lg:hidden" : "hidden lg:flex"
      }`}
    >
      <div className="flex items-center gap-2">
        <span className="text-white/60">Ver</span>
        <select
          defaultValue={pageSize}
          onChange={(e) => {
            const size = parseInt(e.target.value, 10);
            window.location.href = qs(1, size);
          }}
          className="rounded-lg border border-white/15 bg-[#0c0c0c] px-3 py-2 text-sm text-white focus:border-white focus:outline-none"
        >
          {options.map((opt) => (
            <option key={opt} value={opt}>
              {opt} por página
            </option>
          ))}
        </select>
      </div>
      <div className="flex items-center gap-2">
        <a
          href={qs(Math.max(1, page - 1), pageSize)}
          className={`rounded-full border border-white/15 px-3 py-1 text-xs font-semibold ${
            page <= 1 ? "pointer-events-none text-white/30" : "text-white hover:border-white"
          }`}
        >
          ← Anterior
        </a>
        <span className="text-white/60">
          Página {page} de {totalPages}
        </span>
        <a
          href={qs(Math.min(totalPages, page + 1), pageSize)}
          className={`rounded-full border border-white/15 px-3 py-1 text-xs font-semibold ${
            page >= totalPages ? "pointer-events-none text-white/30" : "text-white hover:border-white"
          }`}
        >
          Siguiente →
        </a>
      </div>
    </div>
  );
}
