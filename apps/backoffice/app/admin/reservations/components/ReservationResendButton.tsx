"use client";

import { useState, useTransition } from "react";
import { authedFetch } from "@/lib/authedFetch";

export default function ReservationResendButton({
  id,
  email,
  status,
}: {
  id: string;
  email?: string | null;
  status?: string | null;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const normalizedStatus = (status || "").toLowerCase();
  const canSend = Boolean(email) && normalizedStatus === "approved";
  const hint = !email ? "Agrega un correo para reenviar." : normalizedStatus !== "approved" ? "Solo para aprobadas." : "";

  const onResend = () => {
    if (!canSend) return;
    setError(null);
    setInfo(null);
    startTransition(async () => {
      const res = await authedFetch("/api/reservations/resend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        const message =
          data?.error ||
          data?.reservationEmailError ||
          data?.ticketEmailError ||
          "No se pudo reenviar el correo";
        setError(message);
        return;
      }
      setInfo("Correo reenviado.");
    });
  };

  return (
    <div className="relative flex items-center">
      {(error || info) && (
        <span
          className={`absolute -top-5 right-0 max-w-[220px] text-right text-xs leading-tight ${
            error ? "text-[#fca5a5]" : "text-emerald-200"
          }`}
        >
          {error || info}
        </span>
      )}
      <button
        type="button"
        disabled={pending || !canSend}
        title={!canSend ? hint : ""}
        onClick={onResend}
        className="rounded-full border border-white/20 px-4 py-2 text-sm font-semibold text-white transition hover:border-white disabled:opacity-60"
      >
        {pending ? "Enviando..." : "Reenviar correo"}
      </button>
    </div>
  );
}
