"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { DataTable } from "@repo/ui/components/data-table";
import { StatusBadge } from "@repo/ui";
import { ColumnDef } from "@tanstack/react-table";
import { Building2, Eye, Edit2, Plus, Search, Trash2, Filter, Armchair, Map } from "lucide-react";
import { OrganizerModal, OrganizerFormData } from "./OrganizerModal";
import { DeleteConfirmModal } from "./DeleteConfirmModal";
import { authedFetch } from "@/lib/authedFetch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SelectNative } from "@/components/ui/select-native";
import { ScreenHeader } from "../components/ScreenHeader";
import { ExternalPagination } from "../components/ExternalPagination";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

type OrganizerRow = {
  id: string;
  slug: string;
  name: string;
  is_active: boolean;
  sort_order: number;
  events_count?: number;
  created_at?: string;
};

interface Props {
  initialOrganizers: OrganizerRow[];
  error?: string | null;
}

export default function ModernOrganizersClient({ initialOrganizers, error }: Props) {
  const [organizers, setOrganizers] = useState<OrganizerRow[]>(initialOrganizers);
  const [isLoading, setIsLoading] = useState(false);
  const [tempSearchTerm, setTempSearchTerm] = useState("");
  const [tempStatusFilter, setTempStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  
  // Estados para modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingOrganizer, setEditingOrganizer] = useState<OrganizerRow | null>(null);
  const [deletingOrganizer, setDeletingOrganizer] = useState<OrganizerRow | null>(null);
  const [viewingOrganizer, setViewingOrganizer] = useState<OrganizerRow | null>(null);

  const filteredOrganizers = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return organizers.filter((organizer) => {
      if (statusFilter === "active" && !organizer.is_active) return false;
      if (statusFilter === "inactive" && organizer.is_active) return false;
      if (!term) return true;
      const name = organizer.name.toLowerCase();
      const slug = organizer.slug.toLowerCase();
      return name.includes(term) || slug.includes(term);
    });
  }, [organizers, searchTerm, statusFilter]);

  const totalItems = filteredOrganizers.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pagedOrganizers = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredOrganizers.slice(start, start + pageSize);
  }, [filteredOrganizers, currentPage, pageSize]);

  const hasActiveFilters = Boolean(searchTerm || statusFilter !== "all");

  // Crear organizador
  const handleCreateOrganizer = async (data: OrganizerFormData) => {
    try {
      setIsLoading(true);
      const response = await authedFetch('/api/organizers', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      
      const result = await response.json();
      
      if (result.success) {
        // Agregar el nuevo organizador a la lista
        setOrganizers(prev => [...prev, {
          ...result.organizer,
          events_count: 0
        }]);
        setShowCreateModal(false);
      } else {
        alert('Error: ' + result.error);
      }
    } catch (error) {
      console.error('Error creando organizador:', error);
      alert('Error creando organizador');
    } finally {
      setIsLoading(false);
    }
  };

  // Editar organizador
  const handleEditOrganizer = async (data: OrganizerFormData) => {
    if (!editingOrganizer) return;
    
    try {
      setIsLoading(true);
      const response = await authedFetch('/api/organizers', {
        method: 'PUT',
        body: JSON.stringify({ id: editingOrganizer.id, ...data }),
      });
      
      const result = await response.json();
      
      if (result.success) {
        // Actualizar organizador en la lista
        setOrganizers(prev => prev.map(org => 
          org.id === editingOrganizer.id 
            ? { ...org, ...result.organizer }
            : org
        ));
        setEditingOrganizer(null);
      } else {
        alert('Error: ' + result.error);
      }
    } catch (error) {
      console.error('Error editando organizador:', error);
      alert('Error editando organizador');
    } finally {
      setIsLoading(false);
    }
  };

  // Eliminar organizador
  const handleDeleteOrganizer = async () => {
    if (!deletingOrganizer) return;
    
    try {
      setIsLoading(true);
      const response = await authedFetch(`/api/organizers?id=${deletingOrganizer.id}`, {
        method: 'DELETE',
      });
      
      const result = await response.json();
      
      if (result.success) {
        // Remover organizador de la lista
        setOrganizers(prev => prev.filter(org => org.id !== deletingOrganizer.id));
        setDeletingOrganizer(null);
      } else {
        alert('Error: ' + result.error);
      }
    } catch (error) {
      console.error('Error eliminando organizador:', error);
      alert('Error eliminando organizador');
    } finally {
      setIsLoading(false);
    }
  };

  const handleApplyFilters = () => {
    setSearchTerm(tempSearchTerm);
    setStatusFilter(tempStatusFilter);
    setPage(1);
  };

  const handleClearFilters = () => {
    setTempSearchTerm("");
    setTempStatusFilter("all");
    setSearchTerm("");
    setStatusFilter("all");
    setPage(1);
  };

  return (
    <TooltipProvider>
      <main className="space-y-6">
      <ScreenHeader
        icon={Building2}
        kicker="Operations"
        title="Gestión de Organizadores"
        description="Administra organizadores, estado y orden operativo desde una sola vista."
        actions={
          <>
            <Link
              href="/admin"
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-neutral-600 px-4 py-2 text-sm font-semibold text-neutral-200 transition-all hover:border-neutral-500 hover:bg-neutral-800"
            >
              ← Dashboard
            </Link>
            <Button
              onClick={() => setShowCreateModal(true)}
              className="bg-gradient-to-r from-rose-500 to-pink-600 text-white hover:from-rose-400 hover:to-pink-500"
            >
              <Plus className="h-4 w-4" />
              Crear organizador
            </Button>
          </>
        }
      />

      <section className="mb-6 space-y-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-neutral-300">Búsqueda</label>
            <div className="relative">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
                </TooltipTrigger>
                <TooltipContent>Buscar por nombre o slug</TooltipContent>
              </Tooltip>
              <Input
                value={tempSearchTerm}
                onChange={(event) => setTempSearchTerm(event.target.value)}
                placeholder="Nombre o slug"
                className="h-10 pl-10"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-neutral-300">Estado</label>
            <div className="relative">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Filter className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
                </TooltipTrigger>
                <TooltipContent>Filtrar por estado</TooltipContent>
              </Tooltip>
              <SelectNative
                value={tempStatusFilter}
                onChange={(event) => setTempStatusFilter(event.target.value as "all" | "active" | "inactive")}
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
            onClick={handleApplyFilters}
            className="bg-gradient-to-r from-rose-500 to-pink-600 text-white hover:from-rose-400 hover:to-pink-500"
          >
            <Search className="h-4 w-4" />
            Filtrar
          </Button>

          {hasActiveFilters ? (
            <Button type="button" variant="ghost" onClick={handleClearFilters}>
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

      <div className="rounded-xl border border-neutral-700/70 bg-neutral-900/40 p-1">
        <DataTable
          data={pagedOrganizers}
          columns={createColumns({
            onView: (organizer) => setViewingOrganizer(organizer),
            onEdit: (organizer) => setEditingOrganizer(organizer),
            onDelete: (organizer) => setDeletingOrganizer(organizer),
          })}
          compact
          maxHeight="55vh"
          enableSorting
          showPagination={false}
          emptyMessage="No hay organizadores con los filtros actuales."
        />
      </div>

      <ExternalPagination
        currentPage={currentPage}
        totalItems={totalItems}
        itemsPerPage={pageSize}
        onPageChange={(nextPage) => setPage(nextPage)}
        onPageSizeChange={(size) => {
          setPageSize(size);
          setPage(1);
        }}
        itemLabel="organizadores"
      />
      
      {/* Modals */}
      <OrganizerModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSave={handleCreateOrganizer}
        isLoading={isLoading}
      />
      
      <OrganizerModal
        isOpen={!!editingOrganizer}
        onClose={() => setEditingOrganizer(null)}
        onSave={handleEditOrganizer}
        organizer={editingOrganizer}
        isLoading={isLoading}
      />
      
      <DeleteConfirmModal
        isOpen={!!deletingOrganizer}
        onClose={() => setDeletingOrganizer(null)}
        onConfirm={handleDeleteOrganizer}
        organizerName={deletingOrganizer?.name || ""}
        isLoading={isLoading}
      />
      
      {/* Modal de vista (simple) */}
      {viewingOrganizer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div 
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setViewingOrganizer(null)}
          />
          <div className="relative w-full max-w-md mx-4 bg-neutral-800 rounded-xl border border-neutral-700 shadow-2xl">
            <div className="p-6 border-b border-neutral-700">
              <h2 className="text-lg font-semibold text-white">Detalles del Organizador</h2>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-sm text-neutral-400">Nombre</label>
                <p className="text-white font-medium">{viewingOrganizer.name}</p>
              </div>
              <div>
                <label className="text-sm text-neutral-400">Slug</label>
                <p className="text-neutral-300 font-mono text-sm">{viewingOrganizer.slug}</p>
              </div>
              <div>
                <label className="text-sm text-neutral-400">Estado</label>
                <div className="mt-1">
                  <StatusBadge status={viewingOrganizer.is_active} />
                </div>
              </div>
              <div>
                <label className="text-sm text-neutral-400">Orden</label>
                <p className="text-neutral-300">{viewingOrganizer.sort_order}</p>
              </div>
              <div>
                <label className="text-sm text-neutral-400">Eventos</label>
                <p className="text-neutral-300">{viewingOrganizer.events_count || 0} eventos</p>
              </div>
            </div>
            <div className="p-6 border-t border-neutral-700">
              <Button
                onClick={() => setViewingOrganizer(null)}
                variant="ghost"
                className="w-full border border-neutral-700 bg-neutral-700 text-white hover:bg-neutral-600"
              >
                Cerrar
              </Button>
            </div>
          </div>
        </div>
      )}
      </main>
    </TooltipProvider>
  );
}

// Definición de columnas compactas
const createColumns = ({ 
  onView, 
  onEdit,
  onDelete 
}: { 
  onView: (organizer: OrganizerRow) => void;
  onEdit: (organizer: OrganizerRow) => void;
  onDelete: (organizer: OrganizerRow) => void;
}): ColumnDef<OrganizerRow>[] => [
  {
    accessorKey: "name",
    header: "Organizador",
    cell: ({ row }) => {
      const organizer = row.original;
      return (
        <div className="min-w-0">
          <div className="font-medium text-neutral-100 truncate">
            {organizer.name}
          </div>
          <div className="text-xs text-neutral-400 truncate">
            @{organizer.slug}
          </div>
        </div>
      );
    },
  },
  
  {
    accessorKey: "is_active",
    header: "Estado",
    cell: ({ row }) => {
      const organizer = row.original;
      return (
        <StatusBadge 
          status={organizer.is_active} 
        />
      );
    },
  },
  
  {
    accessorKey: "events_count",
    header: "Eventos",
    cell: ({ row }) => {
      const organizer = row.original;
      const count = organizer.events_count || 0;
      return (
        <div className="text-center">
          <div className="text-sm font-medium text-neutral-100">
            {count}
          </div>
          <div className="text-xs text-neutral-400">
            eventos
          </div>
        </div>
      );
    },
  },
  
  {
    accessorKey: "sort_order",
    header: "Orden",
    cell: ({ row }) => {
      const organizer = row.original;
      return (
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-8 h-8 bg-neutral-700 rounded-full text-xs font-medium text-neutral-300">
            {organizer.sort_order}
          </div>
        </div>
      );
    },
  },
  
  {
    id: "actions",
    header: "Acciones",
    cell: ({ row }) => {
      const organizer = row.original;
      return (
        <div className="flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Link
                href={`/admin/organizers/${organizer.id}/tables`}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md text-neutral-400 transition-colors hover:bg-neutral-700 hover:text-neutral-200"
                aria-label="Mesas del organizador"
              >
                <Armchair className="h-4 w-4" />
              </Link>
            </TooltipTrigger>
            <TooltipContent>Mesas del organizador</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Link
                href={`/admin/organizers/${organizer.id}/layout`}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md text-neutral-400 transition-colors hover:bg-neutral-700 hover:text-cyan-300"
                aria-label="Croquis del organizador"
              >
                <Map className="h-4 w-4" />
              </Link>
            </TooltipTrigger>
            <TooltipContent>Croquis del organizador</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                onClick={() => onView(organizer)}
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-neutral-400 hover:bg-neutral-700 hover:text-neutral-300"
                aria-label="Ver detalles"
              >
                <Eye className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Ver detalles</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                onClick={() => onEdit(organizer)}
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-neutral-400 transition-colors hover:bg-neutral-700 hover:text-rose-300"
                aria-label="Editar organizador"
              >
                <Edit2 className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Editar organizador</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                onClick={() => onDelete(organizer)}
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-neutral-400 hover:bg-neutral-700 hover:text-red-400"
                aria-label="Eliminar organizador"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Eliminar organizador</TooltipContent>
          </Tooltip>
        </div>
      );
    },
  },
];
