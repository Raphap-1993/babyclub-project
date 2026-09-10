import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { getPermanentPromoterPage } from "../../../lib/promoterLinks";
import { PurchaseAttributionError } from "shared/promoterAttribution";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Elige tu evento | BABY",
  robots: { index: false, follow: false },
};

export default async function PermanentPromoterPage({
  params,
}: {
  params: Promise<{ promoterId: string }>;
}) {
  const { promoterId } = await params;
  let page;
  try {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error("Missing configuration");
    const supabase = createClient(url, key, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    page = await getPermanentPromoterPage(supabase, promoterId);
  } catch (error) {
    if (
      error instanceof PurchaseAttributionError &&
      [400, 404].includes(error.status)
    )
      notFound();
    return (
      <main className="mx-auto min-h-screen max-w-xl px-6 py-24 text-white">
        <h1 className="text-2xl font-semibold">Volvemos en un momento</h1>
        <p className="mt-4 text-white/70">
          No pudimos cargar los eventos. Intenta abrir este enlace nuevamente en
          unos minutos.
        </p>
      </main>
    );
  }
  if (page.events.length === 1) redirect(page.events[0].purchaseUrl);
  return (
    <main className="mx-auto min-h-screen max-w-2xl px-6 py-20 text-white">
      <Link href="/" className="text-sm font-semibold tracking-[0.3em]">
        BABY
      </Link>
      <h1 className="mt-8 text-3xl font-semibold">
        {page.events.length
          ? "Elige tu próxima fiesta"
          : "Próximas fiestas por anunciar"}
      </h1>
      <p className="mt-3 text-white/65">
        {page.events.length
          ? "Compra tus entradas o reserva una mesa para el evento que prefieras."
          : "Conserva este enlace. Aquí encontrarás nuestros próximos eventos."}
      </p>
      <div className="mt-8 grid gap-4">
        {page.events.map((event) => (
          <Link
            key={event.id}
            href={event.purchaseUrl}
            className="rounded-2xl border border-white/15 bg-white/5 p-5 transition hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#e91e63]"
          >
            <h2 className="text-xl font-semibold">{event.name}</h2>
            {event.startsAt && (
              <p className="mt-2 text-sm text-white/65">
                {new Intl.DateTimeFormat("es-PE", {
                  dateStyle: "full",
                  timeStyle: "short",
                  timeZone: "America/Lima",
                }).format(new Date(event.startsAt))}
              </p>
            )}
            <span className="mt-4 inline-block text-sm font-semibold text-[#ff77ad]">
              Ver entradas y mesas →
            </span>
          </Link>
        ))}
      </div>
    </main>
  );
}
