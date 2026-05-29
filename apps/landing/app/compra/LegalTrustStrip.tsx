import Link from "next/link";
import { legalLinks } from "../../lib/legalLinks";

export function LegalTrustStrip() {
  return (
    <section className="rounded-2xl border border-white/10 bg-[#0a0a0a] px-4 py-3 text-xs text-white/60">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/55">
            Compra validada por BABY
          </p>
          <p className="text-sm text-white/72">
            Entradas digitales y reservas de mesa BABY
          </p>
        </div>

        <nav
          aria-label="Enlaces legales BABY"
          className="flex flex-wrap gap-x-3 gap-y-1 text-[11px]"
        >
          {legalLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="font-semibold text-[#ff77ad] underline-offset-4 hover:underline"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </section>
  );
}
