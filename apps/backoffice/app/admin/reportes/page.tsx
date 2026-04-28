import Link from "next/link";
import {
  Banknote,
  BarChart3,
  ReceiptText,
  Users2,
  FileClock,
} from "lucide-react";
import { AdminHeader, AdminPage } from "@/components/admin/PageScaffold";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

type ReportModuleCard = {
  title: string;
  description: string;
  href: string;
  cta: string;
  icon: typeof BarChart3;
};

const reportModules: ReportModuleCard[] = [
  {
    title: "Operación de Eventos",
    description:
      "Reporte operativo por evento con asistencia, ventas y control de no-show de QR free.",
    href: "/admin/reportes/mesas",
    cta: "Abrir reporte",
    icon: BarChart3,
  },
  {
    title: "Rendimiento de Promotores",
    description:
      "Visualiza códigos generados vs asistencias por organizador, evento y promotor.",
    href: "/admin/reportes/promotores",
    cta: "Ver promotores",
    icon: Users2,
  },
  {
    title: "Liquidaciones",
    description:
      "Consolidado de liquidaciones creadas por evento, promotor, estado e importe.",
    href: "/admin/reportes/liquidaciones",
    cta: "Ver liquidaciones",
    icon: Banknote,
  },
  {
    title: "Logs de Operación",
    description:
      "Trazabilidad de procesos críticos para auditoría interna y soporte.",
    href: "/admin/logs",
    cta: "Revisar logs",
    icon: FileClock,
  },
  {
    title: "Ingresos",
    description: "Acceso directo al reporte comercial de ventas por evento.",
    href: "/admin/ingresos",
    cta: "Ir a ingresos",
    icon: ReceiptText,
  },
];

export default function ReportesHubPage() {
  return (
    <AdminPage>
      <AdminHeader
        kicker="Reportes"
        title="Módulo de Reportes"
        description="Centraliza aquí los reportes operativos y comerciales del dashboard."
      />

      <section className="grid gap-3 md:grid-cols-2">
        {reportModules.map((module) => {
          const Icon = module.icon;
          return (
            <Card key={module.title} className="border-[#2b2b2b]">
              <CardHeader className="pb-2 pt-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-rose-500/30 bg-rose-500/10 text-rose-300">
                    <Icon className="h-4 w-4" />
                  </span>
                  {module.title}
                </CardTitle>
                <CardDescription className="text-xs text-white/60">
                  {module.description}
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <Link href={module.href}>
                  <Button type="button" size="sm" className="w-full sm:w-auto">
                    {module.cta}
                  </Button>
                </Link>
              </CardContent>
            </Card>
          );
        })}
      </section>
    </AdminPage>
  );
}
