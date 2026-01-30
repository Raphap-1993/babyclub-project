"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ClientAuthGate } from "@/components/ClientAuthGate";
import { LogoutButton } from "@/components/LogoutButton";
import { supabaseClient } from "@/lib/supabaseClient";
import { authedFetch } from "@/lib/authedFetch";
import EditUserModal from "@/app/admin/users/EditUserModal";
import type { Role, StaffUser } from "@/app/admin/users/types";
import type { User } from "@supabase/supabase-js";
import { isDoorRole } from "@/lib/roles";

const MENU = {
  OPERACIONES: [
    { label: "Eventos", href: "/admin/events" },
    { label: "Mesas", href: "/admin/tables" },
    { label: "Reservas", href: "/admin/reservations" },
    { label: "Tickets / QR", href: "/admin/tickets" },
    { label: "Escanear QR", href: "/admin/scan" },
    { label: "Promotores", href: "/admin/promoters" },
    { label: "Productos de mesa", href: "/admin/table-products" },
    { label: "Gestión de códigos", href: "/admin/codes" },
  ],
  REPORTES: [
    { label: "Asistencia", href: "/admin/asistencia" },
    { label: "Ingresos", href: "/admin/ingresos" },
    { label: "Logs", href: "/admin/logs" },
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
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    OPERACIONES: true,
    REPORTES: false,
    "CONFIGURACIÓN": false,
  });
  const [userName, setUserName] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
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
    if (navOpen) setNavOpen(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  const resolvedLogo = logo || process.env.NEXT_PUBLIC_LOGO_URL || null;

  useEffect(() => {
    const fetchProfile = async () => {
      if (!supabaseClient) return;
      const { data } = await supabaseClient.auth.getSession();
      const sessionUser = data.session?.user;
      const authUserId = data.session?.user.id;
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
            "id,is_active,created_at,auth_user_id,person:persons(id,dni,first_name,last_name,email,phone),role:staff_roles(id,code,name)",
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
        // Redirigir inmediatamente si es rol puerta
        const staffRole = Array.isArray(staff?.role) ? staff?.role?.[0] : (staff as any)?.role;
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

  }, []);

  useEffect(() => {
    const roleText = userRole || initialRole || "";
    const doorRole = isDoorRole(roleText);
    if (roleResolved && doorRole && pathname && pathname !== DOOR_LANDING && pathname !== "/admin/door") {
      router.replace(DOOR_LANDING);
    }
  }, [userRole, initialRole, roleResolved, pathname, router]);

  const toggleGroup = (group: string) => {
    setOpenGroups((prev) => ({ ...prev, [group]: !prev[group] }));
  };

  const isActive = (href: string) => {
    if (!pathname) return false;
    if (href === "/admin" && pathname === "/admin") return true;
    return pathname.startsWith(href) && href !== "/admin";
  };

  const roleText = userRole || initialRole || "";
  const isDoorUser = isDoorRole(roleText);
  const isDoorRoute = Boolean(pathname && (pathname.startsWith(DOOR_LANDING) || pathname.startsWith("/admin/door")));
  const isDoor = isDoorUser && isDoorRoute;
  const displayName = userName || nameFromEmail(userEmail) || "Cuenta";
  const accountLabel = userRole ? `${displayName} (${userRole})` : displayName;

  if (profileLoading || !roleResolved) {
    return (
      <ClientAuthGate>
        <div className="flex min-h-screen items-center justify-center bg-[#050505] text-white">
          <p className="rounded-xl border border-white/10 bg-[#0b0b0b] px-4 py-3 text-sm text-white/70">Cargando sesión...</p>
        </div>
      </ClientAuthGate>
    );
  }

  const renderSidebar = (onNavigate?: () => void) => {
    if (isDoor) {
      return (
        <div className="flex h-full max-h-[calc(100vh-2rem)] flex-col gap-6 overflow-y-auto rounded-3xl border border-white/10 bg-[#0b0b0b] p-6 pr-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex h-12 items-center">
              {resolvedLogo ? (
                <img src={resolvedLogo} alt="BABY" className="h-12 w-auto object-contain" />
              ) : (
                <span className="text-lg font-black tracking-[0.2em]">BABY Admin Suite</span>
              )}
            </div>
          </div>
          <nav className="space-y-4 text-sm font-semibold text-white/70">
            <Link
              href={DOOR_LANDING}
              onClick={onNavigate}
              className={`flex items-center justify-between rounded-2xl border px-3 py-2 text-white transition ${
                isActive(DOOR_LANDING)
                  ? "border-[#e91e63]/60 bg-[#e91e63]/15"
                  : "border-white/5 bg-white/[0.04] hover:border-[#e91e63]/60 hover:bg-[#e91e63]/10"
              }`}
            >
              <span className="flex items-center gap-2">
                <span className="text-base font-semibold">▶</span>
                Escanear QR
              </span>
              <span className="text-xs text-white/50">→</span>
            </Link>
            <div className="pt-2">
              <LogoutButton />
            </div>
          </nav>
        </div>
      );
    }

    return (
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
            className="rounded-full border border-white/15 px-3 py-2 text-xs text-white lg:hidden"
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
  };

  // Layout para usuarios de tipo DOOR: solo escáner, sin menú extra
  if (isDoorUser && !isDoorRoute) {
    // Evita parpadeo del dashboard mientras redirecciona
    return (
      <ClientAuthGate>
        <div className="flex min-h-screen items-center justify-center bg-[#050505] text-white">
          <p className="rounded-xl border border-white/10 bg-[#0b0b0b] px-4 py-3 text-sm text-white/70">
            Redirigiendo al escáner...
          </p>
        </div>
      </ClientAuthGate>
    );
  }

  if (isDoor) {
    return (
      <ClientAuthGate>
        <div className="min-h-screen bg-[#050505] text-white">
          <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
            <Link href={DOOR_LANDING} className="flex items-center gap-2 text-white/80">
              <div className="flex h-10 items-center">
                {resolvedLogo ? (
                  <img src={resolvedLogo} alt="BABY" className="h-10 w-auto object-contain" />
                ) : (
                  <span className="text-lg font-semibold">BABY</span>
                )}
              </div>
            </Link>
            <div className="relative min-w-0">
              <button
                onClick={() => setProfileOpen((v) => !v)}
                className="max-w-[72vw] truncate rounded-full border border-white/15 px-3 py-2 text-left text-sm font-semibold text-white transition hover:border-white sm:text-center sm:max-w-xs"
              >
                {accountLabel}
              </button>
              {profileOpen && (
                <div className="absolute right-0 mt-2 w-48 rounded-2xl border border-white/10 bg-[#0c0c0c] p-3 text-sm text-white shadow-lg">
                  {userName && <p className="font-semibold">{userName}</p>}
                  {userEmail && <p className="text-xs text-white/60">{userEmail}</p>}
                  <button
                    onClick={() => {
                      setProfileOpen(false);
                      setProfileModal(true);
                    }}
                    className="mt-2 w-full rounded-xl border border-white/15 px-3 py-2 text-left text-white hover:border-white"
                  >
                    Perfil
                  </button>
                  <div className="mt-2">
                    <LogoutButton />
                  </div>
                </div>
              )}
            </div>
          </header>

          <main className="mx-auto max-w-5xl p-4 lg:p-8">
            <div className="rounded-3xl border border-white/10 bg-[#0b0b0b] p-4 lg:p-6">{children}</div>
          </main>

          <EditUserModal
            open={profileModal}
            onClose={() => setProfileModal(false)}
            user={userStaff}
            roles={roles}
            onSaved={() => {
              // refrescar para traer datos actualizados
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
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-4 xl:flex-row xl:gap-6 xl:px-6 xl:py-6">
          <aside className="hidden w-[250px] xl:block">{renderSidebar()}</aside>

          <main className="flex-1 space-y-4 min-w-0">
            <header className="flex min-w-0 flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-[#0b0b0b] px-4 py-3">
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

              <div className="flex min-w-0 items-center gap-3">
                <div className="relative min-w-0">
                  <button
                    onClick={() => setProfileOpen((v) => !v)}
                    className="max-w-[70vw] truncate rounded-full border border-white/15 px-3 py-2 text-left text-sm font-semibold text-white transition hover:border-white sm:text-center sm:max-w-xs"
                  >
                    {accountLabel}
                  </button>
                  {profileOpen && (
                    <div className="absolute right-0 mt-2 w-48 rounded-2xl border border-white/10 bg-[#0c0c0c] p-3 text-sm text-white shadow-lg">
                      {userName && <p className="font-semibold">{userName}</p>}
                      {userEmail && <p className="text-xs text-white/60">{userEmail}</p>}
                      <button
                        onClick={() => {
                          setProfileOpen(false);
                          setProfileModal(true);
                        }}
                        className="mt-2 w-full rounded-xl border border-white/15 px-3 py-2 text-left text-white hover:border-white"
                      >
                        Perfil
                      </button>
                      <div className="mt-2">
                        <LogoutButton />
                      </div>
                    </div>
                  )}
                </div>
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

      <EditUserModal
        open={profileModal}
        onClose={() => setProfileModal(false)}
        user={userStaff}
        roles={roles}
        onSaved={() => {
          // refrescar para traer datos actualizados
          window.location.reload();
        }}
      />
    </ClientAuthGate>
  );
}
