"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import MessageModal from "@/components/ui/MessageModal";

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
  const [message, setMessage] = useState<string | null>(null);
  const [messageType, setMessageType] = useState<"success" | "error" | "warning" | "info">("info");
  const [formData, setFormData] = useState({
    name: "",
    ticket_count: 4,
    price: 0,
    min_consumption: 0,
    notes: "",
  });

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);

    try {
      const res = await fetch(`/api/organizers/${organizer.id}/tables`, {
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
      const res = await fetch(`/api/tables/delete`, {
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

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 px-4 py-8 text-white">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-pink-500 to-rose-600 flex items-center justify-center text-xl">
            🏢
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
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
            className="px-4 py-2 border border-slate-600 rounded-lg hover:bg-slate-800 transition-colors"
          >
            ← Volver
          </Link>
        </div>
      </div>

      {/* Info */}
      <div className="mb-6 rounded-xl border border-blue-700/40 bg-blue-900/20 p-4">
        <div className="flex items-start gap-3">
          <span className="text-2xl">ℹ️</span>
          <div>
            <h3 className="font-semibold text-blue-300 mb-1">Inventario de {organizer.name}</h3>
            <p className="text-sm text-slate-300">
              Estas son las mesas físicas del local de <strong>{organizer.name}</strong>. Se crean una sola vez y se reutilizan en todos los eventos de este organizador.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Formulario */}
        <div className="lg:col-span-1">
          <div className="rounded-xl border border-slate-700 bg-slate-900/50 p-6">
            <h2 className="text-xl font-bold mb-4">Agregar Mesa</h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Nombre *</label>
                <input
                  required
                  type="text"
                  placeholder="Mesa 1, VIP, etc."
                  className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white"
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
                  className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white"
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
                  className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white"
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
                  className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white"
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
                  className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white"
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
          <div className="rounded-xl border border-slate-700 bg-slate-900/50">
            <div className="p-6 border-b border-slate-700">
              <h2 className="text-xl font-bold">
                Mesas ({tables.length})
              </h2>
            </div>
            <div className="divide-y divide-slate-700">
              {tables.length === 0 && (
                <div className="p-8 text-center text-slate-400">
                  No hay mesas creadas. Agrega tu primera mesa.
                </div>
              )}
              {tables.map((table) => (
                <div key={table.id} className="p-4 hover:bg-slate-800/30 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold">{table.name}</h3>
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-semibold ${
                            table.is_active
                              ? "bg-emerald-500/10 text-emerald-400"
                              : "bg-slate-700/50 text-slate-400"
                          }`}
                        >
                          {table.is_active ? "Activa" : "Inactiva"}
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <span className="text-slate-400">Personas:</span>{" "}
                          <span className="font-medium">{table.ticket_count}</span>
                        </div>
                        <div>
                          <span className="text-slate-400">Precio:</span>{" "}
                          <span className="font-medium">S/ {table.price}</span>
                        </div>
                        <div>
                          <span className="text-slate-400">Consumo mín:</span>{" "}
                          <span className="font-medium">S/ {table.min_consumption}</span>
                        </div>
                      </div>
                      {table.notes && (
                        <p className="text-xs text-slate-400 mt-2">{table.notes}</p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Link
                        href={`/admin/tables/${table.id}/edit`}
                        className="px-3 py-1 text-sm bg-blue-500/20 text-blue-400 rounded hover:bg-blue-500/30 transition-colors"
                      >
                        Editar
                      </Link>
                      <button
                        onClick={() => handleDelete(table.id)}
                        className="px-3 py-1 text-sm bg-red-500/20 text-red-400 rounded hover:bg-red-500/30 transition-colors"
                      >
                        Eliminar
                      </button>
                    </div>
                  </div>
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
