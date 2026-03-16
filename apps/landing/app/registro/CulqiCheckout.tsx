"use client";

import { useEffect, useRef, useState } from "react";
import Script from "next/script";

declare global {
  interface Window {
    Culqi?: new (config: { publicKey: string }) => CulqiInstance;
  }
}

interface CulqiInstance {
  open: (opts: { order: string }) => void;
  options: (opts: { onClose?: () => void }) => void;
}

export type CulqiCheckoutProps = {
  orderId: string;
  paymentId: string;
  publicKey: string;
  onSuccess: (orderId: string) => void;
  onClose: () => void;
  /** Default true — opens the Culqi modal automatically on mount */
  autoOpen?: boolean;
};

const POLL_INTERVAL_MS = 3000;
const MAX_POLL_ATTEMPTS = 5;

export default function CulqiCheckout({
  orderId,
  paymentId,
  publicKey,
  onSuccess,
  onClose,
  autoOpen = true,
}: CulqiCheckoutProps) {
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const culqiRef = useRef<CulqiInstance | null>(null);
  // Track whether we have already kicked off a poll cycle so we don't double-fire
  const pollingRef = useRef(false);

  // Initialise the Culqi SDK and (optionally) open the modal automatically
  useEffect(() => {
    if (!scriptLoaded) return;
    if (!window.Culqi) return;

    const instance = new window.Culqi({ publicKey });
    culqiRef.current = instance;

    instance.options({
      onClose: () => {
        setModalOpen(false);
        if (!pollingRef.current) {
          pollingRef.current = true;
          pollPaymentStatus();
        }
      },
    });

    if (autoOpen) {
      setModalOpen(true);
      instance.open({ order: orderId });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scriptLoaded]);

  /** Manually open the Culqi modal (for external callers) */
  function open() {
    if (!culqiRef.current) return;
    setModalOpen(true);
    culqiRef.current.open({ order: orderId });
  }

  /**
   * Poll GET /api/payments/receipt?payment_id={paymentId} up to MAX_POLL_ATTEMPTS
   * times (every POLL_INTERVAL_MS ms). Calls onSuccess if status is 'paid',
   * otherwise calls onClose.
   */
  async function pollPaymentStatus() {
    for (let attempt = 1; attempt <= MAX_POLL_ATTEMPTS; attempt++) {
      try {
        const res = await fetch(
          `/api/payments/receipt?payment_id=${encodeURIComponent(paymentId)}`
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
        // network error — keep retrying
      }

      if (attempt < MAX_POLL_ATTEMPTS) {
        await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
      }
    }

    // Exhausted all attempts without a 'paid' status
    pollingRef.current = false;
    onClose();
  }

  return (
    <>
      <Script
        src="https://checkout.culqi.com/js/v4"
        strategy="afterInteractive"
        onLoad={() => setScriptLoaded(true)}
      />

      {/* Loading state — shown while Culqi.js hasn't finished loading */}
      {!scriptLoaded && (
        <div className="flex flex-col items-center gap-3 py-6">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-white/20 border-t-[#e91e63]" />
          <p className="text-sm text-white/70">Cargando pasarela de pago...</p>
        </div>
      )}

      {/* Processing state — shown while the Culqi modal is open */}
      {scriptLoaded && modalOpen && (
        <div className="flex flex-col items-center gap-3 py-6">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-white/20 border-t-[#e91e63]" />
          <p className="text-sm font-semibold text-white">Procesando pago...</p>
          <p className="text-xs text-white/60">
            Completa el pago en la ventana de Culqi.
          </p>
        </div>
      )}

      {/* Ready state — script loaded but modal is closed; offer manual re-open */}
      {scriptLoaded && !modalOpen && (
        <div className="flex flex-col items-center gap-3 py-4">
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
