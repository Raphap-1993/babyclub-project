import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import { applyNotDeleted } from "shared/db/softDelete";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

type OrganizerRow = {
  id: string;
  slug: string;
  name: string;
  is_active: boolean;
  sort_order: number;
  events_count?: number;
  tables_count?: number;
  created_at?: string;
};

async function getOrganizers(): Promise<{ organizers: OrganizerRow[]; error?: string }> {
  if (!supabaseUrl || !supabaseServiceKey) 
    return { organizers: [], error: "Falta configuración de Supabase" };
  
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data, error } = await applyNotDeleted(
    supabase
      .from("organizers")
      .select("id, slug, name, is_active, sort_order, created_at")
      .order("sort_order", { ascending: true })
  );

  if (error || !data) {
    return { organizers: [], error: error?.message || "No se pudieron cargar organizadores" };
  }

  const organizersWithStats = await Promise.all(
    data.map(async (org: OrganizerRow) => {
      const { count: eventsCount } = await applyNotDeleted(
        supabase.from("events").select("*", { count: "exact", head: true }).eq("organizer_id", org.id)
      );
      
      const { count: tablesCount } = await applyNotDeleted(
        supabase.from("tables").select("*", { count: "exact", head: true }).eq("organizer_id", org.id)
      );

      return {
        ...org,
        events_count: eventsCount || 0,
        tables_count: tablesCount || 0,
      };
    })
  );

  return { organizers: organizersWithStats };
}

export default async function OrganizersPage() {
  const { organizers, error } = await getOrganizers();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">
            🏢 Organizadores
          </h1>
          <p className="text-slate-400">
            Cada organizador tiene su propia configuración de mesas y croquis
          </p>
        </div>
        <Link
          href="/admin/organizers/create"
          className="px-6 py-3 bg-gradient-to-r from-pink-500 to-rose-600 hover:from-pink-600 hover:to-rose-700 text-white font-semibold rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl"
        >
          + Nuevo Organizador
        </Link>
      </div>

      {error && (
        <div className="mb-6 bg-red-500/10 border border-red-500/50 text-red-400 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {organizers.map((org) => (
          <div
            key={org.id}
            className="bg-slate-800/50 border border-slate-700 rounded-xl p-6 hover:border-blue-500/50 transition-all duration-200"
          >
            <div className="flex items-start gap-4 mb-4">
              <div className="w-16 h-16 rounded-lg bg-gradient-to-br from-pink-500 to-rose-600 flex items-center justify-center text-2xl">
                🏢
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-bold text-white">{org.name}</h3>
                <p className="text-sm text-slate-400">{org.slug}</p>
              </div>
            </div>

            <div className="flex gap-3 mb-4">
              <div className="flex-1 bg-slate-900/50 rounded-lg px-3 py-2">
                <div className="text-xs text-slate-400">Eventos</div>
                <div className="text-lg font-bold text-white">{org.events_count || 0}</div>
              </div>
              <div className="flex-1 bg-slate-900/50 rounded-lg px-3 py-2">
                <div className="text-xs text-slate-400">Mesas</div>
                <div className="text-lg font-bold text-white">{org.tables_count || 0}</div>
              </div>
            </div>

            <div className="space-y-2">
              <Link
                href={`/admin/organizers/${org.id}/tables`}
                className="block w-full bg-gradient-to-r from-cyan-500 to-teal-600 hover:from-cyan-600 hover:to-teal-700 text-white text-center px-4 py-2 rounded-lg transition-all duration-200 font-semibold"
              >
                🪑 Gestionar Mesas
              </Link>
              <Link
                href={`/admin/organizers/${org.id}/layout`}
                className="block w-full bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 text-white text-center px-4 py-2 rounded-lg transition-all duration-200 font-semibold"
              >
                📐 Diseñar Croquis
              </Link>
              <Link
                href={`/admin/organizers/${org.id}`}
                className="block w-full bg-gradient-to-r from-slate-600 to-slate-700 hover:from-slate-500 hover:to-slate-600 text-white text-center px-4 py-2 rounded-lg transition-all duration-200 font-semibold"
              >
                ✏️ Editar Organizador
              </Link>
            </div>
          </div>
        ))}
      </div>

      {organizers.length === 0 && !error && (
        <div className="text-center py-12 text-slate-400">
          No hay organizadores configurados
        </div>
      )}
    </div>
  );
}
