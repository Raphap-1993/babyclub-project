"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  Banknote,
  BadgeDollarSign,
  Building2,
  Calendar,
  ChevronDown,
  ClipboardList,
  Database,
  FileClock,
  Package2,
  Plug,
  QrCode,
  ReceiptText,
  ShieldCheck,
  Ticket,
  UserRound,
  Users,
  Palette,
} from "lucide-react";
import { supabaseClient } from "@/lib/supabaseClient";

type NavChild = {
  id: string;
  label: string;
  href: string;
  icon: LucideIcon;
  isActive?: (pathname: string) => boolean;
};

type NavSection = {
  id: string;
  label: string;
  description: string;
  icon: string;
  children: NavChild[];
};

const DOOR_LANDING = "/admin/door";

const isCollectionListPath = (
  pathname: string,
  href: string,
  excludedSegments: string[] = [],
) => {
  if (pathname === href) return true;
  if (!pathname.startsWith(`${href}/`)) return false;
  const nextSegment = pathname.slice(href.length + 1).split("/")[0];
  return !excludedSegments.includes(nextSegment);
};

const menuSections: NavSection[] = [
  {
    id: "resumen",
    label: "Resumen",
    description: "Vista rápida de operación diaria.",
    icon: "⌂",
    children: [
      { id: "dashboard", label: "Inicio", href: "/admin", icon: BarChart3 },
      {
        id: "reservations",
        label: "Reservas",
        href: "/admin/reservations",
        icon: ReceiptText,
      },
      {
        id: "tickets",
        label: "Tickets / QR",
        href: "/admin/tickets",
        icon: Ticket,
      },
      { id: "scan", label: "Escaneo QR", href: "/admin/scan", icon: QrCode },
    ],
  },
  {
    id: "operation",
    label: "Operación",
    description: "Gestión y ejecución del día a día.",
    icon: "⚙",
    children: [
      {
        id: "events",
        label: "Eventos",
        href: "/admin/events",
        icon: Calendar,
        isActive: (pathname) =>
          isCollectionListPath(pathname, "/admin/events", ["create"]),
      },
      {
        id: "organizers",
        label: "Organizadores / croquis",
        href: "/admin/organizers",
        icon: Building2,
        isActive: (pathname) =>
          isCollectionListPath(pathname, "/admin/organizers", ["create"]),
      },
      {
        id: "promoters",
        label: "Promotores",
        href: "/admin/promoters",
        icon: UserRound,
        isActive: (pathname) =>
          isCollectionListPath(pathname, "/admin/promoters", ["create"]),
      },
      {
        id: "codes",
        label: "Códigos / lotes",
        href: "/admin/codes",
        icon: Ticket,
      },
      {
        id: "ticket-types",
        label: "Entradas y precios",
        href: "/admin/ticket-types",
        icon: BadgeDollarSign,
      },
      {
        id: "liquidaciones",
        label: "Liquidaciones",
        href: "/admin/liquidaciones",
        icon: Banknote,
      },
    ],
  },
  {
    id: "reports",
    label: "Reportes",
    description: "Lectura consolidada y auditoría.",
    icon: "≡",
    children: [
      {
        id: "reports-hub",
        label: "Hub de reportes",
        href: "/admin/reportes",
        icon: ClipboardList,
        isActive: (pathname) => pathname === "/admin/reportes",
      },
      {
        id: "reports-events",
        label: "Operación de eventos",
        href: "/admin/reportes/mesas",
        icon: ClipboardList,
        isActive: (pathname) =>
          pathname === "/admin/reportes/mesas" ||
          pathname === "/admin/asistencia" ||
          pathname === "/admin/ingresos",
      },
      {
        id: "reports-promoters",
        label: "Promotores",
        href: "/admin/reportes/promotores",
        icon: Users,
      },
      {
        id: "reports-liquidaciones",
        label: "Liquidaciones",
        href: "/admin/reportes/liquidaciones",
        icon: Banknote,
      },
      { id: "logs", label: "Logs", href: "/admin/logs", icon: FileClock },
    ],
  },
  {
    id: "system",
    label: "Sistema",
    description: "Configuración y control interno.",
    icon: "⛭",
    children: [
      { id: "branding", label: "Branding", href: "/admin/branding", icon: Palette },
      { id: "users", label: "Usuarios", href: "/admin/users", icon: Users },
      { id: "security", label: "Seguridad", href: "/admin/seguridad", icon: ShieldCheck },
      {
        id: "integrations",
        label: "Integraciones",
        href: "/admin/integraciones",
        icon: Plug,
      },
      { id: "backup", label: "Backup BD", href: "/admin/utilidades/backup", icon: Database },
    ],
  },
];

function isChildActive(pathname: string, child: NavChild) {
  return child.isActive
    ? child.isActive(pathname)
    : pathname === child.href || pathname.startsWith(`${child.href}/`);
}

function NavChildLink({
  child,
  pathname,
  onNavigate,
}: {
  child: NavChild;
  pathname: string;
  onNavigate?: () => void;
}) {
  const active = isChildActive(pathname, child);
  const Icon = child.icon;

  return (
    <Link
      href={child.href}
      onClick={onNavigate}
      className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition ${
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
      <span className="truncate">{child.label}</span>
    </Link>
  );
}

function NavSectionBlock({
  section,
  pathname,
  expanded,
  onToggle,
  onNavigate,
}: {
  section: NavSection;
  pathname: string;
  expanded: boolean;
  onToggle: () => void;
  onNavigate?: () => void;
}) {
  const activeChild = section.children.some((child) => isChildActive(pathname, child));

  return (
    <section className="space-y-2">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className={`w-full rounded-2xl border px-3 py-2 text-left transition ${
          activeChild
            ? "border-rose-500/30 bg-rose-500/10"
            : "border-neutral-800/80 bg-neutral-950/60 hover:border-neutral-700 hover:bg-neutral-900/60"
        }`}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-neutral-500">
              <span className="text-[11px] text-rose-300">{section.icon}</span>
              {section.label}
            </p>
            <p className="mt-1 hidden text-[11px] leading-4 text-neutral-600 sm:block">
              {section.description}
            </p>
          </div>
          <span
            className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-neutral-800 bg-black text-neutral-300 transition-transform ${
              expanded ? "rotate-180" : ""
            }`}
          >
            <ChevronDown size={12} />
          </span>
        </div>
      </button>

      <div
        className={`overflow-hidden transition-all duration-200 ${
          expanded ? "max-h-[700px] opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        <div className="space-y-1 pl-1">
          {section.children.map((child) => (
            <NavChildLink
              key={child.id}
              child={child}
              pathname={pathname}
              onNavigate={onNavigate}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(menuSections.map((section) => [section.id, section.id === "resumen"])),
  );

  useEffect(() => {
    setOpenSections((current) => {
      const next = { ...current };
      let changed = false;

      menuSections.forEach((section) => {
        const hasActiveChild = section.children.some((child) =>
          isChildActive(pathname, child),
        );
        if (hasActiveChild && !next[section.id]) {
          next[section.id] = true;
          changed = true;
        }
      });

      return changed ? next : current;
    });
  }, [pathname]);

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
                  <img
                    src={logoUrl}
                    alt="Logo"
                    className="h-10 w-auto max-w-[160px] object-contain"
                  />
                ) : (
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-rose-400 to-rose-600">
                    <span className="text-xs font-bold text-white">BC</span>
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-rose-300/70">
                    BabyClub Access
                  </p>
                  <h1 className="truncate text-sm font-semibold text-white">
                    Backoffice administrativo
                  </h1>
                </div>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto px-3 py-4">
              <nav className="space-y-3">
                {menuSections.map((section) => (
                  <NavSectionBlock
                    key={section.id}
                    section={section}
                    pathname={pathname}
                    expanded={openSections[section.id] ?? false}
                    onToggle={() =>
                      setOpenSections((current) => ({
                        ...current,
                        [section.id]: !current[section.id],
                      }))
                    }
                  />
                ))}
              </nav>
            </div>
          </aside>

          {mobileOpen ? (
            <div
              className="fixed inset-0 z-50 bg-black/60 md:hidden"
              onClick={() => setMobileOpen(false)}
            >
              <div
                className="absolute left-0 top-0 flex h-[100dvh] w-80 max-w-[88vw] flex-col border-r border-neutral-800 bg-neutral-950 p-4 shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.18em] text-rose-300/70">
                      BabyClub Access
                    </p>
                    <h1 className="text-sm font-semibold text-white">
                      Backoffice administrativo
                    </h1>
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
                  <nav className="space-y-3">
                    {menuSections.map((section) => (
                      <NavSectionBlock
                        key={section.id}
                        section={section}
                        pathname={pathname}
                        expanded={openSections[section.id] ?? false}
                        onToggle={() =>
                          setOpenSections((current) => ({
                            ...current,
                            [section.id]: !current[section.id],
                          }))
                        }
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
                <img
                  src={logoUrl}
                  alt="Logo"
                  className="h-8 w-auto max-w-[140px] object-contain"
                />
              ) : (
                <>
                  <div className="flex h-8 w-8 items-center justify-center rounded-md bg-gradient-to-br from-rose-400 to-rose-600">
                    <span className="text-xs font-bold text-white">BC</span>
                  </div>
                  <span className="text-sm font-semibold text-white">
                    BabyClub Access
                  </span>
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
        <main className={isDoorSession ? "p-2 md:p-4" : "flex-1 p-3 sm:p-4 md:p-6 lg:p-8"}>
          {children}
        </main>
      </div>
    </div>
  );
}
