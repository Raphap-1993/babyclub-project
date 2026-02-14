import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { formatLimaFromDb } from "shared/limaTime";
import { applyNotDeleted } from "shared/db/softDelete";
import { Eye, Edit, ArrowLeft } from "lucide-react";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function getEvent(id: string) {
  if (!supabaseUrl || !supabaseServiceKey) return null;

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data, error } = await applyNotDeleted(
    supabase
      .from("events")
      .select("id,name,location,starts_at,entry_limit,capacity,is_active,header_image")
      .eq("id", id)
  ).single();

  if (error || !data) return null;

  // Get general code
  const { data: codes } = await applyNotDeleted(
    supabase
      .from("codes")
      .select("code")
      .eq("event_id", id)
      .eq("type", "general")
      .eq("is_active", true)
      .limit(1)
  );

  return { ...data, generalCode: codes?.[0]?.code ?? null };
}

export const dynamic = "force-dynamic";

type PageParams = Promise<{ id: string }>;

export default async function EventDetailPage({
  params,
}: {
  params: PageParams;
}) {
  const { id } = await params;
  const event = await getEvent(id);

  if (!event) {
    notFound();
  }

  return (
    <main className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Detalle</p>
          <h1 className="text-3xl font-bold text-white">{event.name}</h1>
        </div>
        <div className="flex gap-3">
          <Link
            href="/admin/events"
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-neutral-600 px-4 py-2 text-sm font-semibold text-neutral-200 transition hover:border-neutral-500 hover:bg-neutral-800"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver
          </Link>
          <Link
            href={`/admin/events/${event.id}/edit`}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-rose-500 to-rose-600 px-5 py-2 text-sm font-semibold text-white shadow-lg transition hover:shadow-xl hover:from-rose-400 hover:to-rose-500"
          >
            <Edit className="h-4 w-4" />
            Editar
          </Link>
        </div>
      </div>

      {/* Event Details Card */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main info */}
        <div className="lg:col-span-2">
          <div className="rounded-xl border border-neutral-700 bg-neutral-900 p-6 space-y-6">
            {/* Header Image */}
            {event.header_image && (
              <div className="relative h-48 w-full overflow-hidden rounded-lg">
                <img
                  src={event.header_image}
                  alt={event.name}
                  className="h-full w-full object-cover"
                />
              </div>
            )}

            {/* Basic Info */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-xs font-semibold uppercase text-neutral-400">Nombre</p>
                <p className="text-lg font-semibold text-white">{event.name}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase text-neutral-400">Estado</p>
                <div className="mt-1">
                  <span
                    className={`inline-block rounded-full px-3 py-1 text-sm font-semibold ${
                      event.is_active
                        ? "bg-rose-500/20 text-rose-400"
                        : "bg-neutral-700/50 text-neutral-400"
                    }`}
                  >
                    {event.is_active ? "Activo" : "Inactivo"}
                  </span>
                </div>
              </div>
            </div>

            {/* Location & Dates */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-xs font-semibold uppercase text-neutral-400">Ubicación</p>
                <p className="mt-1 text-neutral-200">{event.location || "No especificada"}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase text-neutral-400">Fecha de Inicio</p>
                <p className="mt-1 text-neutral-200">{formatLimaFromDb(event.starts_at ?? "")}</p>
              </div>
            </div>

            {/* Capacity & Entry Limit */}
            <div className="grid gap-4 sm:grid-cols-2 border-t border-neutral-700 pt-4">
              <div>
                <p className="text-xs font-semibold uppercase text-neutral-400">Capacidad</p>
                <p className="mt-1 text-lg font-semibold text-white">{event.capacity ?? "—"}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase text-neutral-400">Límite de Ingreso</p>
                <p className="mt-1 text-lg font-semibold text-white">{event.entry_limit ?? "—"}</p>
              </div>
            </div>

            {/* General Code */}
            {event.generalCode && (
              <div className="border-t border-neutral-700 pt-4">
                <p className="text-xs font-semibold uppercase text-neutral-400">Código General</p>
                <code className="mt-2 block rounded bg-neutral-800 px-3 py-2 font-mono text-sm text-neutral-200">
                  {event.generalCode}
                </code>
              </div>
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="space-y-4">
          <div className="rounded-xl border border-neutral-700 bg-neutral-900 p-6 space-y-3">
            <p className="text-xs font-semibold uppercase text-neutral-400">Acciones Rápidas</p>
            <Link
              href={`/admin/events/${event.id}/edit`}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-rose-500/20 px-4 py-2 text-sm font-semibold text-rose-400 transition hover:bg-rose-500/30"
            >
              <Edit className="h-4 w-4" />
              Editar Evento
            </Link>
            <Link
              href={`/admin/codes?event_id=${event.id}`}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-neutral-600 px-4 py-2 text-sm font-semibold text-neutral-200 transition hover:border-neutral-500 hover:bg-neutral-800"
            >
              Ver Códigos
            </Link>
            <Link
              href={`/admin/tickets?event_id=${event.id}`}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-neutral-600 px-4 py-2 text-sm font-semibold text-neutral-200 transition hover:border-neutral-500 hover:bg-neutral-800"
            >
              Ver Tickets
            </Link>
            <Link
              href={`/admin/events/${event.id}/tables`}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-amber-600/50 bg-amber-500/10 px-4 py-2 text-sm font-semibold text-amber-400 transition hover:border-amber-500 hover:bg-amber-500/20"
            >
              ⚙️ Configurar Mesas
            </Link>
          </div>

        </div>
      </div>
    </main>
  );
}
