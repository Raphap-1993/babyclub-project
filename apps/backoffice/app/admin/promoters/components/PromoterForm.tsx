// apps/backoffice/app/admin/promoters/components/PromoterForm.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  mode: "create" | "edit";
  initialData?: PromoterFormData | null;
};

type PromoterFormData = {
  id?: string;
  person_id?: string;
  first_name: string;
  last_name: string;
  dni: string;
  email: string;
  phone: string;
  code: string;
  instagram?: string | null;
  tiktok?: string | null;
  notes?: string | null;
  is_active?: boolean | null;
};

export default function PromoterForm({ mode, initialData }: Props) {
  const router = useRouter();
  const [form, setForm] = useState<PromoterFormData>(() => ({
    id: initialData?.id,
    person_id: initialData?.person_id,
    first_name: initialData?.first_name ?? "",
    last_name: initialData?.last_name ?? "",
    dni: initialData?.dni ?? "",
    email: initialData?.email ?? "",
    phone: initialData?.phone ?? "",
    code: initialData?.code ?? "",
    instagram: initialData?.instagram ?? "",
    tiktok: initialData?.tiktok ?? "",
    notes: initialData?.notes ?? "",
    is_active: initialData?.is_active ?? true,
  }));
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupInfo, setLookupInfo] = useState<string | null>(null);

  const updateField = (key: keyof PromoterFormData, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [key]: value as any }));
  };

  const handleLookup = async () => {
    const dni = form.dni.trim();
    if (dni.length !== 8) {
      setLookupInfo("Ingresa 8 dígitos para buscar.");
      return;
    }
    setLookupInfo(null);
    setLookupLoading(true);
    try {
      const res = await fetch(`/api/persons?dni=${dni}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.person) {
        throw new Error(data?.error || "No se encontró información");
      }
      const person = data.person;
      updateField("first_name", person.first_name || "");
      updateField("last_name", person.last_name || "");
      if (!form.email && person.email) updateField("email", person.email);
      if (!form.phone && person.phone) updateField("phone", person.phone);
      setLookupInfo("Datos cargados automáticamente.");
    } catch (err: any) {
      setLookupInfo(err?.message || "Error al consultar DNI");
    } finally {
      setLookupLoading(false);
    }
  };

  const onSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    setError(null);
    if (!form.first_name.trim() || !form.last_name.trim() || !form.dni.trim()) {
      setError("Nombre, apellido y DNI son requeridos");
      return;
    }
    if (form.dni.trim().length !== 8) {
      setError("DNI debe tener 8 dígitos");
      return;
    }
    setLoading(true);
    try {
      const endpoint = mode === "edit" ? "/api/promoters/update" : "/api/promoters/create";
      const body = JSON.stringify({
        id: form.id,
        person_id: form.person_id,
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        dni: form.dni.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        code: form.code.trim(),
        instagram: (form.instagram || "").trim(),
        tiktok: (form.tiktok || "").trim(),
        notes: (form.notes || "").trim(),
        is_active: Boolean(form.is_active),
      });
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || "No se pudo guardar");
      }
      router.push("/admin/promoters");
      router.refresh();
    } catch (err: any) {
      setError(err?.message || "Error al guardar");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="flex flex-col gap-2">
        <label className="text-sm font-semibold text-white" htmlFor="dni">
          DNI
        </label>
        <div className="grid grid-cols-[1fr_auto] gap-2">
          <input
            id="dni"
            value={form.dni}
            onChange={(e) => {
              let next = e.target.value.replace(/\D/g, "");
              next = next.slice(0, 8);
              updateField("dni", next);
              setLookupInfo(null);
            }}
            placeholder="00000000"
            inputMode="numeric"
            maxLength={8}
            className="w-full rounded-2xl border border-white/10 bg-[#0c0c0c] px-4 py-3 text-sm text-white placeholder:text-white/40 outline-none transition focus:border-white"
            required
          />
          <button
            type="button"
            onClick={handleLookup}
            disabled={lookupLoading}
            className="rounded-2xl border border-white/10 bg-[#111] px-4 text-sm font-semibold text-white transition hover:border-white/30 disabled:opacity-60"
          >
            {lookupLoading ? "Buscando..." : "Buscar"}
          </button>
        </div>
        <p className="text-xs text-white/60">Consulta en BD y API Perú para rellenar automáticamente.</p>
        {lookupInfo && <p className="text-xs font-semibold text-[#ff9a9a]">{lookupInfo}</p>}
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-sm font-semibold text-white">Nombre</label>
        <div className="grid gap-2 md:grid-cols-2">
          <input
            value={form.first_name}
            onChange={(e) => updateField("first_name", e.target.value)}
            placeholder="Nombre"
            className="w-full rounded-2xl border border-white/10 bg-[#0c0c0c] px-4 py-3 text-sm text-white placeholder:text-white/40 outline-none transition focus:border-white"
            required
          />
          <input
            value={form.last_name}
            onChange={(e) => updateField("last_name", e.target.value)}
            placeholder="Apellido"
            className="w-full rounded-2xl border border-white/10 bg-[#0c0c0c] px-4 py-3 text-sm text-white placeholder:text-white/40 outline-none transition focus:border-white"
            required
          />
        </div>
      </div>

      <div className="grid gap-2 md:grid-cols-2">
        <div className="flex flex-col gap-2">
          <label className="text-sm font-semibold text-white" htmlFor="code">
            Código interno
          </label>
          <input
            id="code"
            value={form.code}
            onChange={(e) => updateField("code", e.target.value)}
            placeholder="promotor-01"
            className="w-full rounded-2xl border border-white/10 bg-[#0c0c0c] px-4 py-3 text-sm text-white placeholder:text-white/40 outline-none transition focus:border-white"
          />
        </div>
        <div className="flex flex-col gap-2">
          <label className="text-sm font-semibold text-white" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            type="email"
            value={form.email}
            onChange={(e) => updateField("email", e.target.value)}
            placeholder="email@baby.club"
            className="w-full rounded-2xl border border-white/10 bg-[#0c0c0c] px-4 py-3 text-sm text-white placeholder:text-white/40 outline-none transition focus:border-white"
          />
        </div>
      </div>

      <div className="grid gap-2 md:grid-cols-2">
        <div className="flex flex-col gap-2">
          <label className="text-sm font-semibold text-white" htmlFor="phone">
            Teléfono
          </label>
          <input
            id="phone"
            value={form.phone}
            onChange={(e) => updateField("phone", e.target.value)}
            placeholder="+51 999 999 999"
            className="w-full rounded-2xl border border-white/10 bg-[#0c0c0c] px-4 py-3 text-sm text-white placeholder:text-white/40 outline-none transition focus:border-white"
          />
        </div>
        <div className="flex flex-col gap-2">
          <label className="text-sm font-semibold text-white" htmlFor="instagram">
            Instagram
          </label>
          <input
            id="instagram"
            value={form.instagram || ""}
            onChange={(e) => updateField("instagram", e.target.value)}
            placeholder="@usuario"
            className="w-full rounded-2xl border border-white/10 bg-[#0c0c0c] px-4 py-3 text-sm text-white placeholder:text-white/40 outline-none transition focus:border-white"
          />
        </div>
      </div>

      <div className="grid gap-2 md:grid-cols-2">
        <div className="flex flex-col gap-2">
          <label className="text-sm font-semibold text-white" htmlFor="tiktok">
            TikTok
          </label>
          <input
            id="tiktok"
            value={form.tiktok || ""}
            onChange={(e) => updateField("tiktok", e.target.value)}
            placeholder="@usuario"
            className="w-full rounded-2xl border border-white/10 bg-[#0c0c0c] px-4 py-3 text-sm text-white placeholder:text-white/40 outline-none transition focus:border-white"
          />
        </div>
        <div className="flex flex-col gap-2">
          <label className="text-sm font-semibold text-white" htmlFor="notes">
            Notas
          </label>
          <textarea
            id="notes"
            value={form.notes || ""}
            onChange={(e) => updateField("notes", e.target.value)}
            placeholder="Comentarios internos"
            rows={3}
            className="w-full rounded-2xl border border-white/10 bg-[#0c0c0c] px-4 py-3 text-sm text-white placeholder:text-white/40 outline-none transition focus:border-white"
          />
        </div>
      </div>

      <label className="flex items-center gap-3 text-sm font-semibold text-white/90">
        <input
          type="checkbox"
          checked={!!form.is_active}
          onChange={(e) => updateField("is_active", e.target.checked)}
          className="h-5 w-5 rounded border border-white/20 bg-[#0c0c0c] accent-[#e91e63]"
        />
        Activo
      </label>

      {error && <p className="text-xs font-semibold text-[#ff9a9a]">{error}</p>}
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={loading}
          className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-[#e91e63] to-[#ff77b6] px-5 py-2 text-sm font-semibold text-white shadow-[0_12px_35px_rgba(233,30,99,0.35)] transition hover:shadow-[0_14px_38px_rgba(233,30,99,0.45)] disabled:opacity-70"
        >
          {loading ? "Guardando..." : mode === "edit" ? "Guardar cambios" : "Crear promotor"}
        </button>
      </div>
    </form>
  );
}
