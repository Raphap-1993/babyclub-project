"use client";

import Link from "next/link";
import TableActions from "./components/TableActions";
import { DataTable, Button } from "@repo/ui";
import { ColumnDef } from "@tanstack/react-table";
import { useRouter } from "next/navigation";

type TableRow = {
  id: string;
  name: string;
  ticket_count: number | null;
  min_consumption: number | null;
  price: number | null;
  is_active: boolean | null;
  notes: string | null;
  reserved: boolean;
};

export default function TablesClient({
  tables,
  error,
  pagination,
  total,
  organizerView = false,
}: {
  tables: TableRow[];
  error: string | null;
  pagination: { page: number; pageSize: number };
  total: number;
  organizerView?: boolean;
}) {
  const { page, pageSize } = pagination;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(page, totalPages);
  const router = useRouter();

  const columns: ColumnDef<TableRow>[] = [
    {
      accessorKey: "name",
      header: "Nombre",
      cell: ({ row }) => (
        <div>
          <div className="font-semibold text-neutral-100">{row.original.name}</div>
          {row.original.notes && (
            <div className="text-xs text-neutral-400 mt-0.5">{row.original.notes}</div>
          )}
        </div>
      ),
    },
    {
      accessorKey: "ticket_count",
      header: "Tickets",
      cell: ({ row }) => (
        <span className="text-neutral-300">{row.original.ticket_count ?? "—"}</span>
      ),
    },
    {
      accessorKey: "min_consumption",
      header: "Consumo mín",
      cell: ({ row }) => (
        <span className="text-neutral-300">
          {row.original.min_consumption != null ? `S/ ${row.original.min_consumption}` : "—"}
        </span>
      ),
    },
    {
      accessorKey: "price",
      header: "Precio",
      cell: ({ row }) => (
        <span className="text-neutral-300">
          {row.original.price != null ? `S/ ${row.original.price}` : "—"}
        </span>
      ),
    },
    {
      accessorKey: "is_active",
      header: "Estado",
      cell: ({ row }) => (
        <span
          className={`inline-block px-2 py-1 rounded-full text-xs font-semibold ${
            row.original.is_active 
              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" 
              : "bg-neutral-700/50 text-neutral-400"
          }`}
        >
          {row.original.is_active ? "Activa" : "Inactiva"}
        </span>
      ),
    },
    {
      id: "actions",
      header: "Acciones",
      cell: ({ row }) => <TableActions id={row.original.id} reserved={row.original.reserved} />,
    },
  ];

  return (
    <main className="min-h-screen bg-gradient-to-br from-neutral-950 via-neutral-900 to-neutral-950 px-4 py-8 sm:px-6 lg:px-10">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
            Inventario del Organizador
          </p>
          <h1 className="text-3xl font-bold text-white mt-1">Mesas del Local</h1>
          <p className="text-sm text-neutral-400 mt-2">
            Gestiona las mesas físicas de tu local. Se reutilizan en todos los eventos.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/admin/tables/layout">
            <Button variant="outline" size="md" className="border-neutral-600 hover:border-neutral-400 text-neutral-300 hover:text-white">
              📐 Diseñar Croquis
            </Button>
          </Link>
          <Link href="/admin">
            <Button variant="ghost" size="md" className="text-neutral-300 hover:text-white hover:bg-neutral-800">
              ← Volver
            </Button>
          </Link>
          <Link href="/admin/tables/create">
            <Button variant="primary" size="md" className="bg-gradient-to-r from-pink-600 to-pink-500 hover:from-pink-700 hover:to-pink-600 shadow-lg shadow-pink-500/30">
              + Agregar Mesa
            </Button>
          </Link>
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-6 text-center">
          <p className="text-red-400">Error: {error}</p>
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={tables}
          emptyMessage="No hay mesas registradas. Crea tu primera mesa del local."
          compact
        />
      )}

      <PaginationControls basePath="/admin/tables" page={currentPage} totalPages={totalPages} pageSize={pageSize} />
    </main>
  );
}

function PaginationControls({
  basePath,
  page,
  totalPages,
  pageSize,
}: {
  basePath: string;
  page: number;
  totalPages: number;
  pageSize: number;
}) {
  const options = [5, 10, 15, 20, 30];
  const qs = (nextPage: number, size: number) => {
    const params = new URLSearchParams();
    params.set("page", String(nextPage));
    params.set("pageSize", String(size));
    return `${basePath}?${params.toString()}`;
  };

  return (
    <div className="mt-6 flex flex-wrap items-center justify-between gap-4 px-1">
      <div className="flex items-center gap-3">
        <span className="text-sm text-neutral-400">Mostrar</span>
        <select
          defaultValue={pageSize}
          onChange={(e) => {
            const size = parseInt(e.target.value, 10);
            window.location.href = qs(1, size);
          }}
          className="rounded-lg border border-neutral-600 bg-neutral-800 px-3 py-2 text-sm text-neutral-200 focus:border-neutral-400 focus:outline-none focus:ring-1 focus:ring-neutral-400"
        >
          {options.map((opt) => (
            <option key={opt} value={opt}>
              {opt} por página
            </option>
          ))}
        </select>
      </div>
      <div className="flex items-center gap-3">
        <a
          href={qs(Math.max(1, page - 1), pageSize)}
          className={`rounded-lg border px-4 py-2 text-sm font-medium transition ${
            page <= 1
              ? "pointer-events-none border-neutral-700 text-neutral-600"
              : "border-neutral-600 text-neutral-300 hover:border-neutral-400 hover:bg-neutral-800"
          }`}
        >
          ← Anterior
        </a>
        <span className="text-sm text-neutral-400">
          Página <span className="font-semibold text-neutral-200">{page}</span> de <span className="font-semibold text-neutral-200">{totalPages}</span>
        </span>
        <a
          href={qs(Math.min(totalPages, page + 1), pageSize)}
          className={`rounded-lg border px-4 py-2 text-sm font-medium transition ${
            page >= totalPages
              ? "pointer-events-none border-neutral-700 text-neutral-600"
              : "border-neutral-600 text-neutral-300 hover:border-neutral-400 hover:bg-neutral-800"
          }`}
        >
          Siguiente →
        </a>
      </div>
    </div>
  );
}
