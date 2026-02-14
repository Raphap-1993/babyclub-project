"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ColumnDef } from "@tanstack/react-table";
import { CirclePlus, Mail, Phone, Search, Filter, UserRound } from "lucide-react";
import { DataTable, StatusBadge } from "@repo/ui";
import PromoterActions from "./components/PromoterActions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SelectNative } from "@/components/ui/select-native";
import { ScreenHeader } from "../components/ScreenHeader";
import { ExternalPagination } from "../components/ExternalPagination";

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

const promoterColumns: ColumnDef<PromoterRow>[] = [
  {
    accessorKey: "person",
    header: "Promotor",
    size: 220,
    cell: ({ row }) => {
      const person = row.original.person;
      return (
        <div className="min-w-0">
          <div className="truncate font-medium text-neutral-100">
            {person.first_name} {person.last_name}
          </div>
          <div className="truncate text-xs font-mono text-neutral-400">{person.dni || "—"}</div>
        </div>
      );
    },
  },
  {
    accessorKey: "contact",
    header: "Contacto",
    size: 260,
    cell: ({ row }) => {
      const person = row.original.person;
      return (
        <div className="space-y-0.5 text-xs text-neutral-300">
          <div className="flex items-center gap-1 truncate">
            <Mail className="h-3 w-3 text-neutral-500" />
            <span className="truncate">{person.email || "—"}</span>
          </div>
          <div className="flex items-center gap-1 truncate">
            <Phone className="h-3 w-3 text-neutral-500" />
            <span>{person.phone || "—"}</span>
          </div>
        </div>
      );
    },
  },
  {
    accessorKey: "code",
    header: "Código",
    size: 160,
    cell: ({ getValue }) => {
      const code = getValue() as string | null;
      return code ? (
        <code className="inline-block max-w-[150px] truncate rounded bg-neutral-700/40 px-2 py-0.5 text-xs text-neutral-200">
          {code}
        </code>
      ) : (
        <span className="text-xs text-neutral-500">—</span>
      );
    },
  },
  {
    accessorKey: "is_active",
    header: "Estado",
    size: 110,
    cell: ({ row }) => (
      <StatusBadge status={row.original.is_active ?? false}>
        {row.original.is_active ? "Activo" : "Inactivo"}
      </StatusBadge>
    ),
  },
  {
    id: "actions",
    header: "Acciones",
    size: 100,
    cell: ({ row }) => <PromoterActions id={row.original.id} compact />,
  },
];

export default function PromotersClient({
  promoters,
  error,
  pagination,
  total,
}: {
  promoters: PromoterRow[];
  error: string | null;
  pagination: { page: number; pageSize: number; q: string; status: "all" | "active" | "inactive" };
  total: number;
}) {
  const { page, pageSize, q, status } = pagination;
  const [searchValue, setSearchValue] = useState(q);
  const [statusValue, setStatusValue] = useState<"all" | "active" | "inactive">(status);
  const [appliedSearch, setAppliedSearch] = useState(q);
  const [appliedStatus, setAppliedStatus] = useState<"all" | "active" | "inactive">(status);
  const router = useRouter();
  const pathname = usePathname();
  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / pageSize)), [total, pageSize]);
  const currentPage = Math.min(page, totalPages);
  const hasActiveFilters = Boolean(appliedSearch.trim() || appliedStatus !== "all");

  useEffect(() => {
    setSearchValue(q);
    setStatusValue(status);
    setAppliedSearch(q);
    setAppliedStatus(status);
  }, [q, status]);

  const buildQuery = (next: { page?: number; pageSize?: number; q?: string; status?: "all" | "active" | "inactive" }) => {
    const params = new URLSearchParams();
    const nextQ = next.q ?? appliedSearch;
    const nextStatus = next.status ?? appliedStatus;
    const nextPage = next.page ?? 1;
    const nextPageSize = next.pageSize ?? pageSize;

    if (nextQ.trim()) params.set("q", nextQ.trim());
    if (nextStatus !== "all") params.set("status", nextStatus);
    params.set("page", String(nextPage));
    params.set("pageSize", String(nextPageSize));
    return `${pathname}?${params.toString()}`;
  };

  const handleSubmit = () => {
    const nextQ = searchValue.trim();
    const nextStatus = statusValue;
    setAppliedSearch(nextQ);
    setAppliedStatus(nextStatus);
    router.push(buildQuery({ page: 1, q: nextQ, status: nextStatus }));
  };

  const handleClear = () => {
    setSearchValue("");
    setStatusValue("all");
    setAppliedSearch("");
    setAppliedStatus("all");
    router.push(pathname);
  };

  return (
    <main className="space-y-6">
      <ScreenHeader
        icon={UserRound}
        kicker="Promoters Management"
        title="Gestión de Promotores"
        description="Administra promotores y sus datos comerciales."
        actions={
          <>
            <Link
              href="/admin"
              className="inline-flex items-center justify-center rounded-lg border border-neutral-600 px-4 py-2 text-sm font-semibold text-neutral-200 transition-all hover:border-neutral-500 hover:bg-neutral-800"
            >
              ← Dashboard
            </Link>
            <Link
              href="/admin/promoters/create"
              className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-rose-500 to-pink-600 px-4 py-2 text-sm font-semibold text-white transition-all hover:from-rose-400 hover:to-pink-500"
            >
              <CirclePlus className="h-4 w-4" />
              Crear promotor
            </Link>
          </>
        }
      />

      <section className="mb-6 space-y-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-neutral-300">Búsqueda</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
              <Input
                value={searchValue}
                onChange={(event) => setSearchValue(event.target.value)}
                placeholder="Nombre, DNI o código"
                className="h-10 pl-10"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-neutral-300">Estado</label>
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
              <SelectNative
                value={statusValue}
                onChange={(event) => setStatusValue(event.target.value as "all" | "active" | "inactive")}
                className="h-10 pl-10 text-sm"
              >
                <option value="all">Todos</option>
                <option value="active">Activos</option>
                <option value="inactive">Inactivos</option>
              </SelectNative>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button
            type="button"
            onClick={handleSubmit}
            className="bg-gradient-to-r from-rose-500 to-pink-600 text-white hover:from-rose-400 hover:to-pink-500"
          >
            <Search className="h-4 w-4" />
            Filtrar
          </Button>

          {hasActiveFilters ? (
            <Button type="button" variant="ghost" onClick={handleClear}>
              Limpiar
            </Button>
          ) : null}
        </div>
      </section>

      {error ? (
        <div className="rounded-lg border border-red-500/30 bg-red-500/20 p-3 backdrop-blur-sm">
          <p className="text-sm text-red-400">⚠️ Error: {error}</p>
        </div>
      ) : null}

      <section className="rounded-xl border border-neutral-700/70 bg-neutral-900/40 p-1">
        <DataTable
          columns={promoterColumns}
          data={promoters}
          compact
          maxHeight="55vh"
          enableSorting
          showPagination={false}
          emptyMessage="No hay promotores aún."
        />
      </section>

      <ExternalPagination
        currentPage={currentPage}
        totalItems={total}
        itemsPerPage={pageSize}
        onPageChange={(nextPage) => router.push(buildQuery({ page: nextPage }))}
        onPageSizeChange={(nextSize) => router.push(buildQuery({ page: 1, pageSize: nextSize }))}
        itemLabel="promotores"
      />
    </main>
  );
}
