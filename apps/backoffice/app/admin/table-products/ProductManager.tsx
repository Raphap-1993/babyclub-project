"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Box, Plus, Save, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { SelectNative } from "@/components/ui/select-native";

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

  const currentTable = useMemo(() => tablesState.find((table) => table.id === selectedTableId) || null, [tablesState, selectedTableId]);
  const currentProduct = useMemo(
    () => currentTable?.products.find((product) => product.id === selectedProductId) || null,
    [currentTable, selectedProductId]
  );

  useEffect(() => {
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

  async function saveProduct() {
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
        .map((item) => item.trim())
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
            const existingIdx = products.findIndex((product) => product.id === newId);
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
  }

  async function deleteProduct() {
    if (!currentProduct?.id) return;
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/table-products/delete?id=${currentProduct.id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        setMessage(data?.error || "No se pudo borrar");
      } else {
        setMessage("Eliminado");
        setSelectedProductId("");
        setTablesState((prev) =>
          prev.map((table) => {
            if (table.id !== selectedTableId) return table;
            return { ...table, products: (table.products || []).filter((product) => product.id !== currentProduct.id) };
          })
        );
        router.refresh();
      }
    } catch (err: any) {
      setMessage(err?.message || "Error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      {error && (
        <Card className="border-red-500/35 bg-red-500/10">
          <CardContent className="p-3 text-sm text-red-100">{error}</CardContent>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-[1.2fr,1fr]">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <CardTitle className="text-base">Catálogo por mesa</CardTitle>
                <CardDescription className="mt-1 text-xs text-white/55">Selecciona mesa y administra sus combos.</CardDescription>
              </div>
              <Badge>{tablesState.length} mesas</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <SelectNative
                value={selectedTableId}
                onChange={(e) => {
                  setSelectedTableId(e.target.value);
                  const next = tablesState.find((table) => table.id === e.target.value);
                  setSelectedProductId(next?.products?.[0]?.id || "");
                }}
                className="max-w-sm"
              >
                {tablesState.map((table) => (
                  <option key={table.id} value={table.id}>
                    {table.name}
                  </option>
                ))}
              </SelectNative>
              <Button type="button" size="sm" variant="ghost" onClick={() => setSelectedProductId("")}> 
                <Plus className="h-4 w-4" />
                Nuevo
              </Button>
              {currentProduct && <Badge variant="warning">Editando: {currentProduct.name}</Badge>}
            </div>

            <div className="grid gap-2 md:grid-cols-2">
              {(currentTable?.products || []).map((product) => {
                const active = product.id === selectedProductId;
                return (
                  <button
                    type="button"
                    key={product.id}
                    onClick={() => setSelectedProductId(product.id)}
                    className={`rounded-xl border px-3 py-3 text-left transition ${
                      active ? "border-[#a60c2f]/60 bg-[#a60c2f]/10" : "border-[#292929] hover:border-white/30"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <p className="font-semibold text-white">{product.name}</p>
                      <span className={`text-[11px] ${product.is_active === false ? "text-white/40" : "text-emerald-300"}`}>
                        {product.is_active === false ? "Inactivo" : "Activo"}
                      </span>
                    </div>
                    {product.price != null && <p className="text-xs text-white/70">S/ {product.price}</p>}
                    {product.tickets_included != null && (
                      <p className="text-[11px] text-white/55">Incluye {product.tickets_included} tickets</p>
                    )}
                  </button>
                );
              })}

              {(currentTable?.products || []).length === 0 && (
                <div className="rounded-xl border border-dashed border-[#292929] px-3 py-6 text-center text-sm text-white/60">
                  Sin productos para esta mesa. Crea uno nuevo.
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Editor de producto</CardTitle>
            <CardDescription className="mt-1 text-xs text-white/55">Configura precio, tickets y contenido del combo.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Nombre" value={form.name} onChange={(value) => handleChange("name", value)} required />
              <Field label="Precio" value={form.price} onChange={(value) => handleChange("price", value)} placeholder="S/" />
              <Field
                label="Tickets incluidos"
                value={form.tickets_included}
                onChange={(value) => handleChange("tickets_included", value)}
                placeholder="ej. 4"
              />
              <Field label="Orden" value={form.sort_order} onChange={(value) => handleChange("sort_order", value)} placeholder="0" />
              <div className="md:col-span-2">
                <Field
                  label="Descripción"
                  value={form.description}
                  onChange={(value) => handleChange("description", value)}
                  placeholder="Texto breve"
                />
              </div>
              <label className="space-y-1 md:col-span-2">
                <span className="text-xs uppercase tracking-[0.12em] text-white/50">Ítems (uno por línea)</span>
                <textarea
                  value={form.items}
                  onChange={(e) => handleChange("items", e.target.value)}
                  rows={5}
                  className="w-full rounded-lg border border-[#2b2b2b] bg-[#151515] px-3 py-2 text-sm text-white placeholder:text-white/35 outline-none focus:border-[#a60c2f]/50"
                  placeholder="1 Ron...\n1 Gin..."
                />
              </label>
              <label className="inline-flex items-center gap-2 text-sm font-medium text-white md:col-span-2">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(e) => handleChange("is_active", e.target.checked)}
                  className="h-4 w-4"
                />
                Producto activo
              </label>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" onClick={saveProduct} disabled={saving}>
                <Save className="h-4 w-4" />
                {saving ? "Guardando..." : "Guardar"}
              </Button>
              <Button type="button" variant="danger" onClick={deleteProduct} disabled={!currentProduct || saving}>
                <Trash2 className="h-4 w-4" />
                Eliminar
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setSelectedProductId("");
                  setForm({ name: "", description: "", items: "", price: "", tickets_included: "", sort_order: "0", is_active: true });
                }}
                disabled={saving}
              >
                <Box className="h-4 w-4" />
                Limpiar
              </Button>
            </div>

            {message && <p className="text-sm text-white/75">{message}</p>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  required,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <label className="space-y-1">
      <span className="text-xs uppercase tracking-[0.12em] text-white/50">{label}</span>
      <Input value={value} onChange={(e) => onChange(e.target.value)} required={required} placeholder={placeholder} />
    </label>
  );
}
