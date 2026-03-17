"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ColumnDef } from "@tanstack/react-table";
import { UserPlus, Search, Filter, Shield, Pencil, Trash2 } from "lucide-react";
import { DataTable } from "@repo/ui";
import { authedFetch } from "@/lib/authedFetch";
import type { Role, StaffUser } from "./types";
import EditUserModal from "./EditUserModal";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { SelectNative } from "@/components/ui/select-native";
import { ScreenHeader } from "../components/ScreenHeader";
import { ExternalPagination } from "../components/ExternalPagination";

type DoorAuditUser = {
  id: string;
  auth_user_id: string | null;
  is_active: boolean;
  role_code: string | null;
  role_name: string | null;
  full_name: string;
  email: string | null;
  phone: string | null;
  scans_today: number;
  last_scan_at: string | null;
  ready_for_door: boolean;
  issues: string[];
};

type DoorAuditData = {
  date: string;
  timezone: string;
  summary: {
    total_door_users: number;
    active_door_users: number;
    ready_door_users: number;
    users_with_issues: number;
    scanned_staff_today: number;
    total_scans_today: number;
  };
  users: DoorAuditUser[];
};

export default function AdminUsersClient({ roles, initialStaff }: { roles: Role[]; initialStaff: StaffUser[] }) {
  const allowedRoles = roles.filter(
    (role) =>
      !["promo", "promoter", "promoter_manager"].includes(role.code.toLowerCase()) &&
      !role.code.toLowerCase().startsWith("promo"),
  );

  const [staff, setStaff] = useState<StaffUser[]>(initialStaff);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    dni: "",
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    password: "",
    role_code: allowedRoles.find((role) => role.code === "door")?.code || allowedRoles[0]?.code || "",
  });

  const [saving, setSaving] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [editing, setEditing] = useState<StaffUser | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const [tempSearchValue, setTempSearchValue] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [tempRoleFilter, setTempRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [tempStatusFilter, setTempStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [doorAudit, setDoorAudit] = useState<DoorAuditData | null>(null);
  const [doorAuditLoading, setDoorAuditLoading] = useState(false);
  const [doorAuditError, setDoorAuditError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const filteredStaff = useMemo(() => {
    const term = searchValue.trim().toLowerCase();
    return staff.filter((item) => {
      if (roleFilter !== "all" && item.role.code !== roleFilter) return false;
      if (statusFilter === "active" && !item.is_active) return false;
      if (statusFilter === "inactive" && item.is_active) return false;
      if (!term) return true;
      const fullName = `${item.person.first_name} ${item.person.last_name}`.toLowerCase();
      const email = (item.person.email || "").toLowerCase();
      const dni = (item.person.dni || "").toLowerCase();
      const phone = (item.person.phone || "").toLowerCase();
      const roleName = (item.role.name || "").toLowerCase();
      return (
        fullName.includes(term) ||
        email.includes(term) ||
        dni.includes(term) ||
        phone.includes(term) ||
        roleName.includes(term)
      );
    });
  }, [staff, searchValue, roleFilter, statusFilter]);

  const totalItems = filteredStaff.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const currentPage = Math.min(Math.max(1, page), totalPages);

  useEffect(() => {
    if (page === currentPage) return;
    setPage(currentPage);
  }, [page, currentPage]);

  const pagedStaff = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredStaff.slice(start, start + pageSize);
  }, [filteredStaff, currentPage, pageSize]);
  const hasActiveFilters = Boolean(searchValue.trim() || roleFilter !== "all" || statusFilter !== "all");

  const refreshDoorAudit = useCallback(async () => {
    setDoorAuditLoading(true);
    setDoorAuditError(null);
    try {
      const res = await authedFetch("/api/admin/users/door-audit");
      const payload = await res.json().catch(() => null);
      if (!res.ok || !payload?.success) {
        throw new Error(payload?.error || "No se pudo cargar la auditoría de puerta");
      }
      setDoorAudit(payload.data || null);
    } catch (err: any) {
      setDoorAuditError(err?.message || "Error al cargar auditoría de puerta");
    } finally {
      setDoorAuditLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshDoorAudit();
  }, [refreshDoorAudit]);

  async function refreshStaff() {
    try {
      const res = await authedFetch("/api/admin/users/list");
      const payload = await res.json().catch(() => null);
      if (res.ok && payload?.success) {
        setStaff(payload.data || []);
        await refreshDoorAudit();
      }
    } catch (_err) {
      // ignore refresh failures
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
      setForm((prev) => ({ ...prev, password: "" }));
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
      setStaff((prev) => prev.filter((item) => item.id !== staffId));
      await refreshDoorAudit();
    } catch (err: any) {
      setError(err?.message || "Error al eliminar usuario");
    } finally {
      setDeleting(null);
    }
  }

  const handleApplyFilters = () => {
    setSearchValue(tempSearchValue);
    setRoleFilter(tempRoleFilter);
    setStatusFilter(tempStatusFilter);
    setPage(1);
  };

  const handleClearFilters = () => {
    setTempSearchValue("");
    setTempRoleFilter("all");
    setTempStatusFilter("all");
    setSearchValue("");
    setRoleFilter("all");
    setStatusFilter("all");
    setPage(1);
  };

  const columns = useMemo<ColumnDef<StaffUser>[]>(
    () => [
      {
        accessorKey: "person",
        header: "Nombre",
        size: 220,
        cell: ({ row }) => {
              const item = row.original;
              return (
                <div className="min-w-0">
                  <div className="truncate font-medium text-neutral-100">{`${item.person.first_name} ${item.person.last_name}`}</div>
                </div>
              );
            },
      },
      {
        accessorKey: "contact",
        header: "Email / Teléfono",
        size: 250,
        cell: ({ row }) => {
          const person = row.original.person;
          return (
            <div className="space-y-0.5 text-xs text-neutral-300">
              <div className="truncate">{person.email || "—"}</div>
              <div className="truncate text-neutral-400">{person.phone || "—"}</div>
            </div>
          );
        },
      },
      {
        accessorKey: "dni",
        header: "DNI",
        size: 110,
        cell: ({ row }) => <span className="font-mono text-xs text-neutral-300">{row.original.person.dni || "—"}</span>,
      },
      {
        accessorKey: "role",
        header: "Rol",
        size: 180,
        cell: ({ row }) => {
          const item = row.original;
          return (
            <span className="inline-flex h-8 items-center rounded-full border border-white/15 bg-black/40 px-3 text-xs font-semibold text-neutral-200">
              {item.role.name}
            </span>
          );
        },
      },
      {
        accessorKey: "is_active",
        header: "Activo",
        size: 100,
        cell: ({ row }) => {
          const item = row.original;
          const nextState = !item.is_active;
          return (
            <Button
              type="button"
              variant={item.is_active ? "outline" : "ghost"}
              size="sm"
              onClick={() => handleUpdate(item.id, item.role.code, nextState)}
              disabled={saving === item.id}
              className={`h-7 px-2 text-xs ${item.is_active ? "border-emerald-500/40 text-emerald-300" : "text-neutral-300"}`}
            >
              {item.is_active ? "Activo" : "Inactivo"}
            </Button>
          );
        },
      },
      {
        accessorKey: "created_at",
        header: "Creado",
        size: 100,
        cell: ({ row }) => <span className="text-xs text-neutral-400">{new Date(row.original.created_at).toLocaleDateString()}</span>,
      },
      {
        id: "actions",
        header: "Acciones",
        size: 90,
        cell: ({ row }) => (
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setEditing(row.original)}
              className="h-7 w-7 text-neutral-400 hover:bg-neutral-700/50 hover:text-neutral-200"
              title="Editar perfil"
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => handleDelete(row.original.id)}
              disabled={deleting === row.original.id}
              className="h-7 w-7 text-neutral-400 hover:bg-red-700/20 hover:text-red-400 disabled:cursor-not-allowed disabled:opacity-50"
              title="Eliminar usuario"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ),
      },
    ],
    [deleting, saving],
  );

  return (
    <main className="space-y-6">
      <ScreenHeader
        icon={Shield}
        kicker="Security Management"
        title="Usuarios y Roles"
        description="Control de cuentas internas y permisos operativos."
        actions={
          <>
            <Link
              href="/admin"
              className="inline-flex items-center justify-center rounded-lg border border-neutral-600 px-4 py-2 text-sm font-semibold text-neutral-200 transition-all hover:border-neutral-500 hover:bg-neutral-800"
            >
              ← Dashboard
            </Link>
            <Button onClick={() => setCreateOpen(true)}>
              <UserPlus className="h-4 w-4" />
              Nuevo usuario
            </Button>
          </>
        }
      />

      <section className="mb-6 space-y-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-neutral-300">Búsqueda</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
              <Input
                value={tempSearchValue}
                onChange={(event) => setTempSearchValue(event.target.value)}
                placeholder="Nombre, email, DNI o teléfono"
                className="h-10 pl-10"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-neutral-300">Rol</label>
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
              <SelectNative
                value={tempRoleFilter}
                onChange={(event) => setTempRoleFilter(event.target.value)}
                className="h-10 pl-10 text-sm"
              >
                <option value="all">Todos</option>
                {allowedRoles.map((role) => (
                  <option key={role.code} value={role.code}>
                    {role.name}
                  </option>
                ))}
              </SelectNative>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-neutral-300">Estado</label>
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
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

      <section className="space-y-3 rounded-2xl border border-white/10 bg-[#0b0b0b]/75 p-3 shadow-[0_20px_70px_rgba(0,0,0,0.4)]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-neutral-100">Auditoría puerta (hoy)</h2>
            <p className="text-xs text-neutral-400">
              Usuarios con rol door habilitados para escaneo y actividad del día.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {doorAudit ? (
              <span className="rounded-lg border border-white/10 bg-black/40 px-3 py-1.5 text-xs text-white/75">
                {doorAudit.date} · {doorAudit.timezone}
              </span>
            ) : null}
            <Button type="button" variant="ghost" size="sm" onClick={() => void refreshDoorAudit()} disabled={doorAuditLoading}>
              {doorAuditLoading ? "Actualizando..." : "Actualizar"}
            </Button>
          </div>
        </div>

        {doorAuditError ? (
          <p className="rounded-lg border border-red-500/30 bg-red-500/20 px-3 py-2 text-xs text-red-300">
            {doorAuditError}
          </p>
        ) : null}

        {doorAudit ? (
          <>
            <div className="grid gap-2 md:grid-cols-3 xl:grid-cols-6">
              <AuditStat label="Usuarios door" value={doorAudit.summary.total_door_users} />
              <AuditStat label="Activos" value={doorAudit.summary.active_door_users} />
              <AuditStat label="Listos para puerta" value={doorAudit.summary.ready_door_users} />
              <AuditStat label="Con incidencias" value={doorAudit.summary.users_with_issues} />
              <AuditStat label="Operadores con scans" value={doorAudit.summary.scanned_staff_today} />
              <AuditStat label="Scans hoy" value={doorAudit.summary.total_scans_today} />
            </div>

            <div className="overflow-x-auto rounded-xl border border-white/10">
              <table className="min-w-full divide-y divide-white/10 text-xs text-white/80">
                <thead className="bg-black/40 text-[11px] uppercase tracking-[0.08em] text-white/50">
                  <tr>
                    <th className="px-3 py-2 text-left">Usuario</th>
                    <th className="px-3 py-2 text-left">Rol</th>
                    <th className="px-3 py-2 text-left">Estado</th>
                    <th className="px-3 py-2 text-left">Scans hoy</th>
                    <th className="px-3 py-2 text-left">Último scan</th>
                    <th className="px-3 py-2 text-left">Incidencias</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {doorAudit.users.length === 0 ? (
                    <tr>
                      <td className="px-3 py-3 text-white/60" colSpan={6}>
                        No hay usuarios con rol door registrados.
                      </td>
                    </tr>
                  ) : (
                    doorAudit.users.map((user) => (
                      <tr key={user.id}>
                        <td className="px-3 py-2">
                          <div className="font-medium text-white">{user.full_name}</div>
                          <div className="text-[11px] text-white/60">{user.email || "Sin email"}</div>
                        </td>
                        <td className="px-3 py-2">{user.role_name || user.role_code || "—"}</td>
                        <td className="px-3 py-2">
                          <span
                            className={
                              user.ready_for_door
                                ? "rounded-full border border-emerald-500/40 bg-emerald-500/15 px-2 py-1 text-[11px] font-semibold text-emerald-200"
                                : "rounded-full border border-amber-500/40 bg-amber-500/15 px-2 py-1 text-[11px] font-semibold text-amber-200"
                            }
                          >
                            {user.ready_for_door ? "Habilitado" : "Revisar"}
                          </span>
                        </td>
                        <td className="px-3 py-2 font-semibold text-white">{user.scans_today}</td>
                        <td className="px-3 py-2 text-white/70">
                          {user.last_scan_at
                            ? new Date(user.last_scan_at).toLocaleTimeString("es-PE", {
                                hour: "2-digit",
                                minute: "2-digit",
                                timeZone: "America/Lima",
                              })
                            : "—"}
                        </td>
                        <td className="px-3 py-2 text-white/70">
                          {user.issues.length > 0 ? user.issues.join(" · ") : "Sin incidencias"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <p className="text-xs text-white/60">{doorAuditLoading ? "Cargando auditoría..." : "Sin datos de auditoría."}</p>
        )}
      </section>

      <section className="rounded-2xl border border-white/10 bg-[#0b0b0b]/75 p-3 shadow-[0_20px_70px_rgba(0,0,0,0.4)]">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-neutral-100">Staff</h2>
          <span className="rounded-lg border border-white/10 bg-black/40 px-3 py-1.5 text-xs text-white/75">
            {totalItems} usuarios · página {currentPage}/{totalPages}
          </span>
        </div>

        {/* Mobile cards */}
        <div className="space-y-3 md:hidden">
          {pagedStaff.length === 0 ? (
            <p className="py-6 text-center text-sm text-neutral-500">No hay usuarios aún.</p>
          ) : (
            pagedStaff.map((item) => (
              <div key={item.id} className="rounded-2xl border border-white/10 bg-black/40 p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-neutral-100 truncate">
                      {item.person.first_name} {item.person.last_name}
                    </p>
                    {item.person.dni ? (
                      <p className="text-xs font-mono text-neutral-400 mt-0.5">{item.person.dni}</p>
                    ) : null}
                  </div>
                  <span className="shrink-0 inline-flex h-7 items-center rounded-full border border-white/15 bg-black/40 px-3 text-xs font-semibold text-neutral-200">
                    {item.role.name}
                  </span>
                </div>
                <div className="space-y-1 text-xs text-neutral-400">
                  {item.person.email ? <div className="truncate">{item.person.email}</div> : null}
                  {item.person.phone ? <div className="text-neutral-500">{item.person.phone}</div> : null}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant={item.is_active ? "outline" : "ghost"}
                    size="sm"
                    onClick={() => handleUpdate(item.id, item.role.code, !item.is_active)}
                    disabled={saving === item.id}
                    className={`h-7 px-2 text-xs ${item.is_active ? "border-emerald-500/40 text-emerald-300" : "text-neutral-300"}`}
                  >
                    {item.is_active ? "Activo" : "Inactivo"}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => setEditing(item)}
                    className="h-7 w-7 text-neutral-400 hover:bg-neutral-700/50 hover:text-neutral-200"
                    title="Editar perfil"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(item.id)}
                    disabled={deleting === item.id}
                    className="h-7 w-7 text-neutral-400 hover:bg-red-700/20 hover:text-red-400 disabled:opacity-50"
                    title="Eliminar usuario"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Desktop table */}
        <div className="hidden md:block max-h-[calc(100vh-23rem)] min-h-[300px] overflow-y-auto pr-1">
          <DataTable
            columns={columns}
            data={pagedStaff}
            compact
            maxHeight="none"
            enableSorting
            showPagination={false}
            emptyMessage="No hay usuarios aún."
          />
        </div>

        <div className="mt-3 border-t border-white/10 pt-3">
          <ExternalPagination
            currentPage={currentPage}
            totalItems={totalItems}
            itemsPerPage={pageSize}
            onPageChange={(nextPage) => setPage(nextPage)}
            onPageSizeChange={(size) => {
              setPageSize(size);
              setPage(1);
            }}
            itemLabel="usuarios"
          />
        </div>
      </section>

      {error && <p className="rounded-lg border border-red-500/30 bg-red-500/20 p-3 text-sm text-red-400">⚠️ Error: {error}</p>}

      {createOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <Card className="w-full max-w-2xl border-[#2b2b2b] bg-[#0b0b0b]">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle>Crear usuario</CardTitle>
                <Button type="button" variant="ghost" size="sm" onClick={() => setCreateOpen(false)}>
                  Cerrar
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <form className="space-y-3" onSubmit={handleSubmit}>
                <div className="grid gap-3 md:grid-cols-2">
                  <Field label="DNI" value={form.dni} onChange={(value) => setForm((prev) => ({ ...prev, dni: value }))} required maxLength={8} />
                  <Field label="Teléfono" value={form.phone} onChange={(value) => setForm((prev) => ({ ...prev, phone: value }))} />
                  <Field label="Nombre" value={form.first_name} onChange={(value) => setForm((prev) => ({ ...prev, first_name: value }))} required />
                  <Field label="Apellido" value={form.last_name} onChange={(value) => setForm((prev) => ({ ...prev, last_name: value }))} required />
                  <Field label="Email" value={form.email} onChange={(value) => setForm((prev) => ({ ...prev, email: value }))} required />
                  <Field
                    label="Contraseña"
                    value={form.password}
                    onChange={(value) => setForm((prev) => ({ ...prev, password: value }))}
                    required
                    type="password"
                  />
                  <div className="space-y-1 md:col-span-2">
                    <label className="text-xs uppercase tracking-[0.12em] text-white/50">Rol</label>
                    <SelectNative value={form.role_code} onChange={(e) => setForm((prev) => ({ ...prev, role_code: e.target.value }))}>
                      {allowedRoles.map((role) => (
                        <option key={role.code} value={role.code}>
                          {role.name} ({role.code})
                        </option>
                      ))}
                    </SelectNative>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button type="submit" disabled={loading}>
                    {loading ? "Creando..." : "Crear usuario"}
                  </Button>
                  <Button type="button" variant="ghost" onClick={() => setCreateOpen(false)}>
                    Cancelar
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      <EditUserModal open={Boolean(editing)} user={editing} roles={roles} onClose={() => setEditing(null)} onSaved={refreshStaff} />
    </main>
  );
}

function AuditStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/40 px-3 py-2">
      <p className="text-[11px] uppercase tracking-[0.08em] text-white/50">{label}</p>
      <p className="text-lg font-semibold text-white">{value}</p>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  required,
  type = "text",
  maxLength,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  type?: string;
  maxLength?: number;
}) {
  return (
    <label className="space-y-1">
      <span className="text-xs uppercase tracking-[0.12em] text-white/50">{label}</span>
      <Input value={value} onChange={(e) => onChange(e.target.value)} type={type} maxLength={maxLength} required={required} />
    </label>
  );
}
