"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import MessageModal from "@/components/ui/MessageModal";
import { authedFetch } from "@/lib/authedFetch";

type Table = {
  id: string;
  name: string;
  ticket_count: number | null;
  min_consumption: number | null;
  price: number | null;
  is_active: boolean | null;
  notes: string | null;
};

type Organizer = {
  id: string;
  name: string;
  slug: string;
};

export default function OrganizerTablesClient({
  organizer,
  tables,
}: {
  organizer: Organizer;
  tables: Table[];
}) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [messageType, setMessageType] = useState<"success" | "error" | "warning" | "info">("info");
  const [formData, setFormData] = useState({
    name: "",
    ticket_count: 4,
    price: 0,
    min_consumption: 0,
    notes: "",
  });
  const [editFormData, setEditFormData] = useState({
    name: "",
    ticket_count: 1,
    price: 0,
    min_consumption: 0,
    notes: "",
    is_active: true,
  });

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);

    try {
      const res = await authedFetch(`/api/organizers/${organizer.id}/tables`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          ticketCount: formData.ticket_count,
          price: formData.price,
          minConsumption: formData.min_consumption,
          notes: formData.notes,
          isActive: true,
        }),
      });

      if (!res.ok) throw new Error(await res.text());

      setFormData({ name: "", ticket_count: 4, price: 0, min_consumption: 0, notes: "" });
      router.refresh();
    } catch (err) {
      setMessageType("error");
      setMessage(`Error: ${err}`);
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (tableId: string) => {
    if (!confirm("¿Eliminar esta mesa?")) return;

    try {
      const res = await authedFetch(`/api/tables/delete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: tableId }),
      });

      if (!res.ok) throw new Error(await res.text());
      router.refresh();
    } catch (err) {
      setMessageType("error");
      setMessage(`Error: ${err}`);
    }
  };

  const startEdit = (table: Table) => {
    setEditingId(table.id);
    setEditFormData({
      name: table.name || "",
      ticket_count: table.ticket_count ?? 1,
      price: table.price ?? 0,
      min_consumption: table.min_consumption ?? 0,
      notes: table.notes ?? "",
      is_active: Boolean(table.is_active),
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const handleSaveEdit = async (tableId: string) => {
    if (!editFormData.name.trim()) {
      setMessageType("warning");
      setMessage("El nombre de la mesa es obligatorio.");
      return;
    }

    setSavingEdit(true);
    try {
      const res = await authedFetch(`/api/tables/update`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: tableId,
          name: editFormData.name.trim(),
          ticket_count: Number(editFormData.ticket_count) || 1,
          price: Number(editFormData.price) || 0,
          min_consumption: Number(editFormData.min_consumption) || 0,
          notes: editFormData.notes.trim() || null,
          is_active: Boolean(editFormData.is_active),
        }),
      });

      const payload = await res.json().catch(() => ({}));
      if (!res.ok || !payload?.success) {
        throw new Error(payload?.error || "No se pudo actualizar la mesa");
      }

      setEditingId(null);
      setMessageType("success");
      setMessage("Mesa actualizada correctamente.");
      router.refresh();
    } catch (err) {
      setMessageType("error");
      setMessage(`Error: ${err}`);
    } finally {
      setSavingEdit(false);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-neutral-950 via-neutral-900 to-neutral-950 px-4 py-8 text-white">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-pink-500 to-rose-600 flex items-center justify-center text-xl">
            🏢
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
              {organizer.name}
            </p>
            <h1 className="text-3xl font-bold">Mesas del Local</h1>
          </div>
        </div>
        <div className="flex gap-3">
          <Link
            href={`/admin/organizers/${organizer.id}/layout`}
            className="px-4 py-2 bg-amber-500/20 text-amber-400 rounded-lg hover:bg-amber-500/30 transition-colors"
          >
            📐 Diseñar Croquis
          </Link>
          <Link
            href="/admin/organizers"
            className="px-4 py-2 border border-neutral-600 rounded-lg hover:bg-neutral-800 transition-colors"
          >
            ← Volver
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Formulario */}
        <div className="lg:col-span-1">
          <div className="rounded-xl border border-neutral-700 bg-neutral-900/50 p-6">
            <h2 className="text-xl font-bold mb-4">Agregar Mesa</h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Nombre *</label>
                <input
                  required
                  type="text"
                  placeholder="Mesa 1, VIP, etc."
                  className="w-full bg-neutral-800 border border-neutral-600 rounded-lg px-3 py-2 text-white"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Cantidad de personas</label>
                <input
                  required
                  type="number"
                  min="1"
                  className="w-full bg-neutral-800 border border-neutral-600 rounded-lg px-3 py-2 text-white"
                  value={formData.ticket_count}
                  onChange={(e) =>
                    setFormData({ ...formData, ticket_count: parseInt(e.target.value) || 0 })
                  }
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Precio (S/)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className="w-full bg-neutral-800 border border-neutral-600 rounded-lg px-3 py-2 text-white"
                  value={formData.price}
                  onChange={(e) =>
                    setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })
                  }
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Consumo mínimo (S/)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className="w-full bg-neutral-800 border border-neutral-600 rounded-lg px-3 py-2 text-white"
                  value={formData.min_consumption}
                  onChange={(e) =>
                    setFormData({ ...formData, min_consumption: parseFloat(e.target.value) || 0 })
                  }
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Notas</label>
                <textarea
                  rows={2}
                  className="w-full bg-neutral-800 border border-neutral-600 rounded-lg px-3 py-2 text-white"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                />
              </div>
              <button
                type="submit"
                disabled={creating}
                className="w-full bg-gradient-to-r from-pink-600 to-pink-500 hover:from-pink-700 hover:to-pink-600 rounded-lg px-4 py-2 font-semibold disabled:opacity-50"
              >
                {creating ? "Creando..." : "+ Agregar Mesa"}
              </button>
            </form>
          </div>
        </div>

        {/* Lista de Mesas */}
        <div className="lg:col-span-2">
          <div className="rounded-xl border border-neutral-700 bg-neutral-900/50">
            <div className="p-6 border-b border-neutral-700">
              <h2 className="text-xl font-bold">
                Mesas ({tables.length})
              </h2>
            </div>
            <div className="divide-y divide-neutral-700">
              {tables.length === 0 && (
                <div className="p-8 text-center text-neutral-400">
                  No hay mesas creadas. Agrega tu primera mesa.
                </div>
              )}
              {tables.map((table) => (
                <div key={table.id} className="p-4 hover:bg-neutral-800/30 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold">{table.name}</h3>
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-semibold ${
                            table.is_active
                              ? "bg-emerald-500/10 text-emerald-400"
                              : "bg-neutral-700/50 text-neutral-400"
                          }`}
                        >
                          {table.is_active ? "Activa" : "Inactiva"}
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <span className="text-neutral-400">Personas:</span>{" "}
                          <span className="font-medium">{table.ticket_count}</span>
                        </div>
                        <div>
                          <span className="text-neutral-400">Precio:</span>{" "}
                          <span className="font-medium">S/ {table.price}</span>
                        </div>
                        <div>
                          <span className="text-neutral-400">Consumo mín:</span>{" "}
                          <span className="font-medium">S/ {table.min_consumption}</span>
                        </div>
                      </div>
                      {table.notes && (
                        <p className="text-xs text-neutral-400 mt-2">{table.notes}</p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => startEdit(table)}
                        disabled={savingEdit && editingId === table.id}
                        className="px-3 py-1 text-sm font-semibold rounded border border-amber-300/45 bg-amber-400/20 text-amber-200 shadow-[0_0_0_1px_rgba(251,191,36,0.18)] transition hover:bg-amber-300/30 hover:text-white disabled:opacity-60"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => handleDelete(table.id)}
                        type="button"
                        className="px-3 py-1 text-sm bg-red-500/20 text-red-400 rounded hover:bg-red-500/30 transition-colors"
                      >
                        Eliminar
                      </button>
                    </div>
                  </div>
                  {editingId === table.id && (
                    <div className="mt-4 rounded-lg border border-neutral-700 bg-neutral-900/70 p-4">
                      <p className="mb-3 text-sm font-semibold text-white">Editar mesa</p>
                      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                        <div>
                          <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.1em] text-neutral-400">
                            Nombre
                          </label>
                          <input
                            type="text"
                            value={editFormData.name}
                            onChange={(e) => setEditFormData((prev) => ({ ...prev, name: e.target.value }))}
                            className="w-full rounded-lg border border-neutral-600 bg-neutral-800 px-3 py-2 text-sm text-white outline-none focus:border-neutral-400"
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.1em] text-neutral-400">
                            Personas
                          </label>
                          <input
                            type="number"
                            min="1"
                            value={editFormData.ticket_count}
                            onChange={(e) =>
                              setEditFormData((prev) => ({ ...prev, ticket_count: parseInt(e.target.value, 10) || 1 }))
                            }
                            className="w-full rounded-lg border border-neutral-600 bg-neutral-800 px-3 py-2 text-sm text-white outline-none focus:border-neutral-400"
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.1em] text-neutral-400">
                            Precio (S/)
                          </label>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={editFormData.price}
                            onChange={(e) =>
                              setEditFormData((prev) => ({ ...prev, price: parseFloat(e.target.value) || 0 }))
                            }
                            className="w-full rounded-lg border border-neutral-600 bg-neutral-800 px-3 py-2 text-sm text-white outline-none focus:border-neutral-400"
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.1em] text-neutral-400">
                            Consumo mínimo (S/)
                          </label>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={editFormData.min_consumption}
                            onChange={(e) =>
                              setEditFormData((prev) => ({
                                ...prev,
                                min_consumption: parseFloat(e.target.value) || 0,
                              }))
                            }
                            className="w-full rounded-lg border border-neutral-600 bg-neutral-800 px-3 py-2 text-sm text-white outline-none focus:border-neutral-400"
                          />
                        </div>
                        <div className="md:col-span-2">
                          <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.1em] text-neutral-400">
                            Notas
                          </label>
                          <textarea
                            rows={2}
                            value={editFormData.notes}
                            onChange={(e) => setEditFormData((prev) => ({ ...prev, notes: e.target.value }))}
                            className="w-full rounded-lg border border-neutral-600 bg-neutral-800 px-3 py-2 text-sm text-white outline-none focus:border-neutral-400"
                          />
                        </div>
                        <div className="md:col-span-2">
                          <label className="inline-flex items-center gap-2 text-sm text-neutral-200">
                            <input
                              type="checkbox"
                              checked={editFormData.is_active}
                              onChange={(e) => setEditFormData((prev) => ({ ...prev, is_active: e.target.checked }))}
                              className="h-4 w-4 accent-pink-500"
                            />
                            Mesa activa
                          </label>
                        </div>
                      </div>
                      <div className="mt-4 flex gap-2">
                        <button
                          type="button"
                          onClick={() => handleSaveEdit(table.id)}
                          disabled={savingEdit}
                          className="rounded-lg bg-pink-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-pink-500 disabled:opacity-60"
                        >
                          {savingEdit ? "Guardando..." : "Guardar cambios"}
                        </button>
                        <button
                          type="button"
                          onClick={cancelEdit}
                          disabled={savingEdit}
                          className="rounded-lg border border-neutral-600 px-4 py-2 text-sm font-semibold text-neutral-200 transition hover:bg-neutral-800 disabled:opacity-60"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <MessageModal
        message={message}
        type={messageType}
        onClose={() => setMessage(null)}
      />
    </main>
  );
}
