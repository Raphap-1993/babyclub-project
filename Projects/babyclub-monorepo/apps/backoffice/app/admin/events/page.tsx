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
    <main className="min-h-screen bg-black px-4 py-8 text-white sm:px-6 lg:px-10">
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

      <div className="hidden overflow-x-auto rounded-3xl border border-white/10 bg-[#0c0c0c] shadow-[0_20px_80px_rgba(0,0,0,0.45)] lg:block">
        <table className="min-w-full table-fixed divide-y divide-white/10 text-sm">
          <thead className="bg-white/[0.02] text-xs uppercase tracking-[0.08em] text-white/60">
            <tr>
              <th className="w-[26%] px-4 py-3 text-left">Nombre</th>
              <th className="w-[18%] px-4 py-3 text-left">Ubicación</th>
              <th className="w-[18%] px-4 py-3 text-left">Fecha</th>
              <th className="w-[10%] px-4 py-3 text-left">Capacidad</th>
              <th className="w-[12%] px-4 py-3 text-left">Código</th>
              <th className="w-[10%] px-4 py-3 text-left">Estado</th>
              <th className="w-[6%] px-4 py-3 text-right">Acciones</th>
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
                    <div className="break-all text-xs text-white/50">{event.header_image}</div>
                  )}
                </td>
                <td className="px-4 py-3 text-white/80">{event.location || "—"}</td>
                <td className="px-4 py-3 text-white/80">
                  {formatDate(event.starts_at)}
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

      <div className="space-y-3 lg:hidden">
        {events.length === 0 && (
          <div className="rounded-2xl border border-white/10 bg-[#0c0c0c] p-4 text-center text-white/70">
            No hay eventos aún. Crea el primero.
          </div>
        )}
        {events.map((event) => (
          <div
            key={event.id}
            className="rounded-2xl border border-white/10 bg-[#0c0c0c] p-4 shadow-[0_12px_40px_rgba(0,0,0,0.45)]"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <p className="text-sm font-semibold text-white">{event.name}</p>
                {event.header_image && <p className="break-all text-xs text-white/50">{event.header_image}</p>}
                <p className="text-xs uppercase tracking-[0.15em] text-white/50">{event.code || "Sin código"}</p>
              </div>
              <span
                className={`rounded-full px-3 py-1 text-[12px] font-semibold ${
                  event.is_active ? "bg-[#e91e63]/15 text-[#e91e63]" : "bg-white/5 text-white/70"
                }`}
              >
                {event.is_active ? "Activo" : "Inactivo"}
              </span>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-3 text-sm text-white/80">
              <Info label="Ubicación" value={event.location || "—"} />
              <Info label="Fecha" value={formatDate(event.starts_at)} />
              <Info label="Capacidad" value={event.capacity?.toString() || "—"} />
              <Info label="Código" value={event.code || "—"} />
            </div>

            <div className="mt-4 flex flex-col gap-2">
              <EventActions id={event.id} />
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}

function formatDate(dateString: string | null) {
  if (!dateString) return "—";
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("es-PE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <p className="text-[11px] uppercase tracking-[0.12em] text-white/50">{label}</p>
      <p className="font-semibold text-white">{value}</p>
    </div>
  );
}
