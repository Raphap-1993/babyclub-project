"use client";

import Image from "next/image";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function ManifiestoPage() {
  return (
    <Suspense fallback={<Placeholder />}>
      <ManifiestoContent />
    </Suspense>
  );
}

function ManifiestoContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const code = searchParams.get("code") || "";
  const [manifestUrl, setManifestUrl] = useState("/manifiesto.png");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(process.env.NEXT_PUBLIC_LOGO_URL || null);

  const onContinue = () => {
    if (error) {
      router.push("/");
      return;
    }
    const next = code ? `/registro?code=${encodeURIComponent(code)}` : "/registro";
    router.push(next);
  };

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`/api/manifiesto${code ? `?code=${encodeURIComponent(code)}` : ""}`, {
          cache: "no-store",
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(
            data?.error ||
              "Tu código intenta seducir al sistema… pero no logra abrirle las puertas. No es válido."
          );
          return;
        }
        if (data?.url) setManifestUrl(data.url);
        const brand = await fetch("/api/branding").then((r) => r.json()).catch(() => ({}));
        if (brand?.logo_url) setLogoUrl(brand.logo_url);
      } catch (err: any) {
        setError(err?.message || "Error cargando manifiesto");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [code]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-black px-6 py-10 text-white">
      <div className="w-full max-w-3xl space-y-6 text-center">
        {logoUrl && (
          <div className="flex justify-center">
            <img src={logoUrl} alt="BABY" className="h-[100px] w-auto object-contain" />
          </div>
        )}
        <div className="flex justify-center">
          <div className="relative w-full max-w-xl overflow-hidden rounded-2xl border border-white/10 bg-[#111111]">
            {!loading && !error && (
              <Image
                src={manifestUrl}
                alt="Manifiesto BABY"
                width={800}
                height={1000}
                className="h-full w-full object-cover"
                priority
              />
            )}
            {!loading && error && (
              <div className="p-6 text-sm font-semibold text-[#ff9a9a]">{error}</div>
            )}
          </div>
        </div>

        <div className="flex justify-center">
          <button
            onClick={onContinue}
            className="rounded-xl px-6 py-3 text-sm font-semibold uppercase tracking-wide btn-smoke transition"
          >
            {error ? "Volver" : "Aceptar y continuar"}
          </button>
        </div>
      </div>
    </main>
  );
}

function Placeholder() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-black px-6 py-10 text-white">
      <div className="text-sm text-white/70">Cargando...</div>
    </main>
  );
}
