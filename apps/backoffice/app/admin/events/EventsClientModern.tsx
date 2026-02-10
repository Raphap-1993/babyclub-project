"use client";

import Link from "next/link";
import { ColumnDef } from "@tanstack/react-table";
import { DataTable, StatusBadge, CodeDisplay } from "@repo/ui";
import { formatLimaFromDb } from "shared/limaTime";
import { Eye, Edit2, Trash2, Users, Power } from "lucide-react";
import { useTransition, useState } from "react";
import { authedFetch } from "@/lib/authedFetch";
import * as AlertDialog from "@radix-ui/react-alert-dialog";import MessageModal from "@/components/ui/MessageModal";import type { EventRow } from "./page";

// Definimos las columnas usando TanStack Table - VERSION ULTRA COMPACTA
const columns: ColumnDef<EventRow>[] = [
  {
    accessorKey: "name",
    header: "Evento",
    size: 150,
    cell: ({ getValue }) => (
      <div className="font-semibold text-slate-100 max-w-[150px] truncate">
        {getValue() as string}
      </div>
    ),
  },
  {
    accessorKey: "location",
    header: "Ubicación",
    size: 150,
    cell: ({ getValue }) => (
      <div className="text-slate-300 max-w-[150px] truncate text-xs">
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
        <div className="text-slate-300 font-mono text-xs max-w-[120px] truncate">
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
        <div className="text-slate-300 text-xs max-w-[120px] truncate">
          {org.name}
        </div>
      ) : (
        <span className="text-slate-500 text-xs">—</span>
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
        <div className="text-slate-300 text-center text-xs">
          {capacity ? (
            <span className="inline-flex items-center gap-1">
              <Users className="h-3 w-3 text-slate-500" />
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
        <span className="text-slate-500 text-xs">—</span>
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
        badgeClass = "bg-slate-700/50 text-slate-300 border-slate-600";
      } else if (event.is_active) {
        badge = "✅ Activo";
        badgeClass = "bg-green-500/20 text-green-400 border-green-500/30";
      } else {
        badge = "⏸️ Inactivo";
        badgeClass = "bg-slate-600/30 text-slate-300 border-slate-600/50";
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
    <div className="flex items-center gap-1">
      <Link
        href={`/admin/events/${event.id}`}
        className="inline-flex items-center justify-center w-6 h-6 rounded bg-blue-500/20 text-blue-400 transition-colors hover:bg-blue-500/30 hover:text-blue-300"
        title="Ver evento"
      >
        <Eye className="h-3 w-3" />
      </Link>
      <Link
        href={`/admin/events/${event.id}/edit`}
        className="inline-flex items-center justify-center w-6 h-6 rounded bg-green-500/20 text-green-400 transition-colors hover:bg-green-500/30 hover:text-green-300"
        title="Editar evento"
      >
        <Edit2 className="h-3 w-3" />
      </Link>


      <AlertDialog.Root open={openCloseDialog} onOpenChange={setOpenCloseDialog}>
        <AlertDialog.Trigger asChild>
          <button
            disabled={pending || isClosed}
            className={`inline-flex items-center justify-center w-6 h-6 rounded transition-colors ${
              isClosed
                ? "bg-slate-700/50 text-slate-500 cursor-not-allowed"
                : "bg-orange-500/20 text-orange-400 hover:bg-orange-500/30 hover:text-orange-300"
            }`}
            title={isClosed ? "Este evento ya está cerrado" : "Cerrar evento"}
          >
            <Power className="h-3 w-3" />
          </button>
        </AlertDialog.Trigger>

        <AlertDialog.Portal>
          <AlertDialog.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm" />
          <AlertDialog.Content className="fixed left-[50%] top-[50%] z-50 w-full max-w-md translate-x-[-50%] translate-y-[-50%] rounded-lg border border-slate-700 bg-slate-900 p-6 shadow-xl">
            <AlertDialog.Title className="text-lg font-semibold text-white">
              ¿Cerrar evento?
            </AlertDialog.Title>
            <AlertDialog.Description className="mt-3 text-sm text-slate-300">
              Se cerrará el evento <span className="font-semibold text-slate-100">{event.name}</span> y no se podrán vender más entradas. 
              <br />
              <br />
              Se desactivarán todos los códigos activos y se archivarán las reservaciones pendientes.
            </AlertDialog.Description>

            <div className="mt-6 flex gap-3 justify-end">
              <AlertDialog.Cancel asChild>
                <button className="px-4 py-2 rounded-lg border border-slate-600 text-sm font-medium text-slate-200 transition-all hover:border-slate-500 hover:bg-slate-800">
                  Cancelar
                </button>
              </AlertDialog.Cancel>
              <AlertDialog.Action asChild>
                <button
                  onClick={handleClose}
                  disabled={pending}
                  className="px-4 py-2 rounded-lg bg-orange-600 text-sm font-medium text-white transition-all hover:bg-orange-700 disabled:opacity-50"
                >
                  {pending ? "Cerrando..." : "Cerrar evento"}
                </button>
              </AlertDialog.Action>
            </div>
          </AlertDialog.Content>
        </AlertDialog.Portal>
      </AlertDialog.Root>

      <AlertDialog.Root open={openDeleteDialog} onOpenChange={setOpenDeleteDialog}>
        <AlertDialog.Trigger asChild>
          <button
            disabled={pending}
            className="inline-flex items-center justify-center w-6 h-6 rounded bg-red-500/20 text-red-400 transition-colors hover:bg-red-500/30 hover:text-red-300 disabled:opacity-50"
            title="Eliminar evento"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </AlertDialog.Trigger>

        <AlertDialog.Portal>
          <AlertDialog.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm" />
          <AlertDialog.Content className="fixed left-[50%] top-[50%] z-50 w-full max-w-md translate-x-[-50%] translate-y-[-50%] rounded-lg border border-slate-700 bg-slate-900 p-6 shadow-xl">
            <AlertDialog.Title className="text-lg font-semibold text-white">
              ¿Eliminar evento?
            </AlertDialog.Title>
            <AlertDialog.Description className="mt-3 text-sm text-slate-300">
              Se eliminará permanentemente el evento <span className="font-semibold text-slate-100">{event.name}</span>. 
              <br />
              <br />
              ⚠️ <span className="text-red-400 font-semibold">Esta acción no se puede deshacer.</span> Se borrarán todos los códigos y datos asociados.
            </AlertDialog.Description>

            <div className="mt-6 flex gap-3 justify-end">
              <AlertDialog.Cancel asChild>
                <button className="px-4 py-2 rounded-lg border border-slate-600 text-sm font-medium text-slate-200 transition-all hover:border-slate-500 hover:bg-slate-800">
                  Cancelar
                </button>
              </AlertDialog.Cancel>
              <AlertDialog.Action asChild>
                <button
                  onClick={handleDelete}
                  disabled={pending}
                  className="px-4 py-2 rounded-lg bg-red-600 text-sm font-medium text-white transition-all hover:bg-red-700 disabled:opacity-50"
                >
                  {pending ? "Eliminando..." : "Eliminar evento"}
                </button>
              </AlertDialog.Action>
            </div>
          </AlertDialog.Content>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    </div>
  );
}

export default function EventsClient({
  events,
  pagination,
  total,
}: {
  events: EventRow[];
  pagination: { page: number; pageSize: number };
  total: number;
}) {
  const [message, setMessage] = useState<string | null>(null);
  const [messageType, setMessageType] = useState<"success" | "error" | "warning" | "info">("info");

  return (
    <main className="space-y-6">
      {/* Header mejorado */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-rose-400/80">
            📊 Dashboard
          </p>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
            Gestión de Eventos
          </h1>
          <p className="text-sm text-slate-400">
            Administra los eventos de tu organización
          </p>
        </div>
        <div className="flex gap-3">
          <Link
            href="/admin"
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-600 px-4 py-2 text-sm font-semibold text-slate-200 transition-all hover:border-slate-500 hover:bg-slate-800 hover:shadow-md"
          >
            ← Volver al Dashboard
          </Link>
          <Link
            href="/admin/events/create"
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-rose-500 to-pink-600 px-5 py-2 text-sm font-semibold text-white shadow-lg transition-all hover:shadow-xl hover:from-rose-400 hover:to-pink-500 hover:scale-105"
          >
            ✨ Crear Evento
          </Link>
        </div>
      </div>

      {/* Stats rápidas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4 backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <span className="text-2xl">📅</span>
            <div>
              <p className="text-sm text-slate-400">Total de Eventos</p>
              <p className="text-2xl font-bold text-white">{total}</p>
            </div>
          </div>
        </div>
        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4 backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <span className="text-2xl">✅</span>
            <div>
              <p className="text-sm text-slate-400">Eventos Activos</p>
              <p className="text-2xl font-bold text-green-400">
                {events.filter(e => e.is_active).length}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4 backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <span className="text-2xl">⏸️</span>
            <div>
              <p className="text-sm text-slate-400">Eventos Inactivos</p>
              <p className="text-2xl font-bold text-slate-400">
                {events.filter(e => !e.is_active).length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabla ultra compacta con TanStack Table y paginación */}
      <DataTable
        columns={columns}
        data={events}
        compact={true}
        maxHeight="50vh"
        enableSorting={true}
        enableVirtualization={events.length > 50}
        showPagination={true}
        pageSize={15}
        pageSizeOptions={[10, 15, 25, 50]}
        emptyMessage="🎭 No hay eventos aún. ¡Crea el primero y empieza a organizar!"
      />

      {/* Nota informativa */}
      <div className="mt-6 rounded-lg bg-slate-800/30 border border-slate-700/50 p-4 backdrop-blur-sm">
        <p className="text-xs text-slate-400">
          💡 <strong>Tip:</strong> Los eventos inactivos no son visibles para el público, 
          pero conservan toda su información y códigos asociados.
        </p>
      </div>

      <MessageModal
        message={message}
        type={messageType}
        onClose={() => setMessage(null)}
      />
    </main>
  );
}