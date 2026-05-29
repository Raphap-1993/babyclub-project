"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabaseClient } from "@/lib/supabaseClient";

const navLinks = [
  { href: "/admin", label: "Inicio" },
  { href: "/admin/events", label: "Eventos" },
  { href: "/admin/promoters", label: "Promotores" },
  { href: "/admin/reservations", label: "Reservas" },
  { href: "/admin/reportes", label: "Reportes" },
  { href: "/admin/scan", label: "Escaneo QR" },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [loading, setLoading] = useState(true);

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

    ensureSession().catch(() => {
      router.replace("/auth/login");
    });
  }, [router]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black text-white">
        <p className="rounded-lg border border-white/10 bg-[#0b0b0b] px-4 py-3 text-sm">
          Cargando sesión...
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <header className="sticky top-0 z-40 border-b border-neutral-800 bg-neutral-950/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-rose-300/70">BabyClub Access</p>
            <h1 className="text-sm font-semibold text-white">Backoffice administrativo</h1>
          </div>
          <nav className="flex flex-wrap gap-2">
            {navLinks.map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`rounded-full border px-3 py-1.5 text-xs transition ${
                    active
                      ? "border-rose-500/40 bg-rose-500/15 text-rose-100"
                      : "border-neutral-800 bg-neutral-900/80 text-neutral-300 hover:border-neutral-700 hover:text-white"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-7xl px-4 py-4 sm:px-6 lg:px-8">{children}</main>
    </div>
  );
}
