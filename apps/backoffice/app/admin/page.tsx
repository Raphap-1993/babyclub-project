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

type DashboardMetrics = {
  totalRevenue: number;
  totalTicketsSold: number;
  scannedTickets: number;
  scannedPercentage: number;
  availableTables: number;
  ticketsSoldLast24h: number;
  revenueGrowth: number;
  ticketsGrowth: number;
  scannedGrowth: number;
  salesByHour: Array<{ name: string; value: number }>;
  ticketsByEvent: Array<{ name: string; value: number }>;
  freeTickets: number;
  paidTickets: number;
  freeTicketsByEvent: Array<{ name: string; value: number }>;
  generalCodeByEvent: Array<{ name: string; value: number }>;
};

const EMPTY_METRICS: DashboardMetrics = {
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

const SUPABASE_TIMEOUT_MS = Number(process.env.SUPABASE_TIMEOUT_MS || 9000);
const SUPABASE_RETRY_ATTEMPTS = 2;
const SUPABASE_COUNT_MODE: "exact" | "planned" | "estimated" = "planned";
const RETRY_BASE_DELAY_MS = 250;

function createSupabaseFetchWithTimeout(timeoutMs = SUPABASE_TIMEOUT_MS) {
  return async (input: RequestInfo | URL, init?: RequestInit) => {
    const controller = new AbortController();
    const upstreamSignal = init?.signal;
    const abortFromUpstream = () => controller.abort();
    if (upstreamSignal) {
      if (upstreamSignal.aborted) controller.abort();
      upstreamSignal.addEventListener("abort", abortFromUpstream, { once: true });
    }
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      return await fetch(input, { ...(init || {}), signal: controller.signal });
    } finally {
      clearTimeout(timeoutId);
      upstreamSignal?.removeEventListener("abort", abortFromUpstream);
    }
  };
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function sanitizeErrorMessage(raw: unknown): string {
  const message = typeof raw === "string" ? raw : String((raw as any)?.message || "");
  const normalized = message.replace(/\s+/g, " ").trim();
  if (!normalized) return "Error inesperado de Supabase";
  if (/<(!doctype|html)/i.test(normalized)) return "Supabase devolvió HTML (timeout/edge error)";
  return normalized.length > 220 ? `${normalized.slice(0, 220)}...` : normalized;
}

function isTransientSupabaseError(message: string): boolean {
  return /(aborterror|operation was aborted|aborted|timeout|timed out|error code 522|gateway timeout|service unavailable|fetch failed|network)/i.test(
    message
  );
}

function logSupabaseError(
  operation: string,
  err: unknown,
  context?: { attempt: number; maxAttempts: number; willRetry: boolean }
) {
  const message = sanitizeErrorMessage(err);
  if (isTransientSupabaseError(message)) {
    console.warn("[admin/dashboard] supabase transient issue", {
      operation,
      message,
      attempt: context?.attempt,
      maxAttempts: context?.maxAttempts,
      willRetry: context?.willRetry ?? false,
    });
    return;
  }
  console.error("[admin/dashboard] supabase query failed", {
    operation,
    message,
    attempt: context?.attempt,
    maxAttempts: context?.maxAttempts,
  });
}

async function runDataQuery<T>(
  operation: string,
  query: () => PromiseLike<{ data: T | null; error: any }>
): Promise<T | null> {
  for (let attempt = 1; attempt <= SUPABASE_RETRY_ATTEMPTS; attempt++) {
    try {
      const { data, error } = await query();
      if (!error) {
        return data ?? null;
      }
      const message = sanitizeErrorMessage(error);
      const retryable = isTransientSupabaseError(message);
      const willRetry = retryable && attempt < SUPABASE_RETRY_ATTEMPTS;
      logSupabaseError(operation, error, { attempt, maxAttempts: SUPABASE_RETRY_ATTEMPTS, willRetry });
      if (willRetry) {
        await delay(RETRY_BASE_DELAY_MS * attempt);
        continue;
      }
      return null;
    } catch (err) {
      const message = sanitizeErrorMessage(err);
      const retryable = isTransientSupabaseError(message);
      const willRetry = retryable && attempt < SUPABASE_RETRY_ATTEMPTS;
      logSupabaseError(operation, err, { attempt, maxAttempts: SUPABASE_RETRY_ATTEMPTS, willRetry });
      if (willRetry) {
        await delay(RETRY_BASE_DELAY_MS * attempt);
        continue;
      }
      return null;
    }
  }
  return null;
}

async function runCountQuery(
  operation: string,
  query: () => PromiseLike<{ count: number | null; error: any }>
): Promise<number> {
  for (let attempt = 1; attempt <= SUPABASE_RETRY_ATTEMPTS; attempt++) {
    try {
      const { count, error } = await query();
      if (!error) {
        return count ?? 0;
      }
      const message = sanitizeErrorMessage(error);
      const retryable = isTransientSupabaseError(message);
      const willRetry = retryable && attempt < SUPABASE_RETRY_ATTEMPTS;
      logSupabaseError(operation, error, { attempt, maxAttempts: SUPABASE_RETRY_ATTEMPTS, willRetry });
      if (willRetry) {
        await delay(RETRY_BASE_DELAY_MS * attempt);
        continue;
      }
      return 0;
    } catch (err) {
      const message = sanitizeErrorMessage(err);
      const retryable = isTransientSupabaseError(message);
      const willRetry = retryable && attempt < SUPABASE_RETRY_ATTEMPTS;
      logSupabaseError(operation, err, { attempt, maxAttempts: SUPABASE_RETRY_ATTEMPTS, willRetry });
      if (willRetry) {
        await delay(RETRY_BASE_DELAY_MS * attempt);
        continue;
      }
      return 0;
    }
  }
  return 0;
}

const truncate = (value: string, max = 20) => (value.length > max ? `${value.slice(0, max)}` : value);

async function getMetrics(): Promise<DashboardMetrics> {
  if (!supabaseUrl || !supabaseServiceKey) return EMPTY_METRICS;

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { fetch: createSupabaseFetchWithTimeout() },
    });

    const now = new Date();
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const last48h = new Date(now.getTime() - 48 * 60 * 60 * 1000);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      paymentsData,
      totalTicketsSold,
      scannedTicketsCount,
      nextEvent,
      ticketsLast24h,
      ticketsPrevious24h,
      upcomingEvents,
      freeTickets,
    ] = await Promise.all([
      runDataQuery<Array<{ amount: number | null }>>("payments.monthly_paid", () =>
        supabase.from("payments").select("amount").eq("status", "paid").gte("created_at", startOfMonth.toISOString())
      ),
      runCountQuery("tickets.total_active", () =>
        supabase
          .from("tickets")
          .select("id", { head: true, count: SUPABASE_COUNT_MODE })
          .is("deleted_at", null)
          .eq("is_active", true)
      ),
      runCountQuery("tickets.total_used", () =>
        supabase
          .from("tickets")
          .select("id", { head: true, count: SUPABASE_COUNT_MODE })
          .is("deleted_at", null)
          .eq("is_active", true)
          .eq("used", true)
      ),
      runDataQuery<{ id: string; starts_at: string | null }>("events.next", () =>
        supabase
          .from("events")
          .select("id,starts_at")
          .is("deleted_at", null)
          .eq("is_active", true)
          .or("force_closed.is.null,force_closed.eq.false")
          .gte("starts_at", now.toISOString())
          .order("starts_at", { ascending: true })
          .limit(1)
          .maybeSingle()
      ),
      runCountQuery("tickets.last_24h", () =>
        supabase
          .from("tickets")
          .select("id", { head: true, count: SUPABASE_COUNT_MODE })
          .is("deleted_at", null)
          .eq("is_active", true)
          .gte("created_at", last24h.toISOString())
      ),
      runCountQuery("tickets.previous_24h", () =>
        supabase
          .from("tickets")
          .select("id", { head: true, count: SUPABASE_COUNT_MODE })
          .is("deleted_at", null)
          .eq("is_active", true)
          .gte("created_at", last48h.toISOString())
          .lt("created_at", last24h.toISOString())
      ),
      runDataQuery<Array<{ id: string; name: string | null }>>("events.upcoming_top5", () =>
        supabase
          .from("events")
          .select("id,name")
          .is("deleted_at", null)
          .eq("is_active", true)
          .or("force_closed.is.null,force_closed.eq.false")
          .gte("starts_at", now.toISOString())
          .order("starts_at", { ascending: true })
          .limit(5)
      ),
      runCountQuery("tickets.free_general_total", () =>
        supabase
          .from("tickets")
          .select("id,codes!inner(type)", { head: true, count: SUPABASE_COUNT_MODE })
          .is("deleted_at", null)
          .eq("is_active", true)
          .eq("codes.type", "general")
      ),
    ]);

    const totalRevenue = (paymentsData || []).reduce((sum, payment) => sum + (payment.amount || 0), 0);
    const scannedPercentage =
      totalTicketsSold > 0 ? Math.round((scannedTicketsCount / totalTicketsSold) * 100) : 0;
    const paidTickets = Math.max(totalTicketsSold - freeTickets, 0);

    const availableTables =
      nextEvent?.id
        ? await runCountQuery("table_availability.available_next_event", () =>
            supabase
              .from("table_availability")
              .select("id", { head: true, count: SUPABASE_COUNT_MODE })
              .eq("event_id", nextEvent.id)
              .eq("is_available", true)
              .is("deleted_at", null)
          )
        : 0;

    const ticketsGrowth =
      ticketsPrevious24h > 0
        ? Math.round(((ticketsLast24h - ticketsPrevious24h) / ticketsPrevious24h) * 100)
        : ticketsLast24h > 0
          ? 100
          : 0;

    const salesByHour: Array<{ name: string; value: number }> = [];

    const eventRows = upcomingEvents || [];
    const eventStats =
      eventRows.length > 0
        ? await Promise.all(
            eventRows.map(async (event) => {
              const [totalCount, generalCount] = await Promise.all([
                runCountQuery(`tickets.total_by_event.${event.id}`, () =>
                  supabase
                    .from("tickets")
                    .select("id", { head: true, count: SUPABASE_COUNT_MODE })
                    .is("deleted_at", null)
                    .eq("is_active", true)
                    .eq("event_id", event.id)
                ),
                runCountQuery(`tickets.general_by_event.${event.id}`, () =>
                  supabase
                    .from("tickets")
                    .select("id,codes!inner(type)", { head: true, count: SUPABASE_COUNT_MODE })
                    .is("deleted_at", null)
                    .eq("is_active", true)
                    .eq("event_id", event.id)
                    .eq("codes.type", "general")
                ),
              ]);
              return {
                eventId: event.id,
                totalCount,
                generalCount,
              };
            })
          )
        : [];

    const totalByEventMap = new Map<string, number>();
    const generalByEventMap = new Map<string, number>();
    eventStats.forEach((row) => {
      totalByEventMap.set(row.eventId, row.totalCount);
      generalByEventMap.set(row.eventId, row.generalCount);
    });

    const ticketsByEvent = eventRows.map((event) => {
      const title = (event.name || event.id || "Evento").trim();
      return {
        name: truncate(title, 20),
        value: totalByEventMap.get(event.id) || 0,
      };
    });

    const freeTicketsByEvent = eventRows.map((event) => {
      const title = (event.name || event.id || "Evento").trim();
      return {
        name: truncate(title, 20),
        value: generalByEventMap.get(event.id) || 0,
      };
    });

    const generalCodeByEvent = eventRows
      .map((event) => {
        const title = (event.name || event.id || "Evento").trim();
        return {
          name: truncate(title, 25),
          value: generalByEventMap.get(event.id) || 0,
        };
      })
      .filter((row) => row.value > 0);

    return {
      totalRevenue: totalRevenue / 100,
      totalTicketsSold,
      scannedTickets: scannedTicketsCount,
      scannedPercentage,
      availableTables,
      ticketsSoldLast24h: ticketsLast24h,
      revenueGrowth: 0,
      ticketsGrowth,
      scannedGrowth: 0,
      salesByHour: salesByHour.filter((row) => row.value > 0).slice(-12),
      ticketsByEvent,
      freeTickets,
      paidTickets,
      freeTicketsByEvent,
      generalCodeByEvent,
    };
  } catch (err) {
    console.error("[admin/dashboard] unexpected metrics error", {
      message: sanitizeErrorMessage(err),
    });
    return EMPTY_METRICS;
  }
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
