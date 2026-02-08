import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import { formatLimaFromDb } from "shared/limaTime";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

type LogRow = {
  id: string;
  category: string;
  action: string;
  status: string;
  message: string | null;
  to_email: string | null;
  provider: string | null;
  provider_id: string | null;
  reservation_id: string | null;
  ticket_id: string | null;
  created_at: string;
};

async function getLogs(): Promise<{ logs: LogRow[]; error?: string }> {
  if (!supabaseUrl || !supabaseServiceKey) return { logs: [], error: "Falta configuración de Supabase" };
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await supabase
    .from("process_logs")
    .select(
      "id,category,action,status,message,to_email,provider,provider_id,reservation_id,ticket_id,created_at"
    )
    .order("created_at", { ascending: false })
    .limit(200);
  if (error || !data) return { logs: [], error: error?.message || "No se pudieron cargar logs" };
  return { logs: data as LogRow[] };
}

export const dynamic = "force-dynamic";

export default async function LogsPage() {
  const { logs, error } = await getLogs();

  return (
    <main className="min-h-screen bg-black px-4 py-8 text-white sm:px-6 lg:px-10">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#f2f2f2]/60">Logs</p>
          <h1 className="text-3xl font-semibold">Logs del sistema</h1>
          <p className="text-sm text-white/60">Eventos recientes de procesos (emails, tareas, etc.).</p>
        </div>
        <Link
          href="/admin"
          className="inline-flex items-center justify-center rounded-full border border-white/15 px-4 py-2 text-sm font-semibold text-white transition hover:border-white"
        >
          ← Volver
        </Link>
      </div>

      <div className="overflow-x-auto rounded-3xl border border-white/10 bg-[#0c0c0c] shadow-[0_20px_80px_rgba(0,0,0,0.45)]">
        <table className="min-w-full table-fixed divide-y divide-white/10 text-sm">
          <thead className="bg-white/[0.02] text-xs uppercase tracking-[0.08em] text-white/60">
            <tr>
              <th className="w-[12%] px-4 py-3 text-left">Fecha</th>
              <th className="w-[12%] px-4 py-3 text-left">Tipo</th>
              <th className="w-[16%] px-4 py-3 text-left">Acción</th>
              <th className="w-[10%] px-4 py-3 text-left">Estado</th>
              <th className="w-[18%] px-4 py-3 text-left">Correo</th>
              <th className="w-[16%] px-4 py-3 text-left">Referencia</th>
              <th className="w-[16%] px-4 py-3 text-left">Detalle</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {logs.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-white/60">
                  {error ? `Error: ${error}` : "No hay logs aún."}
                </td>
              </tr>
            )}
            {logs.map((log) => (
              <tr key={log.id} className="hover:bg-white/[0.02]">
                <td className="px-4 py-3 text-white/80">{safeFormat(log.created_at)}</td>
                <td className="px-4 py-3 text-white font-semibold">{log.category}</td>
                <td className="px-4 py-3 text-white/80">{log.action}</td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-3 py-1 text-[12px] font-semibold ${
                      log.status === "success"
                        ? "bg-emerald-500/20 text-emerald-300"
                        : "bg-[#ff5f5f]/20 text-[#ff9a9a]"
                    }`}
                  >
                    {log.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-white/80">{log.to_email || "—"}</td>
                <td className="px-4 py-3 text-white/80">
                  <div className="space-y-1">
                    {log.reservation_id && (
                      <Link
                        href={`/admin/reservations/${encodeURIComponent(log.reservation_id)}`}
                        className="text-xs font-semibold text-[#e91e63] underline-offset-4 hover:underline"
                      >
                        Reserva {shortId(log.reservation_id)}
                      </Link>
                    )}
                    {log.ticket_id && (
                      <Link
                        href={`/admin/tickets/${encodeURIComponent(log.ticket_id)}`}
                        className="text-xs font-semibold text-[#e91e63] underline-offset-4 hover:underline"
                      >
                        Ticket {shortId(log.ticket_id)}
                      </Link>
                    )}
                    {!log.reservation_id && !log.ticket_id && <span className="text-xs text-white/60">—</span>}
                  </div>
                </td>
                <td className="px-4 py-3 text-white/70">
                  <div className="space-y-1">
                    {log.message && <div className="text-xs">{log.message}</div>}
                    {log.provider_id && (
                      <div className="text-[11px] text-white/50">
                        {log.provider || "Proveedor"}: {log.provider_id}
                      </div>
                    )}
                    {!log.message && !log.provider_id && <span className="text-xs text-white/50">—</span>}
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

function shortId(value: string) {
  if (!value) return "—";
  return value.slice(0, 8);
}

function safeFormat(value?: string | null) {
  if (!value) return "—";
  try {
    return formatLimaFromDb(value);
  } catch (_err) {
    return "—";
  }
}
