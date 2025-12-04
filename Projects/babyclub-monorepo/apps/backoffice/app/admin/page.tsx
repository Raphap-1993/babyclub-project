export const dynamic = "force-dynamic";

import Link from "next/link";
import { CardOverview } from "@/components/ui/CardOverview";
import { GradientButton } from "@/components/ui/GradientButton";
import { StatPill } from "@/components/ui/StatPill";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function getMetrics() {
  if (!supabaseUrl || !supabaseServiceKey) {
    return { inscriptions: 0, ticketsOpen: 0, attendance: "0%" };
  }
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const now = new Date();
  const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

  const { count: inscCount = 0 } = await supabase
    .from("tickets")
    .select("*", { head: true, count: "exact" })
    .gt("created_at", last24h);

  const { count: openCount = 0 } = await supabase
    .from("tickets")
    .select("*", { head: true, count: "exact" })
    .eq("used", false);

  const { count: usedCount = 0 } = await supabase
    .from("tickets")
    .select("*", { head: true, count: "exact" })
    .eq("used", true);

  const { count: totalCount = 0 } = await supabase.from("tickets").select("*", { head: true, count: "exact" });

  const attendance =
    totalCount && totalCount > 0 ? `${Math.round(((usedCount || 0) / totalCount) * 100)}%` : "0%";

  return {
    inscriptions: inscCount || 0,
    ticketsOpen: openCount || 0,
    attendance,
  };
}

export default async function AdminDashboard() {
  const metrics = await getMetrics();

  const stats = [
    {
      title: "Inscripciones",
      subtitle: "Últimas 24h",
      value: `${metrics.inscriptions}`,
      pill: <StatPill label="HOY" />,
      tone: "accent" as const,
    },
    {
      title: "Tickets abiertos",
      subtitle: "Sin usar",
      value: `${metrics.ticketsOpen}`,
      pill: <StatPill label="SOPORTE" variant="muted" />,
      tone: "default" as const,
    },
    {
      title: "Asistencia por evento",
      subtitle: "Ratio de uso",
      value: metrics.attendance,
      pill: <StatPill label="ESTIMADO" variant="muted" />,
      tone: "muted" as const,
    },
  ];

  const quickActions = [
    { label: "Eventos", href: "/admin/events" },
    { label: "Promotores", href: "/admin/promoters" },
    { label: "Mesas", href: "/admin/tables" },
    { label: "Reservas", href: "/admin/reservations" },
    { label: "Branding", href: "/admin/branding" },
  ];

  return (
    <main className="min-h-screen bg-[#050505] text-white">
      <div className="mx-auto max-w-6xl space-y-6 px-4 py-8 lg:px-0">
        <div className="flex flex-col gap-4 rounded-3xl border border-white/10 bg-[#0b0b0b] p-6 shadow-[0_20px_80px_rgba(0,0,0,0.35)]">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <h1 className="text-3xl font-semibold">Dashboard</h1>
              <p className="text-sm text-white/60">Planifica y opera el ecosistema BABY con métricas en vivo.</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href="/admin/events/create">
                <GradientButton>Crear evento</GradientButton>
              </Link>
            </div>
          </div>

          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {stats.map((item) => (
              <CardOverview
                key={item.title}
                title={item.title}
                subtitle={item.subtitle}
                value={item.value}
                pill={item.pill}
                tone={item.tone}
              />
            ))}
          </section>
        </div>

        <section className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          <div className="rounded-3xl border border-white/10 bg-[#0c0c0c] p-6">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/50">Flujo diario</p>
                <h2 className="text-xl font-semibold">Tickets y asistencia</h2>
              </div>
              <StatPill label="LIVE" />
            </div>
            <div className="space-y-4">
              <div className="flex items-center justify-between rounded-2xl border border-white/5 bg-white/[0.02] px-4 py-3">
                <div>
                  <p className="text-sm text-white/70">Tickets abiertos</p>
                  <p className="text-2xl font-semibold">{metrics.ticketsOpen}</p>
                </div>
                <span className="rounded-full bg-white/[0.06] px-3 py-1 text-[12px] font-semibold text-white">
                  Sin usar
                </span>
              </div>
              <div className="flex items-center justify-between rounded-2xl border border-white/5 bg-white/[0.02] px-4 py-3">
                <div>
                  <p className="text-sm text-white/70">Asistencia confirmada</p>
                  <p className="text-2xl font-semibold">{metrics.attendance}</p>
                </div>
                <span className="rounded-full bg-white/[0.06] px-3 py-1 text-[12px] font-semibold text-white/80">
                  Ratio uso
                </span>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-[#0c0c0c] p-6">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/50">Accesos rápidos</p>
                <h2 className="text-xl font-semibold">Núcleo BABY</h2>
              </div>
              <StatPill label="PRIORIDAD" variant="muted" />
            </div>
            <div className="space-y-3">
              {quickActions.map((action) => (
                <Link
                  key={action.label}
                  href={action.href}
                  className="flex items-center justify-between rounded-2xl border border-white/5 bg-white/[0.02] px-4 py-3 text-sm font-semibold text-white transition hover:border-white/30 hover:bg-white/[0.05]"
                >
                  {action.label}
                  <span aria-hidden>→</span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
