import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import ReservationActions from "./components/ReservationActions";
import CreateReservationButton from "./components/CreateReservationButton";
import { applyNotDeleted } from "shared/db/softDelete";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

type ReservationRow = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  status: string;
  codes: string[] | null;
  ticket_quantity: number | null;
  table_name: string;
  event_name: string;
};

async function getReservations(): Promise<{ reservations: ReservationRow[]; error?: string }> {
  if (!supabaseUrl || !supabaseServiceKey) return { reservations: [], error: "Falta configuración de Supabase" };
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await applyNotDeleted(
    supabase
      .from("table_reservations")
      .select("id,full_name,email,phone,status,codes,ticket_quantity,table:tables(name,event:events(name)),event:event_id(name)")
      .order("created_at", { ascending: false })
  );
  if (error || !data) return { reservations: [], error: error?.message || "No se pudieron cargar reservas" };

  const normalized: ReservationRow[] = (data as any[]).map((res) => {
    const tableRel = Array.isArray(res.table) ? res.table[0] : res.table;
    const eventRel = tableRel?.event ? (Array.isArray(tableRel.event) ? tableRel.event[0] : tableRel.event) : null;
    const eventFallback = Array.isArray(res.event) ? res.event[0] : res.event;
    return {
      id: res.id,
      full_name: res.full_name ?? "",
      email: res.email ?? null,
      phone: res.phone ?? null,
      status: res.status ?? "",
      codes: res.codes ?? null,
      ticket_quantity: typeof res.ticket_quantity === "number" ? res.ticket_quantity : null,
      table_name: tableRel?.name ?? "Entrada",
      event_name: eventRel?.name ?? eventFallback?.name ?? "—",
    };
  });

  return { reservations: normalized };
}

export const dynamic = "force-dynamic";

export default async function ReservationsPage() {
  const { reservations, error } = await getReservations();

  return (
    <main className="min-h-screen bg-black px-4 py-8 text-white sm:px-6 lg:px-10">
      <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#f2f2f2]/60">Reservas</p>
          <h1 className="text-3xl font-semibold">Reservas</h1>
          <p className="mt-2 text-xs text-white/60">Al guardar se notificará por email al cliente si hay correo y estado aprobado.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <CreateReservationButton />
          <Link
            href="/admin"
            className="inline-flex items-center justify-center rounded-full border border-white/15 px-4 py-2 text-sm font-semibold text-white transition hover:border-white"
          >
            ← Volver
          </Link>
          <Link
            href="/admin/reservations"
            className="inline-flex items-center justify-center rounded-full border border-white/15 px-4 py-2 text-sm font-semibold text-white transition hover:border-white"
          >
            Refrescar
          </Link>
        </div>
      </div>

      <div className="hidden overflow-x-auto rounded-3xl border border-white/10 bg-[#0c0c0c] shadow-[0_20px_80px_rgba(0,0,0,0.45)] lg:block">
        <table className="min-w-full table-fixed divide-y divide-white/10 text-sm">
          <thead className="bg-white/[0.02] text-xs uppercase tracking-[0.08em] text-white/60">
            <tr>
              <th className="w-[14%] px-3 py-3 text-left">Mesa</th>
              <th className="w-[18%] px-3 py-3 text-left">Evento</th>
              <th className="w-[30%] px-3 py-3 text-left">Contacto</th>
              <th className="w-[8%] px-3 py-3 text-left">Entradas</th>
              <th className="w-[12%] px-3 py-3 text-left">Estado</th>
              <th className="w-[18%] px-3 py-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {reservations.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-white/60">
                  {error ? `Error: ${error}` : "No hay reservas aún."}
                </td>
              </tr>
            )}
            {reservations.map((res) => (
              <tr key={res.id} className="hover:bg-white/[0.02]">
                <td className="px-3 py-3 font-semibold text-white">{res.table_name || "—"}</td>
                <td className="px-3 py-3 text-white/80">{res.event_name || "—"}</td>
                <td className="min-w-0 px-3 py-3 text-white/80">
                  <div className="break-words font-semibold text-white">{res.full_name}</div>
                  {res.email && <div className="break-words text-xs text-white/60">{res.email}</div>}
                  {res.phone && <div className="text-xs text-white/60">{res.phone}</div>}
                </td>
                <td className="px-3 py-3 text-white/80">{res.ticket_quantity ?? 1}</td>
                <td className="px-3 py-3">
                  <span
                    className={`rounded-full px-3 py-1 text-[12px] font-semibold ${
                      res.status === "approved"
                        ? "bg-emerald-500/20 text-emerald-300"
                        : res.status === "rejected"
                          ? "bg-[#ff5f5f]/20 text-[#ff9a9a]"
                          : "bg-white/5 text-white/70"
                    }`}
                  >
                    {res.status}
                  </span>
                </td>
                <td className="px-3 py-3 text-right">
                  <div className="flex flex-wrap justify-end gap-2">
                    <Link
                      href={`/admin/reservations/${encodeURIComponent(res.id)}`}
                      className="inline-flex items-center justify-center rounded-full border border-white/15 px-3 py-1.5 text-xs font-semibold text-white transition hover:border-[#e91e63] hover:text-[#e91e63]"
                    >
                      Ver
                    </Link>
                    <ReservationActions id={res.id} status={res.status} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mb-4 lg:hidden">
        <CreateReservationButton />
      </div>

      <div className="space-y-3 lg:hidden">
        {reservations.length === 0 && (
          <div className="rounded-2xl border border-white/10 bg-[#0c0c0c] p-4 text-center text-white/70">
            {error ? `Error: ${error}` : "No hay reservas aún."}
          </div>
        )}
        {reservations.map((res) => (
          <div
            key={res.id}
            className="rounded-2xl border border-white/10 bg-[#0c0c0c] p-4 shadow-[0_12px_40px_rgba(0,0,0,0.45)]"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <p className="text-base font-semibold text-white">{res.table_name || "—"}</p>
                <p className="text-xs uppercase tracking-[0.15em] text-white/50">{res.event_name || "—"}</p>
                <p className="text-sm text-white/80">{res.full_name}</p>
              </div>
              <span
                className={`rounded-full px-3 py-1 text-[12px] font-semibold ${
                  res.status === "approved"
                    ? "bg-emerald-500/20 text-emerald-300"
                    : res.status === "rejected"
                      ? "bg-[#ff5f5f]/20 text-[#ff9a9a]"
                      : "bg-white/5 text-white/70"
                }`}
              >
                {res.status}
              </span>
            </div>

            <div className="mt-3 space-y-3 text-sm text-white/80">
              <Info
                label="Contacto"
                value={[res.email, res.phone].filter(Boolean).join(" · ") || "—"}
              />
              <Info label="Entradas" value={`${res.ticket_quantity ?? 1}`} />
              <div>
                <p className="text-[11px] uppercase tracking-[0.12em] text-white/50">Códigos</p>
                {res.codes && res.codes.length > 0 ? (
                  <div className="mt-1 flex flex-wrap gap-2">
                    {res.codes.map((code) => (
                      <span
                        key={code}
                        className="rounded-full border border-white/10 bg-[#111111] px-3 py-1 text-xs font-semibold text-white"
                      >
                        {code}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm font-semibold text-white">—</p>
                )}
              </div>
            </div>

            <div className="mt-4 flex flex-col gap-2">
              <Link
                href={`/admin/reservations/${encodeURIComponent(res.id)}`}
                className="inline-flex items-center justify-center rounded-full border border-white/15 px-4 py-2 text-sm font-semibold text-white transition hover:border-white/40"
              >
                Ver detalle
              </Link>
              <ReservationActions id={res.id} status={res.status} />
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <p className="text-[11px] uppercase tracking-[0.12em] text-white/50">{label}</p>
      <p className="font-semibold text-white">{value}</p>
    </div>
  );
}
