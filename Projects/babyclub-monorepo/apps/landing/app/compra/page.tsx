/* Compra de mesas/tickets con upload de voucher */
"use client";

import { useEffect, useState } from "react";

type TableRow = {
  id: string;
  name: string;
  ticket_count?: number | null;
  min_consumption?: number | null;
  price?: number | null;
  notes?: string | null;
};

export default function CompraPage() {
  const [tables, setTables] = useState<TableRow[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [form, setForm] = useState({ full_name: "", email: "", phone: "", voucher_url: "" });
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successCodes, setSuccessCodes] = useState<string[] | null>(null);

  useEffect(() => {
    fetch("/api/tables", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        setTables(data?.tables || []);
        setSelected(data?.tables?.[0]?.id || "");
      })
      .catch(() => setTables([]));
  }, []);

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("tableName", selected || "mesa");
    try {
      const res = await fetch("/api/uploads/voucher", { method: "POST", body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        setError(data?.error || "No se pudo subir el voucher");
      } else {
        setForm((prev) => ({ ...prev, voucher_url: data.url }));
      }
    } catch (err: any) {
      setError(err?.message || "Error al subir voucher");
    } finally {
      setUploading(false);
    }
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessCodes(null);

    if (!selected || !form.full_name.trim() || !form.voucher_url) {
      setError("Selecciona una mesa, ingresa tu nombre y sube el voucher");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          table_id: selected,
          full_name: form.full_name,
          email: form.email,
          phone: form.phone,
          voucher_url: form.voucher_url,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        setError(data?.error || "No se pudo registrar la reserva");
      } else {
        setSuccessCodes(data.codes || []);
      }
    } catch (err: any) {
      setError(err?.message || "Error al registrar reserva");
    } finally {
      setLoading(false);
    }
  };

  const tableInfo = tables.find((t) => t.id === selected);

  return (
    <main className="flex min-h-screen items-center justify-center bg-black px-6 py-12 text-white">
      <div className="w-full max-w-3xl space-y-8">
        <div className="text-center space-y-2">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-white/70">BABY</p>
          <h1 className="text-3xl font-semibold">Compra / Reserva</h1>
          <p className="text-sm text-white/60">
            Selecciona tu mesa, sube el voucher (Yape/Plin) y recibe códigos para generar los QR de tu grupo.
          </p>
        </div>

        <form onSubmit={onSubmit} className="space-y-5">
          <div className="flex flex-col gap-2">
            <label className="text-sm font-semibold text-white">Mesa</label>
            <select
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
              className="w-full rounded-2xl border border-white/10 bg-[#111111] px-4 py-3 text-sm text-white focus:border-white"
            >
              {tables.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            {tableInfo && (
              <div className="rounded-2xl border border-white/10 bg-[#0a0a0a] p-3 text-xs text-white/70">
                <div>Tickets incluidos: {tableInfo.ticket_count ?? "—"}</div>
                <div>Consumo mínimo: {tableInfo.min_consumption != null ? `S/ ${tableInfo.min_consumption}` : "—"}</div>
                <div>Precio: {tableInfo.price != null ? `S/ ${tableInfo.price}` : "—"}</div>
                {tableInfo.notes && <div className="mt-1 text-white/60">{tableInfo.notes}</div>}
              </div>
            )}
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Nombre completo" value={form.full_name} onChange={(v) => setForm((p) => ({ ...p, full_name: v }))} required />
            <Field label="Email" value={form.email} onChange={(v) => setForm((p) => ({ ...p, email: v }))} type="email" />
            <Field label="Teléfono" value={form.phone} onChange={(v) => setForm((p) => ({ ...p, phone: v }))} />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-semibold text-white">Voucher (Yape/Plin)</label>
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={onFileChange}
              disabled={uploading}
              className="w-full rounded-2xl border border-white/10 bg-[#111111] px-4 py-3 text-sm text-white file:mr-3 file:rounded-xl file:border-0 file:bg-white/10 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white"
            />
            {form.voucher_url && (
              <a
                href={form.voucher_url}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-[#e91e63] underline-offset-4 hover:underline"
              >
                Ver voucher subido
              </a>
            )}
          </div>

          {error && <p className="text-xs font-semibold text-[#ff9a9a]">{error}</p>}
          {successCodes && successCodes.length > 0 && (
            <div className="rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-4 text-sm text-white">
              <p className="font-semibold mb-2">Reserva registrada. Códigos generados:</p>
              <div className="space-y-1">
                {successCodes.map((c) => (
                  <div key={c} className="rounded-xl bg-black/30 px-3 py-2 font-mono text-xs">
                    {c}
                  </div>
                ))}
              </div>
              <p className="mt-2 text-xs text-white/70">Comparte estos códigos con tu grupo para que generen sus QR.</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-full bg-gradient-to-r from-[#e91e63] to-[#ff77b6] px-4 py-3 text-center text-sm font-semibold uppercase tracking-wide text-white shadow-[0_12px_35px_rgba(233,30,99,0.35)] transition hover:shadow-[0_14px_38px_rgba(233,30,99,0.45)] disabled:opacity-70"
          >
            {loading ? "Procesando..." : "Enviar reserva"}
          </button>
        </form>
      </div>
    </main>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="block space-y-2 text-sm font-semibold text-white">
      {label}
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        type={type}
        required={required}
        className="w-full rounded-xl border border-white/10 bg-[#111111] px-4 py-3 text-base text-white placeholder:text-white/40 focus:border-white focus:outline-none"
      />
    </label>
  );
}
