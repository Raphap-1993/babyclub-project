"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { ArrowLeft, ArrowRight, Ticket } from "lucide-react";
import { LegalFooterLinks } from "../legal/LegalFooterLinks";
import { getLocalTicketLink } from "./ticketLink";

export default function MisEntradasPage() {
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
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
          Abre el enlace de tu entrada desde el correo de confirmación de BABY.
          También puedes pegarlo aquí.
        </p>
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
