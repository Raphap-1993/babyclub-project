"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { authedFetch } from "@/lib/authedFetch";
import { Button, Badge, usePagination } from "@repo/ui";
import { ExpandableDataTable } from "@/components/dashboard/ImprovedDataTable";
import { ExternalLink, Calendar, Users, Mail, Phone, QrCode } from "lucide-react";

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
  created_at?: string;
};

interface ImprovedReservationsClientProps {
  initialReservations: ReservationRow[];
}

export default function ImprovedReservationsClient({ initialReservations }: ImprovedReservationsClientProps) {
  const [reservations, setReservations] = useState<ReservationRow[]>(initialReservations);
  const [filteredReservations, setFilteredReservations] = useState<ReservationRow[]>(initialReservations);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Hook de paginación
  const pagination = usePagination({
    initialPageSize: 25,
    pageSizeOptions: [10, 25, 50, 100],
    basePath: '/admin/reservations'
  });

  // Filtrar y buscar reservas
  useEffect(() => {
    let filtered = reservations;
    
    // Filtro de búsqueda
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(reservation => 
        reservation.full_name?.toLowerCase().includes(query) ||
        reservation.email?.toLowerCase().includes(query) ||
        reservation.phone?.toLowerCase().includes(query) ||
        reservation.event_name?.toLowerCase().includes(query) ||
        reservation.table_name?.toLowerCase().includes(query) ||
        reservation.codes?.some(code => code.toLowerCase().includes(query))
      );
    }
    
    // Filtro de estado
    if (statusFilter !== "all") {
      filtered = filtered.filter(reservation => reservation.status === statusFilter);
    }
    
    setFilteredReservations(filtered);
  }, [reservations, searchQuery, statusFilter]);

  // Función para recargar datos
  async function refreshReservations() {
    try {
      setLoading(true);
      const res = await authedFetch("/api/admin/reservations/list");
      const payload = await res.json().catch(() => null);
      if (res.ok && payload?.success) {
        setReservations(payload.data || []);
      }
    } catch (err) {
      setError("Error al cargar reservas");
    } finally {
      setLoading(false);
    }
  }

  // Configuración de columnas
  const columns = [
    {
      key: 'full_name',
      label: 'Cliente',
      render: (value: string, row: ReservationRow) => (
        <div className="font-medium text-white">
          <div>{value}</div>
          {row.email && (
            <div className="text-xs text-gray-400 flex items-center gap-1">
              <Mail className="w-3 h-3" />
              {row.email}
            </div>
          )}
        </div>
      )
    },
    {
      key: 'event_name',
      label: 'Evento',
      render: (value: string, row: ReservationRow) => (
        <div>
          <div className="text-white font-medium">{value}</div>
          <div className="text-xs text-gray-400">{row.table_name}</div>
        </div>
      )
    },
    {
      key: 'status',
      label: 'Estado',
      render: (value: string) => {
        const statusConfig = {
          confirmed: { label: 'Confirmada', variant: 'success' as const },
          pending: { label: 'Pendiente', variant: 'warning' as const },
          cancelled: { label: 'Cancelada', variant: 'error' as const },
          completed: { label: 'Completada', variant: 'secondary' as const },
        };
        
        const config = statusConfig[value as keyof typeof statusConfig] || { 
          label: value, 
          variant: 'secondary' as const 
        };
        
        return <Badge variant={config.variant}>{config.label}</Badge>;
      }
    },
    {
      key: 'ticket_quantity',
      label: 'Entradas',
      render: (value: number | null) => (
        <div className="flex items-center gap-1 text-gray-300">
          <Users className="w-4 h-4" />
          {value || 0}
        </div>
      )
    },
    // Columnas expandibles
    {
      key: 'phone',
      label: 'Teléfono',
      expandable: true,
      render: (value: string | null) => (
        value ? (
          <div className="flex items-center gap-1 text-gray-300">
            <Phone className="w-4 h-4" />
            {value}
          </div>
        ) : (
          <span className="text-gray-500">Sin teléfono</span>
        )
      )
    },
    {
      key: 'codes',
      label: 'Códigos QR',
      expandable: true,
      render: (value: string[] | null) => (
        value && value.length > 0 ? (
          <div className="space-y-1">
            {value.map((code, index) => (
              <div key={index} className="flex items-center gap-1 text-xs">
                <QrCode className="w-3 h-3" />
                <code className="bg-gray-800 px-2 py-1 rounded">{code}</code>
              </div>
            ))}
          </div>
        ) : (
          <span className="text-gray-500">Sin códigos</span>
        )
      )
    },
    {
      key: 'created_at',
      label: 'Fecha Registro',
      expandable: true,
      render: (value: string) => (
        value ? (
          <div className="flex items-center gap-1 text-gray-300">
            <Calendar className="w-4 h-4" />
            {new Date(value).toLocaleDateString('es-ES', {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            })}
          </div>
        ) : (
          <span className="text-gray-500">Sin fecha</span>
        )
      )
    }
  ];

  // Estados disponibles para filtro
  const statusOptions = [
    { value: 'all', label: 'Todos los Estados' },
    { value: 'confirmed', label: 'Confirmadas' },
    { value: 'pending', label: 'Pendientes' },
    { value: 'cancelled', label: 'Canceladas' },
    { value: 'completed', label: 'Completadas' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Gestión de Reservas</h1>
          <p className="text-gray-400 text-sm mt-1">
            Administra todas las reservas de eventos
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={refreshReservations} variant="outline" disabled={loading}>
            {loading ? 'Actualizando...' : 'Actualizar'}
          </Button>
          <Button>
            Nueva Reserva
          </Button>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-col lg:flex-row gap-4">
        <div className="flex-1">
          <input
            type="text"
            placeholder="Buscar por cliente, email, evento, mesa o código QR..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          />
        </div>
        
        <div className="flex gap-4 items-center">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            {statusOptions.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          
          <div className="text-sm text-gray-400 whitespace-nowrap">
            <span className="text-white font-medium">{filteredReservations.length}</span> de {reservations.length}
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-900/20 border border-red-700 rounded-lg p-4">
          <p className="text-red-400 text-sm">{error}</p>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => setError(null)}
            className="mt-2"
          >
            Cerrar
          </Button>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {statusOptions.slice(1).map(status => {
          const count = reservations.filter(r => r.status === status.value).length;
          const percentage = reservations.length > 0 ? (count / reservations.length * 100) : 0;
          
          return (
            <div key={status.value} className="bg-gray-800 rounded-lg p-4 border border-gray-700">
              <div className="text-2xl font-bold text-white">{count}</div>
              <div className="text-gray-400 text-sm">{status.label}</div>
              <div className="text-xs text-purple-400 mt-1">{percentage.toFixed(1)}%</div>
            </div>
          );
        })}
      </div>

      {/* DataTable with Pagination */}
      <ExpandableDataTable
        data={filteredReservations}
        columns={columns}
        loading={loading}
        emptyMessage={
          searchQuery || statusFilter !== "all"
            ? "No se encontraron reservas que coincidan con los filtros aplicados"
            : "No hay reservas registradas"
        }
        visibleColumns={4} // Mostrar 4 columnas principales
        pagination={{
          total: filteredReservations.length,
          page: pagination.pagination.page,
          pageSize: pagination.pagination.pageSize,
          onPageChange: pagination.setPage,
          onPageSizeChange: pagination.setPageSize,
          pageSizeOptions: [10, 25, 50, 100],
          showPageSizeSelector: true
        }}
        actions={(row: ReservationRow) => (
          <div className="flex items-center gap-2">
            <Link 
              href={`/admin/reservations/${row.id}`}
              className="inline-flex items-center gap-1 px-3 py-1 text-sm bg-purple-600 hover:bg-purple-700 text-white rounded-md transition-colors"
            >
              <ExternalLink className="w-3 h-3" />
              Ver
            </Link>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                // Implementar acción de edición
                console.log('Editar reserva:', row.id);
              }}
            >
              Editar
            </Button>
          </div>
        )}
      />
    </div>
  );
}