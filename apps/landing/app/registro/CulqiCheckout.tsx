"use client";

import { useEffect, useRef, useState } from "react";
import Script from "next/script";
import {
  buildCulqiCheckoutConfig,
  extractCulqiTokenId,
  extractCulqiTokenInstallments,
  getCulqiErrorMessage,
  shouldPollAfterCulqiClose,
  type CulqiCloseEvent,
} from "../../lib/culqiCheckout";

declare global {
  interface Window {
    CulqiCheckout?: new (
      publicKey: string,
      config: Record<string, unknown>,
    ) => CulqiInstance;
  }
}

type CulqiToken = {
  id?: string;
  type?: string;
  email?: string;
  metadata?: {
    installments?: number;
  };
};

type CulqiError = {
  user_message?: string;
  merchant_message?: string;
  message?: string;
};

interface CulqiInstance {
  open: () => void;
  close: () => void;
  token: CulqiToken | null;
  order: { id?: string } | null;
  error: CulqiError | null;
  closeEvent: CulqiCloseEvent | null;
  culqi: () => void;
  closeCheckout: () => void;
}

export type CulqiCheckoutProps = {
  orderId: string;
  paymentId: string;
  publicKey: string;
  amount: number;
  currencyCode: string;
  customerEmail?: string | null;
  title?: string;
  onSuccess: (orderId: string) => void;
  onClose: (state: { awaitingPayment: boolean }) => void;
  autoOpen?: boolean;
};

const CULQI_RSA_ID = process.env.NEXT_PUBLIC_CULQI_RSA_ID ?? "";
const CULQI_RSA_PUBLIC_KEY =
  process.env.NEXT_PUBLIC_CULQI_RSA_PUBLIC_KEY ?? "";
const POLL_INTERVAL_MS = 3000;
const MAX_POLL_ATTEMPTS = 5;

export default function CulqiCheckout({
  orderId,
  paymentId,
  publicKey,
  amount,
  currencyCode,
  customerEmail,
  title = "BabyClub",
  onSuccess,
  onClose,
  autoOpen = true,
}: CulqiCheckoutProps) {
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [processingCharge, setProcessingCharge] = useState(false);
  const culqiRef = useRef<CulqiInstance | null>(null);
  const pollingRef = useRef(false);

  async function pollPaymentStatus() {
    if (pollingRef.current) return;
    pollingRef.current = true;

    for (let attempt = 1; attempt <= MAX_POLL_ATTEMPTS; attempt++) {
      try {
        const res = await fetch(
          `/api/payments/receipt?payment_id=${encodeURIComponent(paymentId)}`,
        );
        if (res.ok) {
          const data = await res.json().catch(() => ({}));
          const status: string = data?.receipt?.status ?? "";
          if (status === "paid") {
            pollingRef.current = false;
            onSuccess(orderId);
            return;
          }
        }
      } catch {
        // keep retrying
      }

      if (attempt < MAX_POLL_ATTEMPTS) {
        await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
      }
    }

    pollingRef.current = false;
    onClose({ awaitingPayment: true });
  }

  async function handleToken(token: CulqiToken | null) {
    const tokenId = extractCulqiTokenId(token);
    if (!tokenId) {
      setCheckoutError("Culqi no devolvió un token válido para procesar el pago.");
      return;
    }

    setProcessingCharge(true);
    setCheckoutError(null);
    setModalOpen(false);

    try {
      const res = await fetch("/api/payments/culqi/charge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payment_id: paymentId,
          token_id: tokenId,
          email: token?.email || customerEmail || undefined,
          installments: extractCulqiTokenInstallments(token),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.success !== true) {
        setCheckoutError(
          typeof data?.error === "string"
            ? data.error
            : "No se pudo procesar el cargo en Culqi.",
        );
        return;
      }

      if (data?.status === "paid") {
        onSuccess(orderId);
        return;
      }

      await pollPaymentStatus();
    } catch (error: any) {
      setCheckoutError(error?.message || "No se pudo procesar el cargo en Culqi.");
    } finally {
      setProcessingCharge(false);
    }
  }

  async function handleCulqiAction() {
    const instance = culqiRef.current;
    if (!instance) return;

    if (instance.token) {
      instance.close();
      await handleToken(instance.token);
      return;
    }

    if (instance.order) {
      instance.close();
      setCheckoutError(null);
      setModalOpen(false);
      await pollPaymentStatus();
      return;
    }

    if (instance.error) {
      setModalOpen(false);
      setCheckoutError(getCulqiErrorMessage(instance.error));
    }
  }

  function handleCheckoutClose() {
    const instance = culqiRef.current;
    const awaitingPayment = shouldPollAfterCulqiClose(instance?.closeEvent);
    setModalOpen(false);

    if (awaitingPayment) {
      void pollPaymentStatus();
      return;
    }

    onClose({ awaitingPayment: false });
  }

  useEffect(() => {
    if (!scriptLoaded) return;
    if (!window.CulqiCheckout) {
      setCheckoutError(
        "No se pudo cargar la pasarela de Culqi. Recarga la página e inténtalo otra vez.",
      );
      return;
    }

    const config = buildCulqiCheckoutConfig({
      orderId,
      amount,
      currencyCode,
      customerEmail,
      title,
      rsaId: CULQI_RSA_ID,
      rsaPublicKey: CULQI_RSA_PUBLIC_KEY,
    });

    const instance = new window.CulqiCheckout(publicKey, config);
    instance.culqi = () => {
      void handleCulqiAction();
    };
    instance.closeCheckout = () => {
      handleCheckoutClose();
    };
    culqiRef.current = instance;

    if (autoOpen) {
      setCheckoutError(null);
      setModalOpen(true);
      instance.open();
    } else {
      setModalOpen(false);
    }
  }, [
    amount,
    autoOpen,
    currencyCode,
    customerEmail,
    orderId,
    publicKey,
    scriptLoaded,
    title,
  ]);

  function open() {
    if (!culqiRef.current) {
      setCheckoutError(
        "No se pudo inicializar la pasarela de Culqi. Recarga la página e inténtalo otra vez.",
      );
      return;
    }
    setCheckoutError(null);
    setModalOpen(true);
    culqiRef.current.open();
  }

  return (
    <>
      <Script
        src="https://js.culqi.com/checkout-js"
        strategy="afterInteractive"
        onLoad={() => setScriptLoaded(true)}
      />

      {!scriptLoaded && (
        <div className="flex flex-col items-center gap-3 py-6">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-white/20 border-t-[#e91e63]" />
          <p className="text-sm text-white/70">Cargando pasarela de pago...</p>
        </div>
      )}

      {scriptLoaded && (modalOpen || processingCharge) && (
        <div className="flex flex-col items-center gap-3 py-6">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-white/20 border-t-[#e91e63]" />
          <p className="text-sm font-semibold text-white">
            {processingCharge ? "Procesando cargo..." : "Procesando pago..."}
          </p>
          <p className="text-xs text-white/60">
            {processingCharge
              ? "Estamos confirmando tu pago con Culqi."
              : "Completa el pago en la ventana de Culqi."}
          </p>
        </div>
      )}

      {scriptLoaded && !modalOpen && !processingCharge && (
        <div className="flex flex-col items-center gap-3 py-4">
          {checkoutError && (
            <div className="w-full rounded-2xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-100">
              {checkoutError}
            </div>
          )}
          <p className="text-xs text-white/60">
            Si el modal no se abrió automáticamente, haz click abajo.
          </p>
          <button
            type="button"
            onClick={open}
            className="rounded-full px-5 py-2.5 text-sm font-semibold btn-attention-red transition"
          >
            Abrir ventana de pago
          </button>
        </div>
      )}
    </>
  );
}
