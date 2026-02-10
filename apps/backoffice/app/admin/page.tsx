export const dynamic = "force-dynamic";

import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import {
  MetricCard,
  ChartCard,
  SimpleBarChart,
  SimplePieChart,
} from "@/components/dashboard";
import TicketsSummaryCard from "@/components/dashboard/TicketsSummaryCard";
import PromotersSummaryCard from "@/components/dashboard/PromotersSummaryCard";
import { Button, Card, CardContent } from "@repo/ui";
import {
  TrendingUp,
  Ticket,
  Calendar,
  Banknote,
  QrCode,
  CheckCircle2,
  Armchair,
} from "lucide-react";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function getMetrics() {
  if (!supabaseUrl || !supabaseServiceKey) {
    return {
      totalRevenue: 0,
      totalTicketsSold: 0,
      scannedTickets: 0,
      scannedPercentage: 0,
      availableTables: 0,
      ticketsSoldLast24h: 0,
      revenueGrowth: 0,
      ticketsGrowth: 0,
      scannedGrowth: 0,
      salesByHour: [],
      ticketsByEvent: [],
      freeTickets: 0,
      paidTickets: 0,
      freeTicketsByEvent: [],
      generalCodeByEvent: [],
    };
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const now = new Date();
  const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const last48h = new Date(now.getTime() - 48 * 60 * 60 * 1000);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  // 1. Ingresos totales del mes (payments succeeded)
  const { data: paymentsData } = await supabase
    .from("payments")
    .select("amount")
    .eq("status", "succeeded")
    .gte("created_at", startOfMonth.toISOString());

  const totalRevenue = paymentsData?.reduce((sum, p) => sum + (p.amount || 0), 0) || 0;

  // 2. Total de tickets vendidos (con payment_status completed)
  const { count: totalTicketsSold } = await supabase
    .from("tickets")
    .select("*", { head: true, count: "exact" })
    .eq("payment_status", "completed");

  // 3. Tickets escaneados (usados)
  const { count: scannedTickets } = await supabase
    .from("tickets")
    .select("*", { head: true, count: "exact" })
    .eq("used", true);

  const totalTickets = totalTicketsSold ?? 0;
  const scannedTicketsCount = scannedTickets ?? 0;
  const scannedPercentage = totalTickets > 0 
    ? Math.round((scannedTicketsCount / totalTickets) * 100) 
    : 0;

  // 4. Mesas disponibles (para próximo evento)
  const { data: nextEvent } = await supabase
    .from("events")
    .select("id")
    .gte("event_date", now.toISOString())
    .order("event_date", { ascending: true })
    .limit(1)
    .single();

  let availableTables = 0;
  if (nextEvent) {
    const { count: available } = await supabase
      .from("tables")
      .select("*", { head: true, count: "exact" })
      .eq("event_id", nextEvent.id)
      .eq("is_reserved", false);
    availableTables = available ?? 0;
  }

  // Growth calculations (últimas 24h vs 24h previas)
  const { count: ticketsLast24h } = await supabase
    .from("tickets")
    .select("*", { head: true, count: "exact" })
    .eq("payment_status", "completed")
    .gte("created_at", last24h.toISOString());

  const { count: ticketsPrevious24h } = await supabase
    .from("tickets")
    .select("*", { head: true, count: "exact" })
    .eq("payment_status", "completed")
    .gte("created_at", last48h.toISOString())
    .lt("created_at", last24h.toISOString());

  const last24hCount = ticketsLast24h ?? 0;
  const prev24hCount = ticketsPrevious24h ?? 0;
  
  const ticketsGrowth = prev24hCount > 0 
    ? Math.round(((last24hCount - prev24hCount) / prev24hCount) * 100) 
    : last24hCount > 0 ? 100 : 0;

  // Ventas por hora (últimas 24h)
  const { data: hourlyTickets } = await supabase
    .from("tickets")
    .select("created_at")
    .eq("payment_status", "completed")
    .gte("created_at", last24h.toISOString())
    .order("created_at", { ascending: true });

  const salesByHour: { name: string; value: number }[] = [];
  const hourCounts: { [key: string]: number } = {};
  
  hourlyTickets?.forEach(ticket => {
    const hour = new Date(ticket.created_at).getHours();
    const hourKey = `${hour}:00`;
    hourCounts[hourKey] = (hourCounts[hourKey] || 0) + 1;
  });

  for (let i = 0; i < 24; i++) {
    const hourKey = `${i}:00`;
    salesByHour.push({ name: hourKey, value: hourCounts[hourKey] || 0 });
  }

  // Tickets por evento (próximos 5 eventos)
  const { data: upcomingEvents } = await supabase
    .from("events")
    .select("id, title")
    .gte("event_date", now.toISOString())
    .order("event_date", { ascending: true })
    .limit(5);

  const ticketsByEvent: { name: string; value: number }[] = [];
  
  if (upcomingEvents) {
    for (const event of upcomingEvents) {
      const { count } = await supabase
        .from("tickets")
        .select("*", { head: true, count: "exact" })
        .eq("event_id", event.id)
        .eq("payment_status", "completed");
      
      ticketsByEvent.push({ 
        name: event.title.substring(0, 20), 
        value: count ?? 0
      });
    }
  }

  // Tickets FREE (códigos generales sin pago)
  const { count: freeTicketsCount } = await supabase
    .from("tickets")
    .select("code_id, codes!inner(type)", { head: true, count: "exact" })
    .eq("codes.type", "general")
    .or("payment_status.is.null,payment_status.neq.completed");

  const freeTickets = freeTicketsCount ?? 0;

  // Tickets PAGADOS (con payment_status completed)
  const { count: paidTicketsCount } = await supabase
    .from("tickets")
    .select("*", { head: true, count: "exact" })
    .eq("payment_status", "completed");

  const paidTickets = paidTicketsCount ?? 0;

  // Tickets FREE por evento (próximos 5 eventos)
  const freeTicketsByEvent: { name: string; value: number }[] = [];
  
  if (upcomingEvents) {
    for (const event of upcomingEvents) {
      const { count } = await supabase
        .from("tickets")
        .select("code_id, codes!inner(type)", { head: true, count: "exact" })
        .eq("event_id", event.id)
        .eq("codes.type", "general")
        .or("payment_status.is.null,payment_status.neq.completed");
      
      freeTicketsByEvent.push({ 
        name: event.title.substring(0, 20), 
        value: count ?? 0
      });
    }
  }

  // Tickets con código general por evento (para gráfico circular)
  const generalCodeByEvent: { name: string; value: number }[] = [];
  
  if (upcomingEvents) {
    for (const event of upcomingEvents) {
      const { count } = await supabase
        .from("tickets")
        .select("code_id, codes!inner(type)", { head: true, count: "exact" })
        .eq("event_id", event.id)
        .eq("codes.type", "general");
      
      if ((count ?? 0) > 0) {
        generalCodeByEvent.push({ 
          name: event.title.substring(0, 25), 
          value: count ?? 0
        });
      }
    }
  }

  return {
    totalRevenue: totalRevenue / 100, // Culqi usa céntimos
    totalTicketsSold: totalTickets,
    scannedTickets: scannedTicketsCount,
    scannedPercentage,
    availableTables,
    ticketsSoldLast24h: last24hCount,
    revenueGrowth: 0, // Calcular si necesario
    ticketsGrowth,
    scannedGrowth: 0, // Calcular si necesario
    salesByHour: salesByHour.filter(h => h.value > 0).slice(-12), // Últimas 12 horas con actividad
    ticketsByEvent,
    freeTickets,
    paidTickets,
    freeTicketsByEvent,
    generalCodeByEvent,
  };
}

export default async function AdminDashboard() {
  const metrics = await getMetrics();

  const quickActions = [
    { label: "Crear Evento", href: "/admin/events/create", icon: Calendar },
    { label: "Escaneo QR", href: "/admin/tickets", icon: QrCode },
    { label: "Ver Mesas", href: "/admin/tables", icon: Armchair },
    { label: "Reportes", href: "/admin/ingresos", icon: TrendingUp },
  ];

  // Determinar qué mostrar basado en datos existentes
  const hasActivity = metrics.salesByHour.length > 0 || metrics.ticketsByEvent.length > 0 || metrics.freeTicketsByEvent.length > 0 || metrics.generalCodeByEvent.length > 0;
  const hasSales = metrics.totalTicketsSold > 0;

  return (
    <main className="space-y-4">
      {/* Header compacto */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          <p className="text-sm text-slate-400">Métricas en tiempo real</p>
        </div>
        {/* Quick Actions inline */}
        <div className="flex gap-2">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <Link key={action.href} href={action.href}>
                <Button 
                  variant="outline" 
                  size="sm"
                  className="border-rose-500/30 bg-slate-800/80 hover:bg-rose-500/20 text-white hover:text-white hover:border-rose-500/50 transition-all"
                >
                  <Icon className="h-4 w-4 mr-2 text-rose-400" />
                  <span className="text-slate-100">{action.label}</span>
                </Button>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Card resumen de tickets generados por evento */}
      <TicketsSummaryCard />

      {/* Metric Cards compactas */}
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Ingresos"
          value={`S/ ${metrics.totalRevenue.toLocaleString('es-PE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}
          description="Este mes"
          icon={<Banknote className="text-green-400" />}
        />
        <MetricCard
          title="Pagados"
          value={(metrics.paidTickets || 0).toLocaleString()}
          description={`Free: ${metrics.freeTickets || 0}`}
          icon={<Ticket className="text-blue-400" />}
          trend={metrics.ticketsGrowth !== 0 ? { 
            value: Math.abs(metrics.ticketsGrowth), 
            direction: metrics.ticketsGrowth > 0 ? "up" : "down", 
            label: `${metrics.ticketsGrowth > 0 ? "+" : ""}${metrics.ticketsGrowth}%` 
          } : undefined}
        />
        <MetricCard
          title="Asistencia"
          value={`${metrics.scannedPercentage || 0}%`}
          description={`${metrics.scannedTickets || 0} escaneados`}
          icon={<CheckCircle2 className="text-emerald-400" />}
        />
        <MetricCard
          title="Mesas"
          value={(metrics.availableTables || 0).toLocaleString()}
          description="Disponibles"
          icon={<Armchair className="text-purple-400" />}
        />
      </div>

      {/* Card grande: promotores por evento (selector + barras) */}
      <PromotersSummaryCard />

      {/* Solo mostrar gráficos si hay datos */}
      {hasActivity && (
        <div className="space-y-4">

          {/* Tickets por evento (barras) */}
          {metrics.ticketsByEvent.length > 0 && (
            <ChartCard title="Tickets generados por evento" description="Cantidad total de tickets por evento">
              <SimpleBarChart data={metrics.ticketsByEvent} height={220} />
            </ChartCard>
          )}

          {/* Tickets con código general por evento */}
          {metrics.generalCodeByEvent.length > 0 && (
            <ChartCard title="Codigo general por evento" description="Distribucion de tickets gratuitos">
              <SimplePieChart data={metrics.generalCodeByEvent} height={260} />
            </ChartCard>
          )}
        </div>
      )}

      {/* Si hay ventas, mostrar desglose compacto de asistencia */}
      {hasSales && (
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="border-0 bg-gradient-to-br from-slate-800 to-slate-900 col-span-3">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-8">
                  <div className="text-center">
                    <div className="text-4xl font-bold text-emerald-400">{metrics.scannedPercentage || 0}%</div>
                    <div className="text-xs text-slate-400 mt-1">Asistencia</div>
                  </div>
                  <div className="h-12 w-px bg-slate-700" />
                  <div className="flex gap-6">
                    <div>
                      <div className="text-2xl font-bold text-white">{metrics.scannedTickets || 0}</div>
                      <div className="text-xs text-slate-400">Escaneados</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-slate-400">{(metrics.totalTicketsSold || 0) - (metrics.scannedTickets || 0)}</div>
                      <div className="text-xs text-slate-400">Pendientes</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-blue-400">{metrics.totalTicketsSold || 0}</div>
                      <div className="text-xs text-slate-400">Total</div>
                    </div>
                  </div>
                </div>
                <div className="flex-1 ml-8">
                  <div className="h-4 w-full rounded-full bg-slate-700 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-600 transition-all"
                      style={{ width: `${metrics.scannedPercentage || 0}%` }}
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Si no hay actividad, mostrar estado vacío compacto */}
      {!hasActivity && !hasSales && (
        <Card className="border-0 bg-gradient-to-br from-slate-800 to-slate-900">
          <CardContent className="p-8 text-center">
            <Calendar className="h-12 w-12 text-slate-600 mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-white mb-1">Sin actividad reciente</h3>
            <p className="text-sm text-slate-400 mb-4">Crea tu primer evento para comenzar</p>
            <Link href="/admin/events/create">
              <Button className="bg-rose-500 hover:bg-rose-600">
                <Calendar className="h-4 w-4 mr-2" />
                Crear Evento
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}
    </main>
  );
}
