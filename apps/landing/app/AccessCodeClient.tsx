"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LegalFooterLinks } from "./legal/LegalFooterLinks";
import { extractAccessCodeInput } from "./accessCodeInput";

type EntryMode = "access" | "nomination";
const NOMINATION_HASH = "#nominacion";

export default function AccessCodeClient({
  initialLogoUrl,
}: {
  initialLogoUrl: string | null;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<EntryMode>("access");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (typeof window === "undefined") return;

    const syncModeWithHash = () => {
      setMode(window.location.hash === NOMINATION_HASH ? "nomination" : "access");
      setError(null);
    };

    syncModeWithHash();
    window.addEventListener("hashchange", syncModeWithHash);
    return () => window.removeEventListener("hashchange", syncModeWithHash);
  }, []);

  const switchMode = (nextMode: EntryMode) => {
    setMode(nextMode);
    setError(null);

    if (typeof window === "undefined") return;

    const nextUrl =
      nextMode === "nomination"
        ? `${window.location.pathname}${window.location.search}${NOMINATION_HASH}`
        : `${window.location.pathname}${window.location.search}`;

    window.history.replaceState(null, "", nextUrl);
  };

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    const normalizedCode = extractAccessCodeInput(code);
    if (!normalizedCode) {
      setError(
        mode === "nomination"
          ? "Pega el código o link que te compartieron."
          : "Ingresa un código",
      );
      return;
    }

    if (mode === "nomination") {
      router.push(`/registro?code=${encodeURIComponent(normalizedCode)}`);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(
        `/api/manifiesto?code=${encodeURIComponent(normalizedCode)}`,
        { method: "GET" },
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const errorMsg =
          data?.error ||
          "Tu código intenta seducir al sistema… pero no logra abrirle las puertas.";
        setErrorMessage(errorMsg);
        setShowErrorModal(true);
        return;
      }
      router.push(`/manifiesto?code=${encodeURIComponent(normalizedCode)}`);
    } catch (err: any) {
      const errorMsg = err?.message || "Error validando el código";
      setErrorMessage(errorMsg);
      setShowErrorModal(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center bg-black px-6 py-10 text-white">
      <div id="nominacion" className="w-full max-w-md space-y-6 text-center">
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

        <div className="rounded-2xl border border-white/10 bg-[#0d0d0d] p-1">
          <div className="grid grid-cols-2 gap-1">
            <button
              type="button"
              onClick={() => switchMode("access")}
              className={`rounded-[14px] px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] transition ${
                mode === "access"
                  ? "bg-white text-black"
                  : "text-white/65 hover:bg-white/5 hover:text-white"
              }`}
            >
              Entrar
            </button>
            <button
              type="button"
              onClick={() => switchMode("nomination")}
              className={`rounded-[14px] px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] transition ${
                mode === "nomination"
                  ? "bg-white text-black"
                  : "text-white/65 hover:bg-white/5 hover:text-white"
              }`}
            >
              Completar nominación
            </button>
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-semibold text-white">
            {mode === "nomination"
              ? "¿Te compartieron un código o link? Pégalo aquí para terminar tu registro y generar tu QR."
              : "Ingresa tu código de acceso para continuar."}
          </p>
          <p className="text-xs leading-relaxed text-white/55">
            {mode === "nomination"
              ? "Funciona con el código que te pasó el comprador desde su correo o con un link completo."
              : "Si te compartieron un código de reserva, puedes completar tu nominación desde aquí. Si no tienes código, compra tu entrada."}
          </p>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-[#111111] px-4 py-3 text-base text-white placeholder:text-white/40 focus:border-white focus:outline-none"
            placeholder={
              mode === "nomination"
                ? "Pega tu código o link"
                : "Código de acceso"
            }
            autoComplete="off"
            autoCapitalize="off"
            autoCorrect="off"
          />

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl px-4 py-3 text-center text-sm font-semibold uppercase tracking-wide btn-attention-red transition hover:scale-[1.01] disabled:opacity-70"
          >
            {loading
              ? mode === "nomination"
                ? "Abriendo..."
                : "Validando..."
              : mode === "nomination"
                ? "Completar nominación"
                : "Entrar"}
          </button>
          {error && (
            <p className="text-xs font-semibold text-[#ff9a9a]">{error}</p>
          )}
        </form>

        <div className="space-y-2 text-center text-sm text-white/70">
          {mode === "nomination" ? (
            <>
              ¿Ya tienes tu acceso listo?{" "}
              <button
                type="button"
                onClick={() => switchMode("access")}
                className="font-semibold text-[#e91e63] underline-offset-4 hover:underline"
              >
                Entrar con mi código
              </button>
            </>
          ) : (
            <>
              <div>
                ¿Te compartieron un código o link?{" "}
                <Link
                  href="/#nominacion"
                  onClick={() => switchMode("nomination")}
                  className="font-semibold text-[#e91e63] underline-offset-4 hover:underline"
                >
                  Completar nominación
                </Link>
              </div>
              <div>
                ¿Sin código?{" "}
                <Link
                  href="/compra"
                  className="font-semibold text-[#e91e63] underline-offset-4 hover:underline"
                >
                  Comprar Entrada
                </Link>
              </div>
            </>
          )}
        </div>
      </div>

      <footer className="absolute bottom-6 max-w-[min(92vw,720px)] px-4">
        <LegalFooterLinks />
      </footer>

      {showErrorModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4 py-6">
          <div className="w-full max-w-md space-y-4 rounded-3xl border border-[#e91e63]/20 bg-gradient-to-b from-[#111111] to-[#050505] p-6 text-white shadow-[0_30px_90px_rgba(233,30,99,0.3)]">
            <div className="space-y-2 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#e91e63]/10 border border-[#e91e63]/30">
                <svg
                  className="h-7 w-7 text-[#e91e63]"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-white">
                Código inválido
              </h3>
              <p className="text-sm leading-relaxed text-[#ff9a9a]">
                {errorMessage}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowErrorModal(false)}
              className="w-full rounded-xl px-4 py-3 text-center text-sm font-semibold uppercase tracking-wide btn-attention-red transition hover:scale-[1.01]"
            >
              Entendido
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
