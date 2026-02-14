"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Trash2 } from "lucide-react";
import MessageModal from "@/components/ui/MessageModal";

type Organizer = {
  id: string;
  name: string;
  slug: string;
  sort_order: number;
  is_active: boolean;
};

export default function OrganizerEditClient({ organizer }: { organizer: Organizer }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [messageType, setMessageType] = useState<"success" | "error" | "warning" | "info">("info");
  const [formData, setFormData] = useState({
    name: organizer.name,
    slug: organizer.slug,
    sort_order: organizer.sort_order,
    is_active: organizer.is_active,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch("/api/organizers", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: organizer.id, ...formData }),
      });

      if (!res.ok) throw new Error("Error al actualizar");

      router.push("/admin/organizers");
      router.refresh();
    } catch (error) {
      setMessageType("error");
      setMessage("Error al actualizar el organizador");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("¿Estás seguro de eliminar este organizador? Esta acción no se puede deshacer.")) {
      return;
    }

    setDeleting(true);
    try {
      const res = await fetch(`/api/organizers?id=${organizer.id}`, {
        method: "DELETE",
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Error al eliminar");
      }

      router.push("/admin/organizers");
      router.refresh();
    } catch (error: any) {
      setMessageType("error");
      setMessage(error.message || "Error al eliminar el organizador");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-900 via-neutral-800 to-neutral-900 p-8">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/admin/organizers"
              className="text-neutral-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-6 h-6" />
            </Link>
            <div>
              <h1 className="text-3xl font-bold text-white">Editar Organizador</h1>
              <p className="text-neutral-400 mt-1">{organizer.name}</p>
            </div>
          </div>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="px-4 py-2 bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            <Trash2 className="w-4 h-4" />
            {deleting ? "Eliminando..." : "Eliminar"}
          </button>
        </div>

        {/* Form */}
        <form
          onSubmit={handleSubmit}
          className="bg-neutral-800/50 border border-neutral-700 rounded-xl p-8 space-y-6"
        >
          <div>
            <label className="block text-sm font-semibold text-neutral-300 mb-2">
              Nombre del Organizador *
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-4 py-3 bg-neutral-900/50 border border-neutral-600 rounded-lg text-white focus:outline-none focus:border-pink-500 transition-colors"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-neutral-300 mb-2">
              Slug (URL amigable) *
            </label>
            <input
              type="text"
              required
              value={formData.slug}
              onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
              className="w-full px-4 py-3 bg-neutral-900/50 border border-neutral-600 rounded-lg text-white focus:outline-none focus:border-pink-500 transition-colors font-mono"
            />
            <p className="text-xs text-neutral-500 mt-1">
              Se usa en URLs: babyclub.com/<strong>{formData.slug}</strong>/evento
            </p>
          </div>

          <div>
            <label className="block text-sm font-semibold text-neutral-300 mb-2">
              Orden de Visualización
            </label>
            <input
              type="number"
              value={formData.sort_order}
              onChange={(e) =>
                setFormData({ ...formData, sort_order: parseInt(e.target.value) })
              }
              className="w-full px-4 py-3 bg-neutral-900/50 border border-neutral-600 rounded-lg text-white focus:outline-none focus:border-pink-500 transition-colors"
            />
          </div>

          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="is_active"
              checked={formData.is_active}
              onChange={(e) =>
                setFormData({ ...formData, is_active: e.target.checked })
              }
              className="w-5 h-5 rounded border-neutral-600 bg-neutral-900/50"
            />
            <label htmlFor="is_active" className="text-sm font-semibold text-neutral-300">
              Organizador activo
            </label>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-6 py-3 bg-gradient-to-r from-pink-500 to-rose-600 hover:from-pink-600 hover:to-rose-700 disabled:from-neutral-600 disabled:to-neutral-700 text-white font-semibold rounded-lg transition-all duration-200 shadow-lg"
            >
              {loading ? "Guardando..." : "Guardar Cambios"}
            </button>
            <Link
              href="/admin/organizers"
              className="px-6 py-3 bg-neutral-700 hover:bg-neutral-600 text-white font-semibold rounded-lg transition-colors text-center"
            >
              Cancelar
            </Link>
          </div>
        </form>
      </div>

      <MessageModal
        message={message}
        type={messageType}
        onClose={() => setMessage(null)}
      />
    </div>
  );
}
