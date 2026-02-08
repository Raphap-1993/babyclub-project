"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function AccessCodeClient({ initialLogoUrl }: { initialLogoUrl: string | null }) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!code.trim()) {
      setError("Ingresa un código");
      return;
    }
    const value = code.trim();
    setLoading(true);
    try {
      const res = await fetch(`/api/manifiesto?code=${encodeURIComponent(value)}`, { method: "GET" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(
          data?.error ||
            "Tu código intenta seducir al sistema… pero no logra abrirle las puertas. No es válido."
        );
        return;
      }
      router.push(`/manifiesto?code=${encodeURIComponent(value)}`);
    } catch (err: any) {
      setError(err?.message || "Error validando el código");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center bg-black px-6 py-10 text-white">
      <div className="w-full max-w-md space-y-6 text-center">
        {initialLogoUrl ? (
          <div className="flex justify-center">
            <img
              src={initialLogoUrl}
              alt="BABY"
              width={336}
              height={96}
              loading="eager"
              fetchPriority="high"
              decoding="async"
              className="h-[80px] w-auto object-contain"
            />
          </div>
        ) : (
          <div className="text-6xl font-bold tracking-[0.4em]">BABY</div>
        )}

        <form onSubmit={onSubmit} className="space-y-4">
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-[#111111] px-4 py-3 text-base text-white placeholder:text-white/40 focus:border-white focus:outline-none"
            placeholder="Código de acceso"
            required
          />

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl px-4 py-3 text-center text-sm font-semibold uppercase tracking-wide btn-attention-red transition hover:scale-[1.01] disabled:opacity-70"
          >
            {loading ? "Validando..." : "Entrar"}
          </button>
          {error && <p className="text-xs font-semibold text-[#ff9a9a]">{error}</p>}
        </form>

        <div className="text-center text-sm text-white/70">
          ¿Sin código?{" "}
          <a href="/compra" className="font-semibold text-[#e91e63] underline-offset-4 hover:underline">
            Comprar tickets / reservar mesa
          </a>
        </div>
      </div>

      <footer className="pointer-events-none absolute bottom-6 text-xs font-semibold tracking-wide text-white/30">
        © 2025 BABYCLUB
      </footer>
    </main>
  );
}
