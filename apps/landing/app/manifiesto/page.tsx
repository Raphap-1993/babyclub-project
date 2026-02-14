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

  // Preload manifest image
  useEffect(() => {
    if (manifestUrl && !loading) {
      const link = document.createElement('link');
      link.rel = 'preload';
      link.as = 'image';
      link.href = manifestUrl;
      link.fetchPriority = 'high';
      document.head.appendChild(link);
      return () => {
        document.head.removeChild(link);
      };
    }
  }, [manifestUrl, loading]);
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
          cache: "force-cache",
          next: { revalidate: 300 } as any, // 5 min cache
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(
            data?.error ||
              "Tu código intenta seducir al sistema… pero no logra abrirle las puertas."
          );
          return;
        }
        if (data?.url) setManifestUrl(data.url);
        const brand = await fetch("/api/branding", {
          cache: "force-cache",
          next: { revalidate: 300 } as any // 5 min cache
        }).then((r) => r.json()).catch(() => ({}));
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
    <main className="flex h-screen items-center justify-center bg-black px-4 py-4 sm:px-6 sm:py-6 text-white overflow-hidden">
      <div className="flex flex-col items-center justify-center w-full max-w-2xl h-full gap-4">
        <div className="flex justify-center items-center flex-1 w-full">
          <div className="relative w-full h-full max-h-[calc(100vh-8rem)] overflow-hidden">
            {!loading && !error && (
              <Image
                src={manifestUrl}
                alt="Manifiesto BABY"
                fill
                className="object-contain"
                priority
                fetchPriority="high"
                unoptimized={manifestUrl.startsWith('http')}
              />
            )}
            {!loading && error && (
              <div className="p-6 text-sm font-semibold text-[#ff9a9a]">{error}</div>
            )}
          </div>
        </div>

        <div className="flex justify-center pb-2">
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
