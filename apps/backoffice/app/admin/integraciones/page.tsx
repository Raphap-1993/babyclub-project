import Link from "next/link";
import { ArrowUpRight, CreditCard } from "lucide-react";

export const dynamic = "force-dynamic";

export default function IntegracionesPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <h1 className="text-2xl font-semibold">Integraciones</h1>
      <Link
        href="/admin/mercadopago"
        className="flex max-w-xl items-center gap-4 rounded-2xl border border-neutral-800 bg-neutral-950 p-6"
      >
        <CreditCard className="text-sky-400" />
        <div className="flex-1">
          <h2 className="font-semibold">Mercado Pago</h2>
          <p className="mt-1 text-sm text-neutral-400">
            Modo activo, control de ventas y pruebas locales.
          </p>
        </div>
        <ArrowUpRight size={18} />
      </Link>
    </div>
  );
}
