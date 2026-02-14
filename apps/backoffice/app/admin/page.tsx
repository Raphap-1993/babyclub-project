export const dynamic = "force-dynamic";

import Link from "next/link";
import { Button } from "@repo/ui";
import { TrendingUp, Calendar, QrCode, Armchair } from "lucide-react";
import TicketsSummaryCard from "@/components/dashboard/TicketsSummaryCard";
import PromotersSummaryCard from "@/components/dashboard/PromotersSummaryCard";

export default async function AdminDashboard() {
  const quickActions = [
    { label: "Crear Evento", href: "/admin/events/create", icon: Calendar },
    { label: "Escaneo QR", href: "/admin/tickets", icon: QrCode },
    { label: "Ver Mesas", href: "/admin/tables", icon: Armchair },
    { label: "Reportes", href: "/admin/ingresos", icon: TrendingUp },
  ];

  return (
    <main className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          <p className="text-sm text-neutral-400">Métricas en tiempo real</p>
        </div>
        <div className="flex gap-2">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <Link key={action.href} href={action.href}>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-rose-500/30 bg-neutral-800/80 hover:bg-rose-500/20 text-white hover:text-white hover:border-rose-500/50 transition-all"
                >
                  <Icon className="mr-2 h-4 w-4 text-rose-400" />
                  <span className="text-neutral-100">{action.label}</span>
                </Button>
              </Link>
            );
          })}
        </div>
      </div>

      <TicketsSummaryCard />
      <PromotersSummaryCard />
    </main>
  );
}
