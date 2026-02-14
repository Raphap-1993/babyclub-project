"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { ColumnDef } from "@tanstack/react-table";
import { DataTable, StatusBadge, ModernDatePicker } from "@repo/ui";
import { authedFetch } from "@/lib/authedFetch";
import { Calendar, Users, Mail, Phone, QrCode, Search, Filter, Eye, Send, XCircle, CheckCircle } from "lucide-react";
import CreateReservationModal from "./components/CreateReservationModal";
import ViewReservationModal from "./components/ViewReservationModal";
import * as AlertDialog from "@radix-ui/react-alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SelectNative } from "@/components/ui/select-native";
import { ScreenHeader } from "../components/ScreenHeader";
import { ExternalPagination } from "../components/ExternalPagination";

type ReservationRow = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  status: string;
  codes: string[] | null;
  ticket_quantity: number | null;
  table_name: string;
  event_name: string;
  organizer_name: string;
  organizer_id: string;
  created_at?: string;
};

// Componente de búsqueda y filtros expandido
function SearchAndDateFilters({
  searchQuery,
  onSearchChange,
  statusFilter,
  onStatusChange,
  organizerFilter,
  onOrganizerChange,
  organizers,
  fromDate,
  onFromDateChange,
  toDate,
  onToDateChange,
  onApplyFilters,
  onClearFilters,
  hasActiveFilters,
}: {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  statusFilter: string;
  onStatusChange: (value: string) => void;
  organizerFilter: string;
  onOrganizerChange: (value: string) => void;
  organizers: { id: string; name: string }[];
  fromDate: string;
  onFromDateChange: (value: string) => void;
  toDate: string;
  onToDateChange: (value: string) => void;
  onApplyFilters: () => void;
  onClearFilters: () => void;
  hasActiveFilters: boolean;
}) {
  return (
    <div className="space-y-3 mb-4">
      {/* Filtros compactos en 2 filas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2">
        <ModernDatePicker 
          value={fromDate} 
          onChange={onFromDateChange} 
          placeholder="Desde" 
        />
        
        <ModernDatePicker 
          value={toDate} 
          onChange={onToDateChange} 
          placeholder="Hasta" 
        />

        <div className="relative">
          <SelectNative
            value={organizerFilter}
            onChange={(e) => onOrganizerChange(e.target.value)}
            className="h-10 border-neutral-700 bg-neutral-800/50 text-neutral-200"
          >
            <option value="all">Todos los organizadores</option>
            {organizers.map((org) => (
              <option key={org.id} value={org.id}>{org.name}</option>
            ))}
          </SelectNative>
        </div>
        
        <div className="relative">
          <SelectNative
            value={statusFilter}
            onChange={(e) => onStatusChange(e.target.value)}
            className="h-10 border-neutral-700 bg-neutral-800/50 text-neutral-200"
          >
            <option value="all">Todos los estados</option>
            <option value="pending">🟡 Pendiente</option>
            <option value="approved">✅ Aprobada</option>
            <option value="rejected">❌ Rechazada</option>
          </SelectNative>
        </div>
      </div>
      
      {/* Segunda fila: Búsqueda y acciones */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-neutral-400" />
          <Input
            type="text"
            placeholder="Buscar por nombre, email o teléfono..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="h-10 border-neutral-700 bg-neutral-800/50 pl-10 text-neutral-200 placeholder:text-neutral-400"
          />
        </div>
        
        <Button
          onClick={onApplyFilters}
          className="bg-gradient-to-r from-rose-500 to-pink-600 shadow-lg hover:from-rose-400 hover:to-pink-500 hover:shadow-xl"
        >
          <Filter className="h-4 w-4" />
          Filtrar
        </Button>
        
        {hasActiveFilters && (
          <Button
            onClick={onClearFilters}
            variant="outline"
            className="border-neutral-600 text-neutral-200 hover:border-neutral-500 hover:bg-neutral-800"
          >
            Limpiar
          </Button>
        )}
      </div>
    </div>
  );
}

// Definición de columnas simplificadas (sin columnas redundantes)
const createColumns = (
  onViewReservation: (id: string) => void,
  onApproveReservation: (id: string) => void,
  onResendEmail: (id: string) => void,
  onCancelReservation: (id: string) => void,
  openMenuId: string | null,
  setOpenMenuId: (id: string | null) => void
): ColumnDef<ReservationRow>[] => [
  {
    accessorKey: "full_name",
    header: "Cliente",
    cell: ({ row }) => {
      const reservation = row.original;
      return (
        <div className="min-w-0">
          <div className="font-medium text-neutral-100 truncate">
            {reservation.full_name}
          </div>
          {reservation.email && (
            <div className="text-xs text-neutral-400 truncate flex items-center gap-1">
              <Mail className="h-3 w-3" />
              {reservation.email}
            </div>
          )}
        </div>
      );
    },
  },
  {
    accessorKey: "phone",
    header: "Teléfono",
    cell: ({ row }) => {
      const reservation = row.original;
      return reservation.phone ? (
        <div className="text-xs text-neutral-300 flex items-center gap-1">
          <Phone className="h-3 w-3 text-neutral-500" />
          {reservation.phone}
        </div>
      ) : (
        <span className="text-neutral-500 text-xs">—</span>
      );
    },
  },
  {
    accessorKey: "event_info",
    header: "Evento & Mesa",
    cell: ({ row }) => {
      const reservation = row.original;
      return (
        <div className="text-xs">
          <div className="font-medium text-neutral-200 truncate">
            {reservation.event_name}
          </div>
          <div className="text-neutral-400 flex items-center gap-1">
            <Users className="h-3 w-3" />
            {reservation.table_name}
          </div>
        </div>
      );
    },
  },
  {
    accessorKey: "codes",
    header: "Entradas",
    cell: ({ row }) => {
      const reservation = row.original;
      const codesCount = reservation.codes?.length || 0;
      return (
        <div className="text-center">
          {codesCount > 0 ? (
            <span className="inline-flex items-center gap-1 text-xs bg-neutral-500/20 text-neutral-400 px-2 py-1 rounded-full">
              <QrCode className="h-3 w-3" />
              <span>{codesCount}</span>
            </span>
          ) : (
            <span className="text-neutral-500 text-xs">—</span>
          )}
        </div>
      );
    },
  },
  {
    accessorKey: "status",
    header: "Estado",
    cell: ({ getValue }) => {
      const status = getValue() as string;
      const getStatusConfig = (status: string) => {
        switch (status?.toLowerCase()) {
          case "approved":
          case "confirmed":
            return { variant: "success" as const, label: "✅ Aprobada" };
          case "pending":
            return { variant: "warning" as const, label: "🟡 Pendiente" };
          case "rejected":
          case "cancelled":
            return { variant: "danger" as const, label: "❌ Rechazada" };
          default:
            return { variant: "default" as const, label: status || "—" };
        }
      };
      
      const config = getStatusConfig(status);
      return <StatusBadge variant={config.variant}>{config.label}</StatusBadge>;
    },
  },
  {
    id: "actions",
    header: "Acciones",
    cell: ({ row }) => {
      const reservation = row.original;
      
      return (
        <div className="flex items-center gap-1">
          <Button
            onClick={(e) => {
              e.stopPropagation();
              onViewReservation(reservation.id);
            }}
            title="Ver detalles"
            variant="ghost"
            size="icon"
            className="h-7 w-7 bg-neutral-500/20 text-neutral-400 hover:bg-neutral-500/30"
          >
            <Eye className="h-3.5 w-3.5" />
          </Button>
          
          <Button
            onClick={(e) => {
              e.stopPropagation();
              onApproveReservation(reservation.id);
            }}
            disabled={reservation.status === "approved" || reservation.status === "rejected"}
            title="Aprobar reserva"
            variant="ghost"
            size="icon"
            className="h-7 w-7 bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 disabled:cursor-not-allowed disabled:opacity-30"
          >
            <CheckCircle className="h-3.5 w-3.5" />
          </Button>
          
          <Button
            onClick={(e) => {
              e.stopPropagation();
              onResendEmail(reservation.id);
            }}
            disabled={reservation.status !== "approved"}
            title="Reenviar correo"
            variant="ghost"
            size="icon"
            className="h-7 w-7 bg-green-500/20 text-green-400 hover:bg-green-500/30 disabled:cursor-not-allowed disabled:opacity-30"
          >
            <Send className="h-3.5 w-3.5" />
          </Button>
          
          <Button
            onClick={(e) => {
              e.stopPropagation();
              onCancelReservation(reservation.id);
            }}
            disabled={["rejected", "cancelled"].includes((reservation.status || "").toLowerCase())}
            title="Anular reserva"
            variant="ghost"
            size="icon"
            className="h-7 w-7 bg-red-500/20 text-red-400 hover:bg-red-500/30 disabled:cursor-not-allowed disabled:opacity-30"
          >
            <XCircle className="h-3.5 w-3.5" />
          </Button>
        </div>
      );
    },
  },
];

interface ModernReservationsClientProps {
  initialReservations: ReservationRow[];
  organizers: { id: string; name: string }[];
  error?: string | null;
}

export default function ModernReservationsClient({
  initialReservations,
  organizers,
  error,
}: ModernReservationsClientProps) {
  const [reservations] = useState<ReservationRow[]>(initialReservations);
  const [filteredReservations, setFilteredReservations] = useState<ReservationRow[]>(initialReservations);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [organizerFilter, setOrganizerFilter] = useState<string>("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [tempSearchQuery, setTempSearchQuery] = useState("");
  const [tempStatusFilter, setTempStatusFilter] = useState<string>("all");
  const [tempOrganizerFilter, setTempOrganizerFilter] = useState<string>("all");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [viewReservationId, setViewReservationId] = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [cancelReservationId, setCancelReservationId] = useState<string | null>(null);
  const [cancelPending, setCancelPending] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Verificar si hay filtros activos
  const hasActiveFilters = Boolean(searchQuery || statusFilter !== "all" || organizerFilter !== "all" || fromDate || toDate);

  // Recargar datos después de crear reserva
  const handleReservationCreated = async () => {
    try {
      const response = await fetch(window.location.href);
      if (response.ok) {
        window.location.reload();
      }
    } catch (err) {
      console.error("Error reloading:", err);
    }
  };

  // Aprobar reserva
  const handleApproveReservation = async (id: string) => {
    if (!confirm("✅ ¿Aprobar esta reserva y enviar email de confirmación?")) return;
    
    try {
      const res = await authedFetch("/api/reservations/update", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id, status: "approved" }),
      });
      
      const data = await res.json();
      
      if (res.ok && data.success) {
        if (data.emailError) {
          alert(`✅ Reserva aprobada, pero hubo un error al enviar el correo: ${data.emailError}`);
        } else if (data.emailSent) {
          alert("✅ Reserva aprobada y correo enviado exitosamente");
        } else {
          alert("✅ Reserva aprobada");
        }
        window.location.reload();
      } else {
        alert(`❌ Error al aprobar reserva: ${data.error || "Error desconocido"}`);
        console.error("Error:", data);
      }
    } catch (err: any) {
      alert(`❌ Error al aprobar reserva: ${err.message}`);
      console.error("Error:", err);
    }
  };

  // Reenviar correo
  const handleResendEmail = async (id: string) => {
    if (!confirm("¿Reenviar correo de confirmación?")) return;
    
    try {
      const res = await authedFetch(`/api/admin/reservations/${id}/resend`, { 
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });
      
      if (res.ok) {
        alert("✅ Correo reenviado exitosamente");
      } else {
        const data = await res.json();
        alert(`❌ Error al reenviar correo: ${data.error || "Error desconocido"}`);
        console.error("Error:", data);
      }
    } catch (err: any) {
      alert(`❌ Error al reenviar correo: ${err.message}`);
      console.error("Error:", err);
    }
  };

  // Anular reserva
  const handleCancelReservation = (id: string) => {
    setCancelReservationId(id);
  };

  const confirmCancelReservation = async () => {
    if (!cancelReservationId) return;
    setCancelPending(true);
    try {
      const res = await authedFetch("/api/reservations/update", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id: cancelReservationId, status: "rejected" }),
      });
      
      const data = await res.json();
      
      if (res.ok && data.success) {
        setCancelReservationId(null);
        if (data.emailError) {
          alert(`✅ Reserva anulada, pero hubo un error al enviar el correo: ${data.emailError}`);
        } else if (data.emailSent) {
          alert("✅ Reserva anulada y correo de notificación enviado");
        } else {
          alert("✅ Reserva anulada");
        }
        window.location.reload();
      } else {
        const details = Array.isArray(data?.cancellationErrors) ? data.cancellationErrors.join(" | ") : "";
        alert(
          `❌ Error al anular reserva: ${data.error || "Error desconocido"}${details ? `\n\nDetalle técnico: ${details}` : ""}`
        );
        console.error("Error:", data);
      }
    } catch (err: any) {
      alert(`❌ Error al anular reserva: ${err.message}`);
      console.error("Error:", err);
    } finally {
      setCancelPending(false);
    }
  };

  // Aplicar filtros
  const applyFilters = () => {
    setSearchQuery(tempSearchQuery);
    setStatusFilter(tempStatusFilter);
    setOrganizerFilter(tempOrganizerFilter);
    // fromDate y toDate ya se actualizan directamente
  };

  // Limpiar filtros
  const clearFilters = () => {
    setSearchQuery("");
    setStatusFilter("all");
    setOrganizerFilter("all");
    setFromDate("");
    setToDate("");
    setTempSearchQuery("");
    setTempStatusFilter("all");
    setTempOrganizerFilter("all");
  };

  // Filtrar reservas
  useEffect(() => {
    let filtered = reservations;
    
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(reservation => 
        reservation.full_name?.toLowerCase().includes(query) ||
        reservation.email?.toLowerCase().includes(query) ||
        reservation.phone?.includes(query) ||
        reservation.event_name?.toLowerCase().includes(query) ||
        reservation.table_name?.toLowerCase().includes(query) ||
        reservation.organizer_name?.toLowerCase().includes(query)
      );
    }
    
    if (statusFilter !== "all") {
      filtered = filtered.filter((reservation) => {
        const normalized = reservation.status?.toLowerCase() || "";
        if (statusFilter === "approved") {
          return normalized === "approved" || normalized === "confirmed";
        }
        if (statusFilter === "rejected") {
          return normalized === "rejected" || normalized === "cancelled";
        }
        return normalized === statusFilter;
      });
    }
    
    if (organizerFilter !== "all") {
      filtered = filtered.filter(reservation => 
        reservation.organizer_id === organizerFilter
      );
    }

    // Filtrar por fechas si están definidas
    if (fromDate) {
      filtered = filtered.filter(reservation => {
        if (!reservation.created_at) return false;
        const reservationDate = new Date(reservation.created_at).toISOString().split('T')[0];
        return reservationDate >= fromDate;
      });
    }

    if (toDate) {
      filtered = filtered.filter(reservation => {
        if (!reservation.created_at) return false;
        const reservationDate = new Date(reservation.created_at).toISOString().split('T')[0];
        return reservationDate <= toDate;
      });
    }
    
    setFilteredReservations(filtered);
  }, [reservations, searchQuery, statusFilter, organizerFilter, fromDate, toDate]);

  useEffect(() => {
    setPage(1);
  }, [searchQuery, statusFilter, organizerFilter, fromDate, toDate]);

  const columns = React.useMemo(
    () => createColumns(
      (id: string) => setViewReservationId(id),
      handleApproveReservation,
      handleResendEmail,
      handleCancelReservation,
      openMenuId,
      setOpenMenuId
    ),
    [openMenuId]
  );

  const totalItems = filteredReservations.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pagedReservations = React.useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredReservations.slice(start, start + pageSize);
  }, [filteredReservations, currentPage, pageSize]);

  return (
    <main className="space-y-6">
      <ScreenHeader
        icon={Calendar}
        kicker="Reservations Management"
        title="Gestión de Reservas"
        description="Gestiona reservas de mesa, estados y notificaciones a clientes."
        actions={
          <>
            <Link
              href="/admin"
              className="inline-flex items-center justify-center rounded-lg border border-neutral-600 px-4 py-2 text-sm font-semibold text-neutral-200 transition-all hover:border-neutral-500 hover:bg-neutral-800"
            >
              ← Dashboard
            </Link>
            <Button
              onClick={() => setIsModalOpen(true)}
              className="bg-gradient-to-r from-rose-500 to-pink-600 text-white hover:from-rose-400 hover:to-pink-500"
            >
              <Calendar className="h-4 w-4" />
              Nueva reserva
            </Button>
          </>
        }
      />

      {error ? (
        <div className="rounded-lg border border-red-500/30 bg-red-500/20 p-3 backdrop-blur-sm">
          <p className="text-sm text-red-400">⚠️ Error: {error}</p>
        </div>
      ) : null}

      {/* Sistema de filtros con fechas */}
      <SearchAndDateFilters
        searchQuery={tempSearchQuery}
        onSearchChange={setTempSearchQuery}
        statusFilter={tempStatusFilter}
        onStatusChange={setTempStatusFilter}
        organizerFilter={tempOrganizerFilter}
        onOrganizerChange={setTempOrganizerFilter}
        organizers={organizers}
        fromDate={fromDate}
        onFromDateChange={setFromDate}
        toDate={toDate}
        onToDateChange={setToDate}
        onApplyFilters={applyFilters}
        onClearFilters={clearFilters}
        hasActiveFilters={hasActiveFilters}
      />

      {/* Tabla optimizada */}
      <DataTable
        columns={columns}
        data={pagedReservations}
        compact
        maxHeight="55vh"
        enableSorting
        enableVirtualization={pagedReservations.length > 50}
        showPagination={false}
        emptyMessage="🔍 No se encontraron reservas con los filtros aplicados"
      />

      <ExternalPagination
        currentPage={currentPage}
        totalItems={totalItems}
        itemsPerPage={pageSize}
        onPageChange={(nextPage) => setPage(nextPage)}
        onPageSizeChange={(size) => {
          setPageSize(size);
          setPage(1);
        }}
        itemLabel="reservas"
      />

      <AlertDialog.Root
        open={Boolean(cancelReservationId)}
        onOpenChange={(open) => {
          if (!open && !cancelPending) setCancelReservationId(null);
        }}
      >
        <AlertDialog.Portal>
          <AlertDialog.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm" />
          <AlertDialog.Content className="fixed left-[50%] top-[50%] z-50 w-full max-w-md translate-x-[-50%] translate-y-[-50%] rounded-lg border border-neutral-700 bg-neutral-900 p-6 shadow-xl">
            <AlertDialog.Title className="text-lg font-semibold text-white">
              ¿Anular reserva?
            </AlertDialog.Title>
            <AlertDialog.Description className="mt-3 text-sm text-neutral-300">
              Se enviará un correo de cancelación al cliente.
              <br />
              <br />
              También se invalidarán los códigos de mesa y se cancelarán los tickets vinculados a esta reserva, por lo que dejarán de verse como activos en Tickets/QR.
            </AlertDialog.Description>

            <div className="mt-6 flex gap-3 justify-end">
              <AlertDialog.Cancel asChild>
                <Button
                  disabled={cancelPending}
                  variant="outline"
                  className="border-neutral-600 text-neutral-200 hover:border-neutral-500 hover:bg-neutral-800 disabled:opacity-50"
                >
                  Cancelar
                </Button>
              </AlertDialog.Cancel>
              <Button
                onClick={confirmCancelReservation}
                disabled={cancelPending}
                className="bg-red-600 text-white transition-all hover:bg-red-700 disabled:opacity-50"
              >
                {cancelPending ? "Anulando..." : "Sí, anular"}
              </Button>
            </div>
          </AlertDialog.Content>
        </AlertDialog.Portal>
      </AlertDialog.Root>

      {/* Modal de creación */}
      <CreateReservationModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={handleReservationCreated}
        organizers={organizers}
      />

      {/* Modal de visualización */}
      <ViewReservationModal
        reservationId={viewReservationId || ""}
        isOpen={!!viewReservationId}
        onClose={() => setViewReservationId(null)}
        onUpdate={() => window.location.reload()}
      />
    </main>
  );
}
