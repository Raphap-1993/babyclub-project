// apps/backoffice/app/admin/events/components/ManifestUploader.tsx
"use client";

import { useState } from "react";

type Props = {
  code: string;
  onUploaded: (url: string) => void;
  initialUrl?: string;
  label?: string;
  inputId?: string;
};

export default function ManifestUploader({ code, onUploaded, initialUrl, label, inputId }: Props) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onChange = async (ev: React.ChangeEvent<HTMLInputElement>) => {
    const file = ev.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError(null);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("code", code || file.name || "manifiesto");

    try {
      const res = await fetch("/api/uploads/manifest", {
        method: "POST",
        body: formData,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        setError(data?.error || "No se pudo subir");
      } else if (data?.url) {
        onUploaded(data.url);
      }
    } catch (err: any) {
      setError(err?.message || "Error al subir archivo");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-semibold text-white" htmlFor={inputId || "manifest-file"}>
        {label || "Subir manifiesto (imagen)"}
      </label>
      <div className="flex items-center gap-3">
        <input
          id={inputId || "manifest-file"}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={onChange}
          disabled={uploading}
          className="w-full rounded-2xl border border-white/10 bg-[#0c0c0c] px-4 py-3 text-sm text-white file:mr-3 file:rounded-xl file:border-0 file:bg-white/10 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white placeholder:text-white/40 outline-none transition focus:border-white disabled:opacity-60"
        />
        {initialUrl && (
          <a
            href={initialUrl}
            target="_blank"
            rel="noreferrer"
            className="text-xs font-semibold text-[#e91e63] underline-offset-4 hover:underline"
          >
            Ver actual
          </a>
        )}
      </div>
      {error && <p className="text-xs text-[#ff9a9a]">{error}</p>}
      {uploading && <p className="text-xs text-white/60">Subiendo...</p>}
    </div>
  );
}
