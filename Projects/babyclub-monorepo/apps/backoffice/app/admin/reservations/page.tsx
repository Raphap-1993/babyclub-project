import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import ReservationActions from "./components/ReservationActions";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

type ReservationRow = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  voucher_url: string | null;
  status: string;
  codes: string[] | null;
  table: {
    name: string;
    event: { name: string };
  } | null;
};

async function getReservations(): Promise<{ reservations: ReservationRow[]; error?: string }> {
  if (!supabaseUrl || !supabaseServiceKey) return { reservations: [], error: "Falta configuración de Supabase" };
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await supabase
    .from("table_reservations")
    .select("id,full_name,email,phone,voucher_url,status,codes,table:tables(name,event:events(name))")
    .order("created_at", { ascending: false });
  if (error || !data) return { reservations: [], error: error?.message || "No se pudieron cargar reservas" };
  return { reservations: data as ReservationRow[] };
}

export const dynamic = "force-dynamic";

export default async function ReservationsPage() {
  const { reservations, error } = await getReservations();

  return (
    <main className="min-h-screen bg-black px-6 py-10 text-white lg:px-10">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#f2f2f2]/60">Reservas</p>
          <h1 className="text-3xl font-semibold">Reservas de mesas</h1>
        </div>
        <div className="flex gap-3">
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

      <div className="overflow-hidden rounded-3xl border border-white/10 bg-[#0c0c0c] shadow-[0_20px_80px_rgba(0,0,0,0.45)]">
        <table className="min-w-full divide-y divide-white/10 text-sm">
          <thead className="bg-white/[0.02] text-xs uppercase tracking-[0.08em] text-white/60">
            <tr>
              <th className="px-4 py-3 text-left">Mesa</th>
              <th className="px-4 py-3 text-left">Evento</th>
              <th className="px-4 py-3 text-left">Contacto</th>
              <th className="px-4 py-3 text-left">Estado</th>
              <th className="px-4 py-3 text-left">Voucher</th>
              <th className="px-4 py-3 text-left">Códigos</th>
              <th className="px-4 py-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {reservations.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-white/60">
                  {error ? `Error: ${error}` : "No hay reservas aún."}
                </td>
              </tr>
            )}
            {reservations.map((res) => (
              <tr key={res.id} className="hover:bg-white/[0.02]">
                <td className="px-4 py-3 text-white font-semibold">{res.table?.name || "—"}</td>
                <td className="px-4 py-3 text-white/80">{res.table?.event?.name || "—"}</td>
                <td className="px-4 py-3 text-white/80">
                  <div className="font-semibold text-white">{res.full_name}</div>
                  {res.email && <div className="text-xs text-white/60">{res.email}</div>}
                  {res.phone && <div className="text-xs text-white/60">{res.phone}</div>}
                </td>
                <td className="px-4 py-3">
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
                <td className="px-4 py-3 text-white/80">
                  {res.voucher_url ? (
                    <a
                      href={res.voucher_url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[#e91e63] underline-offset-4 hover:underline"
                    >
                      Ver voucher
                    </a>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-4 py-3 text-white/80">
                  {res.codes && res.codes.length > 0 ? res.codes.join(", ") : "—"}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-2">
                    <Link
                      href={`/admin/reservations/${encodeURIComponent(res.id)}`}
                      className="inline-flex items-center justify-center rounded-full border border-white/15 px-3 py-1.5 text-xs font-semibold text-white transition hover:border-[#e91e63] hover:text-[#e91e63]"
                    >
                      Ver
                    </Link>
                    <ReservationActions id={res.id} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
