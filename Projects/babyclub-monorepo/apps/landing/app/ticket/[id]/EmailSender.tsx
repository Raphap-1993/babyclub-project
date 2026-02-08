"use client";

import { useState } from "react";

type Props = {
  ticketId: string;
  defaultEmail?: string | null;
};

export function EmailSender({ ticketId, defaultEmail = "" }: Props) {
  const [email, setEmail] = useState(defaultEmail || "");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  const send = async () => {
    if (!email.trim()) {
      setError("Ingresa un correo");
      return;
    }
    setStatus("sending");
    setError(null);
    try {
      const res = await fetch("/api/tickets/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticketId, email: email.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        setError(data?.error || "No se pudo enviar");
        setStatus("error");
        return;
      }
      setStatus("sent");
    } catch (err: any) {
      setError(err?.message || "No se pudo enviar");
      setStatus("error");
    }
  };

  return (
    <div className="rounded-2xl border border-white/10 bg-[#0a0a0a] p-4 space-y-2">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="flex-1">
          <label className="text-xs font-semibold uppercase tracking-[0.12em] text-white/60">Enviar QR al correo</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="correo@ejemplo.com"
            className="mt-1 w-full rounded-xl border border-white/10 bg-[#111111] px-3 py-2 text-sm text-white placeholder:text-white/40 focus:border-white focus:outline-none"
          />
        </div>
        <button
          type="button"
          onClick={send}
          disabled={status === "sending"}
          className="mt-2 sm:mt-6 rounded-xl px-4 py-2 text-sm font-semibold uppercase tracking-wide btn-smoke transition disabled:opacity-70"
        >
          {status === "sent" ? "Enviado" : status === "sending" ? "Enviando..." : "Enviar"}
        </button>
      </div>
      {error && <p className="text-xs text-[#ffb3b3]">{error}</p>}
      {status === "sent" && !error && <p className="text-xs text-emerald-200">Correo enviado con tu QR.</p>}
    </div>
  );
}
