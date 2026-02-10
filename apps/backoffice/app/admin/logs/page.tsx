import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import { Clock3 } from "lucide-react";
import { formatLimaFromDb } from "shared/limaTime";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

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
    .select("id,category,action,status,message,to_email,provider,provider_id,reservation_id,ticket_id,created_at")
    .order("created_at", { ascending: false })
    .limit(200);

  if (error || !data) return { logs: [], error: error?.message || "No se pudieron cargar logs" };
  return { logs: data as LogRow[] };
}

export const dynamic = "force-dynamic";

export default async function LogsPage() {
  const { logs, error } = await getLogs();

  return (
    <main className="relative overflow-hidden px-3 py-4 text-white sm:px-5 lg:px-8">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_17%_20%,rgba(166,12,47,0.11),transparent_35%),radial-gradient(circle_at_84%_0%,rgba(255,255,255,0.10),transparent_28%),radial-gradient(circle_at_50%_108%,rgba(255,255,255,0.06),transparent_45%)]" />

      <div className="mx-auto w-full max-w-7xl space-y-3">
        <Card className="border-[#2b2b2b] bg-[#111111]">
          <CardHeader className="gap-2 py-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <CardDescription className="text-[11px] uppercase tracking-[0.16em] text-white/55">Reportes / Logs</CardDescription>
                <CardTitle className="mt-1 text-2xl">System Logs</CardTitle>
                <p className="mt-1 text-xs text-white/60">Trazabilidad de procesos críticos: email, tickets, reservas y tareas internas.</p>
              </div>
              <div className="flex items-center gap-2">
                <Link href="/admin" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
                  Volver
                </Link>
                <Link href="/admin/logs" className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}>
                  Refrescar
                </Link>
              </div>
            </div>
          </CardHeader>
        </Card>

        <Card className="overflow-hidden border-[#2b2b2b]">
          <CardHeader className="border-b border-[#252525] pb-2 pt-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <CardTitle className="text-base">Últimos 200 logs</CardTitle>
                <CardDescription className="mt-1 text-xs text-white/55">Vista compacta para diagnóstico operativo.</CardDescription>
              </div>
              <Badge>
                <Clock3 className="mr-1 h-3.5 w-3.5" />
                Ordenado por fecha
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table containerClassName="max-h-[60dvh] min-h-[300px]">
              <TableHeader className="[&_th]:sticky [&_th]:top-0 [&_th]:z-[1] [&_th]:bg-[#111111]">
                <TableRow>
                  <TableHead className="w-[13%]">Fecha</TableHead>
                  <TableHead className="w-[12%]">Tipo</TableHead>
                  <TableHead className="w-[14%]">Acción</TableHead>
                  <TableHead className="w-[10%]">Estado</TableHead>
                  <TableHead className="w-[16%]">Correo</TableHead>
                  <TableHead className="w-[15%]">Referencia</TableHead>
                  <TableHead className="w-[20%]">Detalle</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="py-10 text-center text-white/55">
                      {error ? `Error: ${error}` : "No hay logs aún."}
                    </TableCell>
                  </TableRow>
                )}
                {logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="py-2.5 text-white/70">{safeFormat(log.created_at)}</TableCell>
                    <TableCell className="py-2.5 font-semibold text-white">{log.category}</TableCell>
                    <TableCell className="py-2.5 text-white/80">{log.action}</TableCell>
                    <TableCell className="py-2.5">
                      <Badge variant={log.status === "success" ? "success" : "danger"}>{log.status}</Badge>
                    </TableCell>
                    <TableCell className="py-2.5 text-white/75">{log.to_email || "—"}</TableCell>
                    <TableCell className="py-2.5 text-white/80">
                      <div className="space-y-1">
                        {log.reservation_id && (
                          <Link
                            href={`/admin/reservations/${encodeURIComponent(log.reservation_id)}`}
                            className="text-xs font-semibold text-red-300 underline-offset-2 hover:underline"
                          >
                            Reserva {shortId(log.reservation_id)}
                          </Link>
                        )}
                        {log.ticket_id && (
                          <Link
                            href={`/admin/tickets/${encodeURIComponent(log.ticket_id)}`}
                            className="text-xs font-semibold text-red-300 underline-offset-2 hover:underline"
                          >
                            Ticket {shortId(log.ticket_id)}
                          </Link>
                        )}
                        {!log.reservation_id && !log.ticket_id && <span className="text-xs text-white/50">—</span>}
                      </div>
                    </TableCell>
                    <TableCell className="py-2.5 text-white/70">
                      <div className="space-y-1">
                        {log.message && <div className="text-xs">{log.message}</div>}
                        {log.provider_id && (
                          <div className="text-[11px] text-white/50">
                            {log.provider || "Proveedor"}: {log.provider_id}
                          </div>
                        )}
                        {!log.message && !log.provider_id && <span className="text-xs text-white/45">—</span>}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
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
