"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Product = {
  id: string;
  name: string;
  description?: string | null;
  items?: string[];
  price?: number | null;
  tickets_included?: number | null;
  is_active?: boolean | null;
  sort_order?: number | null;
};

type TableRow = {
  id: string;
  name: string;
  event?: { name?: string | null } | null;
  products: Product[];
};

export default function ProductManager({ tables, error }: { tables: TableRow[]; error?: string }) {
  const router = useRouter();
  const [tablesState, setTablesState] = useState<TableRow[]>(tables);
  const [selectedTableId, setSelectedTableId] = useState<string>(tables?.[0]?.id || "");
  const [selectedProductId, setSelectedProductId] = useState<string>(tables?.[0]?.products?.[0]?.id || "");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    description: "",
    items: "",
    price: "",
    tickets_included: "",
    sort_order: "0",
    is_active: true,
  });

  const currentTable = useMemo(
    () => tablesState.find((t) => t.id === selectedTableId) || null,
    [tablesState, selectedTableId]
  );
  const currentProduct = useMemo(
    () => currentTable?.products.find((p) => p.id === selectedProductId) || null,
    [currentTable, selectedProductId]
  );

  // Initialize form when product changes
  useMemo(() => {
    if (!currentProduct) {
      setForm({ name: "", description: "", items: "", price: "", tickets_included: "", sort_order: "0", is_active: true });
      return;
    }
    setForm({
      name: currentProduct.name || "",
      description: currentProduct.description || "",
      items: (currentProduct.items || []).join("\n"),
      price: currentProduct.price != null ? String(currentProduct.price) : "",
      tickets_included: currentProduct.tickets_included != null ? String(currentProduct.tickets_included) : "",
      sort_order: currentProduct.sort_order != null ? String(currentProduct.sort_order) : "0",
      is_active: currentProduct.is_active !== false,
    });
  }, [currentProduct]);

  const handleChange = (field: keyof typeof form, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const saveProduct = async () => {
    if (!selectedTableId || !form.name.trim()) {
      setMessage("Selecciona mesa y pon nombre al producto");
      return;
    }
    setSaving(true);
    setMessage(null);
    const payload = {
      table_id: selectedTableId,
      name: form.name.trim(),
      description: form.description.trim() || null,
      items: form.items
        .split("\n")
        .map((i) => i.trim())
        .filter(Boolean),
      price: form.price ? Number(form.price) : null,
      tickets_included: form.tickets_included ? Number(form.tickets_included) : null,
      sort_order: form.sort_order ? Number(form.sort_order) : 0,
      is_active: form.is_active,
    };

    const isEditing = Boolean(currentProduct?.id);
    const endpoint = isEditing ? "/api/table-products/update" : "/api/table-products/create";
    const method = isEditing ? "PUT" : "POST";
    const body = isEditing ? { ...payload, id: currentProduct?.id } : payload;

    try {
      const res = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        setMessage(data?.error || "Error al guardar");
      } else {
        const newId = data?.id || currentProduct?.id || "";
        setSelectedProductId(newId);
        setTablesState((prev) =>
          prev.map((table) => {
            if (table.id !== selectedTableId) return table;
            const products = table.products || [];
            const existingIdx = products.findIndex((p) => p.id === newId);
            const nextProduct = { id: newId, ...payload } as Product;
            if (existingIdx >= 0) {
              const next = [...products];
              next[existingIdx] = nextProduct;
              return { ...table, products: next };
            }
            return { ...table, products: [...products, nextProduct] };
          })
        );
        setMessage("Guardado");
        router.refresh();
      }
    } catch (err: any) {
      setMessage(err?.message || "Error");
    } finally {
      setSaving(false);
    }
  };

  const deleteProduct = async () => {
    if (!currentProduct?.id) return;
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/table-products/delete?id=${currentProduct.id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) setMessage(data?.error || "No se pudo borrar");
      else {
        setMessage("Eliminado");
        setSelectedProductId("");
        setTablesState((prev) =>
          prev.map((table) => {
            if (table.id !== selectedTableId) return table;
            return { ...table, products: (table.products || []).filter((p) => p.id !== currentProduct.id) };
          })
        );
        router.refresh();
      }
    } catch (err: any) {
      setMessage(err?.message || "Error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {error && <div className="rounded-2xl border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-100">{error}</div>}

      <div className="grid gap-4 lg:grid-cols-[1.2fr,1fr]">
        <div className="rounded-2xl border border-white/10 bg-[#0c0c0c] p-4">
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={selectedTableId}
              onChange={(e) => {
                setSelectedTableId(e.target.value);
                const next = tablesState.find((t) => t.id === e.target.value);
                setSelectedProductId(next?.products?.[0]?.id || "");
              }}
              className="rounded-xl border border-white/10 bg-[#0f0f0f] px-3 py-2 text-sm text-white focus:border-white"
            >
              {tablesState.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setSelectedProductId("")}
              className="rounded-xl border border-white/20 px-3 py-2 text-sm font-semibold text-white hover:border-white"
            >
              + Nuevo
            </button>
            {currentProduct && (
              <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-white/70">
                Editando: {currentProduct.name}
              </span>
            )}
          </div>

          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {(currentTable?.products || []).map((p) => {
              const active = p.id === selectedProductId;
              return (
                <div
                  key={p.id}
                  onClick={() => setSelectedProductId(p.id)}
                  className={`cursor-pointer rounded-xl border px-3 py-3 text-sm transition ${
                    active ? "border-[#e91e63] bg-[#e91e63]/10" : "border-white/10 hover:border-white/30"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-white">{p.name}</p>
                    <span className={`text-[11px] ${p.is_active === false ? "text-white/40" : "text-emerald-300"}`}>
                      {p.is_active === false ? "Inactivo" : "Activo"}
                    </span>
                  </div>
                  {p.price != null && <p className="text-xs text-white/70">S/ {p.price}</p>}
                  {p.tickets_included != null && (
                    <p className="text-[11px] text-white/50">Incluye {p.tickets_included} tickets</p>
                  )}
                  {p.description && <p className="text-xs text-white/60">{p.description}</p>}
                </div>
              );
            })}
            {(currentTable?.products || []).length === 0 && (
              <div className="rounded-xl border border-dashed border-white/10 px-3 py-6 text-center text-sm text-white/60">
                Sin productos para esta mesa. Crea uno nuevo.
              </div>
            )}
          </div>
        </div>

        <div>
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Nombre" value={form.name} onChange={(v) => handleChange("name", v)} required />
            <Field label="Precio" value={form.price} onChange={(v) => handleChange("price", v)} placeholder="S/" />
            <Field
              label="Tickets incluidos"
              value={form.tickets_included}
              onChange={(v) => handleChange("tickets_included", v)}
              placeholder="ej. 4"
            />
            <Field label="Orden" value={form.sort_order} onChange={(v) => handleChange("sort_order", v)} placeholder="0" />
            <Field
              label="Descripción"
              value={form.description}
              onChange={(v) => handleChange("description", v)}
              placeholder="Texto breve"
            />
            <label className="block space-y-2 text-sm font-semibold text-white">
              Ítems (uno por línea)
              <textarea
                value={form.items}
                onChange={(e) => handleChange("items", e.target.value)}
                rows={5}
                className="w-full rounded-xl border border-white/10 bg-[#111111] px-4 py-3 text-sm text-white placeholder:text-white/40 focus:border-white focus:outline-none"
                placeholder="1 Ron...\n1 Gin..."
              />
            </label>
            <label className="flex items-center gap-2 text-sm font-semibold text-white">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={(e) => handleChange("is_active", e.target.checked)}
                className="h-4 w-4 rounded border-white/20 bg-[#0f0f0f] text-[#e91e63] focus:ring-[#e91e63]"
              />
              Activo
            </label>
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={saveProduct}
              disabled={saving}
              className="rounded-full bg-gradient-to-r from-[#e91e63] to-[#ff77b6] px-4 py-2 text-sm font-semibold text-white shadow-[0_10px_30px_rgba(233,30,99,0.35)] transition hover:shadow-[0_12px_32px_rgba(233,30,99,0.45)] disabled:opacity-70"
            >
              {saving ? "Guardando..." : "Guardar"}
            </button>
            {currentProduct?.id && (
              <button
                type="button"
                onClick={deleteProduct}
                disabled={saving}
                className="rounded-full border border-white/20 px-4 py-2 text-sm font-semibold text-white hover:border-white disabled:opacity-70"
              >
                Eliminar
              </button>
            )}
          </div>
        </div>
      </div>
      {message && (
        <div className="rounded-2xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white">{message}</div>
      )}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <label className="block space-y-2 text-sm font-semibold text-white">
      {label}
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        className="w-full rounded-xl border border-white/10 bg-[#111111] px-4 py-3 text-sm text-white placeholder:text-white/40 focus:border-white focus:outline-none"
      />
    </label>
  );
}
