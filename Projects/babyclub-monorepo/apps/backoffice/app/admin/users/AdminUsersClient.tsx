"use client";

import { useState } from "react";
import type { Role, StaffUser } from "./types";
import EditUserModal from "./EditUserModal";

export default function AdminUsersClient({ roles, initialStaff }: { roles: Role[]; initialStaff: StaffUser[] }) {
  const allowedRoles = roles.filter(
    (r) => !["promo", "promoter", "promoter_manager"].includes(r.code.toLowerCase()) && !r.code.toLowerCase().startsWith("promo"),
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
      const res = await fetch("/api/admin/users/list");
      const payload = await res.json().catch(() => null);
      if (res.ok && payload?.success) {
        setStaff(payload.data || []);
      }
    } catch (_err) {
      // ignore
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
      const res = await fetch("/api/admin/users/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok || !payload?.success) throw new Error(payload?.error || "No se pudo crear el usuario");
      await refreshStaff();
      setForm({ ...form, password: "" });
    } catch (err: any) {
      setError(err?.message || "Error inesperado");
    } finally {
      setLoading(false);
    }
  }

  async function handleUpdate(staffId: string, role_code: string, is_active: boolean) {
    setSaving(staffId);
    try {
      const res = await fetch("/api/admin/users/update", {
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
      const res = await fetch("/api/admin/users/delete", {
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

  return (
    <main className="min-h-screen bg-black px-4 py-8 text-white sm:px-6 lg:px-10">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/60">Configuración</p>
          <h1 className="text-3xl font-semibold">Usuarios y Roles</h1>
          <p className="text-sm text-white/60">Crea cuentas de staff y asigna su rol (ej. puerta).</p>
        </div>
        <button
          onClick={() => setCreateOpen(true)}
          className="rounded-2xl bg-gradient-to-r from-[#e91e63] to-[#ff77b6] px-4 py-2 text-sm font-semibold text-white shadow-[0_10px_30px_rgba(233,30,99,0.35)] transition hover:shadow-[0_12px_32px_rgba(233,30,99,0.45)]"
        >
          Nuevo usuario
        </button>
      </div>

      <section className="rounded-3xl border border-white/10 bg-[#0c0c0c] p-4 shadow-[0_20px_80px_rgba(0,0,0,0.45)]">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Staff</h2>
          <div className="flex items-center gap-2 text-sm text-white/70">
            <span>Usuarios: {staff.length}</span>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-white/10 text-sm">
            <thead className="bg-white/[0.02] text-xs uppercase tracking-[0.08em] text-white/60">
              <tr>
                <th className="px-3 py-2 text-left">Nombre</th>
                <th className="px-3 py-2 text-left">Email / Teléfono</th>
                <th className="px-3 py-2 text-left">DNI</th>
                <th className="px-3 py-2 text-left">Rol</th>
                <th className="px-3 py-2 text-left">Activo</th>
                <th className="px-3 py-2 text-left">Creado</th>
                <th className="px-3 py-2 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {staff.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-3 py-4 text-center text-white/60">
                    No hay usuarios aún.
                  </td>
                </tr>
              )}
              {pagedStaff.map((s) => (
                <tr key={s.id} className="hover:bg-white/[0.02]">
                  <td className="px-3 py-3 text-white">
                    <div className="font-semibold">{`${s.person.first_name} ${s.person.last_name}`}</div>
                    <button
                      onClick={() => setEditing(s)}
                      className="text-xs text-[#e91e63] underline-offset-2 hover:underline"
                    >
                      Editar
                    </button>
                  </td>
                  <td className="px-3 py-3 text-white/80">
                    <div>{s.person.email || "—"}</div>
                    <div className="text-xs text-white/60">{s.person.phone || "—"}</div>
                  </td>
                  <td className="px-3 py-3 text-white/80">{s.person.dni || "—"}</td>
                  <td className="px-3 py-3 text-white/80">
                    <select
                      value={s.role.code}
                      onChange={(e) => handleUpdate(s.id, e.target.value, s.is_active)}
                      disabled={saving === s.id}
                      className="rounded-full border border-white/15 bg-black px-3 py-1 text-xs font-semibold text-white"
                    >
                      {allowedRoles.map((r) => (
                        <option key={r.code} value={r.code}>
                          {r.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-3 text-white/80">
                    <label className="flex items-center gap-1 text-xs text-white/70">
                      <input
                        type="checkbox"
                        checked={s.is_active}
                        onChange={(e) => handleUpdate(s.id, s.role.code, e.target.checked)}
                        disabled={saving === s.id}
                      />
                      Activo
                    </label>
                  </td>
                  <td className="px-3 py-3 text-white/80">{new Date(s.created_at).toLocaleDateString()}</td>
                  <td className="px-3 py-3 text-right">
                    <button
                      onClick={() => handleDelete(s.id)}
                      disabled={deleting === s.id}
                      className="rounded-full border border-red-500/40 px-3 py-1 text-[12px] font-semibold text-red-200 transition hover:border-red-400 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {deleting === s.id ? "Eliminando..." : "Eliminar"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="mt-3 flex items-center justify-end gap-2 text-sm text-white/70">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="rounded-full border border-white/15 px-3 py-1 disabled:cursor-not-allowed disabled:opacity-50"
            >
              ←
            </button>
            <span>
              Página {page} / {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="rounded-full border border-white/15 px-3 py-1 disabled:cursor-not-allowed disabled:opacity-50"
            >
              →
            </button>
          </div>
        )}
      </section>
      {createOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-3xl border border-white/15 bg-[#0b0b0b] p-6 shadow-[0_20px_80px_rgba(0,0,0,0.65)]">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-xl font-semibold text-white">Crear usuario</h3>
              <button
                onClick={() => setCreateOpen(false)}
                className="rounded-full border border-white/20 px-3 py-1 text-sm font-semibold text-white transition hover:border-white"
              >
                Cerrar
              </button>
            </div>
            <form className="space-y-3" onSubmit={handleSubmit}>
              <div className="grid gap-3 md:grid-cols-2">
                <Field label="DNI" value={form.dni} onChange={(v) => setForm((p) => ({ ...p, dni: v }))} required maxLength={8} />
                <Field label="Teléfono" value={form.phone} onChange={(v) => setForm((p) => ({ ...p, phone: v }))} />
                <Field label="Nombre" value={form.first_name} onChange={(v) => setForm((p) => ({ ...p, first_name: v }))} required />
                <Field label="Apellido" value={form.last_name} onChange={(v) => setForm((p) => ({ ...p, last_name: v }))} required />
                <Field label="Email" value={form.email} onChange={(v) => setForm((p) => ({ ...p, email: v }))} required />
                <Field label="Contraseña" value={form.password} onChange={(v) => setForm((p) => ({ ...p, password: v }))} required type="password" />
                <div className="md:col-span-2 flex flex-col gap-1 text-sm">
                  <label className="text-xs uppercase tracking-[0.12em] text-white/50">Rol</label>
                  <select
                    value={form.role_code}
                    onChange={(e) => setForm((p) => ({ ...p, role_code: e.target.value }))}
                    className="w-full rounded-2xl border border-white/10 bg-black px-3 py-2 text-sm text-white outline-none focus:border-white"
                  >
                    {allowedRoles.map((r) => (
                      <option key={r.code} value={r.code}>
                        {r.name} ({r.code})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              {error && <p className="text-sm text-red-300">{error}</p>}
              <div className="flex flex-wrap gap-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="rounded-2xl bg-gradient-to-r from-[#e91e63] to-[#ff77b6] px-4 py-2 text-sm font-semibold text-white shadow-[0_10px_30px_rgba(233,30,99,0.35)] transition hover:shadow-[0_12px_32px_rgba(233,30,99,0.45)] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? "Creando..." : "Crear usuario"}
                </button>
                <button
                  type="button"
                  onClick={() => setCreateOpen(false)}
                  className="rounded-2xl border border-white/20 px-4 py-2 text-sm font-semibold text-white transition hover:border-white"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      <EditUserModal open={Boolean(editing)} user={editing} roles={roles} onClose={() => setEditing(null)} onSaved={refreshStaff} />
    </main>
  );
}

function Field({ label, value, onChange, required, type = "text", maxLength }: { label: string; value: string; onChange: (v: string) => void; required?: boolean; type?: string; maxLength?: number }) {
  return (
    <label className="flex flex-col gap-1 text-sm font-semibold text-white">
      <span className="text-xs uppercase tracking-[0.12em] text-white/50">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        type={type}
        maxLength={maxLength}
        required={required}
        className="w-full rounded-2xl border border-white/10 bg-black px-3 py-2 text-sm text-white outline-none focus:border-white"
      />
    </label>
  );
}
