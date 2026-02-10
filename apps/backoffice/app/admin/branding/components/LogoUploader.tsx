// apps/backoffice/app/admin/branding/components/LogoUploader.tsx
"use client";

import { useState } from "react";
import { authedFetch } from "@/lib/authedFetch";

type Props = {
  initialUrl: string;
};

export default function LogoUploader({ initialUrl }: Props) {
  const [logoUrl, setLogoUrl] = useState(initialUrl);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    setError(null);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("path", "branding/logo.png");

    try {
      const res = await authedFetch("/api/uploads/logo", { method: "POST", body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.url) {
        setError(data?.error || "No se pudo subir el logo");
      } else {
        setLogoUrl(data.url);
        await saveLogoUrl(data.url);
      }
    } catch (err: any) {
      setError(err?.message || "Error al subir logo");
    } finally {
      setLoading(false);
    }
  };

  const saveLogoUrl = async (url: string) => {
    const res = await authedFetch("/api/branding/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ logo_url: url }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.success) {
      setError(data?.error || "No se pudo guardar el logo");
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <label className="text-sm font-semibold text-white">Subir logo</label>
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp, image/svg+xml"
          onChange={onFileChange}
          disabled={loading}
          className="w-full rounded-2xl border border-[#292929] bg-[#0c0c0c] px-4 py-3 text-sm text-white file:mr-3 file:rounded-xl file:border-0 file:bg-white/10 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white"
        />
      </div>

      {logoUrl && (
        <div className="flex justify-center">
          <img src={logoUrl} alt="Logo" className="h-16 object-contain" />
        </div>
      )}

      {error && <p className="text-xs font-semibold text-[#fca5a5]">{error}</p>}
    </div>
  );
}
