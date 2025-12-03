"use client";

import { ReactNode, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseClient } from "@/lib/supabaseClient";

export function AuthGuard({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let mounted = true;
    const verify = async () => {
      if (!supabaseClient) {
        router.replace("/auth/login");
        if (mounted) setChecking(false);
        return;
      }
      const { data } = await supabaseClient.auth.getSession();
      if (!data.session) {
        router.replace("/auth/login");
        if (mounted) setChecking(false);
        return;
      }
      if (mounted) setChecking(false);
    };
    verify();
    const { data: listener } = supabaseClient?.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        router.replace("/auth/login");
      }
    }) || { data: null };
    return () => {
      mounted = false;
      listener?.subscription?.unsubscribe();
    };
  }, [router]);

  if (checking) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-black text-white">
        <p className="text-sm text-white/70">Validando sesión...</p>
      </main>
    );
  }

  return <>{children}</>;
}
