"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { KeyRound } from "lucide-react";
import { LegalFooterLinks } from "../legal/LegalFooterLinks";

function extractCodeInput(rawValue: string) {
  const value = rawValue.trim();
  if (!value) return "";

  try {
    const parsed = new URL(value);
    const code = parsed.searchParams.get("code");
    if (code?.trim()) return code.trim();
  } catch {
    // ignore non-url input
  }

  const queryMatch = value.match(/[?&]code=([^&]+)/i);
  if (queryMatch?.[1]) {
    try {
      return decodeURIComponent(queryMatch[1]).trim();
    } catch {
      return queryMatch[1].trim();
    }
  }

  return value;
}

export default function CodeEntryClient({
  initialLogoUrl,
}: {
  initialLogoUrl: string | null;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const nextCode = extractCodeInput(searchParams.get("code") || "");
    if (nextCode) {
      setCode((current) => current || nextCode);
    }
  }, [searchParams]);

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    setError(null);

    const normalizedCode = extractCodeInput(code);
    if (!normalizedCode) {
      setError("Ingresa tu código o pega el link que te compartieron.");
      return;
    }

    setLoading(true);
    router.push(`/registro?code=${encodeURIComponent(normalizedCode)}`);
  };

  return (
    <main className="relative flex min-h-screen flex-col justify-center overflow-hidden bg-black px-6 py-10 text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(233,30,99,0.22),_transparent_34%),radial-gradient(circle_at_bottom,_rgba(255,255,255,0.09),_transparent_26%)]" />

      <div className="relative mx-auto w-full max-w-xl space-y-8 rounded-[32px] border border-white/10 bg-[#080808] p-6 shadow-[0_30px_90px_rgba(0,0,0,0.48)] sm:p-8">
        <div className="space-y-5 text-center">
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
                className="h-[68px] w-auto object-contain"
              />
            </div>
          ) : (
            <div className="text-6xl font-bold tracking-[0.4em]">BABY</div>
          )}

          <div className="space-y-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/45">
              Tengo un código
            </p>
            <h1 className="text-3xl font-semibold sm:text-4xl">
              Usa tu código y abre tu registro
            </h1>
            <p className="mx-auto max-w-lg text-sm leading-relaxed text-white/65 sm:text-base">
              Si te compartieron un código o un link, pégalo aquí. Te
              llevaremos directo al flujo existente para abrir tu QR o terminar
              tu registro.
            </p>
          </div>
        </div>

        <div className="grid gap-3 rounded-3xl border border-white/10 bg-white/[0.03] p-4 sm:grid-cols-[auto,1fr] sm:items-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-black/30 text-white/80 sm:mx-0">
            <KeyRound className="h-5 w-5" />
          </div>
          <div className="text-center sm:text-left">
            <p className="text-sm font-semibold text-white">
              Usar mi código
            </p>
            <p className="mt-1 text-xs leading-relaxed text-white/60">
              También puedes pegar un link completo como
              ` /codigo?code=... ` o ` /registro?code=... `.
            </p>
          </div>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <input
            type="text"
            value={code}
            onChange={(event) => setCode(event.target.value)}
            className="w-full rounded-2xl border border-white/10 bg-[#111111] px-4 py-3 text-base text-white placeholder:text-white/40 focus:border-white focus:outline-none"
            placeholder="Pega tu código o link"
            autoComplete="off"
            autoCapitalize="off"
            autoCorrect="off"
          />

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-2xl px-4 py-3 text-center text-sm font-semibold uppercase tracking-wide btn-attention-red transition hover:scale-[1.01] disabled:opacity-70"
          >
            {loading ? "Abriendo..." : "Usar mi código"}
          </button>

          {error ? (
            <p className="text-xs font-semibold text-[#ff9a9a]">{error}</p>
          ) : null}
        </form>

        <div className="flex flex-wrap items-center justify-center gap-3 text-sm text-white/65">
          <span>¿Aún no tienes código?</span>
          <Link
            href="/compra"
            className="font-semibold text-[#ff7daf] underline-offset-4 hover:underline"
          >
            Comprar entrada
          </Link>
        </div>
      </div>

      <footer className="relative mx-auto mt-8 max-w-[min(92vw,720px)] px-4">
        <LegalFooterLinks />
      </footer>
    </main>
  );
}
