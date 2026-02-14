"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ColumnDef } from "@tanstack/react-table";
import { DataTable, CodeDisplay } from "@repo/ui";
import { formatLimaFromDb } from "shared/limaTime";
import { Eye, Edit2, Trash2, Users, Power, Search, Filter, Calendar } from "lucide-react";
import { useMemo, useTransition, useState } from "react";
import { authedFetch } from "@/lib/authedFetch";
import * as AlertDialog from "@radix-ui/react-alert-dialog";
import MessageModal from "@/components/ui/MessageModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SelectNative } from "@/components/ui/select-native";
import { ScreenHeader } from "../components/ScreenHeader";
import { ExternalPagination } from "../components/ExternalPagination";
import type { EventRow } from "./page";

// Definimos las columnas usando TanStack Table - VERSION ULTRA COMPACTA
const columns: ColumnDef<EventRow>[] = [
  {
    accessorKey: "name",
    header: "Evento",
    size: 150,
    cell: ({ getValue }) => (
      <div className="font-semibold text-neutral-100 max-w-[150px] truncate">
        {getValue() as string}
      </div>
    ),
  },
  {
    accessorKey: "location",
    header: "Ubicación",
    size: 150,
    cell: ({ getValue }) => (
      <div className="text-neutral-300 max-w-[150px] truncate text-xs">
        {(getValue() as string) || "—"}
      </div>
    ),
  },
  {
    accessorKey: "starts_at",
    header: "Fecha",
    size: 120,
    cell: ({ getValue }) => {
      const value = getValue() as string | null;
      const formatted = formatLimaFromDb(value ?? "");
      return (
        <div className="text-neutral-300 font-mono text-xs max-w-[120px] truncate">
          {formatted}
        </div>
      );
    },
  },
  {
    accessorKey: "organizer",
    header: "Organizador",
    size: 120,
    cell: ({ getValue }) => {
      const org = getValue() as { name: string; slug: string } | null;
      return org ? (
        <div className="text-neutral-300 text-xs max-w-[120px] truncate">
          {org.name}
        </div>
      ) : (
        <span className="text-neutral-500 text-xs">—</span>
      );
    },
  },
  {
    accessorKey: "capacity",
    header: "Cap.",
    size: 60,
    cell: ({ getValue }) => {
      const capacity = getValue() as number | null;
      return (
        <div className="text-neutral-300 text-center text-xs">
          {capacity ? (
            <span className="inline-flex items-center gap-1">
              <Users className="h-3 w-3 text-neutral-500" />
              {capacity}
            </span>
          ) : (
            "—"
          )}
        </div>
      );
    },
  },
  {
    accessorKey: "code",
    header: "Código",
    size: 92,
    cell: ({ getValue }) => {
      const code = getValue() as string | null;
      return code ? (
        <CodeDisplay className="text-xs px-1.5 py-0.5 max-w-[92px] truncate block">
          {code}
        </CodeDisplay>
      ) : (
        <span className="text-neutral-500 text-xs">—</span>
      );
    },
  },
  {
    accessorKey: "is_active",
    header: "Estado",
    size: 100,
    cell: ({ row }) => {
      const event = row.original;
      let badge = null;
      let badgeClass = "";
      
      if (event.closed_at) {
        badge = "🔒 Cerrado";
        badgeClass = "bg-neutral-700/50 text-neutral-300 border-neutral-600";
      } else if (event.is_active) {
        badge = "✅ Activo";
        badgeClass = "bg-green-500/20 text-green-400 border-green-500/30";
      } else {
        badge = "⏸️ Inactivo";
        badgeClass = "bg-neutral-600/30 text-neutral-300 border-neutral-600/50";
      }

      return (
        <div className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold border ${badgeClass}`}>
          {badge}
        </div>
      );
    },
  },
  {
    id: "actions",
    header: "Acciones",
    size: 100,
    cell: ({ row }) => <ActionButtons event={row.original} />,
  },
];

function ActionButtons({ event }: { event: EventRow }) {
  const [pending, startTransition] = useTransition();
  const [openCloseDialog, setOpenCloseDialog] = useState(false);
  const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
  const isClosed = event.closed_at !== null;
  const iconButtonBase =
    "inline-flex h-7 w-7 items-center justify-center rounded-md border transition-colors";

  const handleClose = async () => {
    setOpenCloseDialog(false);
    
    startTransition(async () => {
      const res = await authedFetch("/api/events/close", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: event.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.success) {
        // Force hard refresh to avoid cache
        window.location.href = window.location.href;
      } else {
        alert(data?.error || "No se pudo cerrar el evento");
      }
    });
  };

  const handleDelete = async () => {
    setOpenDeleteDialog(false);
    
    startTransition(async () => {
      const res = await authedFetch("/api/events/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: event.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.success) {
        // Force hard refresh to avoid cache
        window.location.href = window.location.href;
      } else {
        alert(data?.error || "No se pudo eliminar el evento");
      }
    });
  };

  return (
    <div className="flex items-center justify-end gap-1.5">
      <Link
        href={`/admin/events/${event.id}`}
        className={`${iconButtonBase} border-neutral-700/80 bg-neutral-800/70 text-neutral-300 hover:border-neutral-600 hover:bg-neutral-700/70 hover:text-neutral-100`}
        title="Ver evento"
      >
        <Eye className="h-3.5 w-3.5" />
      </Link>
      <Link
        href={`/admin/events/${event.id}/edit`}
        className={`${iconButtonBase} border-emerald-500/35 bg-emerald-500/15 text-emerald-300 hover:border-emerald-400/60 hover:bg-emerald-500/25`}
        title="Editar evento"
      >
        <Edit2 className="h-3.5 w-3.5" />
      </Link>


      <AlertDialog.Root open={openCloseDialog} onOpenChange={setOpenCloseDialog}>
        <AlertDialog.Trigger asChild>
          <Button
            type="button"
            disabled={pending || isClosed}
            variant="ghost"
            size="icon"
            className={`${iconButtonBase} ${
              isClosed
                ? "border-neutral-700/80 bg-neutral-800/70 text-neutral-500 cursor-not-allowed"
                : "border-amber-500/35 bg-amber-500/15 text-amber-300 hover:border-amber-400/60 hover:bg-amber-500/25"
            }`}
            title={isClosed ? "Este evento ya está cerrado" : "Cerrar evento"}
          >
            <Power className="h-3.5 w-3.5" />
          </Button>
        </AlertDialog.Trigger>

        <AlertDialog.Portal>
          <AlertDialog.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm" />
          <AlertDialog.Content className="fixed left-[50%] top-[50%] z-50 w-full max-w-md translate-x-[-50%] translate-y-[-50%] rounded-lg border border-neutral-700 bg-neutral-900 p-6 shadow-xl">
            <AlertDialog.Title className="text-lg font-semibold text-white">
              ¿Cerrar evento?
            </AlertDialog.Title>
            <AlertDialog.Description className="mt-3 text-sm text-neutral-300">
              Se cerrará el evento <span className="font-semibold text-neutral-100">{event.name}</span> y no se podrán vender más entradas. 
              <br />
              <br />
              Se desactivarán todos los códigos activos y se archivarán las reservaciones pendientes.
            </AlertDialog.Description>

            <div className="mt-6 flex gap-3 justify-end">
              <AlertDialog.Cancel asChild>
                <Button variant="outline" className="border-neutral-600 text-neutral-200 hover:border-neutral-500 hover:bg-neutral-800">
                  Cancelar
                </Button>
              </AlertDialog.Cancel>
              <AlertDialog.Action asChild>
                <Button
                  onClick={handleClose}
                  disabled={pending}
                  className="bg-orange-600 text-white transition-all hover:bg-orange-700 disabled:opacity-50"
                >
                  {pending ? "Cerrando..." : "Cerrar evento"}
                </Button>
              </AlertDialog.Action>
            </div>
          </AlertDialog.Content>
        </AlertDialog.Portal>
      </AlertDialog.Root>

      <AlertDialog.Root open={openDeleteDialog} onOpenChange={setOpenDeleteDialog}>
        <AlertDialog.Trigger asChild>
          <Button
            type="button"
            disabled={pending}
            variant="ghost"
            size="icon"
            className={`${iconButtonBase} border-rose-500/40 bg-rose-500/15 text-rose-300 hover:border-rose-400/70 hover:bg-rose-500/25 disabled:opacity-50`}
            title="Eliminar evento"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </AlertDialog.Trigger>

        <AlertDialog.Portal>
          <AlertDialog.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm" />
          <AlertDialog.Content className="fixed left-[50%] top-[50%] z-50 w-full max-w-md translate-x-[-50%] translate-y-[-50%] rounded-lg border border-neutral-700 bg-neutral-900 p-6 shadow-xl">
            <AlertDialog.Title className="text-lg font-semibold text-white">
              ¿Eliminar evento?
            </AlertDialog.Title>
            <AlertDialog.Description className="mt-3 text-sm text-neutral-300">
              Se eliminará permanentemente el evento <span className="font-semibold text-neutral-100">{event.name}</span>. 
              <br />
              <br />
              ⚠️ <span className="text-red-400 font-semibold">Esta acción no se puede deshacer.</span> Se borrarán todos los códigos y datos asociados.
            </AlertDialog.Description>

            <div className="mt-6 flex gap-3 justify-end">
              <AlertDialog.Cancel asChild>
                <Button variant="outline" className="border-neutral-600 text-neutral-200 hover:border-neutral-500 hover:bg-neutral-800">
                  Cancelar
                </Button>
              </AlertDialog.Cancel>
              <AlertDialog.Action asChild>
                <Button
                  onClick={handleDelete}
                  disabled={pending}
                  className="bg-red-600 text-white transition-all hover:bg-red-700 disabled:opacity-50"
                >
                  {pending ? "Eliminando..." : "Eliminar evento"}
                </Button>
              </AlertDialog.Action>
            </div>
          </AlertDialog.Content>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    </div>
  );
}

function EventFilters({
  searchValue,
  setSearchValue,
  statusValue,
  setStatusValue,
  onSubmit,
  onClear,
  hasActiveFilters,
}: {
  searchValue: string;
  setSearchValue: (value: string) => void;
  statusValue: "all" | "active" | "inactive" | "closed";
  setStatusValue: (value: "all" | "active" | "inactive" | "closed") => void;
  onSubmit: () => void;
  onClear: () => void;
  hasActiveFilters: boolean;
}) {
  return (
    <div className="mb-6 space-y-4">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
        <div className="space-y-1">
          <label className="text-xs font-semibold text-neutral-300">Búsqueda</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
            <Input
              value={searchValue}
              onChange={(event) => setSearchValue(event.target.value)}
              placeholder="Nombre o ubicación"
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
              onChange={(event) =>
                setStatusValue(event.target.value as "all" | "active" | "inactive" | "closed")
              }
              className="h-10 pl-10 text-sm"
            >
              <option value="all">Todos</option>
              <option value="active">Activos</option>
              <option value="inactive">Inactivos</option>
              <option value="closed">Cerrados</option>
            </SelectNative>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Button
          type="button"
          onClick={onSubmit}
          className="bg-gradient-to-r from-rose-500 to-pink-600 text-white hover:from-rose-400 hover:to-pink-500"
        >
          <Search className="h-4 w-4" />
          Filtrar
        </Button>

        {hasActiveFilters ? (
          <Button type="button" variant="ghost" onClick={onClear}>
            Limpiar
          </Button>
        ) : null}
      </div>
    </div>
  );
}

export default function EventsClient({
  events,
  pagination,
  total,
}: {
  events: EventRow[];
  pagination: { page: number; pageSize: number; q: string; status: "all" | "active" | "inactive" | "closed" };
  total: number;
}) {
  const [message, setMessage] = useState<string | null>(null);
  const [messageType, setMessageType] = useState<"success" | "error" | "warning" | "info">("info");
  const [searchValue, setSearchValue] = useState(pagination.q || "");
  const [statusValue, setStatusValue] = useState<"all" | "active" | "inactive" | "closed">(pagination.status || "all");
  const router = useRouter();
  const pathname = usePathname();

  const hasActiveFilters = Boolean((pagination.q || "").trim() || pagination.status !== "all");

  const handleSubmit = () => {
    const params = new URLSearchParams();
    if (searchValue.trim()) params.set("q", searchValue.trim());
    if (statusValue !== "all") params.set("status", statusValue);
    params.set("page", "1");
    params.set("pageSize", String(pagination.pageSize));
    router.push(`${pathname}?${params.toString()}`);
  };

  const handleClear = () => {
    setSearchValue("");
    setStatusValue("all");
    router.push(pathname);
  };

  const handlePageChange = (newPage: number) => {
    const params = new URLSearchParams();
    if (pagination.q) params.set("q", pagination.q);
    if (pagination.status && pagination.status !== "all") params.set("status", pagination.status);
    params.set("page", String(newPage));
    params.set("pageSize", String(pagination.pageSize));
    router.push(`${pathname}?${params.toString()}`);
  };

  const handlePageSizeChange = (newPageSize: number) => {
    const params = new URLSearchParams();
    if (pagination.q) params.set("q", pagination.q);
    if (pagination.status && pagination.status !== "all") params.set("status", pagination.status);
    params.set("page", "1");
    params.set("pageSize", String(newPageSize));
    router.push(`${pathname}?${params.toString()}`);
  };

  const columnsWithMemo = useMemo(() => columns, []);

  return (
    <main className="space-y-6">
      <ScreenHeader
        icon={Calendar}
        kicker="Events Management"
        title="Gestión de Eventos"
        description="Administra los eventos de tu organización"
        actions={
          <>
            <Link
              href="/admin"
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-neutral-600 px-4 py-2 text-sm font-semibold text-neutral-200 transition-all hover:border-neutral-500 hover:bg-neutral-800"
            >
              ← Dashboard
            </Link>
            <Link
              href="/admin/events/create"
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-rose-500 to-pink-600 px-4 py-2 text-sm font-semibold text-white transition-all hover:from-rose-400 hover:to-pink-500"
            >
              ✨ Crear Evento
            </Link>
          </>
        }
      />

      <EventFilters
        searchValue={searchValue}
        setSearchValue={setSearchValue}
        statusValue={statusValue}
        setStatusValue={setStatusValue}
        onSubmit={handleSubmit}
        onClear={handleClear}
        hasActiveFilters={hasActiveFilters}
      />

      <DataTable
        columns={columnsWithMemo}
        data={events}
        compact
        maxHeight="55vh"
        enableSorting
        enableVirtualization={events.length > 50}
        showPagination={false}
        emptyMessage="🎭 No hay eventos aún. ¡Crea el primero y empieza a organizar!"
      />

      <ExternalPagination
        currentPage={pagination.page}
        totalItems={total}
        itemsPerPage={pagination.pageSize}
        onPageChange={handlePageChange}
        onPageSizeChange={handlePageSizeChange}
        itemLabel="eventos"
      />

      <MessageModal
        message={message}
        type={messageType}
        onClose={() => setMessage(null)}
      />
    </main>
  );
}
