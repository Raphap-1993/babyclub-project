"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ClientAuthGate } from "@/components/ClientAuthGate";
import { LogoutButton } from "@/components/LogoutButton";

const MENU = {
  OPERACIONES: [
    { label: "Eventos", href: "/admin/events" },
    { label: "Mesas y Reservas", href: "/admin/reservations" },
    { label: "Tickets / QR", href: "/admin/events" },
    { label: "Promotores", href: "/admin/promoters" },
  ],
  REPORTES: [
    { label: "Asistencia", href: "/admin" },
    { label: "Ingresos", href: "/admin" },
    { label: "Promotores", href: "/admin/promoters" },
    { label: "Mesas", href: "/admin/tables" },
  ],
  "CONFIGURACIÓN": [
    { label: "General", href: "/admin/branding" },
    { label: "Usuarios y Roles", href: "/admin" },
    { label: "Integraciones", href: "/admin" },
    { label: "Seguridad", href: "/admin" },
  ],
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [logo, setLogo] = useState<string | null>(process.env.NEXT_PUBLIC_LOGO_URL || null);
  const [navOpen, setNavOpen] = useState(false);

  useEffect(() => {
    fetch("/api/branding")
      .then((res) => res.json())
      .then((data) => {
        if (data?.logo_url) setLogo(data.logo_url);
      })
      .catch(() => null);
  }, []);

  const Sidebar = (
    <div className="flex h-full flex-col gap-6 rounded-3xl border border-white/10 bg-[#0b0b0b] p-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          {logo ? (
            <img src={logo} alt="BABY Admin Suite" className="h-10 w-auto object-contain" />
          ) : (
            <span className="text-lg font-black tracking-[0.2em]">BABY Admin Suite</span>
          )}
          <p className="text-xs text-white/60">Operación centralizada</p>
        </div>
        <button
          className="lg:hidden rounded-full border border-white/15 px-3 py-2 text-xs text-white"
          onClick={() => setNavOpen(false)}
        >
          Cerrar
        </button>
      </div>

      <nav className="space-y-4 text-sm font-semibold text-white/70">
        {Object.entries(MENU).map(([group, items]) => (
          <div key={group} className="space-y-2">
            <p className="text-[11px] uppercase tracking-[0.15em] text-white/40">{group}</p>
            {(items as { label: string; href: string }[]).map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className="flex items-center justify-between rounded-2xl border border-white/5 bg-white/[0.02] px-3 py-2 text-white transition hover:border-white/30 hover:bg-white/[0.05]"
              >
                {item.label}
                <span className="text-xs text-white/50">→</span>
              </Link>
            ))}
          </div>
        ))}
        <div className="pt-2">
          <LogoutButton />
        </div>
      </nav>
    </div>
  );

  return (
    <ClientAuthGate>
      <div className="min-h-screen bg-[#050505] text-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 lg:flex-row lg:gap-6 lg:px-6 lg:py-6">
          <aside className="hidden w-[250px] lg:block">{Sidebar}</aside>

          <main className="flex-1 space-y-4">
            <header className="flex items-center justify-between rounded-2xl border border-white/10 bg-[#0b0b0b] px-4 py-3">
              <div className="flex items-center gap-3">
                <button
                  className="inline-flex items-center justify-center rounded-full border border-white/15 bg-white/[0.04] px-3 py-2 text-sm font-semibold text-white lg:hidden"
                  onClick={() => setNavOpen(true)}
                >
                  ☰
                </button>
                <div className="flex flex-col leading-tight">
                  <span className="text-xs uppercase tracking-[0.25em] text-white/50">BABY Admin Suite</span>
                  <span className="text-sm text-white/80">Operación central</span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Link
                  href="/admin/events/create"
                  className="hidden rounded-full border border-white/20 px-4 py-2 text-sm font-semibold text-white transition hover:border-white sm:inline-flex"
                >
                  Nuevo evento
                </Link>
                <LogoutButton />
              </div>
            </header>

            <div className="rounded-3xl border border-white/10 bg-[#0b0b0b] p-4 lg:p-6">{children}</div>
          </main>
        </div>

        {navOpen && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm lg:hidden" onClick={() => setNavOpen(false)}>
            <div
              className="absolute left-4 top-6 w-[82%] max-w-[300px] rounded-3xl border border-white/10 bg-[#0b0b0b] p-4"
              onClick={(e) => e.stopPropagation()}
            >
              {Sidebar}
            </div>
          </div>
        )}
      </div>
    </ClientAuthGate>
  );
}
