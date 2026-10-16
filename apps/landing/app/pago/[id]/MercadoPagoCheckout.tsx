"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import MercadoPagoCardForm from "./MercadoPagoCardForm";
import MercadoPagoYapeForm from "./MercadoPagoYapeForm";
import {
  isYapeAmountAllowed,
  mercadoPagoDeclineMessage,
} from "shared/payments/mercadopagoYape";
import MercadoPagoChallenge from "./MercadoPagoChallenge";
import Script from "next/script";
import {
  ArrowLeft,
  CheckCircle2,
  CreditCard,
  LoaderCircle,
  ShieldCheck,
  Smartphone,
} from "lucide-react";

type Checkout = {
  id: string;
  status: string;
  environment: "test" | "live";
  amountCents: number;
  publicKey: string;
  email: string;
  paymentMethods: ("card" | "yape")[];
  concept: string;
  quantity: number;
  expiresAt: string;
  buyerTicketId: string | null;
  nominationUrl: string | null;
  attemptStatus?: string | null;
  paymentDetail?: string | null;
  challenge?: { url: string; expiresAt: string } | null;
  event?: { name: string };
};
export default function MercadoPagoCheckout({ id }: { id: string }) {
  const [checkout, setCheckout] = useState<Checkout | null>(null);
  const [token, setToken] = useState("");
  const [sdkReady, setSdkReady] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [tokenizing, setTokenizing] = useState(false);
  const [method, setMethod] = useState<"card" | "yape">("card");
  const [brickVersion, setBrickVersion] = useState(0);
  const lastPayment = useRef<any>(null);
  const request = useCallback(
    async (method = "GET", body?: any) => {
      const response = await fetch(
        `/api/payments/mercadopago/sessions/${id}${method === "POST" ? "/pay" : ""}`,
        {
          method,
          headers: {
            Authorization: `Bearer ${token}`,
            ...(body ? { "Content-Type": "application/json" } : {}),
          },
          body: body ? JSON.stringify(body) : undefined,
          cache: "no-store",
        },
      );
      const data = await response.json();
      if (!response.ok)
        throw Object.assign(
          new Error(data.error || "No pudimos verificar tu compra."),
          { code: data.code },
        );
      setCheckout(data.checkout);
      if (
        data.checkout.status === "awaiting_payment" &&
        ["failed", "canceled"].includes(data.checkout.attemptStatus)
      )
        setMessage(mercadoPagoDeclineMessage(data.checkout.paymentDetail));
      return data.checkout as Checkout;
    },
    [id, token],
  );
  useEffect(() => {
    const value =
      new URLSearchParams(location.hash.slice(1)).get("token") || "";
    if (/^[a-f0-9]{64}$/.test(value)) setToken(value);
    else setMessage("Abre el enlace de compra completo para continuar.");
  }, []);
  useEffect(() => {
    if (!token) return;
    if (
      ["fulfilled", "refunded", "review", "expired"].includes(
        checkout?.status || "",
      )
    )
      return;
    request().catch((error) => setMessage(error.message));
    const timer = setInterval(() => {
      request().catch(() => {});
    }, 10_000);
    return () => clearInterval(timer);
  }, [request, token, checkout?.status]);
  const submit = useCallback(
    async (payment: any) => {
      setBusy(true);
      setMessage("");
      lastPayment.current = payment;
      try {
        const state = await request("POST", payment);
        if (state.status === "awaiting_payment") {
          setMessage(mercadoPagoDeclineMessage(state.paymentDetail));
          setBrickVersion((value) => value + 1);
        }
      } catch (error: any) {
        setMessage(error.message);
        if (error.code === "mercadopago_request_rejected")
          setBrickVersion((value) => value + 1);
        else request().catch(() => {});
      } finally {
        setBusy(false);
      }
    },
    [request],
  );
  const payable =
    checkout?.status === "awaiting_payment" &&
    Date.parse(checkout.expiresAt) > Date.now();
  useEffect(() => {
    if (checkout?.status !== "fulfilled" && checkout?.status !== "expired")
      return;
    for (const key of Object.keys(sessionStorage)) {
      if (key.startsWith("baby-mp-request:")) {
        try {
          if (
            JSON.parse(sessionStorage.getItem(key) || "{}").checkout_token ===
            token
          )
            sessionStorage.removeItem(key);
        } catch {}
      }
    }
  }, [checkout?.status, token]);
  const completed = checkout?.status === "fulfilled";
  const yapeAvailable = checkout?.paymentMethods?.includes("yape") === true;
  const pending =
    checkout?.status === "processing" || checkout?.status === "paid";
  const checkChallenge = useCallback(() => request(), [request]);
  return (
    <main className="min-h-screen bg-black px-4 py-7 text-white md:px-8 md:py-10">
      <Script
        src="https://sdk.mercadopago.com/js/v2"
        onReady={() => setSdkReady(true)}
        onError={() =>
          setMessage(
            "No pudimos conectar con Mercado Pago. Reintenta en unos minutos.",
          )
        }
      />
      <div className="mx-auto max-w-5xl">
        <header className="mb-10 flex items-center justify-between gap-4">
          <Link href="/" aria-label="BABY, inicio">
            <img
              src="/images/baby-logo.png"
              alt="BABY"
              width={138}
              height={42}
            />
          </Link>
          <Link
            href="/"
            className="flex items-center gap-2 text-sm text-white/65"
          >
            <ArrowLeft size={16} /> Volver a eventos
          </Link>
        </header>
        <div className="grid items-start gap-7 md:grid-cols-[.8fr_1.2fr]">
          <aside className="rounded-2xl border border-white/15 bg-[#0b0b0b] p-6 md:sticky md:top-8">
            <span className="text-xs uppercase tracking-[.22em] text-red-400">
              {checkout?.environment === "test"
                ? "Compra de prueba"
                : "Tu compra"}
            </span>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight">
              {checkout?.event?.name || "Tu noche en BABY"}
            </h1>
            <p className="mt-6 text-lg">{checkout?.concept}</p>
            <p className="mt-1 text-sm text-white/55">
              {checkout?.quantity || "—"}{" "}
              {checkout?.quantity === 1
                ? "entrada incluida"
                : "entradas incluidas"}
            </p>
            <div className="my-6 h-px bg-white/15" />
            <div className="flex justify-between gap-4">
              <span>Total</span>
              <strong className="text-2xl">
                {checkout
                  ? new Intl.NumberFormat("es-PE", {
                      style: "currency",
                      currency: "PEN",
                    }).format(checkout.amountCents / 100)
                  : "—"}
              </strong>
            </div>
            <p className="mt-6 flex items-start gap-2 text-xs leading-5 text-white/50">
              <ShieldCheck size={16} className="mt-0.5 shrink-0" /> Mercado Pago
              procesa tu pago de forma segura. BABY no almacena los datos de tu
              tarjeta ni el código de aprobación de Yape.
            </p>
          </aside>
          <section
            className="min-w-0 rounded-2xl border border-white/15 bg-[#0b0b0b] p-4 sm:p-6"
            aria-live="polite"
          >
            {completed ? (
              <>
                <CheckCircle2 size={36} className="mb-5 text-green-400" />
                <h2 className="text-2xl font-semibold">
                  Tu entrada está lista
                </h2>
                <p className="my-4 text-sm leading-6 text-white/60">
                  Pago confirmado. Ya puedes abrir tu QR y completar los datos
                  de tus acompañantes.
                </p>
                <Link
                  href={`/ticket/${checkout.buyerTicketId}`}
                  className="mt-3 block rounded-xl bg-white p-4 text-center font-semibold text-black"
                >
                  Ver mi QR
                </Link>
                <Link
                  href={checkout.nominationUrl!}
                  className="mt-5 block text-center text-sm text-red-400 underline underline-offset-4"
                >
                  Mis entradas y acompañantes
                </Link>
              </>
            ) : checkout?.challenge ? (
              <MercadoPagoChallenge
                key={checkout.challenge.url}
                url={checkout.challenge.url}
                expiresAt={checkout.challenge.expiresAt}
                onCheck={checkChallenge}
              />
            ) : pending ? (
              <>
                <LoaderCircle className="mb-5 animate-spin text-red-400" />
                <h2 className="text-2xl font-semibold">
                  {checkout?.status === "paid"
                    ? "Estamos preparando tus entradas"
                    : "Verificando tu pago"}
                </h2>
                <p className="mt-4 text-sm leading-6 text-white/60">
                  Tu compra se confirmará automáticamente cuando Mercado Pago
                  acredite el pago. Conserva este enlace para consultar su
                  estado.
                </p>
                {message && lastPayment.current && (
                  <button
                    className="mt-5 text-sm text-red-400 underline"
                    disabled={busy}
                    onClick={() => submit(lastPayment.current)}
                  >
                    Verificar el mismo intento
                  </button>
                )}
              </>
            ) : payable ? (
              <>
                <h2 className="mb-2 flex items-center gap-2 text-xl font-semibold">
                  <CreditCard size={20} /> Paga con Mercado Pago
                </h2>
                <p className="mb-5 text-sm text-white/55">
                  {yapeAvailable
                    ? "Elige cómo pagar. Tus entradas se generan al confirmar el pago."
                    : "Paga tu mesa o box con tarjeta de débito o crédito. Tus QR se generan al confirmar el pago."}
                </p>
                {yapeAvailable && (
                  <div
                    role="group"
                    aria-label="Medio de pago"
                    className="mb-5 grid grid-cols-2 gap-3"
                  >
                    {(["card", "yape"] as const).map((option) => (
                      <button
                        key={option}
                        type="button"
                        aria-pressed={method === option}
                        disabled={
                          busy ||
                          tokenizing ||
                          (option === "yape" &&
                            !isYapeAmountAllowed(checkout.amountCents))
                        }
                        onClick={() => {
                          setMethod(option);
                          setMessage("");
                        }}
                        className={`flex min-h-12 items-center justify-center gap-2 rounded-xl border px-3 py-3 text-sm font-semibold transition-colors disabled:opacity-40 ${method === option ? "border-red-500 bg-red-500/10 text-white" : "border-white/20 text-white/60 hover:border-white/40"}`}
                      >
                        {option === "card" ? (
                          <CreditCard size={19} />
                        ) : (
                          <Smartphone size={19} />
                        )}{" "}
                        {option === "card" ? "Tarjeta" : "Yape"}
                      </button>
                    ))}
                  </div>
                )}
                {yapeAvailable &&
                  !isYapeAmountAllowed(checkout.amountCents) && (
                    <p className="mb-4 text-xs leading-5 text-white/55">
                      Yape admite compras entre S/ 1 y S/ 2,000. Puedes pagar
                      este importe con tarjeta.
                    </p>
                  )}
                {sdkReady ? (
                  method === "yape" && yapeAvailable ? (
                    <MercadoPagoYapeForm
                      key={`yape-${brickVersion}`}
                      publicKey={checkout.publicKey}
                      amountCents={checkout.amountCents}
                      environment={checkout.environment}
                      onSubmit={submit}
                      onBusyChange={setTokenizing}
                    />
                  ) : (
                    <MercadoPagoCardForm
                      key={brickVersion}
                      publicKey={checkout.publicKey}
                      email={checkout.email}
                      amountCents={checkout.amountCents}
                      onSubmit={submit}
                      onBusyChange={setTokenizing}
                    />
                  )
                ) : (
                  <p className="py-6 text-sm text-white/50">
                    Cargando formulario seguro…
                  </p>
                )}
                {busy && (
                  <p className="mt-4 text-sm text-white/60">
                    Confirmando el pago…
                  </p>
                )}
              </>
            ) : checkout ? (
              <>
                <h2 className="text-xl font-semibold">
                  {checkout.status === "review"
                    ? "Estamos revisando tu compra"
                    : checkout.status === "refunded"
                      ? "Pago devuelto"
                      : "Esta sesión de compra venció"}
                </h2>
                <p className="mt-4 text-sm text-white/60">
                  {checkout.status === "review"
                    ? "No realices otro pago. Contacta a BABY e indica la referencia de esta compra."
                    : checkout.status === "refunded"
                      ? "Las entradas de esta compra ya no están activas."
                      : "Vuelve al evento para iniciar una nueva compra."}
                </p>
              </>
            ) : (
              <p className="text-sm text-white/60">Cargando tu compra…</p>
            )}
            {message && !busy && !tokenizing && !pending && !completed && (
              <p
                role="alert"
                className="mt-5 rounded-lg border border-red-500/25 bg-red-500/10 p-3 text-sm leading-6 text-red-200"
              >
                {message}
              </p>
            )}
          </section>
        </div>
        <footer className="mt-12 border-t border-white/10 py-5 text-center text-xs text-white/40">
          <Link
            href="/terminos-condiciones"
            className="underline underline-offset-4"
          >
            Términos y condiciones
          </Link>
          <span className="mx-3">·</span>
          <Link
            href="/politica-privacidad"
            className="underline underline-offset-4"
          >
            Privacidad
          </Link>
        </footer>
      </div>
    </main>
  );
}
