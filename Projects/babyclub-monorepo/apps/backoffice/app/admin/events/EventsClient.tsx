"use client";

import Link from "next/link";
import EventActions from "./components/EventActions";
import { formatLimaFromDb } from "shared/limaTime";

type EventRow = {
  id: string;
  name: string;
  location: string | null;
  starts_at: string | null;
  capacity: number | null;
  is_active: boolean | null;
  header_image: string | null;
  code?: string | null;
};

export default function EventsClient({
  events,
  pagination,
  total,
}: {
  events: EventRow[];
  pagination: { page: number; pageSize: number };
  total: number;
}) {
  const { page, pageSize } = pagination;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(page, totalPages);

  return (
    <main className="min-h-screen bg-black px-4 py-8 text-white sm:px-6 lg:px-10">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#f2f2f2]/60">Eventos</p>
          <h1 className="text-3xl font-semibold">Listado de eventos</h1>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/admin"
            className="inline-flex items-center justify-center rounded-full border border-white/15 px-4 py-2 text-sm font-semibold text-white transition hover:border-white"
          >
            ← Volver
          </Link>
          <Link
            href="/admin/events/create"
            className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-[#e91e63] to-[#ff77b6] px-5 py-2 text-sm font-semibold text-white shadow-[0_12px_35px_rgba(233,30,99,0.35)] transition hover:shadow-[0_14px_38px_rgba(233,30,99,0.45)]"
          >
            Crear evento
          </Link>
        </div>
      </div>

      <div className="hidden overflow-x-auto rounded-3xl border border-white/10 bg-[#0c0c0c] shadow-[0_20px_80px_rgba(0,0,0,0.45)] lg:block">
        <table className="min-w-full table-fixed divide-y divide-white/10 text-sm">
          <thead className="bg-white/[0.02] text-xs uppercase tracking-[0.08em] text-white/60">
            <tr>
              <th className="w-[26%] px-4 py-3 text-left">Nombre</th>
              <th className="w-[18%] px-4 py-3 text-left">Ubicación</th>
              <th className="w-[18%] px-4 py-3 text-left">Fecha</th>
              <th className="w-[10%] px-4 py-3 text-left">Capacidad</th>
              <th className="w-[12%] px-4 py-3 text-left">Código</th>
              <th className="w-[10%] px-4 py-3 text-left">Estado</th>
              <th className="w-[6%] px-4 py-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {events.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-white/60">
                  No hay eventos aún. Crea el primero.
                </td>
              </tr>
            )}
            {events.map((event) => (
              <tr key={event.id} className="hover:bg-white/[0.02]">
                <td className="px-4 py-3">
                  <div className="font-semibold text-white">{event.name}</div>
                  {event.header_image && <div className="break-all text-xs text-white/50">{event.header_image}</div>}
                </td>
                <td className="px-4 py-3 text-white/80">{event.location || "—"}</td>
                <td className="px-4 py-3 text-white/80">{formatLimaFromDb(event.starts_at ?? "")}</td>
                <td className="px-4 py-3 text-white/80">{event.capacity ?? "—"}</td>
                <td className="px-4 py-3 text-white/80 whitespace-nowrap" title={event.code ?? "—"}>
                  {event.code ?? "—"}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-3 py-1 text-[12px] font-semibold ${
                      event.is_active ? "bg-[#e91e63]/15 text-[#e91e63]" : "bg-white/5 text-white/70"
                    }`}
                  >
                    {event.is_active ? "Activo" : "Inactivo"}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <EventActions id={event.id} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <PaginationControls basePath="/admin/events" page={currentPage} totalPages={totalPages} pageSize={pageSize} />

      <div className="space-y-3 lg:hidden">
        {events.length === 0 && (
          <div className="rounded-2xl border border-white/10 bg-[#0c0c0c] p-4 text-center text-white/70">
            No hay eventos aún. Crea el primero.
          </div>
        )}
        {events.map((event) => (
          <div
            key={event.id}
            className="rounded-2xl border border-white/10 bg-[#0c0c0c] p-4 shadow-[0_12px_40px_rgba(0,0,0,0.45)]"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <p className="text-sm font-semibold text-white">{event.name}</p>
                {event.header_image && <p className="break-all text-xs text-white/50">{event.header_image}</p>}
                <p className="text-xs uppercase tracking-[0.15em] text-white/50">{event.code || "Sin código"}</p>
              </div>
              <span
                className={`rounded-full px-3 py-1 text-[12px] font-semibold ${
                  event.is_active ? "bg-[#e91e63]/15 text-[#e91e63]" : "bg-white/5 text-white/70"
                }`}
              >
                {event.is_active ? "Activo" : "Inactivo"}
              </span>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-3 text-sm text-white/80">
              <Info label="Ubicación" value={event.location || "—"} />
              <Info label="Fecha" value={formatLimaFromDb(event.starts_at ?? "")} />
              <Info label="Capacidad" value={event.capacity?.toString() || "—"} />
              <Info label="Código" value={event.code || "—"} />
            </div>

            <div className="mt-4 flex flex-col gap-2">
              <EventActions id={event.id} />
            </div>
          </div>
        ))}
      </div>
      <PaginationControls basePath="/admin/events" page={currentPage} totalPages={totalPages} pageSize={pageSize} isMobile />
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
  isMobile,
}: {
  basePath: string;
  page: number;
  totalPages: number;
  pageSize: number;
  isMobile?: boolean;
}) {
  const options = [5, 10, 15, 20, 30];
  const qs = (nextPage: number, size: number) => {
    const params = new URLSearchParams();
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
