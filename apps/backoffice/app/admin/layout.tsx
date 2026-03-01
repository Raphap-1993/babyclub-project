"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ClientAuthGate } from "@/components/ClientAuthGate";
import { supabaseClient } from "@/lib/supabaseClient";
import { authedFetch } from "@/lib/authedFetch";
import EditUserModal from "@/app/admin/users/EditUserModal";
import { Sidebar } from "@/components/dashboard";
import type { Role, StaffUser } from "@/app/admin/users/types";
import type { User } from "@supabase/supabase-js";
import { isDoorRole } from "@/lib/roles";

const DOOR_LANDING = "/admin/door";

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
  const [profileModal, setProfileModal] = useState(false);
  const [userStaff, setUserStaff] = useState<StaffUser | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [profileLoading, setProfileLoading] = useState(true);
  const [initialRole, setInitialRole] = useState<string | null>(null);
  const [roleResolved, setRoleResolved] = useState(false);

  useEffect(() => {
    const fetchProfile = async () => {
      if (!supabaseClient) return;
      const { data } = await supabaseClient.auth.getSession();
      const sessionUser = data.session?.user;
      const authUserId = data.session?.user.id;
      const sessionMetaRole =
        (sessionUser?.user_metadata?.role as string | undefined) ||
        (sessionUser?.app_metadata?.role as string | undefined) ||
        (sessionUser?.app_metadata?.user_role as string | undefined) ||
        null;
      setInitialRole(sessionMetaRole);

      if (!authUserId) {
        setRoleResolved(true);
        return;
      }

      try {
        const { data: staff } = await supabaseClient
          .from("staff")
          .select(
            "id,is_active,created_at,auth_user_id,person:persons(id,dni,first_name,last_name,email,phone),role:staff_roles(id,code,name)",
          )
          .eq("auth_user_id", authUserId)
          .maybeSingle();

        if (staff) {
          const role = Array.isArray(staff.role) ? staff.role[0] : staff.role;
          setUserStaff({
            id: staff.id,
            is_active: staff.is_active,
            created_at: staff.created_at,
            auth_user_id: staff.auth_user_id,
            role,
            person: Array.isArray(staff.person) ? staff.person[0] : staff.person,
          });
        }
      } catch (_err) {
        console.error("Error fetching profile:", _err);
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
  }, [router]);

  const staffRoleCode =
    (typeof userStaff?.role?.code === "string" ? userStaff.role.code : null) || initialRole || "";
  const isDoorSession = isDoorRole(staffRoleCode);
  const isDoorAllowedPath = pathname === DOOR_LANDING;

  useEffect(() => {
    if (!roleResolved) return;
    if (isDoorSession && !isDoorAllowedPath) {
      router.replace(DOOR_LANDING);
    }
  }, [isDoorAllowedPath, isDoorSession, roleResolved, router]);

  if (profileLoading || !roleResolved) {
    return (
      <ClientAuthGate>
        <div className="flex min-h-screen items-center justify-center bg-black text-white">
          <p className="rounded-lg border border-white/10 bg-[#0b0b0b] px-4 py-3 text-sm">
            Cargando sesión...
          </p>
        </div>
      </ClientAuthGate>
    );
  }

  if (isDoorSession && !isDoorAllowedPath) {
    return (
      <ClientAuthGate>
        <div className="flex min-h-screen items-center justify-center bg-black text-white">
          <p className="rounded-lg border border-white/10 bg-[#0b0b0b] px-4 py-3 text-sm">
            Redirigiendo al módulo de escaneo...
          </p>
        </div>
      </ClientAuthGate>
    );
  }

  return (
    <ClientAuthGate>
      <div className="flex min-h-screen bg-black text-white">
        {!isDoorSession ? <Sidebar /> : null}
        <main className={isDoorSession ? "flex-1" : "flex-1 md:ml-64"}>
          <div className={isDoorSession ? "p-2 md:p-4" : "p-4 md:p-8"}>
            {children}
          </div>
        </main>
      </div>
      {!isDoorSession ? (
        <EditUserModal
          open={profileModal}
          onClose={() => setProfileModal(false)}
          user={userStaff}
          roles={roles}
          onSaved={() => {
            window.location.reload();
          }}
        />
      ) : null}
    </ClientAuthGate>
  );
}
