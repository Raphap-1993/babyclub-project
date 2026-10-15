"use client";
import { useEffect, useRef, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { isMercadoPagoChallengeComplete } from "shared/payments/mercadopagoChallenge";

export default function MercadoPagoChallenge({
  url,
  expiresAt,
  onCheck,
}: {
  url: string;
  expiresAt: string;
  onCheck: () => Promise<unknown>;
}) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [checking, setChecking] = useState(false);
  const [notice, setNotice] = useState("");
  const [expired, setExpired] = useState(Date.parse(expiresAt) <= Date.now());
  useEffect(() => {
    const timer = setInterval(
      () => setExpired(Date.parse(expiresAt) <= Date.now()),
      1000,
    );
    return () => clearInterval(timer);
  }, [expiresAt]);
  useEffect(() => {
    const completed = (event: MessageEvent) => {
      if (
        isMercadoPagoChallengeComplete(event, frame.current?.contentWindow, url)
      ) {
        setNotice(
          "Verificación completada. Estamos consultando el resultado del pago.",
        );
        onCheck().catch(() =>
          setNotice("Seguimos verificando el pago. Conserva este enlace."),
        );
      }
    };
    window.addEventListener("message", completed);
    return () => window.removeEventListener("message", completed);
  }, [url, onCheck]);
  async function check() {
    setChecking(true);
    try {
      await onCheck();
    } catch {
      setNotice("No pudimos consultar el estado. Intenta verificar de nuevo.");
    } finally {
      setChecking(false);
    }
  }
  return (
    <>
      <ShieldCheck className="mb-4 text-red-400" size={30} />
      <h2 className="text-2xl font-semibold">Confirma tu pago con el banco</h2>
      <p className="mt-3 text-sm leading-6 text-white/65">
        Completa la verificación de tu tarjeta en el recuadro. Tu entrada se
        emitirá cuando el pago quede acreditado.
      </p>
      {expired ? (
        <p role="status" className="my-5 text-sm text-amber-200">
          El plazo de verificación terminó. Estamos confirmando el estado con
          Mercado Pago antes de permitir otro intento.
        </p>
      ) : (
        <iframe
          ref={frame}
          src={url}
          title="Verificación bancaria 3D Secure"
          referrerPolicy="no-referrer"
          className="mt-6 h-[520px] w-full min-w-0 rounded-xl border-0 bg-white sm:h-[560px]"
        />
      )}
      <button
        type="button"
        onClick={check}
        disabled={checking}
        className="mt-5 w-full rounded-xl border border-white/25 px-4 py-3 text-sm font-medium disabled:opacity-50"
      >
        {checking ? "Consultando…" : "Ya terminé · Verificar pago"}
      </button>
      <p className="mt-3 text-xs leading-5 text-white/45">
        Puedes retomar esta misma compra si recargas o cierras la página.
      </p>
      {notice && (
        <p role="status" className="mt-4 text-sm text-white/70">
          {notice}
        </p>
      )}
    </>
  );
}
