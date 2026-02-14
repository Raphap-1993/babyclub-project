"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Calendar,
  BookOpen,
  ChevronDown,
  QrCode,
  UserRound,
  Ticket,
  Users,
  Settings,
  Menu,
  X,
  Building2,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useState, useEffect } from "react";
import { LogoutButton } from "@/components/LogoutButton";

type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  children?: Array<{ label: string; href: string }>;
};

const menuItems = [
  {
    section: "DASHBOARD",
    items: [
      { label: "Inicio", href: "/admin", icon: BarChart3 },
    ],
  },
  {
    section: "OPERACIONES",
    items: [
      { label: "Organizadores", href: "/admin/organizers", icon: Building2 },
      { label: "Eventos", href: "/admin/events", icon: Calendar },
      {
        label: "Promotores",
        href: "/admin/promoters",
        icon: UserRound,
        children: [{ label: "Códigos/Lotes", href: "/admin/codes" }],
      },
      { label: "Reservas", href: "/admin/reservations", icon: BookOpen },
      { label: "Tickets/QR", href: "/admin/tickets", icon: QrCode },
    ] as NavItem[],
  },
  {
    section: "REPORTES",
    items: [
      { label: "Asistencia", href: "/admin/asistencia", icon: BarChart3 },
      { label: "Ingresos", href: "/admin/ingresos", icon: BarChart3 },
    ],
  },
  {
    section: "CONFIGURACIÓN",
    items: [
      { label: "Usuarios", href: "/admin/users", icon: Users },
      { label: "Seguridad", href: "/admin/seguridad", icon: Settings },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [expandedParents, setExpandedParents] = useState<Record<string, boolean>>({});
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>(
    () => Object.fromEntries(menuItems.map((section) => [section.section, true]))
  );

  useEffect(() => {
    fetch("/api/branding")
      .then((res) => res.json())
      .then((data) => {
        if (data?.logo_url) setLogoUrl(data.logo_url);
      })
      .catch(() => null);
  }, []);

  const isActive = (href: string) => {
    if (href === "/admin") return pathname === href;
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  useEffect(() => {
    setExpandedParents((prev) => {
      const next = { ...prev };
      let changed = false;

      menuItems.forEach((section) => {
        section.items.forEach((item: NavItem) => {
          if (!item.children?.length) return;
          const hasActiveChild = item.children.some((child) => isActive(child.href));
          if ((isActive(item.href) || hasActiveChild) && !next[item.href]) {
            next[item.href] = true;
            changed = true;
          }
        });
      });

      return changed ? next : prev;
    });
  }, [pathname]);

  useEffect(() => {
    setExpandedSections((prev) => {
      const next = { ...prev };
      let changed = false;

      menuItems.forEach((section) => {
        const hasActiveItem = section.items.some((item: NavItem) => {
          const hasActiveChild = item.children?.some((child) => isActive(child.href)) ?? false;
          return isActive(item.href) || hasActiveChild;
        });

        if (hasActiveItem && !next[section.section]) {
          next[section.section] = true;
          changed = true;
        }
      });

      return changed ? next : prev;
    });
  }, [pathname]);

  const toggleParent = (href: string) => {
    setExpandedParents((prev) => ({ ...prev, [href]: !prev[href] }));
  };

  const toggleSection = (sectionName: string) => {
    setExpandedSections((prev) => ({ ...prev, [sectionName]: !prev[sectionName] }));
  };

  return (
    <>
      {/* Mobile Toggle */}
      <button
        onClick={() => setOpen(!open)}
        className="fixed right-4 top-4 z-50 rounded-lg bg-neutral-800 p-2 md:hidden"
      >
        {open ? <X size={20} /> : <Menu size={20} />}
      </button>

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 transform flex-col border-r border-neutral-700 bg-gradient-to-b from-neutral-950 to-neutral-900 transition-transform duration-300 ${
          open ? "translate-x-0" : "-translate-x-full"
        } md:translate-x-0`}
      >
        {/* Header */}
        <div className="flex items-center justify-center border-b border-neutral-700 px-6 py-4">
          {logoUrl ? (
            <img 
              src={logoUrl} 
              alt="Baby Logo" 
              className="w-full max-w-[180px] h-auto object-contain"
            />
          ) : (
            <div className="flex items-center gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-rose-400 to-rose-600">
                <span className="font-bold text-white">BC</span>
              </div>
              <div className="flex flex-col">
                <h1 className="font-bold text-white">BabyClub</h1>
                <p className="text-xs text-neutral-400">Access</p>
              </div>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-6 overflow-y-auto px-4 py-6">
          {menuItems.map((section) => (
            <div key={section.section}>
              <button
                type="button"
                onClick={() => toggleSection(section.section)}
                aria-expanded={expandedSections[section.section] ?? true}
                className="mb-2 flex w-full items-center justify-between rounded-md px-2 py-1 text-left text-xs font-semibold uppercase tracking-wider text-neutral-500 transition-colors hover:bg-neutral-800/60 hover:text-neutral-300"
              >
                <span>{section.section}</span>
                <ChevronDown
                  size={13}
                  className={`transition-transform duration-200 ${(expandedSections[section.section] ?? true) ? "rotate-180" : ""}`}
                />
              </button>

              <div
                className={`space-y-1 overflow-hidden transition-all duration-200 ${
                  expandedSections[section.section] ?? true ? "max-h-[700px] opacity-100" : "max-h-0 opacity-0"
                }`}
              >
                {section.items.map((item) => {
                  const Icon = item.icon;
                  const active = isActive(item.href);
                  const hasChildren = !!item.children?.length;
                  const children = item.children ?? [];
                  const hasActiveChild = hasChildren ? children.some((child) => isActive(child.href)) : false;
                  const rowActive = active || hasActiveChild;
                  const isExpanded = expandedParents[item.href] ?? false;

                  return (
                    <div key={item.href}>
                      <div
                        className={`flex items-center gap-1 rounded-lg px-1 transition-colors ${
                          rowActive
                            ? "bg-gradient-to-r from-rose-500/20 to-rose-600/20 text-rose-400"
                            : "text-neutral-300 hover:bg-neutral-800"
                        }`}
                      >
                        <Link
                          href={item.href}
                          onClick={() => setOpen(false)}
                          className="flex min-w-0 flex-1 items-center gap-3 rounded-lg px-2 py-2.5 text-sm font-medium"
                        >
                          <Icon size={18} />
                          <span className="truncate">{item.label}</span>
                        </Link>

                        {hasChildren ? (
                          <button
                            type="button"
                            aria-label={isExpanded ? "Contraer menú hijo" : "Expandir menú hijo"}
                            aria-expanded={isExpanded}
                            onClick={() => toggleParent(item.href)}
                            className="rounded-md p-1.5 text-neutral-300 transition hover:bg-neutral-700 hover:text-white"
                          >
                            <ChevronDown
                              size={14}
                              className={`transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}
                            />
                          </button>
                        ) : null}
                      </div>

                      {hasChildren ? (
                        <div
                          className={`ml-9 mt-1 overflow-hidden border-l border-neutral-800 pl-3 transition-all duration-200 ${
                            isExpanded ? "max-h-40 opacity-100" : "max-h-0 opacity-0"
                          }`}
                        >
                          <div className="space-y-1 py-1">
                          {children.map((child) => {
                            const childActive = isActive(child.href);
                            return (
                              <Link
                                key={child.href}
                                href={child.href}
                                onClick={() => setOpen(false)}
                                className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-xs font-medium transition-colors ${
                                  childActive
                                    ? "bg-rose-500/15 text-rose-300"
                                    : "text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200"
                                }`}
                              >
                                <Ticket size={13} />
                                <span>{child.label}</span>
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
        <div className="border-t border-neutral-700 p-4">
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
