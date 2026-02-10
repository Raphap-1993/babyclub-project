"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  CalendarDays,
  ClipboardList,
  FileText,
  Home,
  KeyRound,
  Package2,
  QrCode,
  ScanLine,
  Settings2,
  Shield,
  Table2,
  Ticket,
  UserCog,
  Users,
  Wallet,
  PlugZap,
  ChevronRight,
  ChevronDown,
  Menu,
  X,
} from "lucide-react";
import { ClientAuthGate } from "@/components/ClientAuthGate";
import { LogoutButton } from "@/components/LogoutButton";
import { supabaseClient } from "@/lib/supabaseClient";
import { authedFetch } from "@/lib/authedFetch";
import EditUserModal from "@/app/admin/users/EditUserModal";
import type { Role, StaffUser } from "@/app/admin/users/types";
import { isDoorRole } from "@/lib/roles";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type MenuItem = {
  label: string;
  href: string;
  icon: LucideIcon;
};

const MENU: Record<string, MenuItem[]> = {
  OPERACIONES: [
    { label: "Eventos", href: "/admin/events", icon: CalendarDays },
    { label: "Mesas", href: "/admin/tables", icon: Table2 },
    { label: "Reservas", href: "/admin/reservations", icon: ClipboardList },
    { label: "Tickets / QR", href: "/admin/tickets", icon: Ticket },
    { label: "Escanear QR", href: "/admin/scan", icon: ScanLine },
    { label: "Promotores", href: "/admin/promoters", icon: Users },
    { label: "Productos de mesa", href: "/admin/table-products", icon: Package2 },
    { label: "Gestión de códigos", href: "/admin/codes", icon: KeyRound },
  ],
  REPORTES: [
    { label: "Asistencia", href: "/admin/asistencia", icon: BarChart3 },
    { label: "Ingresos", href: "/admin/ingresos", icon: Wallet },
    { label: "Logs", href: "/admin/logs", icon: FileText },
    { label: "Promotores", href: "/admin/reportes/promotores", icon: Users },
    { label: "Mesas", href: "/admin/reportes/mesas", icon: Table2 },
  ],
  CONFIGURACIÓN: [
    { label: "General", href: "/admin/branding", icon: Settings2 },
    { label: "Usuarios y Roles", href: "/admin/users", icon: UserCog },
    { label: "Integraciones", href: "/admin/integraciones", icon: PlugZap },
    { label: "Seguridad", href: "/admin/seguridad", icon: Shield },
  ],
};

const DOOR_LANDING = "/admin/scan";

const joinName = (...parts: Array<string | null | undefined>) => {
  return parts
    .map((part) => (typeof part === "string" ? part.trim() : ""))
    .filter(Boolean)
    .join(" ")
    .trim();
};

const nameFromEmail = (email?: string | null) => {
  if (!email) return null;
  const [local] = email.split("@");
  if (!local) return null;
  const cleaned = local.replace(/[._-]+/g, " ").trim();
  if (!cleaned) return null;
  return cleaned
    .split(" ")
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
};

const getPreferredSessionName = (user?: User | null) => {
  if (!user) return null;
  const meta = (user.user_metadata || {}) as Record<string, any>;
  const appMeta = (user.app_metadata || {}) as Record<string, any>;

  const candidates = [
    joinName(meta.full_name),
    joinName(meta.fullName),
    joinName(meta.name),
    joinName(meta.first_name, meta.last_name),
    joinName(appMeta.full_name),
    joinName(appMeta.name),
    joinName(appMeta.first_name, appMeta.last_name),
    typeof meta.user_name === "string" ? meta.user_name.trim() : null,
    typeof meta.username === "string" ? meta.username.trim() : null,
  ];

  const found = candidates.find((value) => !!value);
  return (found as string | undefined) || nameFromEmail(user.email) || null;
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  const [logo, setLogo] = useState<string | null>(process.env.NEXT_PUBLIC_LOGO_URL || null);
  const [navOpen, setNavOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement | null>(null);

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    OPERACIONES: true,
    REPORTES: false,
    CONFIGURACIÓN: false,
  });

  const [userName, setUserName] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [profileModal, setProfileModal] = useState(false);
  const [userStaff, setUserStaff] = useState<StaffUser | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);

  const [profileLoading, setProfileLoading] = useState(true);
  const [initialRole, setInitialRole] = useState<string | null>(null);
  const [roleResolved, setRoleResolved] = useState(false);

  useEffect(() => {
    authedFetch("/api/branding")
      .then((res) => res.json())
      .then((data) => {
        if (data?.logo_url) setLogo(data.logo_url);
      })
      .catch(() => null);
  }, []);

  useEffect(() => {
    setNavOpen(false);
    setProfileOpen(false);
  }, [pathname]);

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      if (!profileRef.current) return;
      if (!profileRef.current.contains(event.target as Node)) {
        setProfileOpen(false);
      }
    };

    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setProfileOpen(false);
    };

    if (profileOpen) {
      document.addEventListener("mousedown", onPointerDown);
      document.addEventListener("keydown", onEscape);
    }

    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onEscape);
    };
  }, [profileOpen]);

  const resolvedLogo = logo || process.env.NEXT_PUBLIC_LOGO_URL || null;

  useEffect(() => {
    const fetchProfile = async () => {
      if (!supabaseClient) return;

      const { data } = await supabaseClient.auth.getSession();
      const sessionUser = data.session?.user;
      const authUserId = sessionUser?.id;
      const sessionEmail = sessionUser?.email || null;
      const sessionMetaRole =
        (sessionUser?.user_metadata?.role as string | undefined) ||
        (sessionUser?.app_metadata?.role as string | undefined) ||
        (sessionUser?.app_metadata?.user_role as string | undefined) ||
        null;

      const sessionName = getPreferredSessionName(sessionUser);
      setInitialRole(sessionMetaRole);

      if (!authUserId) return;

      try {
        const { data: staff } = await supabaseClient
          .from("staff")
          .select(
            "id,is_active,created_at,auth_user_id,person:persons(id,dni,first_name,last_name,email,phone),role:staff_roles(id,code,name)"
          )
          .eq("auth_user_id", authUserId)
          .maybeSingle();

        if (staff) {
          const person = Array.isArray(staff.person) ? staff.person[0] : staff.person;
          const role = Array.isArray(staff.role) ? staff.role[0] : staff.role;
          const personName = joinName(person?.first_name, person?.last_name);

          setUserName(personName || sessionName || nameFromEmail(sessionEmail) || null);
          setUserRole(role?.code || sessionMetaRole || null);
          setUserEmail(person?.email || sessionEmail || null);

          setUserStaff({
            id: staff.id,
            is_active: staff.is_active,
            created_at: staff.created_at,
            auth_user_id: staff.auth_user_id,
            role,
            person,
          });
        } else {
          setUserEmail(sessionEmail);
          setUserName(sessionName || nameFromEmail(sessionEmail) || null);
          setUserRole(sessionMetaRole || null);
        }

        const staffRole = Array.isArray((staff as any)?.role) ? (staff as any)?.role?.[0] : (staff as any)?.role;
        const roleText = sessionMetaRole || staffRole?.code || "";
        if (isDoorRole(roleText) && pathname !== DOOR_LANDING && pathname !== "/admin/door") {
          router.replace(DOOR_LANDING);
        }
      } catch (_err) {
        setUserEmail(sessionEmail);
        setUserName(sessionName || nameFromEmail(sessionEmail) || null);
        setUserRole(sessionMetaRole || null);
      } finally {
        setRoleResolved(true);
      }
    };

    fetchProfile().finally(() => setProfileLoading(false));

    authedFetch("/api/admin/users/roles")
      .then((res) => res.json())
      .then((payload) => {
        if (payload?.success) setRoles(payload.data || []);
      })
      .catch(() => null);
  }, [pathname, router]);

  useEffect(() => {
    const roleText = userRole || initialRole || "";
    const doorRole = isDoorRole(roleText);
    if (roleResolved && doorRole && pathname && pathname !== DOOR_LANDING && pathname !== "/admin/door") {
      router.replace(DOOR_LANDING);
    }
  }, [userRole, initialRole, roleResolved, pathname, router]);

  const isActive = (href: string) => {
    if (!pathname) return false;
    if (href === "/admin" && pathname === "/admin") return true;
    return href !== "/admin" && pathname.startsWith(href);
  };

  const toggleGroup = (group: string) => {
    setOpenGroups((prev) => ({ ...prev, [group]: !prev[group] }));
  };

  const roleText = userRole || initialRole || "";
  const isDoorUser = isDoorRole(roleText);
  const isDoorRoute = Boolean(pathname && (pathname.startsWith(DOOR_LANDING) || pathname.startsWith("/admin/door")));
  const isDoor = isDoorUser && isDoorRoute;

  const displayName = userName || nameFromEmail(userEmail) || "Cuenta";
  const accountLabel = userRole ? `${displayName} (${userRole})` : displayName;

  const sectionTitle = useMemo(() => {
    if (!pathname || pathname === "/admin") return "Inicio";
    for (const group of Object.values(MENU)) {
      const match = group.find((item) => pathname.startsWith(item.href));
      if (match) return match.label;
    }
    return "Panel";
  }, [pathname]);

  if (profileLoading || !roleResolved) {
    return (
      <ClientAuthGate>
        <div className="flex min-h-screen items-center justify-center bg-[#050505] text-white">
          <p className="rounded-xl border border-[#2a2a2a] bg-[#121212] px-4 py-3 text-sm text-white/70">Cargando sesión...</p>
        </div>
      </ClientAuthGate>
    );
  }

  const renderProfile = () => {
    return (
      <div ref={profileRef} className="relative min-w-0">
        <button
          onClick={() => setProfileOpen((value) => !value)}
          className="max-w-[72vw] truncate rounded-full border border-[#2b2b2b] bg-[#151515] px-3 py-2 text-left text-sm font-semibold text-white/90 transition hover:border-[#3a3a3a] hover:bg-[#1c1c1c] sm:max-w-xs sm:text-center"
        >
          {accountLabel}
        </button>
        {profileOpen && (
          <div className="absolute right-0 z-[80] mt-2 w-60 rounded-2xl border border-[#2b2b2b] bg-[#121212] p-3 text-sm text-white shadow-[0_20px_60px_rgba(0,0,0,0.55)]">
            {userName && <p className="truncate font-semibold">{userName}</p>}
            {userEmail && <p className="truncate text-xs text-white/60">{userEmail}</p>}
            <button
              onClick={() => {
                setProfileOpen(false);
                setProfileModal(true);
              }}
              className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "mt-3 w-full justify-start")}
            >
              Perfil
            </button>
            <div className="mt-3 border-t border-[#252525] pt-3">
              <LogoutButton />
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderSidebar = (onNavigate?: () => void) => {
    if (isDoor) {
      return (
        <div className="flex h-full flex-col gap-4 rounded-3xl border border-[#252525] bg-[#111111] p-5">
          <div className="flex items-center gap-3">
            {resolvedLogo ? (
              <img src={resolvedLogo} alt="BABY" className="h-10 w-auto object-contain" />
            ) : (
              <span className="text-lg font-extrabold tracking-[0.1em]">BABY Admin</span>
            )}
          </div>
          <nav className="space-y-2">
            <Link
              href={DOOR_LANDING}
              onClick={onNavigate}
              className={cn(
                "group flex items-center justify-between rounded-2xl border px-3 py-2 text-sm text-white transition-all duration-200 ease-out hover:-translate-y-[1px] hover:translate-x-[2px]",
                isActive(DOOR_LANDING)
                  ? "border-[#7a1b33] bg-[#2a1118] text-[#ffe0e7]"
                  : "border-[#232323] bg-[#141414] text-white/82 hover:border-[#a60c2f]/35 hover:bg-[#1c1315] hover:text-[#ffe9ee]"
              )}
            >
              <span className="inline-flex items-center gap-2 font-semibold">
                <QrCode className="h-4 w-4" />
                Escanear QR
              </span>
              <ChevronRight className={cn("h-4 w-4 transition-colors group-hover:text-[#ff9fb1]", isActive(DOOR_LANDING) ? "text-[#ff93ab]" : "text-white/45")} />
            </Link>
          </nav>
          <div className="mt-auto">
            <LogoutButton />
          </div>
        </div>
      );
    }

    return (
      <div className="flex h-full max-h-[calc(100vh-2rem)] flex-col gap-4 overflow-y-auto rounded-3xl border border-[#252525] bg-[#111111] p-5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            {resolvedLogo ? (
              <img src={resolvedLogo} alt="BABY" className="h-10 w-auto object-contain" />
            ) : (
              <span className="text-lg font-extrabold tracking-[0.1em]">BABY Admin Suite</span>
            )}
          </div>
          <button
            className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "xl:hidden")}
            onClick={() => setNavOpen(false)}
            aria-label="Cerrar menú"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <nav className="space-y-3 text-sm">
          <Link
            href="/admin"
            onClick={onNavigate}
            className={cn(
              "group flex items-center justify-between rounded-2xl border px-3 py-2.5 transition-all duration-200 ease-out hover:-translate-y-[1px] hover:translate-x-[2px]",
              isActive("/admin")
                ? "border-[#7a1b33] bg-[#2a1118] text-[#ffe0e7]"
                : "border-[#232323] bg-[#141414] text-white/82 hover:border-[#a60c2f]/35 hover:bg-[#1c1315] hover:text-[#ffe9ee]"
            )}
          >
            <span className={cn("inline-flex items-center gap-2 font-semibold", isActive("/admin") ? "text-[#ffe0e7]" : "")}>
              <Home className="h-4 w-4" />
              Inicio
            </span>
            <ChevronRight className={cn("h-4 w-4 transition-colors group-hover:text-[#ff9fb1]", isActive("/admin") ? "text-[#ff93ab]" : "text-white/45")} />
          </Link>

          {Object.entries(MENU).map(([group, items]) => {
            const opened = openGroups[group];
            return (
              <div key={group} className="space-y-2 rounded-2xl border border-[#232323] bg-[#101010] p-2.5">
                <button
                  type="button"
                  onClick={() => toggleGroup(group)}
                  className="flex w-full items-center justify-between rounded-xl px-2 py-1 text-left text-[11px] font-semibold uppercase tracking-[0.14em] text-white/52 transition hover:text-white/82"
                >
                  <span>{group}</span>
                  {opened ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                </button>
                {opened && (
                  <div className="space-y-1.5">
                    {items.map((item) => {
                      const Icon = item.icon;
                      const active = isActive(item.href);
                      return (
                        <Link
                          key={item.label}
                          href={item.href}
                          onClick={onNavigate}
                          className={cn(
                            "group flex items-center justify-between rounded-xl border px-3 py-2 transition-all duration-200 ease-out hover:-translate-y-[1px] hover:translate-x-[2px]",
                            active
                              ? "border-[#7a1b33] bg-[#2a1118] text-[#ffe0e7]"
                              : "border-[#232323] bg-[#141414] text-white/80 hover:border-[#a60c2f]/35 hover:bg-[#1c1315] hover:text-[#ffe9ee]"
                          )}
                        >
                          <span className={cn("inline-flex items-center gap-2", active ? "text-[#ffe0e7]" : "")}>
                            <Icon className="h-4 w-4" />
                            {item.label}
                          </span>
                          <ChevronRight className={cn("h-4 w-4 transition-colors group-hover:text-[#ff9fb1]", active ? "text-[#ff93ab]" : "text-white/40")} />
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        <div className="mt-auto border-t border-[#252525] pt-4">
          <LogoutButton />
        </div>
      </div>
    );
  };

  if (isDoorUser && !isDoorRoute) {
    return (
      <ClientAuthGate>
        <div className="flex min-h-screen items-center justify-center bg-[#050505] text-white">
          <p className="rounded-xl border border-[#2a2a2a] bg-[#121212] px-4 py-3 text-sm text-white/70">Redirigiendo al escáner...</p>
        </div>
      </ClientAuthGate>
    );
  }

  if (isDoor) {
    return (
      <ClientAuthGate>
        <div className="min-h-screen bg-[#050505] text-white">
          <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(circle_at_10%_0%,rgba(166,12,47,0.05),transparent_25%),radial-gradient(circle_at_85%_0%,rgba(255,255,255,0.02),transparent_28%)]" />
          <header className="relative z-20 border-b border-[#252525] px-4 py-3">
            <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
              <Link href={DOOR_LANDING} className="inline-flex items-center gap-2 text-white/85">
                {resolvedLogo ? (
                  <img src={resolvedLogo} alt="BABY" className="h-10 w-auto object-contain" />
                ) : (
                  <span className="text-lg font-semibold">BABY</span>
                )}
              </Link>
              {renderProfile()}
            </div>
          </header>

          <main className="mx-auto max-w-6xl px-4 py-5 lg:px-6">{children}</main>

          <EditUserModal
            open={profileModal}
            onClose={() => setProfileModal(false)}
            user={userStaff}
            roles={roles}
            onSaved={() => {
              window.location.reload();
            }}
          />
        </div>
      </ClientAuthGate>
    );
  }

  return (
    <ClientAuthGate>
      <div className="min-h-screen bg-[#050505] text-white">
        <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(circle_at_12%_0%,rgba(166,12,47,0.05),transparent_26%),radial-gradient(circle_at_88%_0%,rgba(255,255,255,0.02),transparent_24%),radial-gradient(circle_at_50%_100%,rgba(255,255,255,0.02),transparent_35%)]" />

        <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-4 px-4 py-4 xl:flex-row xl:gap-6 xl:px-6 xl:py-6">
          <aside className="hidden w-[280px] shrink-0 xl:sticky xl:top-4 xl:block xl:h-[calc(100vh-2rem)]">{renderSidebar()}</aside>

          <main className="min-w-0 flex-1">
            <header className="sticky top-0 z-30 flex min-w-0 flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#252525] bg-[#111111] px-4 py-3">
              <div className="flex min-w-0 items-center gap-3">
                <button
                  className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "xl:hidden")}
                  onClick={() => setNavOpen(true)}
                  aria-label="Abrir menú"
                >
                  <Menu className="h-4 w-4" />
                </button>

                <Link href="/admin" className="group inline-flex items-center gap-3 text-white/85">
                  {resolvedLogo ? (
                    <img src={resolvedLogo} alt="BABY" className="h-9 w-auto object-contain transition group-hover:opacity-90" />
                  ) : (
                    <span className="text-lg font-semibold">BABY</span>
                  )}
                </Link>

                <div className="hidden min-w-0 md:block">
                  <p className="truncate text-[11px] uppercase tracking-[0.14em] text-white/40">Panel</p>
                  <p className="truncate text-sm font-semibold text-white/78">{sectionTitle}</p>
                </div>
              </div>

              {renderProfile()}
            </header>

            <div className="bc-page-transition min-w-0">{children}</div>
          </main>
        </div>

        {navOpen && (
          <div className="fixed inset-0 z-[70] bg-black/65 xl:hidden" onClick={() => setNavOpen(false)}>
            <div
              className="absolute left-3 top-4 h-[calc(100vh-2rem)] w-[86%] max-w-[340px]"
              onClick={(event) => event.stopPropagation()}
            >
              {renderSidebar(() => setNavOpen(false))}
            </div>
          </div>
        )}
      </div>

      <EditUserModal
        open={profileModal}
        onClose={() => setProfileModal(false)}
        user={userStaff}
        roles={roles}
        onSaved={() => {
          window.location.reload();
        }}
      />
    </ClientAuthGate>
  );
}
