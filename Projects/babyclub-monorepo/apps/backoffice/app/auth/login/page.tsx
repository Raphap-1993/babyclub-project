"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseClient } from "@/lib/supabaseClient";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  // Si ya hay sesión, redirigir al dashboard
  useEffect(() => {
    const checkSession = async () => {
      if (!supabaseClient) {
        setChecking(false);
        return;
      }
      const { data } = await supabaseClient.auth.getSession();
      if (data.session) {
        router.replace("/admin");
        return;
      }
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
    const { error: signInError } = await supabaseClient.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (signInError) {
      setError(signInError.message);
      return;
    }
    router.push("/admin");
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
            <span className="text-4xl font-black tracking-[0.2em]">BABY</span>
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
              className="w-full rounded-xl border border-white/10 bg-[#111111] px-4 py-3 text-base text-white placeholder:text-white/40 focus:border-white focus:outline-none"
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
              className="w-full rounded-xl border border-white/10 bg-[#111111] px-4 py-3 text-base text-white placeholder:text-white/40 focus:border-white focus:outline-none"
              placeholder="••••••••"
            />
          </div>
          {error && <p className="text-xs font-semibold text-[#ff9a9a]">{error}</p>}
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
