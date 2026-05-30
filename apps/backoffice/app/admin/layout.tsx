"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  Calendar,
  ClipboardList,
  ReceiptText,
  ShieldCheck,
  Ticket,
} from "lucide-react";
import { supabaseClient } from "@/lib/supabaseClient";

type NavItem = {
  id: string;
  label: string;
  href: string;
  icon: LucideIcon;
  isActive?: (pathname: string) => boolean;
};

const DOOR_LANDING = "/admin/door";

const menuItems: NavItem[] = [
  { id: "dashboard", label: "Inicio", href: "/admin", icon: BarChart3 },
  { id: "events", label: "Eventos", href: "/admin/events", icon: Calendar },
  { id: "reservations", label: "Reservas", href: "/admin/reservations", icon: ReceiptText },
  { id: "tickets", label: "Tickets / QR", href: "/admin/tickets", icon: Ticket },
  { id: "reports", label: "Reportes", href: "/admin/reportes", icon: ClipboardList },
  { id: "system", label: "Sistema", href: "/admin/users", icon: ShieldCheck },
];

function NavEntry({
  item,
  pathname,
  onNavigate,
}: {
  item: NavItem;
  pathname: string;
  onNavigate?: () => void;
}) {
  const active = item.isActive
    ? item.isActive(pathname)
    : pathname === item.href || pathname.startsWith(`${item.href}/`);
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${
        active
          ? "bg-rose-500/15 text-rose-100 ring-1 ring-rose-500/30"
          : "text-neutral-300 hover:bg-neutral-900 hover:text-white"
      }`}
    >
      <span
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[11px] font-semibold ${
          active ? "bg-rose-500/20 text-rose-100" : "bg-neutral-800 text-neutral-400"
        }`}
      >
        <Icon size={15} />
      </span>
      <span className="truncate">{item.label}</span>
    </Link>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  const isDoorSession = pathname === DOOR_LANDING;
  const isDoorAllowedPath = pathname === DOOR_LANDING;

  useEffect(() => {
    const ensureSession = async () => {
      if (!supabaseClient) {
        setLoading(false);
        return;
      }

      const { data } = await supabaseClient.auth.getSession();
      if (!data.session && process.env.NODE_ENV === "production") {
        router.replace("/auth/login");
        return;
      }

      setLoading(false);
    };

    ensureSession().catch(() => router.replace("/auth/login"));
  }, [router]);

  useEffect(() => {
    fetch("/api/branding")
      .then((res) => res.json())
      .then((data) => {
        if (data?.logo_url) setLogoUrl(data.logo_url);
      })
      .catch(() => null);
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black text-white">
        <p className="rounded-lg border border-white/10 bg-[#0b0b0b] px-4 py-3 text-sm">
          Cargando sesión...
        </p>
      </div>
    );
  }

  if (isDoorSession && !isDoorAllowedPath) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black text-white">
        <p className="rounded-lg border border-white/10 bg-[#0b0b0b] px-4 py-3 text-sm">
          Redirigiendo al módulo de escaneo...
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen overflow-x-hidden bg-black text-white">
      {!isDoorSession ? (
        <>
          <aside className="sticky top-0 hidden h-screen w-64 shrink-0 border-r border-neutral-800 bg-neutral-950/95 md:flex md:flex-col">
            <div className="border-b border-neutral-800 px-4 py-4">
              <div className="flex items-center gap-3">
                {logoUrl ? (
                  <img src={logoUrl} alt="Logo" className="h-10 w-auto max-w-[160px] object-contain" />
                ) : (
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-rose-400 to-rose-600">
                    <span className="text-xs font-bold text-white">BC</span>
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-rose-300/70">BabyClub Access</p>
                  <h1 className="truncate text-sm font-semibold text-white">Backoffice administrativo</h1>
                </div>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto px-3 py-4">
              <nav className="space-y-1">
                {menuItems.map((item) => (
                  <NavEntry key={item.id} item={item} pathname={pathname} />
                ))}
              </nav>
            </div>
          </aside>

          {mobileOpen ? (
            <div className="fixed inset-0 z-50 bg-black/60 md:hidden" onClick={() => setMobileOpen(false)}>
              <div
                className="absolute left-0 top-0 flex h-[100dvh] w-80 max-w-[88vw] flex-col border-r border-neutral-800 bg-neutral-950 p-4 shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.18em] text-rose-300/70">BabyClub Access</p>
                    <h1 className="text-sm font-semibold text-white">Backoffice administrativo</h1>
                  </div>
                  <button
                    onClick={() => setMobileOpen(false)}
                    className="flex h-9 w-9 items-center justify-center rounded-lg bg-neutral-800"
                    aria-label="Cerrar menú"
                  >
                    <span className="text-lg leading-none">×</span>
                  </button>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto pb-6">
                  <nav className="space-y-1">
                    {menuItems.map((item) => (
                      <NavEntry
                        key={item.id}
                        item={item}
                        pathname={pathname}
                        onNavigate={() => setMobileOpen(false)}
                      />
                    ))}
                  </nav>
                </div>
              </div>
            </div>
          ) : null}
        </>
      ) : null}

      <div className={isDoorSession ? "flex-1 min-w-0" : "flex flex-1 min-w-0 flex-col"}>
        {!isDoorSession ? (
          <div className="sticky top-0 z-40 flex h-14 shrink-0 items-center justify-between border-b border-neutral-800 bg-neutral-950/95 px-4 backdrop-blur-sm md:hidden">
            <div className="flex items-center gap-2">
              {logoUrl ? (
                <img src={logoUrl} alt="Logo" className="h-8 w-auto max-w-[140px] object-contain" />
              ) : (
                <>
                  <div className="flex h-8 w-8 items-center justify-center rounded-md bg-gradient-to-br from-rose-400 to-rose-600">
                    <span className="text-xs font-bold text-white">BC</span>
                  </div>
                  <span className="text-sm font-semibold text-white">BabyClub Access</span>
                </>
              )}
            </div>
            <button
              onClick={() => setMobileOpen((v) => !v)}
              aria-label={mobileOpen ? "Cerrar menú" : "Abrir menú"}
              className="flex h-9 w-9 items-center justify-center rounded-lg bg-neutral-800 touch-manipulation"
            >
              <span className="relative block h-4 w-4">
                <span
                  className={`absolute left-0 top-0 h-0.5 w-4 bg-white transition-transform ${
                    mobileOpen ? "translate-y-[7px] rotate-45" : ""
                  }`}
                />
                <span
                  className={`absolute left-0 top-[7px] h-0.5 w-4 bg-white transition-opacity ${
                    mobileOpen ? "opacity-0" : "opacity-100"
                  }`}
                />
                <span
                  className={`absolute left-0 top-[14px] h-0.5 w-4 bg-white transition-transform ${
                    mobileOpen ? "-translate-y-[7px] -rotate-45" : ""
                  }`}
                />
              </span>
            </button>
          </div>
        ) : null}
        <main className={isDoorSession ? "p-2 md:p-4" : "flex-1 p-3 sm:p-4 md:p-6 lg:p-8"}>{children}</main>
      </div>
    </div>
  );
}
