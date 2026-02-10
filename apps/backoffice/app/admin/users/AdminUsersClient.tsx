"use client";

import Link from "next/link";
import { useState } from "react";
import { UserPlus } from "lucide-react";
import { authedFetch } from "@/lib/authedFetch";
import type { Role, StaffUser } from "./types";
import EditUserModal from "./EditUserModal";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { SelectNative } from "@/components/ui/select-native";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

export default function AdminUsersClient({ roles, initialStaff }: { roles: Role[]; initialStaff: StaffUser[] }) {
  const allowedRoles = roles.filter(
    (r) => !["promo", "promoter", "promoter_manager"].includes(r.code.toLowerCase()) && !r.code.toLowerCase().startsWith("promo")
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
    role_code: allowedRoles.find((r) => r.code === "door")?.code || allowedRoles[0]?.code || "",
  });

  const [saving, setSaving] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [editing, setEditing] = useState<StaffUser | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const totalPages = Math.max(1, Math.ceil(staff.length / pageSize));
  const pagedStaff = staff.slice((page - 1) * pageSize, page * pageSize);

  async function refreshStaff() {
    try {
      const res = await authedFetch("/api/admin/users/list");
      const payload = await res.json().catch(() => null);
      if (res.ok && payload?.success) {
        setStaff(payload.data || []);
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
    } catch (err: any) {
      setError(err?.message || "Error al eliminar usuario");
    } finally {
      setDeleting(null);
    }
  }

  return (
    <main className="relative overflow-hidden px-3 py-4 text-white sm:px-5 lg:px-8">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_16%_16%,rgba(166,12,47,0.10),transparent_32%),radial-gradient(circle_at_84%_0%,rgba(255,255,255,0.09),transparent_30%),radial-gradient(circle_at_50%_108%,rgba(255,255,255,0.06),transparent_42%)]" />

      <div className="mx-auto w-full max-w-7xl space-y-3">
        <Card className="border-[#2b2b2b] bg-[#111111]">
          <CardHeader className="gap-2 py-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <CardDescription className="text-[11px] uppercase tracking-[0.16em] text-white/55">
                  Configuración / Seguridad
                </CardDescription>
                <CardTitle className="mt-1 text-2xl">Usuarios y Roles</CardTitle>
                <p className="mt-1 text-xs text-white/60">Control de cuentas internas y permisos operativos por rol.</p>
              </div>
              <div className="flex items-center gap-2">
                <Link href="/admin" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
                  Volver
                </Link>
                <Button size="sm" onClick={() => setCreateOpen(true)}>
                  <UserPlus className="h-4 w-4" />
                  Nuevo usuario
                </Button>
              </div>
            </div>
          </CardHeader>
        </Card>

        <Card className="overflow-hidden border-[#2b2b2b]">
          <CardHeader className="border-b border-[#252525] pb-2 pt-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <CardTitle className="text-base">Staff</CardTitle>
                <CardDescription className="mt-1 text-xs text-white/55">Edición rápida de rol, estado y eliminación.</CardDescription>
              </div>
              <Badge>
                Página {page}/{totalPages}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table containerClassName="max-h-[58dvh] min-h-[280px]">
              <TableHeader className="[&_th]:sticky [&_th]:top-0 [&_th]:z-[1] [&_th]:bg-[#111111]">
                <TableRow>
                  <TableHead className="w-[20%]">Nombre</TableHead>
                  <TableHead className="w-[22%]">Email / Teléfono</TableHead>
                  <TableHead className="w-[10%]">DNI</TableHead>
                  <TableHead className="w-[18%]">Rol</TableHead>
                  <TableHead className="w-[10%]">Activo</TableHead>
                  <TableHead className="w-[10%]">Creado</TableHead>
                  <TableHead className="w-[10%] text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {staff.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="py-10 text-center text-white/55">
                      No hay usuarios aún.
                    </TableCell>
                  </TableRow>
                )}
                {pagedStaff.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="py-2.5 text-white">
                      <div className="font-semibold">{`${item.person.first_name} ${item.person.last_name}`}</div>
                      <button onClick={() => setEditing(item)} className="text-xs text-red-300 hover:underline">
                        Editar perfil
                      </button>
                    </TableCell>
                    <TableCell className="py-2.5 text-white/75">
                      <div>{item.person.email || "—"}</div>
                      <div className="text-xs text-white/55">{item.person.phone || "—"}</div>
                    </TableCell>
                    <TableCell className="py-2.5 text-white/80">{item.person.dni || "—"}</TableCell>
                    <TableCell className="py-2.5">
                      <SelectNative
                        value={item.role.code}
                        onChange={(e) => handleUpdate(item.id, e.target.value, item.is_active)}
                        disabled={saving === item.id}
                        className="h-8"
                      >
                        {allowedRoles.map((role) => (
                          <option key={role.code} value={role.code}>
                            {role.name}
                          </option>
                        ))}
                      </SelectNative>
                    </TableCell>
                    <TableCell className="py-2.5">
                      <label className="inline-flex items-center gap-2 text-xs text-white/70">
                        <input
                          type="checkbox"
                          checked={item.is_active}
                          onChange={(e) => handleUpdate(item.id, item.role.code, e.target.checked)}
                          disabled={saving === item.id}
                        />
                        Activo
                      </label>
                    </TableCell>
                    <TableCell className="py-2.5 text-white/70">{new Date(item.created_at).toLocaleDateString()}</TableCell>
                    <TableCell className="py-2.5 text-right">
                      <Button
                        type="button"
                        variant="danger"
                        size="sm"
                        onClick={() => handleDelete(item.id)}
                        disabled={deleting === item.id}
                      >
                        {deleting === item.id ? "Eliminando..." : "Eliminar"}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {totalPages > 1 && (
          <div className="flex items-center justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>
              Anterior
            </Button>
            <span className="text-xs text-white/60">
              Página {page} de {totalPages}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
            >
              Siguiente
            </Button>
          </div>
        )}

        {error && (
          <Card className="border-red-500/40">
            <CardContent className="p-3 text-sm text-red-200">{error}</CardContent>
          </Card>
        )}

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
                    <Field label="DNI" value={form.dni} onChange={(v) => setForm((p) => ({ ...p, dni: v }))} required maxLength={8} />
                    <Field label="Teléfono" value={form.phone} onChange={(v) => setForm((p) => ({ ...p, phone: v }))} />
                    <Field label="Nombre" value={form.first_name} onChange={(v) => setForm((p) => ({ ...p, first_name: v }))} required />
                    <Field label="Apellido" value={form.last_name} onChange={(v) => setForm((p) => ({ ...p, last_name: v }))} required />
                    <Field label="Email" value={form.email} onChange={(v) => setForm((p) => ({ ...p, email: v }))} required />
                    <Field
                      label="Contraseña"
                      value={form.password}
                      onChange={(v) => setForm((p) => ({ ...p, password: v }))}
                      required
                      type="password"
                    />
                    <div className="md:col-span-2 space-y-1">
                      <label className="text-xs uppercase tracking-[0.12em] text-white/50">Rol</label>
                      <SelectNative value={form.role_code} onChange={(e) => setForm((p) => ({ ...p, role_code: e.target.value }))}>
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
      </div>

      <EditUserModal open={Boolean(editing)} user={editing} roles={roles} onClose={() => setEditing(null)} onSaved={refreshStaff} />
    </main>
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
