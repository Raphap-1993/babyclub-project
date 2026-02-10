"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseClient } from "@/lib/supabaseClient";
import type { User } from "@supabase/supabase-js";
import { isDoorRole } from "@/lib/roles";

const getSessionRole = (user?: User | null) => {
  if (!user) return null;
  const meta = (user.user_metadata || {}) as Record<string, any>;
  const appMeta = (user.app_metadata || {}) as Record<string, any>;
  return (
    (meta.role as string | undefined) ||
    (appMeta.role as string | undefined) ||
    (appMeta.user_role as string | undefined) ||
    null
  );
};

const DOOR_LANDING = "/admin/scan";

const fetchStaffRoleCode = async (authUserId: string) => {
  if (!supabaseClient) return null;
  const { data, error } = await supabaseClient
    .from("staff")
    .select("role:staff_roles(code)")
    .eq("auth_user_id", authUserId)
    .maybeSingle();
  if (error || !data) return null;
  const roleRel = Array.isArray((data as any).role) ? (data as any).role[0] : (data as any).role;
  return typeof roleRel?.code === "string" ? roleRel.code : null;
};

const resolveDoorRedirect = async (sessionUser?: User | null) => {
  if (!sessionUser) return false;
  const sessionRole = getSessionRole(sessionUser);
  const staffRole = sessionUser.id ? await fetchStaffRoleCode(sessionUser.id) : null;
  const resolvedRole = staffRole || sessionRole;
  return isDoorRole(resolvedRole);
};

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  // Si ya hay sesión, redirigir al dashboard
  useEffect(() => {
    const checkSession = async () => {
      if (!supabaseClient) {
        setChecking(false);
        return;
      }
      try {
        const { data } = await supabaseClient.auth.getSession();
        if (data.session) {
          const shouldGoDoor = await resolveDoorRedirect(data.session.user);
          router.replace(shouldGoDoor ? DOOR_LANDING : "/admin");
          return;
        }
        // Cargar logo desde brand_settings
        const { data: brandData } = await supabaseClient
          .from("brand_settings")
          .select("logo_url")
          .eq("id", 1)
          .maybeSingle();
        if (brandData?.logo_url) {
          setLogoUrl(brandData.logo_url);
        }
      } catch (_err) {}
      setChecking(false);
    };
    checkSession();
  }, [router]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!supabaseClient) {
      setError("Supabase no está configurado");
      return;
    }
    setLoading(true);
    const { data: signInData, error: signInError } = await supabaseClient.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (signInError) {
      setError(signInError.message);
      return;
    }
    const sessionUser =
      signInData.session?.user || (await supabaseClient.auth.getSession()).data.session?.user || null;
    const shouldGoDoor = await resolveDoorRedirect(sessionUser);
    router.push(shouldGoDoor ? DOOR_LANDING : "/admin");
  };

  if (checking) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-black text-white">
        <p className="text-sm text-white/70">Validando sesión...</p>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-black px-6 py-12 text-white">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center space-y-2">
          <div className="flex justify-center">
            {logoUrl ? (
              <img
                src={logoUrl}
                alt="BABY"
                width={336}
                height={96}
                loading="eager"
                className="h-[68px] w-auto object-contain"
              />
            ) : (
              <span className="text-4xl font-black tracking-[0.2em]">BABY</span>
            )}
          </div>
          <h1 className="text-3xl font-semibold">Ingresar</h1>
          <p className="text-sm text-white/60">Accede al backoffice con tus credenciales.</p>
        </div>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-semibold">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full rounded-xl border border-[#292929] bg-[#111111] px-4 py-3 text-base text-white placeholder:text-white/40 focus:border-white focus:outline-none"
              placeholder="admin@baby.club"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-semibold">Contraseña</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full rounded-xl border border-[#292929] bg-[#111111] px-4 py-3 text-base text-white placeholder:text-white/40 focus:border-white focus:outline-none"
              placeholder="••••••••"
            />
          </div>
          {error && <p className="text-xs font-semibold text-[#fca5a5]">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-full bg-white px-4 py-3 text-center text-sm font-semibold uppercase tracking-wide text-black transition hover:scale-[1.01] disabled:opacity-70"
          >
            {loading ? "Ingresando..." : "Entrar"}
          </button>
        </form>
      </div>
    </main>
  );
}
