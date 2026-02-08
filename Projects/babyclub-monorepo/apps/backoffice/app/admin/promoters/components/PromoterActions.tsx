// apps/backoffice/app/admin/promoters/components/PromoterActions.tsx
"use client";

import Link from "next/link";
import { useTransition, useState } from "react";
import { useRouter } from "next/navigation";

type Props = { id: string };

export default function PromoterActions({ id }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const onDelete = () => {
    const confirmed = window.confirm("¿Eliminar promotor?");
    if (!confirmed) return;
    setError(null);
    startTransition(async () => {
      const res = await fetch("/api/promoters/delete", {
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
    <div className="flex justify-end gap-2">
      <Link
        href={`/admin/promoters/${encodeURIComponent(id)}/edit`}
        className="inline-flex items-center justify-center rounded-full border border-white/15 px-3 py-1.5 text-xs font-semibold text-white transition hover:border-[#e91e63] hover:text-[#e91e63]"
      >
        Editar
      </Link>
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
