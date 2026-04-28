export const dynamic = "force-dynamic";

import Link from "next/link";
import { Button } from "@repo/ui";
import { TrendingUp, Calendar, QrCode, Building2, Package2, BadgeDollarSign } from "lucide-react";
import TicketsSummaryCard from "@/components/dashboard/TicketsSummaryCard";
import PromotersSummaryCard from "@/components/dashboard/PromotersSummaryCard";

export default async function AdminDashboard() {
  const quickActions = [
    { label: "Crear Evento", href: "/admin/events/create", icon: Calendar },
    { label: "Entradas/Precios", href: "/admin/ticket-types", icon: BadgeDollarSign },
    { label: "Escaneo QR", href: "/admin/scan", icon: QrCode },
    { label: "Mesas/Croquis", href: "/admin/organizers", icon: Building2 },
    { label: "Productos Mesa", href: "/admin/table-products", icon: Package2 },
    { label: "Reportes", href: "/admin/reportes", icon: TrendingUp },
  ];

  return (
    <main className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          <p className="text-sm text-neutral-400">Métricas en tiempo real</p>
        </div>
        <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-2 lg:w-auto lg:grid-cols-3 xl:grid-cols-6">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <Link key={action.href} href={action.href} className="w-full">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start border-rose-500/30 bg-neutral-800/80 text-white transition-all hover:border-rose-500/50 hover:bg-rose-500/20 hover:text-white sm:justify-center lg:justify-start"
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
