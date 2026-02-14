"use client";

import Link from "next/link";
import { ExpandableDataTable, RowActions } from "@/components/dashboard";
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

  const columns = [
    {
      key: "name" as const,
      label: "Nombre",
      width: "w-[25%]",
      render: (value: string) => <span className="font-semibold text-white">{value}</span>,
    },
    {
      key: "location" as const,
      label: "Ubicación",
      width: "w-[20%]",
      render: (value: string | null) => <span>{value || "—"}</span>,
      expandable: true,
    },
    {
      key: "starts_at" as const,
      label: "Fecha",
      width: "w-[18%]",
      render: (value: string | null) => <span>{formatLimaFromDb(value ?? "")}</span>,
    },
    {
      key: "capacity" as const,
      label: "Capacidad",
      width: "w-[12%]",
      render: (value: number | null) => <span>{value ?? "—"}</span>,
      expandable: true,
    },
    {
      key: "code" as const,
      label: "Código General",
      width: "w-[12%]",
      render: (value: string | null) => (
        <code className="rounded bg-neutral-700/50 px-2 py-1 text-xs font-mono text-neutral-300">
          {value ?? "—"}
        </code>
      ),
      expandable: true,
    },
    {
      key: "is_active" as const,
      label: "Estado",
      width: "w-[13%]",
      render: (value: boolean | null) => (
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${
          value ? "bg-rose-500/20 text-rose-400" : "bg-neutral-700/50 text-neutral-400"
        }`}>
          {value ? "Activo" : "Inactivo"}
        </span>
      ),
    },
  ];

  return (
    <main className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Eventos</p>
          <h1 className="text-3xl font-bold text-white">Listado de eventos</h1>
        </div>
        <div className="flex gap-3">
          <Link
            href="/admin"
            className="inline-flex items-center justify-center rounded-lg border border-neutral-600 px-4 py-2 text-sm font-semibold text-neutral-200 transition hover:border-neutral-500 hover:bg-neutral-800"
          >
            ← Volver
          </Link>
          <Link
            href="/admin/events/create"
            className="inline-flex items-center justify-center rounded-lg bg-gradient-to-r from-rose-500 to-rose-600 px-5 py-2 text-sm font-semibold text-white shadow-lg transition hover:shadow-xl hover:from-rose-400 hover:to-rose-500"
          >
            + Crear evento
          </Link>
        </div>
      </div>

      {/* Expandable Data Table */}
      <ExpandableDataTable
        data={events}
        columns={columns}
        actions={(row) => (
          <RowActions
            id={row.id}
            editHref={`/admin/events/${row.id}/edit`}
            viewHref={`/admin/events/${row.id}`}
            deleteApiEndpoint="/api/events/delete"
            deleteConfirmMessage="¿Eliminar este evento? Se borrarán sus códigos asociados."
            showView
            showEdit
            showDelete
          />
        )}
        pagination={{
          page,
          pageSize,
          total,
          basePath: "/admin/events",
        }}
        emptyMessage="No hay eventos aún. Crea el primero."
        visibleColumns={3}
      />
    </main>
  );
}
