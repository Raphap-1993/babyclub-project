"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import MessageModal from "@/components/ui/MessageModal";

export default function CreateOrganizerPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [messageType, setMessageType] = useState<"success" | "error" | "warning" | "info">("info");
  const [formData, setFormData] = useState({
    name: "",
    slug: "",
    sort_order: 100,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch("/api/organizers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!res.ok) throw new Error("Error al crear organizador");

      router.push("/admin/organizers");
      router.refresh();
    } catch (error) {
      setMessageType("error");
      setMessage("Error al crear el organizador");
    } finally {
      setLoading(false);
    }
  };

  const handleNameChange = (name: string) => {
    setFormData({
      ...formData,
      name,
      // Auto-generar slug desde el nombre
      slug: name
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "") // quitar acentos
        .replace(/[^a-z0-9]+/g, "-") // espacios a guiones
        .replace(/^-+|-+$/g, ""), // quitar guiones del inicio/fin
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-8">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex items-center gap-4">
          <Link
            href="/admin/organizers"
            className="text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-6 h-6" />
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-white">Nuevo Organizador</h1>
            <p className="text-slate-400 mt-1">
              Crea un nuevo organizador para gestionar eventos
            </p>
          </div>
        </div>

        {/* Form */}
        <form
          onSubmit={handleSubmit}
          className="bg-slate-800/50 border border-slate-700 rounded-xl p-8 space-y-6"
        >
          <div>
            <label className="block text-sm font-semibold text-slate-300 mb-2">
              Nombre del Organizador *
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => handleNameChange(e.target.value)}
              className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-pink-500 transition-colors"
              placeholder="ej: Baby Club"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-300 mb-2">
              Slug (URL amigable) *
            </label>
            <input
              type="text"
              required
              value={formData.slug}
              onChange={(e) =>
                setFormData({ ...formData, slug: e.target.value })
              }
              className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-pink-500 transition-colors font-mono"
              placeholder="ej: babyclub"
            />
            <p className="text-xs text-slate-500 mt-1">
              Se usa en URLs: babyclub.com/<strong>{formData.slug || "organizador"}</strong>/evento
            </p>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-300 mb-2">
              Orden de Visualización
            </label>
            <input
              type="number"
              value={formData.sort_order}
              onChange={(e) =>
                setFormData({ ...formData, sort_order: parseInt(e.target.value) })
              }
              className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-pink-500 transition-colors"
              placeholder="100"
            />
            <p className="text-xs text-slate-500 mt-1">
              Menor número = aparece primero
            </p>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-6 py-3 bg-gradient-to-r from-pink-500 to-rose-600 hover:from-pink-600 hover:to-rose-700 disabled:from-slate-600 disabled:to-slate-700 text-white font-semibold rounded-lg transition-all duration-200 shadow-lg"
            >
              {loading ? "Creando..." : "Crear Organizador"}
            </button>
            <Link
              href="/admin/organizers"
              className="px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white font-semibold rounded-lg transition-colors text-center"
            >
              Cancelar
            </Link>
          </div>
        </form>

        {/* Info */}
        <div className="mt-6 bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
          <p className="text-sm text-blue-300">
            💡 <strong>Tip:</strong> Después de crear el organizador, podrás agregar su logo, 
            configurar mesas y diseñar el croquis del local.
          </p>
        </div>
      </div>

      <MessageModal
        message={message}
        type={messageType}
        onClose={() => setMessage(null)}
      />
    </div>
  );
}
