"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { ClientAuthGate } from "@/components/ClientAuthGate";
import { LogoutButton } from "@/components/LogoutButton";

const MENU = {
  OPERACIONES: [
    { label: "Eventos", href: "/admin/events" },
    { label: "Mesas y Reservas", href: "/admin/mesas-reservas" },
    { label: "Tickets / QR", href: "/admin/tickets" },
    { label: "Promotores", href: "/admin/promoters" },
  ],
  REPORTES: [
    { label: "Asistencia", href: "/admin/asistencia" },
    { label: "Ingresos", href: "/admin/ingresos" },
    { label: "Promotores", href: "/admin/reportes/promotores" },
    { label: "Mesas", href: "/admin/reportes/mesas" },
  ],
  "CONFIGURACIÓN": [
    { label: "General", href: "/admin/branding" },
    { label: "Usuarios y Roles", href: "/admin/users" },
    { label: "Integraciones", href: "/admin/integraciones" },
    { label: "Seguridad", href: "/admin/seguridad" },
  ],
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [logo, setLogo] = useState<string | null>(process.env.NEXT_PUBLIC_LOGO_URL || null);
  const [navOpen, setNavOpen] = useState(false);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    OPERACIONES: true,
    REPORTES: false,
    "CONFIGURACIÓN": false,
  });

  useEffect(() => {
    fetch("/api/branding")
      .then((res) => res.json())
      .then((data) => {
        if (data?.logo_url) setLogo(data.logo_url);
      })
      .catch(() => null);
  }, []);

  useEffect(() => {
    if (navOpen) setNavOpen(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  const resolvedLogo = logo || process.env.NEXT_PUBLIC_LOGO_URL || null;

  const toggleGroup = (group: string) => {
    setOpenGroups((prev) => ({ ...prev, [group]: !prev[group] }));
  };

  const isActive = (href: string) => {
    if (!pathname) return false;
    if (href === "/admin" && pathname === "/admin") return true;
    return pathname.startsWith(href) && href !== "/admin";
  };

  const renderSidebar = (onNavigate?: () => void) => (
    <div className="flex h-full max-h-[calc(100vh-2rem)] flex-col gap-6 overflow-y-auto rounded-3xl border border-white/10 bg-[#0b0b0b] p-6 pr-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex h-12 items-center">
          {resolvedLogo ? (
            <img src={resolvedLogo} alt="BABY" className="h-12 w-auto object-contain" />
          ) : (
            <span className="text-lg font-black tracking-[0.2em]">BABY Admin Suite</span>
          )}
        </div>
        <button
          className="lg:hidden rounded-full border border-white/15 px-3 py-2 text-xs text-white"
          onClick={() => setNavOpen(false)}
        >
          Cerrar
        </button>
      </div>

      <nav className="space-y-4 text-sm font-semibold text-white/70">
        <Link
          href="/admin"
          onClick={onNavigate}
          className={`flex items-center justify-between rounded-2xl border px-3 py-2 text-white transition ${
            isActive("/admin")
            ? "border-[#e91e63]/60 bg-[#e91e63]/15"
            : "border-white/5 bg-white/[0.04] hover:border-[#e91e63]/60 hover:bg-[#e91e63]/10"
          }`}
        >
          <span className="flex items-center gap-2">
            <span className="text-base font-semibold">⌂</span>
            Inicio
          </span>
          <span className="text-xs text-white/50">→</span>
        </Link>

        {Object.entries(MENU).map(([group, items]) => (
          <div key={group} className="space-y-2 rounded-2xl border border-white/5 bg-white/[0.015] p-2">
            <button
              type="button"
              onClick={() => toggleGroup(group)}
              className="flex w-full items-center justify-between rounded-xl px-2 py-1 text-left text-[11px] font-semibold uppercase tracking-[0.15em] text-white/60 hover:text-white"
            >
              <span>{group}</span>
              <span className="text-base font-bold">{openGroups[group] ? "−" : "+"}</span>
            </button>
            {openGroups[group] && (
              <div className="space-y-2">
                {(items as { label: string; href: string }[]).map((item) => (
                  <Link
                    key={item.label}
                    href={item.href}
                    onClick={onNavigate}
                    className={`flex items-center justify-between rounded-2xl border px-3 py-2 text-white transition ${
                      isActive(item.href)
                      ? "border-[#e91e63]/60 bg-[#e91e63]/15"
                      : "border-white/5 bg-white/[0.02] hover:border-[#e91e63]/60 hover:bg-[#e91e63]/10"
                    }`}
                  >
                    {item.label}
                    <span className="text-xs text-white/50">→</span>
                  </Link>
                ))}
              </div>
            )}
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
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 xl:flex-row xl:gap-6 xl:px-6 xl:py-6">
          <aside className="hidden w-[250px] xl:block">{renderSidebar()}</aside>

          <main className="flex-1 space-y-4">
            <header className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-[#0b0b0b] px-4 py-3">
              <div className="flex items-center gap-3">
                <button
                  className="inline-flex items-center justify-center rounded-full border border-white/15 bg-white/[0.04] px-3 py-2 text-sm font-semibold text-white xl:hidden"
                  onClick={() => setNavOpen(true)}
                >
                  ☰
                </button>
                <Link href="/admin" className="group inline-flex items-center gap-3 text-white/80">
                  <div className="flex h-10 w-40 items-center">
                    {resolvedLogo ? (
                      <img
                        src={resolvedLogo}
                        alt="BABY"
                        className="h-10 w-auto object-contain transition group-hover:opacity-90"
                      />
                    ) : (
                      <span className="inline-flex h-10 items-center text-lg font-semibold">BABY</span>
                    )}
                  </div>
                </Link>
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
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm xl:hidden" onClick={() => setNavOpen(false)}>
            <div
              className="absolute left-4 top-6 w-[82%] max-w-[340px] max-h-[calc(100vh-3rem)] overflow-y-auto rounded-3xl border border-white/10 bg-[#0b0b0b] p-4"
              onClick={(e) => e.stopPropagation()}
            >
              {renderSidebar(() => setNavOpen(false))}
            </div>
          </div>
        )}
      </div>
    </ClientAuthGate>
  );
}
