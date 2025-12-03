// apps/backoffice/app/admin/reservations/components/ReservationActions.tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export default function ReservationActions({ id }: { id: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const updateStatus = (status: "approved" | "rejected" | "pending") => {
    setError(null);
    startTransition(async () => {
      const res = await fetch("/api/reservations/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        setError(data?.error || "No se pudo actualizar");
        return;
      }
      router.refresh();
    });
  };

  return (
    <div className="flex items-center justify-end gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() => updateStatus("approved")}
        className="rounded-full border border-emerald-500/50 px-3 py-1.5 text-xs font-semibold text-emerald-200 transition hover:border-emerald-400 disabled:opacity-60"
      >
        Aprobar
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => updateStatus("rejected")}
        className="rounded-full border border-[#ff5f5f]/60 px-3 py-1.5 text-xs font-semibold text-[#ff9a9a] transition hover:border-[#ff5f5f] disabled:opacity-60"
      >
        Rechazar
      </button>
      {error && <span className="text-xs text-[#ff9a9a]">{error}</span>}
    </div>
  );
}
