// apps/backoffice/app/admin/tables/components/TableActions.tsx
"use client";

import Link from "next/link";
import { useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { authedFetch } from "@/lib/authedFetch";
import { Button } from "@repo/ui";

export default function TableActions({ id, reserved }: { id: string; reserved?: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const onRelease = () => {
    const confirmed = window.confirm("¿Liberar reservas activas de esta mesa?");
    if (!confirmed) return;
    setError(null);
    startTransition(async () => {
      const res = await authedFetch("/api/tables/release", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        setError(data?.error || "No se pudo liberar");
        return;
      }
      router.refresh();
    });
  };

  const onDelete = () => {
    const confirmed = window.confirm("¿Eliminar mesa?");
    if (!confirmed) return;
    setError(null);
    startTransition(async () => {
      const res = await authedFetch("/api/tables/delete", {
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
      <Link href={`/admin/tables/${encodeURIComponent(id)}/edit`}>
        <Button 
          variant="outline" 
          size="sm" 
          className="border-neutral-600 text-neutral-300 hover:border-purple-500 hover:text-purple-400 hover:bg-purple-500/10"
        >
          Editar
        </Button>
      </Link>
      {reserved && (
        <Button
          type="button"
          onClick={onRelease}
          disabled={pending}
          variant="outline"
          size="sm"
          className="border-neutral-600 text-neutral-300 hover:border-yellow-500 hover:text-yellow-400 hover:bg-yellow-500/10 disabled:opacity-50"
        >
          Liberar
        </Button>
      )}
      <Button
        type="button"
        onClick={onDelete}
        disabled={pending}
        variant="outline"
        size="sm"
        className="border-neutral-600 text-neutral-300 hover:border-red-500 hover:text-red-400 hover:bg-red-500/10 disabled:opacity-50"
      >
        Eliminar
      </Button>
      {error && <span className="text-xs text-red-400">{error}</span>}
    </div>
  );
}
