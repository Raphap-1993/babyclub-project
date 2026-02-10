"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ColumnDef } from "@tanstack/react-table";
import { DataTable, StatusBadge, ModernDatePicker } from "@repo/ui";
import { Eye, Calendar, User, Mail, Phone, QrCode, Download, Search, Filter, ChevronLeft, ChevronRight } from "lucide-react";
import TicketActions from "./components/TicketActions";

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

// Componente de paginación externa compacta
function ExternalPagination({
  currentPage,
  totalItems,
  itemsPerPage,
  onPageChange,
  onPageSizeChange,
}: {
  currentPage: number;
  totalItems: number;
  itemsPerPage: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
}) {
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const startItem = (currentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(currentPage * itemsPerPage, totalItems);

  return (
    <div className="flex items-center justify-between px-2 py-3 bg-slate-800/20 border border-slate-700/30 rounded-lg backdrop-blur-sm">
      {/* Info */}
      <div className="flex items-center text-xs text-slate-400">
        <span>
          Mostrando <span className="font-medium text-slate-300">{startItem}</span> a{" "}
          <span className="font-medium text-slate-300">{endItem}</span> de{" "}
          <span className="font-medium text-slate-300">{totalItems}</span> tickets
        </span>
      </div>

      {/* Controles */}
      <div className="flex items-center gap-4">
        {/* Selector de tamaño de página */}
        <div className="flex items-center gap-2 text-xs">
          <label htmlFor="pageSize" className="text-slate-400">
            Por página:
          </label>
          <select
            id="pageSize"
            value={itemsPerPage}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className="bg-slate-800/50 border border-slate-600 rounded px-2 py-1 text-slate-200 text-xs"
          >
            <option value={5}>5</option>
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </div>

        {/* Navegación */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage <= 1}
            className="flex items-center justify-center w-8 h-8 text-slate-400 transition-colors hover:text-slate-200 hover:bg-slate-700/50 rounded disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          
          <div className="flex items-center gap-1 text-xs">
            <span className="text-slate-400">Página</span>
            <span className="font-medium text-slate-200 px-2 py-1 bg-slate-700/50 rounded">
              {currentPage}
            </span>
            <span className="text-slate-400">de {totalPages}</span>
          </div>
          
          <button
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage >= totalPages}
            className="flex items-center justify-center w-8 h-8 text-slate-400 transition-colors hover:text-slate-200 hover:bg-slate-700/50 rounded disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
function TicketFilters({
  fromDate,
  setFromDate,
  toDate,
  setToDate,
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
  fromDate: string;
  setFromDate: (date: string) => void;
  toDate: string;
  setToDate: (date: string) => void;
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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="space-y-1">
          <label className="text-xs font-semibold text-slate-300">Desde</label>
          <ModernDatePicker value={fromDate} onChange={setFromDate} name="from" placeholder="Fecha inicio" />
        </div>
        
        <div className="space-y-1">
          <label className="text-xs font-semibold text-slate-300">Hasta</label>
          <ModernDatePicker value={toDate} onChange={setToDate} name="to" placeholder="Fecha fin" />
        </div>
        
        <div className="space-y-1">
          <label className="text-xs font-semibold text-slate-300">Búsqueda</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              placeholder="DNI, nombre o email"
              className="w-full pl-10 pr-4 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-500/50 focus:border-rose-500/50 text-sm"
            />
          </div>
        </div>
        
        <div className="space-y-1">
          <label className="text-xs font-semibold text-slate-300">Promotor</label>
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
            <select
              value={promoterId}
              onChange={(e) => setPromoterId(e.target.value)}
              className="w-full pl-10 pr-8 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-500/50 focus:border-rose-500/50 text-sm appearance-none cursor-pointer"
            >
              <option value="">Todos los promotores</option>
              {promoterOptions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
      
      {/* Acciones */}
      <div className="flex items-center gap-3">
        <button
          onClick={onSubmit}
          className="inline-flex items-center gap-2 bg-gradient-to-r from-rose-500 to-pink-600 px-4 py-2 text-sm font-semibold text-white rounded-lg shadow-lg transition-all hover:shadow-xl hover:from-rose-400 hover:to-pink-500 hover:scale-105"
        >
          🔍 Filtrar
        </button>
        
        {hasActiveFilters && (
          <button
            onClick={onClear}
            className="inline-flex items-center gap-2 border border-slate-600 px-4 py-2 text-sm font-semibold text-slate-200 rounded-lg transition-all hover:border-slate-500 hover:bg-slate-800"
          >
            ✨ Limpiar
          </button>
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
          <div className="font-medium text-slate-100 truncate">
            {ticket.full_name || "Sin nombre"}
          </div>
          <div className="text-xs text-slate-400 font-mono truncate">
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
        <div className="text-xs text-slate-300 space-y-0.5">
          {ticket.email && (
            <div className="flex items-center gap-1 truncate">
              <Mail className="h-3 w-3 text-slate-500 flex-shrink-0" />
              <span className="truncate">{ticket.email}</span>
            </div>
          )}
          {ticket.phone && (
            <div className="flex items-center gap-1">
              <Phone className="h-3 w-3 text-slate-500 flex-shrink-0" />
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
    cell: ({ getValue }) => {
      const eventName = getValue() as string | null;
      return (
        <div className="text-xs text-slate-200 truncate" title={eventName || ""}>
          {eventName || "—"}
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
          <QrCode className="h-3 w-3 text-slate-500" />
          <code className="text-xs bg-slate-700/30 border border-slate-600/30 px-1.5 py-0.5 rounded font-mono text-slate-300 truncate">
            {code}
          </code>
        </div>
      ) : (
        <span className="text-slate-500 text-xs">—</span>
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
        <div className="text-xs text-slate-300 truncate" title={promoter || ""}>
          {promoter ? (
            <span className="inline-flex items-center gap-1">
              <User className="h-3 w-3 text-slate-500" />
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
      const formatted = new Date(date).toLocaleDateString('es-PE', {
        day: '2-digit',
        month: '2-digit',
        year: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });
      return (
        <div className="flex items-center gap-1 text-xs text-slate-300">
          <Calendar className="h-3 w-3 text-slate-500" />
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
}: {
  initialTickets: TicketRow[];
  error: string | null;
  filters: { from: string; to: string; q: string; promoter_id: string; page: number; pageSize: number; total: number };
  promoterOptions: Array<{ id: string; label: string }>;
}) {
  const { from, to, q, promoter_id, page, pageSize, total } = filters;
  const [fromDate, setFromDate] = useState(from);
  const [toDate, setToDate] = useState(to);
  const [searchValue, setSearchValue] = useState(q);
  const [promoterId, setPromoterId] = useState(promoter_id);
  const router = useRouter();
  const pathname = usePathname();

  const exportHref = useMemo(() => {
    const params = new URLSearchParams();
    if (fromDate) params.set("from", fromDate);
    if (toDate) params.set("to", toDate);
    if (searchValue) params.set("q", searchValue);
    if (promoterId) params.set("promoter_id", promoterId);
    return `/api/admin/tickets/export?${params.toString()}`;
  }, [fromDate, toDate, searchValue, promoterId]);

  const hasActiveFilters = Boolean(from || to || q || promoter_id);

  const handleSubmit = () => {
    const params = new URLSearchParams();
    if (fromDate) params.set("from", fromDate);
    if (toDate) params.set("to", toDate);
    if (searchValue) params.set("q", searchValue);
    if (promoterId) params.set("promoter_id", promoterId);
    params.set("page", "1");
    params.set("pageSize", String(pageSize));
    
    router.push(`${pathname}?${params.toString()}`);
  };

  const handleClear = () => {
    setFromDate("");
    setToDate("");
    setSearchValue("");
    setPromoterId("");
    router.push(pathname);
  };

  const handlePageChange = (newPage: number) => {
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    if (q) params.set("q", q);
    if (promoter_id) params.set("promoter_id", promoter_id);
    params.set("page", String(newPage));
    params.set("pageSize", String(pageSize));
    
    router.push(`${pathname}?${params.toString()}`);
  };

  const handlePageSizeChange = (newPageSize: number) => {
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    if (q) params.set("q", q);
    if (promoter_id) params.set("promoter_id", promoter_id);
    params.set("page", "1"); // Reset to first page when changing page size
    params.set("pageSize", String(newPageSize));
    
    router.push(`${pathname}?${params.toString()}`);
  };

  const columns = createTicketsColumns();

  return (
    <main className="space-y-6">
      {/* Header moderno */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-rose-400/80">
            🎫 Tickets Management
          </p>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
            Gestión de Tickets
          </h1>
          <p className="text-sm text-slate-400">
            Administra todos los tickets generados
          </p>
        </div>
        <div className="flex gap-3">
          <Link
            href="/admin"
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-600 px-4 py-2 text-sm font-semibold text-slate-200 transition-all hover:border-slate-500 hover:bg-slate-800"
          >
            ← Dashboard
          </Link>
        </div>
      </div>

      {/* Stats compactas */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <div className="bg-slate-800/30 border border-slate-700/50 rounded-lg p-3 backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <span className="text-lg">🎫</span>
            <div>
              <p className="text-xs text-slate-400">Total Tickets</p>
              <p className="text-lg font-bold text-white">{total}</p>
            </div>
          </div>
        </div>
        <div className="bg-slate-800/30 border border-slate-700/50 rounded-lg p-3 backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <span className="text-lg">📊</span>
            <div>
              <p className="text-xs text-slate-400">Esta página</p>
              <p className="text-lg font-bold text-blue-400">{initialTickets.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-slate-800/30 border border-slate-700/50 rounded-lg p-3 backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <span className="text-lg">👥</span>
            <div>
              <p className="text-xs text-slate-400">Promotores</p>
              <p className="text-lg font-bold text-green-400">{promoterOptions.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-slate-800/30 border border-slate-700/50 rounded-lg p-3 backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <span className="text-lg">🔍</span>
            <div>
              <p className="text-xs text-slate-400">Filtros</p>
              <p className="text-lg font-bold text-yellow-400">
                {hasActiveFilters ? "Activos" : "Ninguno"}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Sistema de filtros */}
      <TicketFilters
        fromDate={fromDate}
        setFromDate={setFromDate}
        toDate={toDate}
        setToDate={setToDate}
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
          <p className="text-sm text-red-400">
            ⚠️ Error: {error}
          </p>
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
      />

      {/* Información adicional */}
      <div className="mt-4 rounded-lg bg-slate-800/20 border border-slate-700/30 p-3 backdrop-blur-sm">
        <p className="text-xs text-slate-400">
          💡 <strong>Tip:</strong> Usa los filtros para encontrar tickets específicos por fecha, promotor o información del cliente. 
          Los códigos QR se pueden exportar desde el botón "Exportar".
        </p>
      </div>
    </main>
  );
}