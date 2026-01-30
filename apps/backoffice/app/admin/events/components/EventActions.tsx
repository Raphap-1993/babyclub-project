// apps/backoffice/app/admin/events/components/EventActions.tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { authedFetch } from "@/lib/authedFetch";

type Props = {
  id: string;
};

export default function EventActions({ id }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const onDelete = () => {
    const confirmDelete = window.confirm("¿Eliminar este evento? Se borrarán sus códigos asociados.");
    if (!confirmDelete) return;
    setError(null);
    startTransition(async () => {
      const res = await authedFetch("/api/events/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        setError(data?.error || "No se pudo eliminar");
        return;
      }
      router.refresh();
    });
  };

  return (
    <div className="flex items-center justify-end gap-2">
      <button
        type="button"
        onClick={() => router.push(`/admin/events/${encodeURIComponent(id)}/edit`)}
        className="inline-flex items-center justify-center rounded-full border border-white/15 px-3 py-1.5 text-xs font-semibold text-white transition hover:border-[#e91e63] hover:text-[#e91e63]"
      >
        Editar
      </button>
      <button
        type="button"
        onClick={onDelete}
        disabled={pending}
        className="inline-flex items-center justify-center rounded-full border border-white/15 px-3 py-1.5 text-xs font-semibold text-white transition hover:border-[#ff5f5f] hover:text-[#ff5f5f] disabled:opacity-60"
      >
        Eliminar
      </button>
      {error && <span className="text-xs text-[#ff9a9a]">{error}</span>}
    </div>
  );
}
