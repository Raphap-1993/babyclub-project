import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import EventActions from "./components/EventActions";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

type EventRow = {
  id: string;
  name: string;
  location: string | null;
  starts_at: string | null;
  capacity: number | null;
  is_active: boolean | null;
  header_image: string | null;
  code?: string | null;
};

async function getEvents(): Promise<EventRow[] | null> {
  if (!supabaseUrl || !supabaseServiceKey) return null;

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data, error } = await supabase
    .from("events")
    .select("id,name,location,starts_at,capacity,is_active,header_image")
    .order("starts_at", { ascending: true })
    .limit(500);

  if (error || !data) return null;
  if (data.length === 0) return [];

  const ids = data.map((e) => e.id);
  const { data: codes } = await supabase.from("codes").select("event_id,code").in("event_id", ids);
  const codeMap = new Map<string, string>();
  (codes || []).forEach((c: any) => codeMap.set(c.event_id, c.code));

  return (data as EventRow[]).map((e) => ({ ...e, code: codeMap.get(e.id) ?? null }));
}

export const dynamic = "force-dynamic";

export default async function EventsPage() {
  const events = await getEvents();
  if (!events) return notFound();

  return (
    <main className="min-h-screen bg-black px-6 py-10 text-white lg:px-10">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#f2f2f2]/60">Eventos</p>
          <h1 className="text-3xl font-semibold">Listado de eventos</h1>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/admin"
            className="inline-flex items-center justify-center rounded-full border border-white/15 px-4 py-2 text-sm font-semibold text-white transition hover:border-white"
          >
            ← Volver
          </Link>
          <Link
            href="/admin/events/create"
            className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-[#e91e63] to-[#ff77b6] px-5 py-2 text-sm font-semibold text-white shadow-[0_12px_35px_rgba(233,30,99,0.35)] transition hover:shadow-[0_14px_38px_rgba(233,30,99,0.45)]"
          >
            Crear evento
          </Link>
        </div>
      </div>

      <div className="overflow-hidden rounded-3xl border border-white/10 bg-[#0c0c0c] shadow-[0_20px_80px_rgba(0,0,0,0.45)]">
        <table className="min-w-full divide-y divide-white/10 text-sm">
          <thead className="bg-white/[0.02] text-xs uppercase tracking-[0.08em] text-white/60">
            <tr>
              <th className="px-4 py-3 text-left">Nombre</th>
              <th className="px-4 py-3 text-left">Ubicación</th>
              <th className="px-4 py-3 text-left">Fecha</th>
              <th className="px-4 py-3 text-left">Capacidad</th>
              <th className="px-4 py-3 text-left">Código</th>
              <th className="px-4 py-3 text-left">Estado</th>
              <th className="px-4 py-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {events.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-white/60">
                  No hay eventos aún. Crea el primero.
                </td>
              </tr>
            )}
            {events.map((event) => (
              <tr key={event.id} className="hover:bg-white/[0.02]">
                <td className="px-4 py-3">
                  <div className="font-semibold text-white">{event.name}</div>
                  {event.header_image && (
                    <div className="text-xs text-white/50 truncate max-w-[260px]">{event.header_image}</div>
                  )}
                </td>
                <td className="px-4 py-3 text-white/80">{event.location || "—"}</td>
                <td className="px-4 py-3 text-white/80">
                  {event.starts_at
                    ? new Date(event.starts_at).toLocaleString("es-PE", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                        hour12: false,
                      })
                    : "—"}
                </td>
                <td className="px-4 py-3 text-white/80">{event.capacity ?? "—"}</td>
                <td className="px-4 py-3 text-white/80">{event.code ?? "—"}</td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-3 py-1 text-[12px] font-semibold ${
                      event.is_active
                        ? "bg-[#e91e63]/15 text-[#e91e63]"
                        : "bg-white/5 text-white/70"
                    }`}
                  >
                    {event.is_active ? "Activo" : "Inactivo"}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <EventActions id={event.id} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
