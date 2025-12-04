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

  const normalized: ReservationRow[] = (data as any[]).map((res) => {
    const tableRel = Array.isArray(res.table) ? res.table[0] : res.table;
    const eventRel = tableRel?.event ? (Array.isArray(tableRel.event) ? tableRel.event[0] : tableRel.event) : null;
    return {
      id: res.id,
      full_name: res.full_name ?? "",
      email: res.email ?? null,
      phone: res.phone ?? null,
      voucher_url: res.voucher_url ?? null,
      status: res.status ?? "",
      codes: res.codes ?? null,
      table: tableRel
        ? {
            name: tableRel.name ?? "",
            event: { name: eventRel?.name ?? "—" },
          }
        : null,
    };
  });

  return { reservations: normalized };
}

export const dynamic = "force-dynamic";

export default async function ReservationsPage() {
  const { reservations, error } = await getReservations();

  return (
    <main className="min-h-screen bg-black px-4 py-8 text-white sm:px-6 lg:px-10">
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

      <div className="hidden overflow-x-auto rounded-3xl border border-white/10 bg-[#0c0c0c] shadow-[0_20px_80px_rgba(0,0,0,0.45)] lg:block">
        <table className="min-w-full table-fixed divide-y divide-white/10 text-sm">
          <thead className="bg-white/[0.02] text-xs uppercase tracking-[0.08em] text-white/60">
            <tr>
              <th className="w-[16%] px-4 py-3 text-left">Mesa</th>
              <th className="w-[16%] px-4 py-3 text-left">Evento</th>
              <th className="w-[24%] px-4 py-3 text-left">Contacto</th>
              <th className="w-[10%] px-4 py-3 text-left">Estado</th>
              <th className="w-[14%] px-4 py-3 text-left">Voucher</th>
              <th className="w-[12%] px-4 py-3 text-left">Códigos</th>
              <th className="w-[8%] px-4 py-3 text-right">Acciones</th>
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
                  {res.email && <div className="break-words text-xs text-white/60">{res.email}</div>}
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
                <td className="px-4 py-3 text-white/80 break-words">
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
                <p className="text-base font-semibold text-white">{res.table?.name || "—"}</p>
                <p className="text-xs uppercase tracking-[0.15em] text-white/50">{res.table?.event?.name || "—"}</p>
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
              <Info label="Voucher" value={res.voucher_url ? "Disponible" : "—"} />
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
              {res.voucher_url && (
                <a
                  href={res.voucher_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center text-sm font-semibold text-[#e91e63] underline-offset-4 hover:underline"
                >
                  Ver voucher
                </a>
              )}
            </div>

            <div className="mt-4 flex flex-col gap-2">
              <Link
                href={`/admin/reservations/${encodeURIComponent(res.id)}`}
                className="inline-flex items-center justify-center rounded-full border border-white/15 px-4 py-2 text-sm font-semibold text-white transition hover:border-white/40"
              >
                Ver detalle
              </Link>
              <ReservationActions id={res.id} />
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
