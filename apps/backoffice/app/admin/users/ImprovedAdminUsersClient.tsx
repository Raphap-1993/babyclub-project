"use client";

import { useState, useEffect } from "react";
import { authedFetch } from "@/lib/authedFetch";
import { Button, Badge, usePagination } from "@repo/ui";
import { ExpandableDataTable } from "@/components/dashboard/ImprovedDataTable";
import type { Role, StaffUser } from "./types";
import EditUserModal from "./EditUserModal";
import { PlusCircle, UserPlus } from "lucide-react";

interface AdminUsersClientProps {
  roles: Role[];
  initialStaff: StaffUser[];
}

export default function AdminUsersClient({ roles, initialStaff }: AdminUsersClientProps) {
  const allowedRoles = roles.filter(
    (r) => !["promo", "promoter", "promoter_manager"].includes(r.code.toLowerCase()) && 
         !r.code.toLowerCase().startsWith("promo"),
  );

  const [staff, setStaff] = useState<StaffUser[]>(initialStaff);
  const [filteredStaff, setFilteredStaff] = useState<StaffUser[]>(initialStaff);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [editing, setEditing] = useState<StaffUser | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Hook de paginación mejorado
  const pagination = usePagination({
    initialPageSize: 20,
    pageSizeOptions: [10, 20, 50],
    basePath: '/admin/users'
  });

  const [form, setForm] = useState({
    dni: "",
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    password: "",
    role_code: allowedRoles.find((r) => r.code === "door")?.code || allowedRoles[0]?.code || "",
  });

  // Filtrar y buscar usuarios
  useEffect(() => {
    let filtered = staff;
    
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = staff.filter(user => 
        user.person.first_name?.toLowerCase().includes(query) ||
        user.person.last_name?.toLowerCase().includes(query) ||
        user.person.email?.toLowerCase().includes(query) ||
        user.person.dni?.toLowerCase().includes(query) ||
        user.role.name?.toLowerCase().includes(query)
      );
    }
    
    setFilteredStaff(filtered);
  }, [staff, searchQuery]);

  // Funciones de API
  async function refreshStaff() {
    try {
      setLoading(true);
      const res = await authedFetch("/api/admin/users/list");
      const payload = await res.json().catch(() => null);
      if (res.ok && payload?.success) {
        setStaff(payload.data || []);
      }
    } catch (_err) {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (!form.email || !form.password || !form.first_name || !form.last_name || !form.dni || !form.role_code) {
      setError("Completa todos los campos requeridos");
      return;
    }
    setLoading(true);
    try {
      const res = await authedFetch("/api/admin/users/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok || !payload?.success) throw new Error(payload?.error || "No se pudo crear el usuario");
      await refreshStaff();
      setForm({ 
        dni: "",
        first_name: "",
        last_name: "",
        email: "",
        phone: "",
        password: "",
        role_code: allowedRoles.find((r) => r.code === "door")?.code || allowedRoles[0]?.code || "",
      });
      setCreateOpen(false);
    } catch (err: any) {
      setError(err?.message || "Error inesperado");
    } finally {
      setLoading(false);
    }
  }

  async function handleUpdate(staffId: string, role_code: string, is_active: boolean) {
    setSaving(staffId);
    try {
      const res = await authedFetch("/api/admin/users/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ staff_id: staffId, role_code, is_active }),
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok || !payload?.success) throw new Error(payload?.error || "No se pudo actualizar");
      await refreshStaff();
    } catch (err: any) {
      setError(err?.message || "Error al actualizar usuario");
    } finally {
      setSaving(null);
    }
  }

  async function handleDelete(staffId: string) {
    if (!window.confirm("¿Eliminar este usuario?")) return;
    setDeleting(staffId);
    try {
      const res = await authedFetch("/api/admin/users/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ staff_id: staffId }),
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok || !payload?.success) throw new Error(payload?.error || "No se pudo eliminar");
      setStaff((prev) => prev.filter((s) => s.id !== staffId));
    } catch (err: any) {
      setError(err?.message || "Error al eliminar usuario");
    } finally {
      setDeleting(null);
    }
  }

  // Configuración de columnas para la DataTable
  const columns = [
    {
      key: 'person.first_name',
      label: 'Nombre',
      render: (value: string, row: StaffUser) => (
        <div className="font-medium text-white">
          {row.person.first_name} {row.person.last_name}
        </div>
      )
    },
    {
      key: 'person.email',
      label: 'Email',
      render: (value: string) => (
        <div className="text-gray-300 text-sm">{value || 'Sin email'}</div>
      )
    },
    {
      key: 'role.name',
      label: 'Rol',
      render: (value: string, row: StaffUser) => {
        const roleColors = {
          admin: 'success',
          door: 'info',
          cashier: 'warning',
          waiter: 'secondary',
        } as const;
        
        return (
          <Badge variant={roleColors[row.role.code as keyof typeof roleColors] || 'secondary'}>
            {value}
          </Badge>
        );
      }
    },
    {
      key: 'is_active',
      label: 'Estado',
      render: (value: boolean) => (
        <Badge variant={value ? 'success' : 'error'}>
          {value ? 'Activo' : 'Inactivo'}
        </Badge>
      )
    },
    // Columnas expandibles
    {
      key: 'person.dni',
      label: 'DNI',
      expandable: true,
      render: (value: string) => value || 'Sin DNI'
    },
    {
      key: 'person.phone',
      label: 'Teléfono',
      expandable: true,
      render: (value: string) => value || 'Sin teléfono'
    },
    {
      key: 'created_at',
      label: 'Fecha Registro',
      expandable: true,
      render: (value: string) => new Date(value).toLocaleDateString('es-ES', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      })
    },
    {
      key: 'auth_user_id',
      label: 'Auth ID',
      expandable: true,
      render: (value: string) => (
        <code className="text-xs bg-gray-800 px-2 py-1 rounded">
          {value?.substring(0, 8)}...
        </code>
      )
    }
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Gestión de Usuarios</h1>
          <p className="text-gray-400 text-sm mt-1">
            Administra el personal y sus permisos
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="flex items-center gap-2">
          <UserPlus className="w-4 h-4" />
          Nuevo Usuario
        </Button>
      </div>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <input
            type="text"
            placeholder="Buscar por nombre, email, DNI o rol..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          />
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-400">
          Total: <span className="text-white font-medium">{filteredStaff.length}</span>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-900/20 border border-red-700 rounded-lg p-4">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {/* DataTable with Pagination */}
      <ExpandableDataTable
        data={filteredStaff}
        columns={columns}
        loading={loading}
        emptyMessage={
          searchQuery 
            ? `No se encontraron usuarios que coincidan con "${searchQuery}"` 
            : "No hay usuarios registrados"
        }
        visibleColumns={4} // Mostrar 4 columnas principales, resto expandible
        pagination={{
          total: filteredStaff.length,
          page: pagination.pagination.page,
          pageSize: pagination.pagination.pageSize,
          onPageChange: pagination.setPage,
          onPageSizeChange: pagination.setPageSize,
          pageSizeOptions: [10, 20, 50],
          showPageSizeSelector: true
        }}
        actions={(row: StaffUser) => (
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setEditing(row)}
              disabled={saving === row.id || deleting === row.id}
            >
              Editar
            </Button>
            <Button
              size="sm"
              variant="danger"
              onClick={() => handleDelete(row.id)}
              disabled={saving === row.id || deleting === row.id}
            >
              {deleting === row.id ? 'Eliminando...' : 'Eliminar'}
            </Button>
          </div>
        )}
      />

      {/* Create User Modal */}
      {createOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-gray-900 rounded-lg p-6 w-full max-w-md border border-gray-700">
            <h2 className="text-xl font-bold text-white mb-4">Crear Nuevo Usuario</h2>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  DNI *
                </label>
                <input
                  type="text"
                  value={form.dni}
                  onChange={(e) => setForm(prev => ({ ...prev, dni: e.target.value }))}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Nombres *
                  </label>
                  <input
                    type="text"
                    value={form.first_name}
                    onChange={(e) => setForm(prev => ({ ...prev, first_name: e.target.value }))}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Apellidos *
                  </label>
                  <input
                    type="text"
                    value={form.last_name}
                    onChange={(e) => setForm(prev => ({ ...prev, last_name: e.target.value }))}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Email *
                </label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm(prev => ({ ...prev, email: e.target.value }))}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Teléfono
                </label>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setForm(prev => ({ ...prev, phone: e.target.value }))}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Contraseña *
                </label>
                <input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm(prev => ({ ...prev, password: e.target.value }))}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Rol *
                </label>
                <select
                  value={form.role_code}
                  onChange={(e) => setForm(prev => ({ ...prev, role_code: e.target.value }))}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  required
                >
                  {allowedRoles.map(role => (
                    <option key={role.id} value={role.code}>
                      {role.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex gap-3 pt-4">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setCreateOpen(false)}
                  className="flex-1"
                >
                  Cancelar
                </Button>
                <Button 
                  type="submit" 
                  disabled={loading}
                  className="flex-1"
                >
                  {loading ? 'Creando...' : 'Crear Usuario'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {editing && (
        <EditUserModal
          open={!!editing}
          user={editing}
          roles={allowedRoles}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            // Refrescar data si es necesario
          }}
        />
      )}
    </div>
  );
}