"use client";
import { useState } from "react";
import { useEffect } from "react";
import type { ChangeEvent } from "react";
import { authedFetch } from "@/lib/authedFetch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SelectNative } from "@/components/ui/select-native";

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
    const { name, value } = target;
    setForm((prev) => ({ ...prev, [name]: value }));
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
      const res = await authedFetch("/api/admin/users/update", {
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-2xl rounded-3xl border border-[#2b2b2b] bg-[#0b0b0b] p-6 shadow-[0_20px_80px_rgba(0,0,0,0.65)]">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-xl font-semibold text-white">Editar usuario</h3>
          <Button
            onClick={onClose}
            variant="outline"
            size="sm"
            className="rounded-full border-white/20 text-white hover:border-white"
          >
            Cerrar
          </Button>
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
              <SelectNative
                name="role_code"
                value={form.role_code}
                onChange={handleChange}
                className="h-10 rounded-2xl border-[#292929] bg-black text-sm text-white focus:border-white"
              >
                {roles.map((r) => (
                  <option key={r.code} value={r.code}>
                    {r.name} ({r.code})
                  </option>
                ))}
              </SelectNative>
            </div>
            <div className="md:col-span-2">
              <Button
                type="button"
                variant={form.is_active ? "outline" : "ghost"}
                size="sm"
                onClick={() => setForm((prev) => ({ ...prev, is_active: !prev.is_active }))}
                className={form.is_active ? "border-emerald-500/40 text-emerald-300" : "text-white/80"}
              >
                {form.is_active ? "Activo" : "Inactivo"}
              </Button>
            </div>
          </div>
          {error && <p className="text-sm text-red-300">{error}</p>}
          <div className="flex flex-wrap gap-2">
            <Button
              type="submit"
              disabled={saving}
              className="rounded-2xl bg-gradient-to-r from-[#a60c2f] to-[#6f0c25] text-sm font-semibold text-white shadow-[0_10px_30px_rgba(166,12,47,0.35)] transition hover:shadow-[0_12px_32px_rgba(166,12,47,0.45)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "Guardando..." : "Guardar cambios"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="rounded-2xl border-white/20 text-sm font-semibold text-white hover:border-white"
            >
              Cancelar
            </Button>
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
      <Input
        name={name}
        value={value}
        onChange={onChange}
        type={type}
        required={required}
        className="h-10 rounded-2xl border-[#292929] bg-black text-sm text-white focus:border-white"
      />
    </label>
  );
}
