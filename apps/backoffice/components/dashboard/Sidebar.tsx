"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Calendar,
  Table2,
  BookOpen,
  QrCode,
  Users,
  Settings,
  LogOut,
  Menu,
  X,
  Building2,
} from "lucide-react";
import { useState, useEffect } from "react";
import { LogoutButton } from "@/components/LogoutButton";

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
      { label: "Reservas", href: "/admin/reservations", icon: BookOpen },
      { label: "Tickets/QR", href: "/admin/tickets", icon: QrCode },
    ],
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

  useEffect(() => {
    fetch("/api/branding")
      .then((res) => res.json())
      .then((data) => {
        if (data?.logo_url) setLogoUrl(data.logo_url);
      })
      .catch(() => null);
  }, []);

  const isActive = (href: string) => pathname === href;

  return (
    <>
      {/* Mobile Toggle */}
      <button
        onClick={() => setOpen(!open)}
        className="fixed right-4 top-4 z-50 rounded-lg bg-slate-800 p-2 md:hidden"
      >
        {open ? <X size={20} /> : <Menu size={20} />}
      </button>

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 transform flex-col border-r border-slate-700 bg-gradient-to-b from-slate-950 to-slate-900 transition-transform duration-300 ${
          open ? "translate-x-0" : "-translate-x-full"
        } md:translate-x-0`}
      >
        {/* Header */}
        <div className="flex items-center justify-center border-b border-slate-700 px-6 py-4">
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
                <p className="text-xs text-slate-400">Access</p>
              </div>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-6 overflow-y-auto px-4 py-6">
          {menuItems.map((section) => (
            <div key={section.section}>
              <p className="mb-3 px-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                {section.section}
              </p>
              <div className="space-y-1">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  const active = isActive(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setOpen(false)}
                      className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                        active
                          ? "bg-gradient-to-r from-rose-500/20 to-rose-600/20 text-rose-400"
                          : "text-slate-300 hover:bg-slate-800"
                      }`}
                    >
                      <Icon size={18} />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div className="border-t border-slate-700 p-4">
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
