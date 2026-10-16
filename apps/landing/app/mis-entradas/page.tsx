"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { ArrowLeft, ArrowRight, Ticket } from "lucide-react";
import { LegalFooterLinks } from "../legal/LegalFooterLinks";
import { getLocalTicketLink } from "./ticketLink";

export default function MisEntradasPage() {
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState("");
  const [recoveryError, setRecoveryError] = useState("");
  async function recover(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSending(true);
    setRecoveryError("");
    setMessage("");
    try {
      const response = await fetch("/api/tickets/recover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Inténtalo más tarde.");
      setMessage(result.message);
    } catch (error) {
      setRecoveryError(
        error instanceof Error
          ? error.message
          : "No pudimos conectar. Inténtalo de nuevo.",
      );
    } finally {
      setSending(false);
    }
  }
  function openTicket(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const destination = getLocalTicketLink(value, window.location.origin);
    if (!destination) {
      setError(
        "Pega el enlace completo de tu entrada o reserva de BABY que recibiste por correo.",
      );
      return;
    }
    window.location.assign(destination);
  }
  return (
    <main className="flex min-h-svh flex-col bg-black px-6 py-8 text-white">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-12">
        <Link
          href="/"
          className="mb-10 inline-flex items-center gap-2 text-sm text-white/70 hover:text-white"
        >
          <ArrowLeft size={16} aria-hidden="true" />
          Volver al inicio
        </Link>
        <Ticket
          size={32}
          strokeWidth={1.5}
          aria-hidden="true"
          className="mb-5 text-[#ff1744]"
        />
        <h1 className="text-3xl font-semibold tracking-tight">Mis entradas</h1>
        <p className="mt-4 text-sm leading-6 text-white/65">
          Ingresa el correo que usaste al comprar o al registrar tu entrada. Te
          enviaremos los accesos a tus entradas y reservas.
        </p>
        <form onSubmit={recover} className="mt-8 space-y-4">
          <label htmlFor="recovery-email" className="block text-sm">
            Tu correo electrónico
          </label>
          <input
            id="recovery-email"
            type="email"
            autoComplete="email"
            required
            maxLength={254}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="w-full rounded-xl border border-white/20 bg-[#111] px-4 py-3 text-base outline-none focus:border-[#ff1744]"
            placeholder="tucorreo@ejemplo.com"
          />
          <button
            type="submit"
            disabled={sending}
            className="flex min-h-12 w-full items-center justify-between rounded-xl bg-[#f2f2f2] px-4 py-3 font-semibold text-black disabled:opacity-50"
          >
            {sending ? "Enviando solicitud…" : "Recibir mis accesos por correo"}
            <ArrowRight size={18} aria-hidden="true" />
          </button>
          {message && (
            <p role="status" className="text-sm leading-6 text-white/75">
              {message} Por seguridad, espera 20 minutos antes de solicitar otro
              envío.
            </p>
          )}
          {recoveryError && (
            <p role="alert" className="text-sm text-[#ff6684]">
              {recoveryError}
            </p>
          )}
        </form>
        <details className="mt-8 border-t border-white/15 pt-6">
          <summary className="cursor-pointer text-sm text-[#ff1744] underline underline-offset-4">
            Ya tengo un enlace
          </summary>
          <form onSubmit={openTicket} className="mt-8 space-y-4">
            <label htmlFor="ticket-link" className="block text-sm">
              Enlace de tu entrada o reserva
            </label>
            <input
              id="ticket-link"
              value={value}
              onChange={(event) => {
                setValue(event.target.value);
                setError("");
              }}
              type="text"
              inputMode="url"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              maxLength={4096}
              required
              aria-describedby="ticket-help"
              aria-invalid={Boolean(error)}
              className="w-full rounded-xl border border-white/20 bg-[#111] px-4 py-3 text-base outline-none focus:border-[#ff1744]"
              placeholder="https://babyclubaccess.com/ticket/…"
            />
            <p id="ticket-help" className="text-xs leading-5 text-white/55">
              El enlace es personal. No lo compartas con otras personas.
            </p>
            {error && (
              <p role="alert" className="text-sm text-[#ff6684]">
                {error}
              </p>
            )}
            <button
              type="submit"
              className="flex w-full items-center justify-between rounded-xl bg-[#f2f2f2] px-4 py-3 font-semibold text-black focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#ff1744]"
            >
              Abrir mi entrada
              <ArrowRight size={18} aria-hidden="true" />
            </button>
          </form>
        </details>
        <p className="mt-8 text-sm leading-6 text-white/55">
          Si todavía no recibiste la confirmación, revisa también la carpeta de
          correo no deseado.
        </p>
        <Link
          href="/codigo"
          className="mt-5 text-sm text-[#ff1744] underline underline-offset-4"
        >
          ¿Tienes un código?
        </Link>
      </div>
      <LegalFooterLinks compact />
    </main>
  );
}
