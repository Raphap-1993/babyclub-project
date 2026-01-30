import Link from "next/link";
import PromoterForm from "../components/PromoterForm";

export const dynamic = "force-dynamic";

export default function CreatePromoterPage() {
  return (
    <main className="min-h-screen bg-black px-4 py-8 text-white sm:px-6 lg:px-10">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#f2f2f2]/60">Promotores</p>
          <h1 className="text-3xl font-semibold">Crear promotor</h1>
        </div>
        <Link
          href="/admin/promoters"
          className="inline-flex items-center justify-center rounded-full border border-white/15 px-4 py-2 text-sm font-semibold text-white transition hover:border-white"
        >
          ← Volver
        </Link>
      </div>

      <div className="rounded-3xl border border-white/10 bg-[#0c0c0c] p-6 shadow-[0_20px_80px_rgba(0,0,0,0.45)]">
        <PromoterForm mode="create" />
      </div>
    </main>
  );
}
