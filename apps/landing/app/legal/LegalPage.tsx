import type { ReactNode } from "react";
import Link from "next/link";
import { getLegalConfig } from "lib/legal";
import { legalLinks } from "lib/legalLinks";

export function LegalPage({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  const legal = getLegalConfig();

  return (
    <main className="min-h-screen bg-black px-4 py-8 text-white sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <nav className="flex flex-wrap items-center justify-between gap-3 text-sm">
          <Link
            href="/compra"
            className="rounded-full border border-white/15 px-4 py-2 font-semibold text-white/80 transition hover:border-white/40 hover:text-white"
          >
            ← Volver a compra
          </Link>
          <div className="flex flex-wrap gap-2 text-xs font-semibold text-white/60">
            {legalLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-full border border-white/10 px-3 py-1.5 transition hover:border-[#e91e63]/50 hover:text-white"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </nav>

        <header className="rounded-3xl border border-white/10 bg-gradient-to-b from-[#111111] to-[#050505] p-6 shadow-[0_28px_90px_rgba(0,0,0,0.5)]">
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-[#e91e63]">
            {eyebrow}
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
            {title}
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-white/65">
            {description}
          </p>
          <p className="mt-4 text-xs font-semibold uppercase tracking-[0.18em] text-white/40">
            Última actualización: {legal.lastUpdated}
          </p>
        </header>

        <section className="grid gap-4 lg:grid-cols-[0.85fr,1.6fr]">
          <aside className="h-fit rounded-3xl border border-white/10 bg-[#0a0a0a] p-5 text-sm text-white/70">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-white/40">
              Comercio
            </p>
            <div className="mt-4 space-y-3">
              <Info label="Nombre comercial" value={legal.tradeName} />
              <Info label="Razón social" value={legal.legalName} />
              <Info label="RUC" value={legal.ruc} />
              <Info label="Dirección" value={legal.address} />
              <Info label="Teléfono" value={legal.phone} />
              <Info label="Correo" value={legal.supportEmail} />
              <Info label="Instagram" value={legal.instagram} />
            </div>
          </aside>

          <article className="space-y-4">{children}</article>
        </section>
      </div>
    </main>
  );
}

export function LegalSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-white/10 bg-[#0a0a0a] p-5">
      <h2 className="text-lg font-semibold text-white">{title}</h2>
      <div className="mt-3 space-y-3 text-sm leading-6 text-white/70">
        {children}
      </div>
    </section>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/35">
        {label}
      </p>
      <p className="font-semibold text-white/85">{value}</p>
    </div>
  );
}
