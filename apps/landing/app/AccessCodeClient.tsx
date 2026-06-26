"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { LegalFooterLinks } from "./legal/LegalFooterLinks";
import { extractAccessCodeInput } from "./accessCodeInput";
import {
  getAccessCodeViewState,
  type EntryMode,
} from "./accessCodeViewState";

export default function AccessCodeClient({
  initialLogoUrl,
}: {
  initialLogoUrl: string | null;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const mode: EntryMode =
    searchParams.get("mode") === "nomination" ? "nomination" : "access";
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const viewState = getAccessCodeViewState(mode);

  useEffect(() => {
    setError(null);
    setShowErrorModal(false);
    setErrorMessage("");
  }, [mode]);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    const normalizedCode = extractAccessCodeInput(code);
    if (!normalizedCode) {
      setError(viewState.emptyError);
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
      <div id="nominacion" className="w-full max-w-md space-y-5 text-center">
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

        <form onSubmit={onSubmit} className="space-y-4">
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-[#111111] px-4 py-3 text-base text-white placeholder:text-white/40 focus:border-white focus:outline-none"
            placeholder={viewState.placeholder}
            autoComplete="off"
            autoCapitalize="off"
            autoCorrect="off"
          />

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl px-4 py-3 text-center text-sm font-semibold uppercase tracking-wide btn-attention-red transition hover:scale-[1.01] disabled:opacity-70"
          >
            {loading ? viewState.loadingLabel : viewState.submitLabel}
          </button>
          {error && (
            <p className="text-xs font-semibold text-[#ff9a9a]">{error}</p>
          )}
        </form>

        <div className="flex flex-col items-center gap-2 text-center text-sm text-white/70">
          {mode === "nomination" ? (
            <Link
              href="/"
              className="font-semibold text-[#e91e63] underline-offset-4 hover:underline"
            >
              Volver al inicio
            </Link>
          ) : (
            <>
              <Link
                href="/?mode=nomination#nominacion"
                className="font-semibold text-[#e91e63] underline-offset-4 hover:underline"
              >
                Completar nominación
              </Link>
              <Link
                href="/compra"
                className="font-semibold text-[#e91e63] underline-offset-4 hover:underline"
              >
                Comprar Entrada
              </Link>
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
