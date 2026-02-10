// apps/backoffice/app/admin/tables/components/TableForm.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type TableFormProps = {
  mode: "create" | "edit";
  initialData?: TableFormData | null;
  eventId?: string;
};

type TableFormData = {
  id?: string;
  name: string;
  ticket_count: number;
  min_consumption?: number | null;
  price?: number | null;
  notes?: string | null;
  is_active?: boolean | null;
  event_id?: string;
};

export default function TableForm({ mode, initialData, eventId }: TableFormProps) {
  const router = useRouter();
  const [form, setForm] = useState<TableFormData>(() => ({
    id: initialData?.id,
    name: initialData?.name || "",
    ticket_count: initialData?.ticket_count || 4,
    min_consumption: initialData?.min_consumption ?? null,
    price: initialData?.price ?? null,
    notes: initialData?.notes ?? "",
    is_active: initialData?.is_active ?? true,
    event_id: eventId || initialData?.event_id,
  }));
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const update = (key: keyof TableFormData, value: any) => setForm((prev) => ({ ...prev, [key]: value }));

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!form.name.trim()) {
      setError("Nombre es requerido");
      return;
    }
    if (mode === "create" && !form.event_id) {
      setError("Se requiere un evento activo");
      return;
    }
    setLoading(true);
    try {
      const endpoint = mode === "edit" ? "/api/tables/update" : "/api/tables/create";
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          name: form.name.trim(),
          notes: (form.notes || "").trim(),
          min_consumption: form.min_consumption ?? null,
          price: form.price ?? null,
          ticket_count: Number(form.ticket_count) || 1,
          is_active: Boolean(form.is_active),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        setError(data?.error || "No se pudo guardar");
      } else {
        router.push("/admin/tables");
        router.refresh();
      }
    } catch (err: any) {
      setError(err?.message || "Error al guardar");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2">
        <Field label="Nombre" value={form.name} onChange={(v) => update("name", v)} required />
        <Field
          label="Cantidad de tickets"
          type="number"
          value={String(form.ticket_count)}
          onChange={(v) => update("ticket_count", Number(v) || 1)}
          min={1}
          required
        />
        <Field
          label="Consumo mínimo (S/)"
          type="number"
          value={form.min_consumption != null ? String(form.min_consumption) : ""}
          onChange={(v) => update("min_consumption", v ? Number(v) : null)}
          min={0}
        />
        <Field
          label="Precio referencial (S/)"
          type="number"
          value={form.price != null ? String(form.price) : ""}
          onChange={(v) => update("price", v ? Number(v) : null)}
          min={0}
        />
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-sm font-semibold text-white">Notas</label>
        <textarea
          value={form.notes || ""}
          onChange={(e) => update("notes", e.target.value)}
          rows={3}
          className="w-full rounded-2xl border border-white/10 bg-[#0c0c0c] px-4 py-3 text-sm text-white placeholder:text-white/40 outline-none transition focus:border-white"
          placeholder="Opcional: ubicación, beneficios, etc."
        />
      </div>

      <label className="flex items-center gap-3 text-sm font-semibold text-white/90">
        <input
          type="checkbox"
          checked={!!form.is_active}
          onChange={(e) => update("is_active", e.target.checked)}
          className="h-5 w-5 rounded border border-white/20 bg-[#0c0c0c] accent-[#e91e63]"
        />
        Activa
      </label>

      {error && <p className="text-xs font-semibold text-[#ff9a9a]">{error}</p>}
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={loading}
          className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-[#e91e63] to-[#ff77b6] px-5 py-2 text-sm font-semibold text-white shadow-[0_12px_35px_rgba(233,30,99,0.35)] transition hover:shadow-[0_14px_38px_rgba(233,30,99,0.45)] disabled:opacity-70"
        >
          {loading ? "Guardando..." : mode === "edit" ? "Guardar cambios" : "Crear mesa"}
        </button>
      </div>
    </form>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  min,
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  min?: number;
  required?: boolean;
}) {
  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-semibold text-white">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        type={type}
        min={min}
        required={required}
        className="w-full rounded-2xl border border-white/10 bg-[#0c0c0c] px-4 py-3 text-sm text-white placeholder:text-white/40 outline-none transition focus:border-white"
      />
    </div>
  );
}
