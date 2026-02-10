export const dynamic = "force-dynamic";

import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import {
  CalendarClock,
  CalendarDays,
  CreditCard,
  QrCode,
  Sparkles,
  Ticket,
  TrendingUp,
  UserCheck,
  Users,
} from "lucide-react";
import { applyNotDeleted } from "shared/db/softDelete";
import { formatLimaFromDb } from "shared/limaTime";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

type DashboardMetrics = {
  inscriptions24h: number;
  ticketsOpen: number;
  attendance: string;
  activeEvents: number;
  pendingReservations: number;
  activePromoters: number;
  recentReservations: Array<{
    id: string;
    full_name: string;
    status: string;
    event_name: string;
    table_name: string;
    created_at: string;
  }>;
};

function resolveStatusVariant(status: string): "default" | "success" | "warning" | "danger" {
  const normalized = status.toLowerCase();
  if (normalized === "approved") return "success";
  if (normalized === "rejected") return "danger";
  return "warning";
}

async function getMetrics(): Promise<DashboardMetrics> {
  if (!supabaseUrl || !supabaseServiceKey) {
    return {
      inscriptions24h: 0,
      ticketsOpen: 0,
      attendance: "0%",
      activeEvents: 0,
      pendingReservations: 0,
      activePromoters: 0,
      recentReservations: [],
    };
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const now = new Date();
  const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

  const [inscRes, openRes, usedRes, totalRes, eventsRes, pendingRes, promotersRes, recentReservationsRes] =
    await Promise.all([
      applyNotDeleted(supabase.from("tickets").select("id", { head: true, count: "exact" }).gt("created_at", last24h)),
      applyNotDeleted(supabase.from("tickets").select("id", { head: true, count: "exact" }).eq("used", false)),
      applyNotDeleted(supabase.from("tickets").select("id", { head: true, count: "exact" }).eq("used", true)),
      applyNotDeleted(supabase.from("tickets").select("id", { head: true, count: "exact" })),
      applyNotDeleted(supabase.from("events").select("id", { head: true, count: "exact" }).eq("is_active", true)),
      applyNotDeleted(
        supabase
          .from("table_reservations")
          .select("id", { head: true, count: "exact" })
          .in("status", ["pending", "approved", "confirmed", "paid"])
      ),
      applyNotDeleted(supabase.from("promoters").select("id", { head: true, count: "exact" }).eq("is_active", true)),
      applyNotDeleted(
        supabase
          .from("table_reservations")
          .select("id,full_name,status,created_at,event_id,table:tables(name,event:events(name)),event:event_id(name)")
          .order("created_at", { ascending: false })
          .limit(5)
      ),
    ]);

  const usedCount = usedRes.count ?? 0;
  const totalCount = totalRes.count ?? 0;
  const attendance = totalCount > 0 ? `${Math.round((usedCount / totalCount) * 100)}%` : "0%";

  const recentReservations = ((recentReservationsRes.data as any[]) || []).map((res) => {
    const tableRel = Array.isArray(res.table) ? res.table[0] : res.table;
    const eventFromTable = Array.isArray(tableRel?.event) ? tableRel?.event[0] : tableRel?.event;
    const eventFallback = Array.isArray(res.event) ? res.event[0] : res.event;

    return {
      id: res.id,
      full_name: res.full_name ?? "—",
      status: res.status ?? "pending",
      created_at: res.created_at ?? "",
      table_name: tableRel?.name ?? "Entrada",
      event_name: eventFromTable?.name ?? eventFallback?.name ?? "—",
    };
  });

  return {
    inscriptions24h: inscRes.count ?? 0,
    ticketsOpen: openRes.count ?? 0,
    attendance,
    activeEvents: eventsRes.count ?? 0,
    pendingReservations: pendingRes.count ?? 0,
    activePromoters: promotersRes.count ?? 0,
    recentReservations,
  };
}

export default async function AdminDashboard() {
  const metrics = await getMetrics();

  const stats = [
    {
      title: "Registros 24h",
      value: String(metrics.inscriptions24h),
      icon: <TrendingUp className="h-4 w-4 text-white/65" />,
      tone: "text-white",
    },
    {
      title: "Tickets abiertos",
      value: String(metrics.ticketsOpen),
      icon: <Ticket className="h-4 w-4 text-white/65" />,
      tone: "text-white",
    },
    {
      title: "Asistencia",
      value: metrics.attendance,
      icon: <UserCheck className="h-4 w-4 text-[#ff9fb1]" />,
      tone: "text-[#ffd9e1]",
    },
    {
      title: "Eventos activos",
      value: String(metrics.activeEvents),
      icon: <CalendarDays className="h-4 w-4 text-white/65" />,
      tone: "text-white",
    },
    {
      title: "Reservas activas",
      value: String(metrics.pendingReservations),
      icon: <CalendarClock className="h-4 w-4 text-white/65" />,
      tone: "text-white",
    },
    {
      title: "Promotores activos",
      value: String(metrics.activePromoters),
      icon: <Users className="h-4 w-4 text-white/65" />,
      tone: "text-white",
    },
  ];

  const quickActions = [
    { label: "Crear evento", href: "/admin/events/create", icon: CalendarDays },
    { label: "Crear reserva", href: "/admin/reservations", icon: CreditCard },
    { label: "Escanear QR", href: "/admin/scan", icon: QrCode },
    { label: "Tickets", href: "/admin/tickets", icon: Ticket },
  ];

  return (
    <main className="relative overflow-hidden px-3 py-4 text-white sm:px-5 lg:px-8">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_14%_15%,rgba(166,12,47,0.09),transparent_32%),radial-gradient(circle_at_84%_0%,rgba(255,255,255,0.04),transparent_30%),radial-gradient(circle_at_50%_106%,rgba(255,255,255,0.04),transparent_42%)]" />

      <div className="mx-auto w-full max-w-7xl space-y-3">
        <Card className="border-[#2b2b2b] bg-[#111111]">
          <CardHeader className="gap-2 py-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <CardDescription className="text-[11px] uppercase tracking-[0.16em] text-white/55">
                  Overview / BabyClub
                </CardDescription>
                <CardTitle className="mt-1 text-2xl">Operations Dashboard</CardTitle>
                <p className="mt-1 text-xs text-white/60">Visión central de operación, venta y validación de tickets en tiempo real.</p>
              </div>
              <div className="flex items-center gap-2">
                <Link href="/admin/events/create" className={cn(buttonVariants({ size: "sm" }))}>
                  <Sparkles className="h-4 w-4" />
                  Nuevo evento
                </Link>
                <Link href="/admin/reservations" className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}>
                  Ver reservas
                </Link>
              </div>
            </div>
          </CardHeader>
        </Card>

        <section className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
          {stats.map((item) => (
            <Card key={item.title}>
              <CardContent className="flex items-center justify-between p-3">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.12em] text-white/55">{item.title}</p>
                  <p className={cn("mt-0.5 text-xl font-semibold", item.tone)}>{item.value}</p>
                </div>
                {item.icon}
              </CardContent>
            </Card>
          ))}
        </section>

        <section className="grid gap-3 xl:grid-cols-[1.4fr_1fr]">
          <Card className="overflow-hidden border-[#2b2b2b]">
            <CardHeader className="pb-2 pt-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-base">Últimas reservas</CardTitle>
                </div>
                <Link href="/admin/reservations" className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}>
                  Ver todo
                </Link>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[28%]">Cliente</TableHead>
                    <TableHead className="w-[22%]">Evento</TableHead>
                    <TableHead className="w-[18%]">Mesa</TableHead>
                    <TableHead className="w-[14%]">Estado</TableHead>
                    <TableHead className="w-[18%]">Hora</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {metrics.recentReservations.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="py-10 text-center text-white/55">
                        Sin reservas recientes.
                      </TableCell>
                    </TableRow>
                  )}
                  {metrics.recentReservations.map((reservation) => (
                    <TableRow key={reservation.id}>
                      <TableCell className="py-2.5 font-semibold text-white">{reservation.full_name}</TableCell>
                      <TableCell className="py-2.5 text-white/80">{reservation.event_name}</TableCell>
                      <TableCell className="py-2.5 text-white/75">{reservation.table_name}</TableCell>
                      <TableCell className="py-2.5">
                        <Badge variant={resolveStatusVariant(reservation.status)}>{reservation.status}</Badge>
                      </TableCell>
                      <TableCell className="py-2.5 text-white/70">{safeFormat(reservation.created_at)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card className="border-[#2b2b2b]">
            <CardHeader className="pb-2 pt-3">
              <CardTitle className="text-base">Accesos rápidos</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5">
              {quickActions.map((action) => (
                <Link
                  key={action.label}
                  href={action.href}
                  className="flex items-center justify-between rounded-xl border border-[#252525] bg-[#141414] px-3 py-2 text-sm text-white/88 transition-all duration-200 ease-out hover:-translate-y-[1px] hover:translate-x-[2px] hover:border-[#a60c2f]/35 hover:bg-[#a60c2f]/10 hover:text-[#ffe9ee]"
                >
                  <span className="inline-flex items-center gap-2">
                    <action.icon className="h-4 w-4 text-white/70" />
                    {action.label}
                  </span>
                  <span className="text-white/45">→</span>
                </Link>
              ))}
            </CardContent>
          </Card>
        </section>
      </div>
    </main>
  );
}

function safeFormat(value?: string | null) {
  if (!value) return "—";
  try {
    return formatLimaFromDb(value);
  } catch (_err) {
    return "—";
  }
}
