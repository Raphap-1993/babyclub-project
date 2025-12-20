// apps/backoffice/app/admin/reservations/components/ReservationActions.tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export default function ReservationActions({ id, status }: { id: string; status?: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const currentStatus = (status || "").toLowerCase();

  const updateStatus = (status: "approved" | "rejected" | "pending") => {
    setError(null);
    setInfo(null);
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
      if (status === "approved") {
        if (data?.emailError) {
          setError(`Reserva aprobada, pero el correo no salió: ${data.emailError}`);
        } else if (data?.emailSent) {
          setInfo("Reserva aprobada y correo enviado al cliente.");
        }
      }
      router.refresh();
    });
  };

  const handleDelete = () => {
    const confirmed = window.confirm("¿Eliminar esta reserva?");
    if (!confirmed) return;
    setError(null);
    setInfo(null);
    startTransition(async () => {
      const res = await fetch("/api/admin/reservations/delete", {
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
    <div className="relative flex flex-wrap items-center justify-end gap-2">
      {currentStatus !== "approved" && (
        <button
          type="button"
          disabled={pending}
          onClick={() => updateStatus("approved")}
          className="rounded-full border border-emerald-500/50 px-3 py-1.5 text-xs font-semibold text-emerald-200 transition hover:border-emerald-400 disabled:opacity-60"
        >
          Aprobar
        </button>
      )}
      {currentStatus !== "rejected" && (
        <button
          type="button"
          disabled={pending}
          onClick={() => updateStatus("rejected")}
          className="rounded-full border border-[#ff5f5f]/60 px-3 py-1.5 text-xs font-semibold text-[#ff9a9a] transition hover:border-[#ff5f5f] disabled:opacity-60"
        >
          Rechazar
        </button>
      )}
      <button
        type="button"
        disabled={pending}
        onClick={handleDelete}
        className="rounded-full border border-white/20 px-3 py-1.5 text-xs font-semibold text-white transition hover:border-white disabled:opacity-60"
      >
        Eliminar
      </button>
      {(error || info) && (
        <span
          className={`absolute -top-5 right-0 max-w-[220px] text-right text-xs leading-tight ${
            error ? "text-[#ff9a9a]" : "text-emerald-200"
          }`}
        >
          {error || info}
        </span>
      )}
    </div>
  );
}
