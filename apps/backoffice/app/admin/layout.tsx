"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabaseClient } from "@/lib/supabaseClient";

type NavItem = {
  id: string;
  label: string;
  href?: string;
  children?: NavChild[];
  isActive?: (pathname: string) => boolean;
};

type NavChild = {
  id: string;
  label: string;
  href: string;
  isActive?: (pathname: string) => boolean;
};

const DOOR_LANDING = "/admin/door";

const isCollectionListPath = (pathname: string, href: string, excludedSegments: string[] = []) => {
  if (pathname === href) return true;
  if (!pathname.startsWith(`${href}/`)) return false;
  const nextSegment = pathname.slice(href.length + 1).split("/")[0];
  return !excludedSegments.includes(nextSegment);
};

const sectionMeta: Record<string, { glyph: string; description: string }> = {
  RESUMEN: { glyph: "⌂", description: "Vista rápida de operación diaria" },
  OPERACIÓN: { glyph: "⚙", description: "Gestión y ejecución del día a día" },
  REPORTES: { glyph: "≡", description: "Lectura consolidada y auditoría" },
  SISTEMA: { glyph: "⛭", description: "Configuración y control interno" },
};

const itemGlyph = (label: string) => {
  const normalized = label.toLowerCase();
  if (normalized.includes("evento")) return "◉";
  if (normalized.includes("reserva")) return "↳";
  if (normalized.includes("ticket")) return "▣";
  if (normalized.includes("escaneo") || normalized.includes("qr")) return "◌";
  if (normalized.includes("promotor")) return "∴";
  if (normalized.includes("código")) return "#";
  if (normalized.includes("liquid")) return "$";
  if (normalized.includes("log")) return "•";
  if (normalized.includes("usuario")) return "@";
  if (normalized.includes("seguridad")) return "!";
  if (normalized.includes("branding")) return "◈";
  if (normalized.includes("integr")) return "↔";
  if (normalized.includes("backup")) return "⇪";
  if (normalized.includes("mesa")) return "▤";
  if (normalized.includes("precio") || normalized.includes("entrada")) return "¤";
  return "•";
};

const menuItems: Array<{ section: string; items: NavItem[] }> = [
  {
    section: "RESUMEN",
    items: [
      { id: "dashboard", label: "Inicio", href: "/admin" },
      {
        id: "reservations",
        label: "Reservas",
        href: "/admin/reservations",
      },
      {
        id: "tickets",
        label: "Tickets / QR",
        href: "/admin/tickets",
      },
      { id: "scan", label: "Escaneo QR", href: "/admin/scan" },
    ],
  },
  {
    section: "OPERACIÓN",
    items: [
      {
        id: "events",
        label: "Gestión de eventos",
        children: [
          {
            id: "events-list",
            label: "Listado de eventos",
            href: "/admin/events",
            isActive: (pathname) => isCollectionListPath(pathname, "/admin/events", ["create"]),
          },
          { id: "events-create", label: "Crear evento", href: "/admin/events/create" },
        ],
      },
      {
        id: "organizers",
        label: "Organizadores y croquis",
        children: [
          {
            id: "organizers-list",
            label: "Listado de organizadores",
            href: "/admin/organizers",
            isActive: (pathname) => isCollectionListPath(pathname, "/admin/organizers", ["create"]),
          },
          { id: "table-products", label: "Productos de mesa", href: "/admin/table-products" },
        ],
      },
      {
        id: "promoters",
        label: "Promotores y códigos",
        children: [
          {
            id: "promoters-list",
            label: "Listado de promotores",
            href: "/admin/promoters",
            isActive: (pathname) => isCollectionListPath(pathname, "/admin/promoters", ["create"]),
          },
          { id: "promoters-create", label: "Crear promotor", href: "/admin/promoters/create" },
          { id: "codes-batches", label: "Lotes de códigos", href: "/admin/codes" },
        ],
      },
      { id: "ticket-types", label: "Entradas y precios", href: "/admin/ticket-types" },
      { id: "settlements", label: "Liquidaciones", href: "/admin/liquidaciones" },
    ],
  },
  {
    section: "REPORTES",
    items: [
      {
        id: "reports-hub",
        label: "Hub de reportes",
        href: "/admin/reportes",
        isActive: (pathname) => pathname === "/admin/reportes",
      },
      {
        id: "reports",
        label: "Analítica operativa",
        children: [
          {
            id: "reports-attendance-sales",
            label: "Operación de eventos",
            href: "/admin/reportes/mesas",
            isActive: (pathname) =>
              pathname === "/admin/reportes/mesas" ||
              pathname === "/admin/asistencia" ||
              pathname === "/admin/ingresos",
          },
          { id: "reports-promoters", label: "Promotores", href: "/admin/reportes/promotores" },
          { id: "reports-settlements", label: "Liquidaciones", href: "/admin/reportes/liquidaciones" },
          { id: "logs", label: "Logs", href: "/admin/logs" },
        ],
      },
    ],
  },
  {
    section: "SISTEMA",
    items: [
      { id: "branding", label: "Branding", href: "/admin/branding" },
      { id: "users", label: "Usuarios", href: "/admin/users" },
      { id: "security", label: "Seguridad", href: "/admin/seguridad" },
      { id: "integrations", label: "Integraciones", href: "/admin/integraciones" },
      { id: "backup", label: "Backup BD", href: "/admin/utilidades/backup" },
    ],
  },
];

const itemBadge = (label: string) => label.slice(0, 2).toUpperCase();

function NavEntry({
  item,
  pathname,
  onNavigate,
}: {
  item: NavItem;
  pathname: string;
  onNavigate?: () => void;
}) {
  const active =
    item.href ? pathname === item.href || pathname.startsWith(`${item.href}/`) : false;

  if (!item.children?.length) {
    return (
      <Link
        href={item.href || "#"}
        onClick={onNavigate}
        className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition ${
          active
            ? "bg-rose-500/15 text-rose-100 ring-1 ring-rose-500/30"
            : "text-neutral-300 hover:bg-neutral-900 hover:text-white"
        }`}
      >
        <span
          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[11px] font-semibold ${
            active ? "bg-rose-500/20 text-rose-100" : "bg-neutral-800 text-neutral-400"
          }`}
        >
          {itemGlyph(item.label)}
        </span>
        <span className="truncate">{item.label}</span>
      </Link>
    );
  }

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-white">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-rose-500/15 text-[11px] font-semibold text-rose-200">
          {itemGlyph(item.label)}
        </span>
        <span className="truncate">{item.label}</span>
      </div>
      <div className="space-y-1 pl-2">
        {item.children.map((child) => {
          const childActive = child.isActive ? child.isActive(pathname) : pathname === child.href || pathname.startsWith(`${child.href}/`);
          return (
            <Link
              key={child.id}
              href={child.href}
              onClick={onNavigate}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${
                childActive
                  ? "bg-rose-500/15 text-rose-100 ring-1 ring-rose-500/30"
                  : "text-neutral-400 hover:bg-neutral-900 hover:text-white"
              }`}
            >
              <span
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded text-[10px] font-semibold ${
                  childActive ? "bg-rose-500/20 text-rose-100" : "bg-neutral-800 text-neutral-500"
                }`}
              >
                {itemGlyph(child.label)}
              </span>
              <span className="truncate">{child.label}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    RESUMEN: true,
  });

  const isDoorSession = pathname === DOOR_LANDING;
  const isDoorAllowedPath = pathname === DOOR_LANDING;

  useEffect(() => {
    const activeSection =
      menuItems.find((group) =>
        group.items.some((item) =>
          item.children
            ? item.children.some((child) =>
                child.isActive
                  ? child.isActive(pathname)
                  : pathname === child.href || pathname.startsWith(`${child.href}/`),
              )
            : item.href
              ? pathname === item.href || pathname.startsWith(`${item.href}/`)
              : false,
        ),
      )?.section || null;

    if (!activeSection) return;

    setOpenSections((current) => ({
      ...current,
      [activeSection]: true,
    }));
  }, [pathname]);

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
              <div className="space-y-5">
                {menuItems.map((group) => (
                  <section key={group.section} className="space-y-2">
                    <button
                      type="button"
                      onClick={() =>
                        setOpenSections((current) => ({
                          ...current,
                          [group.section]: !current[group.section],
                        }))
                      }
                      className="w-full rounded-2xl border border-neutral-800/80 bg-neutral-950/60 px-3 py-2 text-left transition hover:border-neutral-700 hover:bg-neutral-900/60"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-neutral-500">
                            <span className="text-[11px] text-rose-300">
                              {sectionMeta[group.section]?.glyph || "•"}
                            </span>
                            {group.section}
                          </p>
                          <p className="mt-1 text-[11px] leading-4 text-neutral-600">
                            {sectionMeta[group.section]?.description || ""}
                          </p>
                        </div>
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-neutral-800 bg-black text-neutral-300">
                          {openSections[group.section] ? "−" : "+"}
                        </span>
                      </div>
                    </button>
                    {openSections[group.section] ? (
                      <div className="space-y-1 pl-1">
                        {group.items.map((item) => (
                          <NavEntry key={item.id} item={item} pathname={pathname} />
                        ))}
                      </div>
                    ) : null}
                  </section>
                ))}
              </div>
            </div>
          </aside>

          {mobileOpen ? (
            <div className="fixed inset-0 z-50 bg-black/60 md:hidden" onClick={() => setMobileOpen(false)}>
              <div
                className="absolute left-0 top-0 h-full w-80 max-w-[88vw] border-r border-neutral-800 bg-neutral-950 p-4 shadow-2xl"
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
                <div className="space-y-5 overflow-y-auto pb-6">
                  {menuItems.map((group) => (
                    <section key={group.section} className="space-y-2">
                      <button
                        type="button"
                        onClick={() =>
                          setOpenSections((current) => ({
                            ...current,
                            [group.section]: !current[group.section],
                          }))
                        }
                        className="w-full rounded-2xl border border-neutral-800/80 bg-neutral-950/60 px-3 py-2 text-left transition hover:border-neutral-700 hover:bg-neutral-900/60"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-neutral-500">
                              <span className="text-[11px] text-rose-300">
                                {sectionMeta[group.section]?.glyph || "•"}
                              </span>
                              {group.section}
                            </p>
                            <p className="mt-1 text-[11px] leading-4 text-neutral-600">
                              {sectionMeta[group.section]?.description || ""}
                            </p>
                          </div>
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-neutral-800 bg-black text-neutral-300">
                            {openSections[group.section] ? "−" : "+"}
                          </span>
                        </div>
                      </button>
                      {openSections[group.section] ? (
                        <div className="space-y-1 pl-1">
                          {group.items.map((item) => (
                            <NavEntry
                              key={item.id}
                              item={item}
                              pathname={pathname}
                              onNavigate={() => setMobileOpen(false)}
                            />
                          ))}
                        </div>
                      ) : null}
                    </section>
                  ))}
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
