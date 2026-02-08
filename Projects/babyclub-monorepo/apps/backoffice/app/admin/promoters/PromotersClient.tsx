"use client";

import Link from "next/link";
import { useMemo } from "react";
import PromoterActions from "./components/PromoterActions";

type PromoterRow = {
  id: string;
  code: string | null;
  is_active: boolean | null;
  person: {
    dni: string | null;
    first_name: string;
    last_name: string;
    email: string | null;
    phone: string | null;
  };
};

export default function PromotersClient({
  promoters,
  error,
  pagination,
  total,
}: {
  promoters: PromoterRow[];
  error: string | null;
  pagination: { page: number; pageSize: number; q: string };
  total: number;
}) {
  const { page, pageSize, q } = pagination;
  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / pageSize)), [total, pageSize]);
  const currentPage = Math.min(page, totalPages);

  return (
    <main className="min-h-screen bg-black px-4 py-8 text-white sm:px-6 lg:px-10">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#f2f2f2]/60">Promotores</p>
          <h1 className="text-3xl font-semibold">Listado de promotores</h1>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/admin"
            className="inline-flex items-center justify-center rounded-full border border-white/15 px-4 py-2 text-sm font-semibold text-white transition hover:border-white"
          >
            ← Volver
          </Link>
          <Link
            href="/admin/promoters/create"
            className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-[#e91e63] to-[#ff77b6] px-5 py-2 text-sm font-semibold text-white shadow-[0_12px_35px_rgba(233,30,99,0.35)] transition hover:shadow-[0_14px_38px_rgba(233,30,99,0.45)]"
          >
            Crear promotor
          </Link>
        </div>
      </div>

      <form className="mb-6 flex flex-wrap items-end gap-3 rounded-3xl border border-white/10 bg-[#0c0c0c] p-4 shadow-[0_20px_80px_rgba(0,0,0,0.45)]">
        <label className="flex-1 min-w-[220px] space-y-2 text-sm font-semibold text-white">
          Buscar
          <input
            type="text"
            name="q"
            defaultValue={q}
            placeholder="Nombre, DNI o código"
            className="w-full rounded-xl border border-white/10 bg-[#111] px-3 py-2 text-sm text-white placeholder:text-white/40 focus:border-white focus:outline-none"
          />
        </label>
        <div className="flex gap-2">
          <button
            type="submit"
            className="rounded-xl bg-gradient-to-r from-[#e91e63] to-[#ff77b6] px-4 py-2 text-sm font-semibold text-white shadow-[0_10px_30px_rgba(233,30,99,0.35)] transition hover:shadow-[0_12px_32px_rgba(233,30,99,0.45)]"
          >
            Filtrar
          </button>
          {q && (
            <Link
              href="/admin/promoters"
              className="rounded-xl border border-white/15 px-3 py-2 text-sm font-semibold text-white hover:border-white"
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
              <th className="w-[30%] px-4 py-3 text-left">Nombre</th>
              <th className="w-[14%] px-4 py-3 text-left">DNI</th>
              <th className="w-[30%] px-4 py-3 text-left">Email</th>
              <th className="w-[12%] px-4 py-3 text-left">Estado</th>
              <th className="w-[14%] px-4 py-3 text-right">Acciones</th>
            </tr>
          </thead>
            <tbody className="divide-y divide-white/5">
            {promoters.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-white/60">
                  {error ? `Error: ${error}` : "No hay promotores aún."}
                </td>
              </tr>
            )}
            {promoters.map((promoter) => (
              <tr key={promoter.id} className="hover:bg-white/[0.02]">
                <td className="px-4 py-3 font-semibold text-white">
                  {promoter.person.first_name} {promoter.person.last_name}
                </td>
                <td className="px-4 py-3 text-white/80">{promoter.person.dni || "—"}</td>
                <td className="px-4 py-3 text-white/80 break-words">{promoter.person.email || "—"}</td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-3 py-1 text-[12px] font-semibold ${
                      promoter.is_active ? "bg-[#e91e63]/15 text-[#e91e63]" : "bg-white/5 text-white/70"
                    }`}
              >
                {promoter.is_active ? "Activo" : "Inactivo"}
              </span>
            </td>
            <td className="px-4 py-3 text-right">
              <div className="flex justify-end gap-2">
                <PromoterActions id={promoter.id} />
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
      </div>

      <PaginationControls basePath="/admin/promoters" page={currentPage} totalPages={totalPages} pageSize={pageSize} q={q} />

      <div className="space-y-3 lg:hidden">
        {promoters.length === 0 && (
          <div className="rounded-2xl border border-white/10 bg-[#0c0c0c] p-4 text-center text-white/70">
            {error ? `Error: ${error}` : "No hay promotores aún."}
          </div>
        )}
        {promoters.map((promoter) => (
          <div
            key={promoter.id}
            className="rounded-2xl border border-white/10 bg-[#0c0c0c] p-4 shadow-[0_12px_40px_rgba(0,0,0,0.45)]"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <p className="text-base font-semibold text-white">
                  {promoter.person.first_name} {promoter.person.last_name}
                </p>
                <p className="text-sm text-white/70">{promoter.person.email || "—"}</p>
              </div>
              <span
                className={`rounded-full px-3 py-1 text-[12px] font-semibold ${
                  promoter.is_active ? "bg-[#e91e63]/15 text-[#e91e63]" : "bg-white/5 text-white/70"
                }`}
              >
                {promoter.is_active ? "Activo" : "Inactivo"}
              </span>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-3 text-sm text-white/80">
              <Info label="DNI" value={promoter.person.dni || "—"} />
              <Info label="Email" value={promoter.person.email || "—"} />
            </div>

            <div className="mt-4 flex flex-col gap-2">
              <PromoterActions id={promoter.id} />
            </div>
          </div>
        ))}
      </div>

      <PaginationControls
        basePath="/admin/promoters"
        page={currentPage}
        totalPages={totalPages}
        pageSize={pageSize}
        q={q}
        isMobile
      />
    </main>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <p className="text-[11px] uppercase tracking-[0.12em] text-white/50">{label}</p>
      <p className="font-semibold text-white">{value}</p>
    </div>
  );
}

function PaginationControls({
  basePath,
  page,
  totalPages,
  pageSize,
  q,
  isMobile,
}: {
  basePath: string;
  page: number;
  totalPages: number;
  pageSize: number;
  q: string;
  isMobile?: boolean;
}) {
  const options = [5, 10, 15, 20, 30];
  const qs = (nextPage: number, size: number) => {
    const params = new URLSearchParams();
    params.set("page", String(nextPage));
    params.set("pageSize", String(size));
    if (q) params.set("q", q);
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
          value={pageSize}
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
