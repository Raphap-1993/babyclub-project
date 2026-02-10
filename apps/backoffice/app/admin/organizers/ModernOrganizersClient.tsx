"use client";

import { useState } from "react";
import { DataTable } from "@repo/ui/components/data-table";
import { StatusBadge } from "@repo/ui";
import { ColumnDef } from "@tanstack/react-table";
import { Eye, Edit2, Plus, Trash2 } from "lucide-react";
import { OrganizerModal, OrganizerFormData } from "./OrganizerModal";
import { DeleteConfirmModal } from "./DeleteConfirmModal";
import { authedFetch } from "@/lib/authedFetch";

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
}

export default function ModernOrganizersClient({ initialOrganizers }: Props) {
  const [organizers, setOrganizers] = useState<OrganizerRow[]>(initialOrganizers);
  const [isLoading, setIsLoading] = useState(false);
  
  // Estados para modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingOrganizer, setEditingOrganizer] = useState<OrganizerRow | null>(null);
  const [deletingOrganizer, setDeletingOrganizer] = useState<OrganizerRow | null>(null);
  const [viewingOrganizer, setViewingOrganizer] = useState<OrganizerRow | null>(null);

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

  // Stats para el encabezado
  const stats = {
    total: organizers.length,
    active: organizers.filter(org => org.is_active).length,
    inactive: organizers.filter(org => !org.is_active).length,
    totalEvents: organizers.reduce((sum, org) => sum + (org.events_count || 0), 0)
  };

  return (
    <div className="space-y-6">
      {/* Header con estadísticas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-xl p-4">
          <div className="text-2xl font-bold text-white">{stats.total}</div>
          <div className="text-sm text-slate-400">Total organizadores</div>
        </div>
        
        <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-xl p-4">
          <div className="text-2xl font-bold text-green-400">{stats.active}</div>
          <div className="text-sm text-slate-400">Activos</div>
        </div>
        
        <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-xl p-4">
          <div className="text-2xl font-bold text-slate-400">{stats.inactive}</div>
          <div className="text-sm text-slate-400">Inactivos</div>
        </div>
        
        <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-xl p-4">
          <div className="text-2xl font-bold text-blue-400">{stats.totalEvents}</div>
          <div className="text-sm text-slate-400">Total eventos</div>
        </div>
      </div>

      {/* Acciones principales */}
      <div className="flex items-center justify-between">
        <div className="text-lg font-semibold text-white">
          Lista de Organizadores
        </div>
        
        <button
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center gap-2 bg-gradient-to-r from-emerald-500 to-green-600 px-4 py-2 text-sm font-semibold text-white rounded-lg shadow-lg transition-all hover:shadow-xl hover:from-emerald-400 hover:to-green-500 hover:scale-105"
        >
          <Plus className="h-4 w-4" />
          Crear Organizador
        </button>
      </div>

      {/* Tabla de datos */}
      <div className="bg-slate-800/30 backdrop-blur-sm border border-slate-700 rounded-xl overflow-hidden">
        <DataTable
          data={organizers}
          columns={createColumns({ 
            onView: (organizer) => setViewingOrganizer(organizer), 
            onEdit: (organizer) => setEditingOrganizer(organizer),
            onDelete: (organizer) => setDeletingOrganizer(organizer)
          })}
        />
      </div>
      
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
          <div className="relative w-full max-w-md mx-4 bg-slate-800 rounded-xl border border-slate-700 shadow-2xl">
            <div className="p-6 border-b border-slate-700">
              <h2 className="text-lg font-semibold text-white">Detalles del Organizador</h2>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-sm text-slate-400">Nombre</label>
                <p className="text-white font-medium">{viewingOrganizer.name}</p>
              </div>
              <div>
                <label className="text-sm text-slate-400">Slug</label>
                <p className="text-slate-300 font-mono text-sm">{viewingOrganizer.slug}</p>
              </div>
              <div>
                <label className="text-sm text-slate-400">Estado</label>
                <div className="mt-1">
                  <StatusBadge status={viewingOrganizer.is_active} />
                </div>
              </div>
              <div>
                <label className="text-sm text-slate-400">Orden</label>
                <p className="text-slate-300">{viewingOrganizer.sort_order}</p>
              </div>
              <div>
                <label className="text-sm text-slate-400">Eventos</label>
                <p className="text-slate-300">{viewingOrganizer.events_count || 0} eventos</p>
              </div>
            </div>
            <div className="p-6 border-t border-slate-700">
              <button
                onClick={() => setViewingOrganizer(null)}
                className="w-full px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
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
          <div className="font-medium text-slate-100 truncate">
            {organizer.name}
          </div>
          <div className="text-xs text-slate-400 truncate">
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
          <div className="text-sm font-medium text-slate-100">
            {count}
          </div>
          <div className="text-xs text-slate-400">
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
          <div className="inline-flex items-center justify-center w-8 h-8 bg-slate-700 rounded-full text-xs font-medium text-slate-300">
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
          <button
            onClick={() => onView(organizer)}
            className="inline-flex items-center justify-center w-8 h-8 text-slate-400 hover:text-blue-400 hover:bg-slate-700 rounded-lg transition-colors"
            title="Ver detalles"
          >
            <Eye className="h-4 w-4" />
          </button>
          
          <button
            onClick={() => onEdit(organizer)}
            className="inline-flex items-center justify-center w-8 h-8 text-slate-400 hover:text-emerald-400 hover:bg-slate-700 rounded-lg transition-colors"
            title="Editar organizador"
          >
            <Edit2 className="h-4 w-4" />
          </button>
          
          <button
            onClick={() => onDelete(organizer)}
            className="inline-flex items-center justify-center w-8 h-8 text-slate-400 hover:text-red-400 hover:bg-slate-700 rounded-lg transition-colors"
            title="Eliminar organizador"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      );
    },
  },
];