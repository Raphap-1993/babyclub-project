"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Ticket,
  ShieldCheck,
  LoaderCircle,
} from "lucide-react";
import { LegalFooterLinks } from "../legal/LegalFooterLinks";
import { formatEventDate } from "../home/eventModel";
import { getLocalTicketLink } from "./ticketLink";

type Wallet = {
  event: { name: string; startsAt: string; location: string | null } | null;
  tickets: { id: string; name: string; state: string; qr: string | null }[];
  reservations: { id: string; label: string; href: string }[];
};
const field =
  "w-full rounded-xl border border-white/20 bg-[#111] px-4 py-3 text-base outline-none focus:border-[#ff1744]";
const primary =
  "flex min-h-12 w-full items-center justify-between gap-3 rounded-xl bg-[#f2f2f2] px-4 py-3 font-semibold text-black disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#ff1744]";

export default function MisEntradasPage() {
  const [view, setView] = useState<"checking" | "dni" | "code" | "wallet">(
    "checking",
  );
  const [dni, setDni] = useState("");
  const [code, setCode] = useState("");
  const [remember, setRemember] = useState(true);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [countdown, setCountdown] = useState(0);
  const [link, setLink] = useState("");

  async function loadWallet() {
    const response = await fetch("/api/customer-access", { cache: "no-store" });
    const result = await response.json();
    if (response.status === 401) {
      setWallet(null);
      setView("dni");
      return;
    }
    if (!response.ok) throw new Error(result.error);
    setWallet(result.wallet);
    setView("wallet");
  }
  useEffect(() => {
    let active = true;
    loadWallet().catch(() => {
      if (active) {
        setView("dni");
        setError("No pudimos cargar tu acceso. Puedes volver a intentarlo.");
      }
    });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setTimeout(
      () => setCountdown((value) => Math.max(0, value - 1)),
      1000,
    );
    return () => clearTimeout(timer);
  }, [countdown]);

  async function request(action: string, values: Record<string, unknown> = {}) {
    const response = await fetch("/api/customer-access", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...values }),
    });
    const result = await response.json();
    if (!response.ok)
      throw new Error(
        result.error || "No pudimos conectar. Inténtalo de nuevo.",
      );
    return result;
  }
  async function lookup(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result = await request("lookup", { dni });
      if (result.verified) {
        setWallet(result.wallet);
        setView("wallet");
      } else {
        setView("code");
        setMessage(result.message);
        setCode("");
        setCountdown(result.resendAfter);
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : "Inténtalo de nuevo.");
    } finally {
      setBusy(false);
    }
  }
  async function verify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await request("verify", { code, remember });
      setView("wallet");
      await loadWallet();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Inténtalo de nuevo.");
    } finally {
      setBusy(false);
    }
  }
  async function logout() {
    setBusy(true);
    setError("");
    try {
      await request("logout");
      setWallet(null);
      setView("dni");
      setDni("");
      setCode("");
      setMessage("");
    } catch {
      setError("No pudimos cerrar el acceso. Inténtalo de nuevo.");
    } finally {
      setBusy(false);
    }
  }
  function openLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const destination = getLocalTicketLink(link, window.location.origin);
    if (destination) window.location.assign(destination);
    else setError("Pega el enlace completo de tu entrada o reserva de BABY.");
  }

  return (
    <main className="flex min-h-svh flex-col bg-black px-5 py-8 text-white">
      <div className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center py-8">
        <Link
          href="/"
          className="mb-9 inline-flex items-center gap-2 text-sm text-white/65 hover:text-white"
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
        {error && (
          <p
            role="alert"
            className="mt-5 rounded-xl border border-[#ff1744]/40 p-4 text-sm leading-6 text-[#ff8aa2]"
          >
            {error}
          </p>
        )}
        {view === "checking" && (
          <p
            role="status"
            className="mt-8 flex items-center gap-3 text-sm text-white/65"
          >
            <LoaderCircle className="animate-spin" size={18} />
            Buscando tu acceso…
          </p>
        )}
        {view === "dni" && (
          <>
            <p className="mt-4 text-sm leading-6 text-white/65">
              Encuentra tus QR y reservas del próximo evento con tu DNI. En un
              dispositivo nuevo verificaremos tu acceso una sola vez.
            </p>
            <form onSubmit={lookup} className="mt-7 space-y-4">
              <label htmlFor="customer-dni" className="block text-sm">
                Tu número de DNI
              </label>
              <input
                id="customer-dni"
                value={dni}
                onChange={(event) =>
                  setDni(event.target.value.replace(/\D/g, "").slice(0, 8))
                }
                inputMode="numeric"
                autoComplete="off"
                pattern="[0-9]{8}"
                minLength={8}
                maxLength={8}
                required
                className={field}
                placeholder="8 dígitos"
              />
              <button type="submit" disabled={busy} className={primary}>
                {busy ? "Buscando…" : "Buscar mis entradas"}
                <ArrowRight size={18} aria-hidden="true" />
              </button>
            </form>
            <p className="mt-5 flex items-start gap-2 text-xs leading-5 text-white/50">
              <ShieldCheck size={17} className="shrink-0" aria-hidden="true" />
              Tus entradas solo se muestran después de verificar que eres el
              titular.
            </p>
            <details className="mt-8 border-t border-white/15 pt-5">
              <summary className="cursor-pointer text-sm text-[#ff1744] underline underline-offset-4">
                Ya tengo un enlace
              </summary>
              <form onSubmit={openLink} className="mt-5 space-y-4">
                <label htmlFor="ticket-link" className="block text-sm">
                  Enlace de tu entrada o reserva
                </label>
                <input
                  id="ticket-link"
                  value={link}
                  onChange={(event) => setLink(event.target.value)}
                  required
                  maxLength={4096}
                  className={field}
                  placeholder="https://babyclubaccess.com/ticket/…"
                />
                <button className={primary}>
                  Abrir mi entrada
                  <ArrowRight size={18} />
                </button>
              </form>
            </details>
          </>
        )}
        {view === "code" && (
          <>
            <h2 className="mt-6 text-xl font-semibold">
              Verifica este dispositivo
            </h2>
            <p className="mt-3 text-sm leading-6 text-white/65">
              {message} El código vence en 10 minutos.
            </p>
            <form onSubmit={verify} className="mt-6 space-y-4">
              <label htmlFor="customer-code" className="block text-sm">
                Código de verificación
              </label>
              <input
                id="customer-code"
                autoFocus
                value={code}
                onChange={(event) =>
                  setCode(event.target.value.replace(/\D/g, "").slice(0, 6))
                }
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{6}"
                minLength={6}
                maxLength={6}
                required
                className={field + " text-center text-2xl tracking-[0.4em]"}
                placeholder="000000"
              />
              <label className="flex items-start gap-3 py-2 text-sm leading-6 text-white/75">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(event) => setRemember(event.target.checked)}
                  className="mt-1 h-5 w-5 shrink-0 accent-[#ff1744]"
                />
                <span>
                  Recordar este dispositivo por 30 días.
                  <span className="block text-xs text-white/50">
                    Desactívalo si es un equipo compartido.
                  </span>
                </span>
              </label>
              <button type="submit" disabled={busy} className={primary}>
                {busy ? "Verificando…" : "Ver mis QR"}
                <ArrowRight size={18} aria-hidden="true" />
              </button>
            </form>
            <button
              type="button"
              disabled={busy || countdown > 0}
              onClick={() => lookup()}
              className="mt-4 min-h-11 text-sm text-[#ff1744] underline underline-offset-4 disabled:text-white/40"
            >
              {countdown > 0
                ? "Solicitar otro código en " + countdown + " s"
                : "Solicitar otro código"}
            </button>
            <p className="mt-1 text-xs leading-5 text-white/50">
              Máximo tres solicitudes por hora. Si no tienes acceso al correo
              registrado, contacta a BABY para revisar tu registro.
            </p>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setView("dni");
                setError("");
              }}
              className="mt-3 min-h-11 text-sm text-white/60 underline underline-offset-4"
            >
              Corregir DNI
            </button>
          </>
        )}
        {view === "wallet" && (
          <>
            <p className="mt-3 flex items-center gap-2 text-xs text-white/55">
              <ShieldCheck size={16} aria-hidden="true" />
              Dispositivo verificado
            </p>
            {!wallet ? (
              <button
                className={primary + " mt-6"}
                onClick={() =>
                  loadWallet().catch(() => setError("Inténtalo nuevamente."))
                }
              >
                Volver a cargar entradas
              </button>
            ) : wallet.event ? (
              <>
                <p className="mt-7 text-xs uppercase tracking-[0.2em] text-[#ff4769]">
                  Tu próximo evento
                </p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight">
                  {wallet.event.name}
                </h2>
                <p className="mt-2 text-sm text-white/65">
                  {formatEventDate(wallet.event.startsAt).label}
                </p>
                {wallet.event.location && (
                  <p className="mt-1 text-sm text-white/50">
                    {wallet.event.location}
                  </p>
                )}
                <div className="mt-6 space-y-5">
                  {wallet.tickets.map((ticket, index) => (
                    <article
                      key={ticket.id}
                      className="rounded-2xl border border-white/15 bg-[#0c0c0c] p-5"
                    >
                      <p className="text-xs text-white/50">
                        Entrada {index + 1}
                      </p>
                      <h3 className="mt-1 font-semibold">{ticket.name}</h3>
                      {ticket.qr ? (
                        <>
                          <img
                            src={ticket.qr}
                            alt={"QR de ingreso de " + ticket.name}
                            width={520}
                            height={520}
                            className="mx-auto mt-5 h-auto w-full max-w-[300px] rounded-xl"
                          />
                          <p className="mt-4 text-center text-xs leading-5 text-white/55">
                            Presenta este QR y tu documento al ingresar. No lo
                            compartas.
                          </p>
                        </>
                      ) : (
                        <p className="mt-4 text-sm text-white/65">
                          {ticket.state === "used"
                            ? "Esta entrada ya fue utilizada."
                            : ticket.state === "expired"
                              ? "El horario de ingreso de esta entrada terminó."
                              : ticket.state === "inactive"
                                ? "Esta entrada no está activa."
                                : "El QR todavía no está disponible."}
                        </p>
                      )}
                    </article>
                  ))}
                </div>
                {wallet.reservations.map((reservation) => (
                  <Link
                    key={reservation.id}
                    href={reservation.href}
                    className="mt-5 flex items-center justify-between gap-3 rounded-2xl border border-white/20 px-5 py-5"
                  >
                    <span>
                      <strong className="block">{reservation.label}</strong>
                      <span className="mt-1 block text-xs text-white/55">
                        Ver reserva y completar datos de asistentes
                      </span>
                    </span>
                    <ArrowRight size={19} aria-hidden="true" />
                  </Link>
                ))}
              </>
            ) : (
              <p className="mt-7 rounded-xl border border-white/15 p-5 text-sm leading-6 text-white/70">
                No tienes entradas ni reservas disponibles para un próximo
                evento. Los eventos pasados no aparecen aquí.
              </p>
            )}
            <button
              type="button"
              disabled={busy}
              onClick={logout}
              className="mt-7 min-h-11 text-sm text-[#ff1744] underline underline-offset-4"
            >
              Cerrar acceso y usar otro DNI
            </button>
          </>
        )}
      </div>
      <LegalFooterLinks compact />
    </main>
  );
}
