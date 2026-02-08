"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Table = {
  id: string;
  name: string;
  ticket_count?: number | null;
  min_consumption?: number | null;
  price?: number | null;
  notes?: string | null;
  is_active?: boolean | null;
  pos_x?: number | null;
  pos_y?: number | null;
  pos_w?: number | null;
  pos_h?: number | null;
};

type LayoutData = {
  layout_url: string | null;
  tables: Table[];
};

export default function LayoutEditor({ initial }: { initial?: LayoutData }) {
  const router = useRouter();
  const [data, setData] = useState<LayoutData>(initial || { layout_url: null, tables: [] });
  const [selected, setSelected] = useState<string>("");
  const [loading, setLoading] = useState(!initial);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (initial && initial.tables.length) {
      setSelected(initial.tables[0].id);
    }
  }, [initial]);

  useEffect(() => {
    setError(null);
    Promise.all([fetch("/api/layout").then((r) => r.json()), fetch("/api/tables").then((r) => r.json())])
      .then(([layoutRes, tablesRes]) => {
        const nextTables = Array.isArray(tablesRes?.tables) ? tablesRes.tables : [];
        const layout_url = layoutRes?.layout_url || data.layout_url || null;
        setData((prev) => ({
          layout_url,
          tables: nextTables.length > 0 ? nextTables : prev.tables,
        }));
        setSelected((prev) => prev || nextTables?.[0]?.id || data.tables?.[0]?.id || "");
        if (!nextTables.length) {
          setError("No se pudieron cargar mesas o no existen registros.");
        }
      })
      .catch((e) => setError(e?.message || "No se pudo cargar la información"))
      .finally(() => setLoading(false));
  }, [data.layout_url]);

  const selectedTable = useMemo(
    () => data.tables.find((t) => t.id === selected) || null,
    [data.tables, selected]
  );

  const updateTablePos = (id: string, patch: Partial<Table>) => {
    setData((prev) => ({
      ...prev,
      tables: prev.tables.map((t) => (t.id === id ? { ...t, ...patch } : t)),
    }));
  };

  const onDrop = (event: React.DragEvent<HTMLDivElement>, id: string) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const rawX = ((event.clientX - rect.left) / rect.width) * 100;
    const rawY = ((event.clientY - rect.top) / rect.height) * 100;
    // Snap fino de 0.5% para mayor precisión visual
    const snap = 0.5;
    const x = Math.round(rawX / snap) * snap;
    const y = Math.round(rawY / snap) * snap;
    updateTablePos(id, {
      pos_x: Math.max(0, Math.min(100, x)),
      pos_y: Math.max(0, Math.min(100, y)),
    });
  };

  const saveLayout = async () => {
    setSaving(true);
    setMessage(null);
    try {
      // guardar layout url (ya se guarda al subir) y posiciones de mesas
      for (const table of data.tables) {
        await fetch("/api/tables/update", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: table.id,
            name: table.name,
            ticket_count: table.ticket_count,
            min_consumption: table.min_consumption,
            price: table.price,
            notes: table.notes,
            is_active: table.is_active,
            pos_x: table.pos_x,
            pos_y: table.pos_y,
            pos_w: table.pos_w,
            pos_h: table.pos_h,
          }),
        });
      }
      setMessage("Plano guardado");
      router.refresh();
    } catch (err: any) {
      setMessage(err?.message || "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  };

  const uploadLayout = async (file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/uploads/layout", { method: "POST", body: fd });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json?.success) {
      setMessage(json?.error || "No se pudo subir la imagen");
      return;
    }
    const url = json.url;
    setData((prev) => ({ ...prev, layout_url: url }));
    await fetch("/api/layout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ layout_url: url }),
    });
    setMessage("Imagen actualizada");
  };

  if (loading) return <div className="text-sm text-white/70">Cargando...</div>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) uploadLayout(file);
          }}
          className="text-sm text-white"
        />
        <button
          type="button"
          onClick={saveLayout}
          disabled={saving}
          className="rounded-full bg-gradient-to-r from-[#e91e63] to-[#ff77b6] px-4 py-2 text-sm font-semibold text-white shadow-[0_10px_30px_rgba(233,30,99,0.35)] transition hover:shadow-[0_12px_32px_rgba(233,30,99,0.45)] disabled:opacity-70"
        >
          {saving ? "Guardando..." : "Guardar posiciones"}
        </button>
        {message && <span className="text-sm text-white/70">{message}</span>}
        {error && <span className="text-sm text-[#ff9a9a]">{error}</span>}
      </div>

      <div className="grid gap-4 lg:grid-cols-[2fr,1fr]">
        <div
          ref={containerRef}
          className="relative w-full rounded-3xl border border-white/15 bg-black"
          style={{
            aspectRatio: "3 / 4",
            minHeight: "320px",
            maxHeight: "80vh",
            backgroundImage: data.layout_url ? `url(${data.layout_url})` : undefined,
            backgroundSize: "contain",
            backgroundRepeat: "no-repeat",
            backgroundPosition: "center",
          }}
        >
          {data.tables.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center text-sm text-white/50">
              No hay mesas. Crea mesas y vuelve para posicionarlas.
            </div>
          )}
          {data.tables.map((t) => {
            const match = t.name.match(/(\d+)/);
            const shortLabel = match ? `M${match[1]}` : t.name;
            return (
              <div
                key={t.id}
                draggable
                onDragEnd={(e) => onDrop(e as any, t.id)}
                onClick={() => setSelected(t.id)}
                className={`absolute flex cursor-move items-center justify-center rounded-xl border px-2 py-1 text-[11px] font-semibold ${
                  t.id === selected ? "border-[#e91e63] bg-[#e91e63]/25 text-white" : "border-white/30 bg-black/50 text-white"
                }`}
                style={{
                  left: `${t.pos_x ?? 10}%`,
                  top: `${t.pos_y ?? 10}%`,
                  width: `clamp(40px, ${t.pos_w ?? 9}%, 110px)`,
                  height: `clamp(40px, ${t.pos_h ?? 6}%, 110px)`,
                }}
              >
                {shortLabel}
              </div>
            );
          })}
        </div>

        <div className="space-y-3 rounded-2xl border border-white/10 bg-[#0c0c0c] p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-white/50">Mesa</p>
          <select
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-[#0f0f0f] px-3 py-2 text-sm text-white"
          >
            {data.tables.length === 0 && <option value="">Sin mesas</option>}
            {data.tables.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>

          {selectedTable && (
            <div className="grid gap-3 md:grid-cols-2">
              <Field
                label="Pos X (%)"
                value={selectedTable.pos_x != null ? String(selectedTable.pos_x) : ""}
                onChange={(v) => updateTablePos(selectedTable.id, { pos_x: Number(v) || 0 })}
                step={0.5}
              />
              <Field
                label="Pos Y (%)"
                value={selectedTable.pos_y != null ? String(selectedTable.pos_y) : ""}
                onChange={(v) => updateTablePos(selectedTable.id, { pos_y: Number(v) || 0 })}
                step={0.5}
              />
              <Field
                label="Ancho (%)"
                value={selectedTable.pos_w != null ? String(selectedTable.pos_w) : ""}
                onChange={(v) => updateTablePos(selectedTable.id, { pos_w: Number(v) || 0 })}
                step={0.5}
              />
              <Field
                label="Alto (%)"
                value={selectedTable.pos_h != null ? String(selectedTable.pos_h) : ""}
                onChange={(v) => updateTablePos(selectedTable.id, { pos_h: Number(v) || 0 })}
                step={0.5}
              />
            </div>
          )}
          <p className="text-xs text-white/50">Arrastra los recuadros sobre el plano o ajusta los porcentajes.</p>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  min = 0,
  max = 100,
  step = 0.5,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  min?: number;
  max?: number;
  step?: number;
}) {
  const nudge = (delta: number) => {
    const numeric = Number(value || 0);
    const next = Math.max(min, Math.min(max, numeric + delta));
    onChange(String(Number(next.toFixed(2))));
  };

  return (
    <label className="block space-y-1 text-sm font-semibold text-white">
      <span className="flex items-center justify-between">
        <span>{label}</span>
        <div className="flex items-center gap-1 text-[11px] text-white/60">
          <button
            type="button"
            onClick={() => nudge(-step)}
            className="h-6 w-6 rounded-md border border-white/15 bg-[#121212] text-center font-bold text-white/80 hover:border-white/40"
          >
            –
          </button>
          <button
            type="button"
            onClick={() => nudge(step)}
            className="h-6 w-6 rounded-md border border-white/15 bg-[#121212] text-center font-bold text-white/80 hover:border-white/40"
          >
            +
          </button>
        </div>
      </span>
      <input
        type="number"
        step={step}
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-white/10 bg-[#111111] px-3 py-2 text-sm text-white focus:border-white"
      />
    </label>
  );
}
