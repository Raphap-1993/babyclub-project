"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@repo/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SelectNative } from "@/components/ui/select-native";
import {
  Calendar,
  User,
  Mail,
  Phone,
  QrCode,
  Download,
  Search,
  Filter,
  Ticket as TicketIcon,
} from "lucide-react";
import TicketActions from "./components/TicketActions";
import { ScreenHeader } from "../components/ScreenHeader";
import { ExternalPagination } from "../components/ExternalPagination";

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
  table_name: string | null;
};

function TicketFilters({
  eventId,
  setEventId,
  eventOptions,
  searchValue,
  setSearchValue,
  promoterId,
  setPromoterId,
  promoterOptions,
  onSubmit,
  exportHref,
  hasActiveFilters,
  onClear,
}: {
  eventId: string;
  setEventId: (id: string) => void;
  eventOptions: Array<{ id: string; label: string }>;
  searchValue: string;
  setSearchValue: (value: string) => void;
  promoterId: string;
  setPromoterId: (id: string) => void;
  promoterOptions: Array<{ id: string; label: string }>;
  onSubmit: () => void;
  exportHref: string;
  hasActiveFilters: boolean;
  onClear: () => void;
}) {
  return (
    <div className="space-y-4 mb-6">
      {/* Filtros principales */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        <div className="space-y-1">
          <label className="text-xs font-semibold text-neutral-300">
            Búsqueda
          </label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-neutral-400" />
            <Input
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              placeholder="DNI, nombre o email"
              className="h-10 pl-10"
            />
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-semibold text-neutral-300">Evento</label>
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-neutral-400" />
            <SelectNative
              value={eventId}
              onChange={(e) => setEventId(e.target.value)}
              className="h-10 pl-10 text-sm"
            >
              <option value="">Todos los eventos</option>
              {eventOptions.map((event) => (
                <option key={event.id} value={event.id}>
                  {event.label}
                </option>
              ))}
            </SelectNative>
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-semibold text-neutral-300">
            Promotor
          </label>
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-neutral-400" />
            <SelectNative
              value={promoterId}
              onChange={(e) => setPromoterId(e.target.value)}
              className="h-10 pl-10 text-sm"
            >
              <option value="">Todos los promotores</option>
              {promoterOptions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </SelectNative>
          </div>
        </div>
      </div>

      {/* Acciones */}
      <div className="flex items-center gap-3">
        <Button
          type="button"
          onClick={onSubmit}
          className="bg-gradient-to-r from-rose-500 to-pink-600 text-white hover:from-rose-400 hover:to-pink-500"
        >
          🔍 Filtrar
        </Button>

        {hasActiveFilters && (
          <Button
            type="button"
            variant="ghost"
            onClick={onClear}
          >
            ✨ Limpiar
          </Button>
        )}

        <Link
          href={exportHref}
          className="inline-flex items-center gap-2 bg-green-600 hover:bg-green-500 px-4 py-2 text-sm font-semibold text-white rounded-lg transition-colors"
        >
          <Download className="h-4 w-4" />
          Exportar
        </Link>
      </div>
    </div>
  );
}

// Definición de columnas para tickets
const createTicketsColumns = (): ColumnDef<TicketRow>[] => [
  {
    accessorKey: "full_name",
    header: "Cliente",
    size: 180,
    cell: ({ row }) => {
      const ticket = row.original;
      return (
        <div className="min-w-0">
          <div className="font-medium text-neutral-100 truncate">
            {ticket.full_name || "Sin nombre"}
          </div>
          <div className="text-xs text-neutral-400 font-mono truncate">
            {ticket.dni || "—"}
          </div>
        </div>
      );
    },
  },
  {
    accessorKey: "contact",
    header: "Contacto",
    size: 180,
    cell: ({ row }) => {
      const ticket = row.original;
      return (
        <div className="text-xs text-neutral-300 space-y-0.5">
          {ticket.email && (
            <div className="flex items-center gap-1 truncate">
              <Mail className="h-3 w-3 text-neutral-500 flex-shrink-0" />
              <span className="truncate">{ticket.email}</span>
            </div>
          )}
          {ticket.phone && (
            <div className="flex items-center gap-1">
              <Phone className="h-3 w-3 text-neutral-500 flex-shrink-0" />
              <span>{ticket.phone}</span>
            </div>
          )}
        </div>
      );
    },
  },
  {
    accessorKey: "event_name",
    header: "Evento",
    size: 100,
    cell: ({ row, getValue }) => {
      const eventName = getValue() as string | null;
      const tableName = row.original.table_name;
      return (
        <div className="min-w-0">
          <div
            className="text-xs text-neutral-200 truncate"
            title={eventName || ""}
          >
            {eventName || "—"}
          </div>
          {tableName ? (
            <div className="text-[11px] text-neutral-400 truncate">
              Mesa: {tableName}
            </div>
          ) : null}
        </div>
      );
    },
  },
  {
    accessorKey: "code_value",
    header: "Código QR",
    size: 150,
    cell: ({ getValue }) => {
      const code = getValue() as string | null;
      return code ? (
        <div className="flex items-center gap-1">
          <QrCode className="h-3 w-3 text-neutral-500" />
          <code className="text-xs bg-neutral-700/30 border border-neutral-600/30 px-1.5 py-0.5 rounded font-mono text-neutral-300 truncate">
            {code}
          </code>
        </div>
      ) : (
        <span className="text-neutral-500 text-xs">—</span>
      );
    },
  },
  {
    accessorKey: "promoter_name",
    header: "Promotor",
    size: 120,
    cell: ({ getValue }) => {
      const promoter = getValue() as string | null;
      return (
        <div className="text-xs text-neutral-300 truncate" title={promoter || ""}>
          {promoter ? (
            <span className="inline-flex items-center gap-1">
              <User className="h-3 w-3 text-neutral-500" />
              {promoter}
            </span>
          ) : (
            "—"
          )}
        </div>
      );
    },
  },
  {
    accessorKey: "created_at",
    header: "Fecha",
    size: 100,
    cell: ({ getValue }) => {
      const date = getValue() as string;
      const formatted = new Date(date).toLocaleDateString("es-PE", {
        day: "2-digit",
        month: "2-digit",
        year: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });
      return (
        <div className="flex items-center gap-1 text-xs text-neutral-300">
          <Calendar className="h-3 w-3 text-neutral-500" />
          <span className="font-mono">{formatted}</span>
        </div>
      );
    },
  },
  {
    id: "actions",
    header: "Acciones",
    size: 80,
    cell: ({ row }) => {
      const ticket = row.original;
      return <TicketActions id={ticket.id} />;
    },
  },
];

export default function ModernTicketsClient({
  initialTickets,
  error,
  filters,
  promoterOptions,
  eventOptions,
}: {
  initialTickets: TicketRow[];
  error: string | null;
  filters: {
    event_id: string;
    q: string;
    promoter_id: string;
    page: number;
    pageSize: number;
    total: number;
  };
  promoterOptions: Array<{ id: string; label: string }>;
  eventOptions: Array<{ id: string; label: string }>;
}) {
  const { event_id, q, promoter_id, page, pageSize, total } = filters;
  const [eventId, setEventId] = useState(event_id);
  const [searchValue, setSearchValue] = useState(q);
  const [promoterId, setPromoterId] = useState(promoter_id);
  const router = useRouter();
  const pathname = usePathname();

  const exportHref = useMemo(() => {
    const params = new URLSearchParams();
    if (eventId) params.set("event_id", eventId);
    if (searchValue) params.set("q", searchValue);
    if (promoterId) params.set("promoter_id", promoterId);
    return `/api/admin/tickets/export?${params.toString()}`;
  }, [eventId, searchValue, promoterId]);

  const hasActiveFilters = Boolean(eventId || searchValue || promoterId);

  const handleSubmit = () => {
    const params = new URLSearchParams();
    if (eventId) params.set("event_id", eventId);
    if (searchValue) params.set("q", searchValue);
    if (promoterId) params.set("promoter_id", promoterId);
    params.set("page", "1");
    params.set("pageSize", String(pageSize));

    router.push(`${pathname}?${params.toString()}`);
  };

  const handleClear = () => {
    setEventId("");
    setSearchValue("");
    setPromoterId("");
    router.push(pathname);
  };

  const handlePageChange = (newPage: number) => {
    const params = new URLSearchParams();
    if (event_id) params.set("event_id", event_id);
    if (q) params.set("q", q);
    if (promoter_id) params.set("promoter_id", promoter_id);
    params.set("page", String(newPage));
    params.set("pageSize", String(pageSize));

    router.push(`${pathname}?${params.toString()}`);
  };

  const handlePageSizeChange = (newPageSize: number) => {
    const params = new URLSearchParams();
    if (event_id) params.set("event_id", event_id);
    if (q) params.set("q", q);
    if (promoter_id) params.set("promoter_id", promoter_id);
    params.set("page", "1"); // Reset to first page when changing page size
    params.set("pageSize", String(newPageSize));

    router.push(`${pathname}?${params.toString()}`);
  };

  const columns = createTicketsColumns();

  return (
    <main className="space-y-6">
      <ScreenHeader
        icon={TicketIcon}
        kicker="Tickets Management"
        title="Gestión de Tickets"
        description="Administra todos los tickets generados"
        actions={
          <Link
            href="/admin"
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-neutral-600 px-4 py-2 text-sm font-semibold text-neutral-200 transition-all hover:border-neutral-500 hover:bg-neutral-800"
          >
            ← Dashboard
          </Link>
        }
      />

      {/* Sistema de filtros */}
      <TicketFilters
        eventId={eventId}
        setEventId={setEventId}
        eventOptions={eventOptions}
        searchValue={searchValue}
        setSearchValue={setSearchValue}
        promoterId={promoterId}
        setPromoterId={setPromoterId}
        promoterOptions={promoterOptions}
        onSubmit={handleSubmit}
        exportHref={exportHref}
        hasActiveFilters={hasActiveFilters}
        onClear={handleClear}
      />

      {/* Error handling */}
      {error && (
        <div className="rounded-lg bg-red-500/20 border border-red-500/30 p-3 backdrop-blur-sm">
          <p className="text-sm text-red-400">⚠️ Error: {error}</p>
        </div>
      )}

      {/* Tabla moderna ultra compacta */}
      <DataTable
        columns={columns}
        data={initialTickets}
        compact={true}
        maxHeight="55vh"
        enableSorting={true}
        enableVirtualization={initialTickets.length > 100}
        showPagination={false} // Usamos paginación externa
        emptyMessage="🎫 No hay tickets que coincidan con los filtros aplicados"
      />

      {/* Paginación externa moderna */}
      <ExternalPagination
        currentPage={page}
        totalItems={total}
        itemsPerPage={pageSize}
        onPageChange={handlePageChange}
        onPageSizeChange={handlePageSizeChange}
        itemLabel="tickets"
      />

    </main>
  );
}
