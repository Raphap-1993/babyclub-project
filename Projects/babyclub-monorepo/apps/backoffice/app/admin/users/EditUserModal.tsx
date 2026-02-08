"use client";
import { useState } from "react";
import { useEffect } from "react";
import type { ChangeEvent } from "react";

import type { Role, StaffUser } from "./types";

export default function EditUserModal({
  open,
  user,
  roles,
  onClose,
  onSaved,
}: {
  open: boolean;
  user: StaffUser | null;
  roles: Role[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState(() => ({
    dni: user?.person.dni || "",
    first_name: user?.person.first_name || "",
    last_name: user?.person.last_name || "",
    email: user?.person.email || "",
    phone: user?.person.phone || "",
    password: "",
    role_code: user?.role.code || roles[0]?.code || "",
    is_active: user?.is_active ?? true,
  }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      setForm({
        dni: user.person.dni || "",
        first_name: user.person.first_name,
        last_name: user.person.last_name,
        email: user.person.email || "",
        phone: user.person.phone || "",
        password: "",
        role_code: user.role.code,
        is_active: user.is_active,
      });
    }
  }, [user]);

  if (!open || !user) return null;

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const target = e.target as HTMLInputElement | HTMLSelectElement;
    const { name, value, type } = target;
    const isChecked = (target as HTMLInputElement).checked;
    setForm((prev) => ({ ...prev, [name]: type === "checkbox" ? isChecked : value }));
  };

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    const staffId = user?.id;
    if (!staffId) {
      setError("Usuario no disponible");
      setSaving(false);
      return;
    }
    try {
      const res = await fetch("/api/admin/users/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          staff_id: staffId,
          ...form,
        }),
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok || !payload?.success) throw new Error(payload?.error || "No se pudo actualizar");
      onSaved();
      onClose();
    } catch (err: any) {
      setError(err?.message || "Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-3xl border border-white/15 bg-[#0b0b0b] p-6 shadow-[0_20px_80px_rgba(0,0,0,0.65)]">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-xl font-semibold text-white">Editar usuario</h3>
          <button
            onClick={onClose}
            className="rounded-full border border-white/20 px-3 py-1 text-sm font-semibold text-white transition hover:border-white"
          >
            Cerrar
          </button>
        </div>
        <form className="space-y-3" onSubmit={handleSubmit}>
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="DNI" name="dni" value={form.dni} onChange={handleChange} required />
            <Field label="Teléfono" name="phone" value={form.phone} onChange={handleChange} />
            <Field label="Nombre" name="first_name" value={form.first_name} onChange={handleChange} required />
            <Field label="Apellido" name="last_name" value={form.last_name} onChange={handleChange} required />
            <Field label="Email" name="email" value={form.email} onChange={handleChange} required />
            <Field label="Nueva contraseña (opcional)" name="password" value={form.password} onChange={handleChange} type="password" />
            <div className="md:col-span-2 flex flex-col gap-1 text-sm">
              <label className="text-xs uppercase tracking-[0.12em] text-white/50">Rol</label>
              <select
                name="role_code"
                value={form.role_code}
                onChange={handleChange}
                className="w-full rounded-2xl border border-white/10 bg-black px-3 py-2 text-sm text-white outline-none focus:border-white"
              >
                {roles.map((r) => (
                  <option key={r.code} value={r.code}>
                    {r.name} ({r.code})
                  </option>
                ))}
              </select>
            </div>
            <label className="flex items-center gap-2 text-xs text-white/80">
              <input type="checkbox" name="is_active" checked={form.is_active} onChange={handleChange} />
              Activo
            </label>
          </div>
          {error && <p className="text-sm text-red-300">{error}</p>}
          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={saving}
              className="rounded-2xl bg-gradient-to-r from-[#e91e63] to-[#ff77b6] px-4 py-2 text-sm font-semibold text-white shadow-[0_10px_30px_rgba(233,30,99,0.35)] transition hover:shadow-[0_12px_32px_rgba(233,30,99,0.45)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "Guardando..." : "Guardar cambios"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-2xl border border-white/20 px-4 py-2 text-sm font-semibold text-white transition hover:border-white"
            >
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({ label, name, value, onChange, type = "text", required }: { label: string; name: string; value: string; onChange: (e: ChangeEvent<any>) => void; type?: string; required?: boolean }) {
  return (
    <label className="flex flex-col gap-1 text-sm font-semibold text-white">
      <span className="text-xs uppercase tracking-[0.12em] text-white/50">{label}</span>
      <input
        name={name}
        value={value}
        onChange={onChange}
        type={type}
        required={required}
        className="w-full rounded-2xl border border-white/10 bg-black px-3 py-2 text-sm text-white outline-none focus:border-white"
      />
    </label>
  );
}
