"use client";

import { useState, useEffect } from "react";
import { ColumnDef } from "@tanstack/react-table";
import { DataTable, StatusBadge, Button } from "@repo/ui";
import { authedFetch } from "@/lib/authedFetch";
import { PlusCircle, UserPlus, Shield, Mail, Phone, Edit2, Trash2 } from "lucide-react";

type Role = {
  id: string;
  code: string;
  name: string;
};

type StaffUser = {
  id: string;
  dni: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  role_code: string;
  role_name?: string;
  is_active: boolean;
  created_at?: string;
};

// Definición de columnas compactas
const createColumns = (
  roles: Role[],
  onEdit: (user: StaffUser) => void,
  onDelete: (userId: string) => void
): ColumnDef<StaffUser>[] => [
  {
    accessorKey: "full_name",
    header: "Usuario",
    cell: ({ row }) => {
      const user = row.original;
      return (
        <div className="min-w-0">
          <div className="font-medium text-slate-100 truncate">
            {user.first_name} {user.last_name}
          </div>
          <div className="text-xs text-slate-400 truncate">
            DNI: {user.dni}
          </div>
        </div>
      );
    },
  },
  {
    accessorKey: "contact",
    header: "Contacto",
    cell: ({ row }) => {
      const user = row.original;
      return (
        <div className="text-xs text-slate-300 space-y-0.5">
          {user.email && (
            <div className="flex items-center gap-1 truncate">
              <Mail className="h-3 w-3 text-slate-500" />
              <span className="truncate">{user.email}</span>
            </div>
          )}
          {user.phone && (
            <div className="flex items-center gap-1">
              <Phone className="h-3 w-3 text-slate-500" />
              {user.phone}
            </div>
          )}
        </div>
      );
    },
  },
  {
    accessorKey: "role_code",
    header: "Rol",
    cell: ({ row }) => {
      const user = row.original;
      const role = roles.find(r => r.code === user.role_code);
      
      const getRoleConfig = (roleCode: string) => {
        switch (roleCode?.toLowerCase()) {
          case "admin":
            return { variant: "danger" as const, icon: "👑", color: "text-red-400" };
          case "door":
            return { variant: "success" as const, icon: "🚪", color: "text-green-400" };
          case "promotor":
            return { variant: "warning" as const, icon: "📢", color: "text-yellow-400" };
          default:
            return { variant: "default" as const, icon: "👤", color: "text-slate-400" };
        }
      };
      
      const config = getRoleConfig(user.role_code);
      
      return (
        <div className="flex items-center gap-1">
          <span className="text-sm">{config.icon}</span>
          <div>
            <div className={`text-xs font-medium ${config.color}`}>
              {role?.name || user.role_code}
            </div>
            <div className="text-xs text-slate-500">
              {user.role_code}
            </div>
          </div>
        </div>
      );
    },
  },
  {
    accessorKey: "is_active",
    header: "Estado",
    cell: ({ getValue }) => {
      const isActive = getValue() as boolean;
      return (
        <StatusBadge status={isActive}>
          {isActive ? "✅ Activo" : "⏸️ Inactivo"}
        </StatusBadge>
      );
    },
  },
  {
    id: "actions",
    header: "Acciones",
    cell: ({ row }) => {
      const user = row.original;
      return (
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onEdit(user)}
            className="h-7 w-7 p-0 text-blue-400 hover:text-blue-300 hover:bg-blue-500/20"
          >
            <Edit2 className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost" 
            size="sm"
            onClick={() => onDelete(user.id)}
            className="h-7 w-7 p-0 text-red-400 hover:text-red-300 hover:bg-red-500/20"
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      );
    },
  },
];

interface ModernAdminUsersClientProps {
  roles: Role[];
  initialStaff: StaffUser[];
}

export default function ModernAdminUsersClient({ roles, initialStaff }: ModernAdminUsersClientProps) {
  const [staff, setStaff] = useState<StaffUser[]>(initialStaff);
  const [filteredStaff, setFilteredStaff] = useState<StaffUser[]>(initialStaff);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");

  // Filtros permitidos (excluir roles de promotores)
  const allowedRoles = roles.filter(
    (r) => !["promo", "promoter", "promoter_manager"].includes(r.code.toLowerCase()) && 
         !r.code.toLowerCase().startsWith("promo")
  );

  // Filtrar usuarios
  useEffect(() => {
    let filtered = staff;
    
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(user => 
        `${user.first_name} ${user.last_name}`.toLowerCase().includes(query) ||
        user.dni?.includes(query) ||
        user.email?.toLowerCase().includes(query) ||
        user.phone?.includes(query)
      );
    }
    
    if (roleFilter !== "all") {
      filtered = filtered.filter(user => user.role_code === roleFilter);
    }
    
    setFilteredStaff(filtered);
  }, [staff, searchQuery, roleFilter]);

  const handleEdit = (user: StaffUser) => {
    console.log("Editar usuario:", user);
    // Aquí iría la lógica para abrir modal de edición
  };

  const handleDelete = async (userId: string) => {
    if (!confirm("¿Eliminar este usuario? Esta acción no se puede deshacer.")) return;
    
    setLoading(true);
    try {
      const response = await authedFetch(`/api/admin/users/delete`, {
        method: "POST",
        body: JSON.stringify({ user_id: userId }),
      });

      if (response.ok) {
        setStaff(prev => prev.filter(u => u.id !== userId));
      }
    } catch (error) {
      console.error("Error eliminando usuario:", error);
    } finally {
      setLoading(false);
    }
  };

  const columns = createColumns(allowedRoles, handleEdit, handleDelete);

  return (
    <main className="space-y-6">
      {/* Header moderno */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-rose-400/80">
            👥 Staff Management
          </p>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
            Gestión de Usuarios
          </h1>
          <p className="text-sm text-slate-400">
            Administra el equipo y sus permisos
          </p>
        </div>
        <div className="flex gap-3">
          <Button
            className="inline-flex items-center gap-2 bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-400 hover:to-pink-500"
          >
            <UserPlus className="h-4 w-4" />
            Nuevo Usuario
          </Button>
        </div>
      </div>

      {/* Stats por rol */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <div className="bg-slate-800/30 border border-slate-700/50 rounded-lg p-3 backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <span className="text-lg">👤</span>
            <div>
              <p className="text-xs text-slate-400">Total</p>
              <p className="text-lg font-bold text-white">{staff.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-slate-800/30 border border-slate-700/50 rounded-lg p-3 backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <span className="text-lg">👑</span>
            <div>
              <p className="text-xs text-slate-400">Admins</p>
              <p className="text-lg font-bold text-red-400">
                {staff.filter(u => u.role_code.toLowerCase() === "admin").length}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-slate-800/30 border border-slate-700/50 rounded-lg p-3 backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <span className="text-lg">🚪</span>
            <div>
              <p className="text-xs text-slate-400">Puerta</p>
              <p className="text-lg font-bold text-green-400">
                {staff.filter(u => u.role_code.toLowerCase() === "door").length}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-slate-800/30 border border-slate-700/50 rounded-lg p-3 backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <span className="text-lg">✅</span>
            <div>
              <p className="text-xs text-slate-400">Activos</p>
              <p className="text-lg font-bold text-blue-400">
                {staff.filter(u => u.is_active).length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Búsqueda y filtros */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <input
            type="text"
            placeholder="Buscar por nombre, DNI, email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-4 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-500/50 focus:border-rose-500/50 text-sm"
          />
        </div>
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="px-4 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-500/50 focus:border-rose-500/50 text-sm min-w-[140px]"
        >
          <option value="all">Todos los roles</option>
          {allowedRoles.map(role => (
            <option key={role.code} value={role.code}>
              {role.name}
            </option>
          ))}
        </select>
      </div>

      {/* Tabla compacta */}
      <DataTable
        columns={columns}
        data={filteredStaff}
        compact={true}
        maxHeight="65vh"
        enableSorting={true}
        enableVirtualization={false} // Pocos usuarios, no necesita virtualización
        emptyMessage="👥 No se encontraron usuarios con los filtros aplicados"
      />

      {/* Info sobre permisos */}
      <div className="mt-4 rounded-lg bg-slate-800/20 border border-slate-700/30 p-3 backdrop-blur-sm">
        <p className="text-xs text-slate-400">
          💡 <strong>Roles disponibles:</strong> Admin (acceso total), Door (solo escaneo), 
          Promotor (gestión limitada). Los usuarios inactivos no pueden iniciar sesión.
        </p>
      </div>
    </main>
  );
}