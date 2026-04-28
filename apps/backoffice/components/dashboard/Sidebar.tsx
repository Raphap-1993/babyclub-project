"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  BadgeDollarSign,
  Building2,
  Calendar,
  ChevronDown,
  ClipboardList,
  FileClock,
  List,
  Package2,
  Plus,
  QrCode,
  ReceiptText,
  UserRound,
  Ticket,
  Users,
  Database,
  Palette,
  Plug,
  ShieldCheck,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { LogoutButton } from "@/components/LogoutButton";

type NavItem = {
  id: string;
  label: string;
  href?: string;
  icon: LucideIcon;
  children?: NavChild[];
  isActive?: (pathname: string) => boolean;
};

type NavChild = {
  id: string;
  label: string;
  href: string;
  icon?: LucideIcon;
  isActive?: (pathname: string) => boolean;
};

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

const menuItems = [
  {
    section: "INICIO",
    items: [
      { id: "dashboard", label: "Inicio", href: "/admin", icon: BarChart3 },
    ],
  },
  {
    section: "GESTIÓN",
    items: [
      {
        id: "events",
        label: "Eventos",
        icon: Calendar,
        children: [
          {
            id: "events-list",
            label: "Eventos",
            href: "/admin/events",
            icon: List,
            isActive: (pathname) =>
              isCollectionListPath(pathname, "/admin/events", ["create"]),
          },
          {
            id: "events-create",
            label: "Crear evento",
            href: "/admin/events/create",
            icon: Plus,
          },
        ],
      },
      {
        id: "organizers",
        label: "Organizadores y croquis",
        icon: Building2,
        children: [
          {
            id: "organizers-list",
            label: "Organizadores / croquis",
            href: "/admin/organizers",
            icon: Building2,
            isActive: (pathname) =>
              isCollectionListPath(pathname, "/admin/organizers", ["create"]),
          },
          {
            id: "table-products",
            label: "Productos de mesa",
            href: "/admin/table-products",
            icon: Package2,
          },
        ],
      },
      {
        id: "promoters",
        label: "Promotores y códigos",
        icon: UserRound,
        children: [
          {
            id: "promoters-list",
            label: "Promotores",
            href: "/admin/promoters",
            icon: UserRound,
            isActive: (pathname) =>
              isCollectionListPath(pathname, "/admin/promoters", ["create"]),
          },
          {
            id: "promoters-create",
            label: "Crear promotor",
            href: "/admin/promoters/create",
            icon: Plus,
          },
          {
            id: "codes-batches",
            label: "Códigos / lotes",
            href: "/admin/codes",
            icon: Ticket,
          },
        ],
      },
    ] as NavItem[],
  },
  {
    section: "VENTAS",
    items: [
      {
        id: "ticket-types",
        label: "Entradas y precios",
        href: "/admin/ticket-types",
        icon: BadgeDollarSign,
      },
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
    ] as NavItem[],
  },
  {
    section: "OPERACIÓN",
    items: [
      { id: "scan", label: "Escaneo QR", href: "/admin/scan", icon: QrCode },
    ] as NavItem[],
  },
  {
    section: "REPORTES",
    items: [
      {
        id: "reports",
        label: "Reportes",
        icon: BarChart3,
        children: [
          {
            id: "reports-hub",
            label: "Hub de reportes",
            href: "/admin/reportes",
            icon: BarChart3,
            isActive: (pathname) => pathname === "/admin/reportes",
          },
          {
            id: "reports-attendance-sales",
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
          { id: "logs", label: "Logs", href: "/admin/logs", icon: FileClock },
        ],
      },
    ] as NavItem[],
  },
  {
    section: "SISTEMA",
    items: [
      {
        id: "branding",
        label: "Branding",
        href: "/admin/branding",
        icon: Palette,
      },
      { id: "users", label: "Usuarios", href: "/admin/users", icon: Users },
      {
        id: "security",
        label: "Seguridad",
        href: "/admin/seguridad",
        icon: ShieldCheck,
      },
      {
        id: "integrations",
        label: "Integraciones",
        href: "/admin/integraciones",
        icon: Plug,
      },
      {
        id: "backup",
        label: "Backup BD",
        href: "/admin/utilidades/backup",
        icon: Database,
      },
    ] as NavItem[],
  },
];

export function Sidebar({
  open,
  setOpen,
}: {
  open: boolean;
  setOpen: (v: boolean) => void;
}) {
  const pathname = usePathname();
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [expandedParents, setExpandedParents] = useState<
    Record<string, boolean>
  >(() =>
    Object.fromEntries(
      menuItems.flatMap((section) =>
        section.items
          .filter((item) => item.children?.length)
          .map((item) => [item.id, true]),
      ),
    ),
  );
  const [expandedSections, setExpandedSections] = useState<
    Record<string, boolean>
  >(() =>
    Object.fromEntries(menuItems.map((section) => [section.section, true])),
  );

  useEffect(() => {
    fetch("/api/branding")
      .then((res) => res.json())
      .then((data) => {
        if (data?.logo_url) setLogoUrl(data.logo_url);
      })
      .catch(() => null);
  }, []);

  const isActive = useCallback(
    (href: string) => {
      if (href === "/admin") return pathname === href;
      return pathname === href || pathname.startsWith(`${href}/`);
    },
    [pathname],
  );

  const isItemActive = useCallback(
    (item: NavItem) => {
      if (item.isActive) return item.isActive(pathname);
      if (!item.href) return false;
      return isActive(item.href);
    },
    [isActive, pathname],
  );

  const isChildActive = useCallback(
    (child: NavChild) => child.isActive?.(pathname) ?? isActive(child.href),
    [isActive, pathname],
  );

  useEffect(() => {
    setExpandedParents((prev) => {
      const next = { ...prev };
      let changed = false;

      menuItems.forEach((section) => {
        section.items.forEach((item: NavItem) => {
          if (!item.children?.length) return;
          const hasActiveChild = item.children.some(isChildActive);
          if ((isItemActive(item) || hasActiveChild) && !next[item.id]) {
            next[item.id] = true;
            changed = true;
          }
        });
      });

      return changed ? next : prev;
    });
  }, [isChildActive, isItemActive]);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  useEffect(() => {
    setExpandedSections((prev) => {
      const next = { ...prev };
      let changed = false;

      menuItems.forEach((section) => {
        const hasActiveItem = section.items.some((item: NavItem) => {
          const hasActiveChild = item.children?.some(isChildActive) ?? false;
          return isItemActive(item) || hasActiveChild;
        });

        if (hasActiveItem && !next[section.section]) {
          next[section.section] = true;
          changed = true;
        }
      });

      return changed ? next : prev;
    });
  }, [isChildActive, isItemActive]);

  const toggleParent = (id: string) => {
    setExpandedParents((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleSection = (sectionName: string) => {
    setExpandedSections((prev) => ({
      ...prev,
      [sectionName]: !prev[sectionName],
    }));
  };

  return (
    <>
      {/* Sidebar */}
      <aside
        className={`fixed left-0 top-14 z-40 flex h-[calc(100dvh-3.5rem)] w-64 transform flex-col overflow-hidden border-r border-neutral-700 bg-gradient-to-b from-neutral-950 to-neutral-900 transition-transform duration-300 md:top-0 md:h-[100dvh] ${
          open ? "translate-x-0" : "-translate-x-full"
        } md:translate-x-0`}
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-center border-b border-neutral-700 px-4 py-3">
          {logoUrl ? (
            <img
              src={logoUrl}
              alt="Baby Logo"
              className="h-auto max-h-10 w-full max-w-[150px] object-contain"
            />
          ) : (
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-rose-400 to-rose-600">
                <span className="text-sm font-bold text-white">BC</span>
              </div>
              <div className="flex flex-col">
                <h1 className="text-sm font-bold text-white">BabyClub</h1>
                <p className="text-xs text-neutral-400">Access</p>
              </div>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="min-h-0 flex-1 space-y-3 overflow-y-auto overflow-x-hidden overscroll-contain px-3 py-3 [scrollbar-color:#525252_transparent] [scrollbar-gutter:stable] [scrollbar-width:thin]">
          {menuItems.map((section) => (
            <div key={section.section}>
              <button
                type="button"
                onClick={() => toggleSection(section.section)}
                aria-expanded={expandedSections[section.section] ?? true}
                className="mb-1 flex w-full items-center justify-between rounded-md px-2 py-0.5 text-left text-[11px] font-semibold uppercase tracking-[0.14em] text-neutral-500 transition-colors hover:bg-neutral-800/60 hover:text-neutral-300"
              >
                <span>{section.section}</span>
                <ChevronDown
                  size={12}
                  className={`transition-transform duration-200 ${(expandedSections[section.section] ?? true) ? "rotate-180" : ""}`}
                />
              </button>

              <div
                className={`space-y-0.5 overflow-hidden transition-all duration-200 ${
                  (expandedSections[section.section] ?? true)
                    ? "max-h-[700px] opacity-100"
                    : "max-h-0 opacity-0"
                }`}
              >
                {section.items.map((item) => {
                  const Icon = item.icon;
                  const active = isItemActive(item);
                  const hasChildren = !!item.children?.length;
                  const children = item.children ?? [];
                  const hasActiveChild = hasChildren
                    ? children.some(isChildActive)
                    : false;
                  const rowActive = active || hasActiveChild;
                  const isExpanded = expandedParents[item.id] ?? false;

                  return (
                    <div key={item.id}>
                      <div
                        className={`flex items-center gap-1 rounded-md px-0.5 transition-colors ${
                          rowActive
                            ? "bg-gradient-to-r from-rose-500/20 to-rose-600/20 text-rose-400"
                            : "text-neutral-300 hover:bg-neutral-800"
                        }`}
                      >
                        {item.href ? (
                          <Link
                            href={item.href}
                            onClick={() => setOpen(false)}
                            className="flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-1.5 text-[13px] font-medium"
                          >
                            <Icon size={16} />
                            <span className="truncate">{item.label}</span>
                          </Link>
                        ) : (
                          <button
                            type="button"
                            aria-expanded={hasChildren ? isExpanded : undefined}
                            onClick={() => toggleParent(item.id)}
                            className="flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] font-medium"
                          >
                            <Icon size={16} />
                            <span className="truncate">{item.label}</span>
                          </button>
                        )}

                        {hasChildren ? (
                          <button
                            type="button"
                            aria-label={
                              isExpanded
                                ? "Contraer menú hijo"
                                : "Expandir menú hijo"
                            }
                            aria-expanded={isExpanded}
                            onClick={() => toggleParent(item.id)}
                            className="rounded-md p-1 text-neutral-300 transition hover:bg-neutral-700 hover:text-white"
                          >
                            <ChevronDown
                              size={13}
                              className={`transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}
                            />
                          </button>
                        ) : null}
                      </div>

                      {hasChildren ? (
                        <div
                          className={`ml-6 mt-0.5 overflow-hidden border-l border-neutral-800 pl-2 transition-all duration-200 ${
                            isExpanded
                              ? "max-h-72 opacity-100"
                              : "max-h-0 opacity-0"
                          }`}
                        >
                          <div className="space-y-0.5 py-0.5">
                            {children.map((child) => {
                              const childActive = isChildActive(child);
                              const ChildIcon = child.icon ?? Ticket;
                              return (
                                <Link
                                  key={child.id}
                                  href={child.href}
                                  onClick={() => setOpen(false)}
                                  className={`flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-medium leading-4 transition-colors ${
                                    childActive
                                      ? "bg-rose-500/15 text-rose-300"
                                      : "text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200"
                                  }`}
                                >
                                  <ChildIcon size={11} />
                                  <span className="truncate">
                                    {child.label}
                                  </span>
                                </Link>
                              );
                            })}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div className="shrink-0 border-t border-neutral-700 p-3">
          <LogoutButton />
        </div>
      </aside>

      {/* Mobile Overlay */}
      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/50 md:hidden"
          onClick={() => setOpen(false)}
        />
      )}
    </>
  );
}
