"use client";
import { useEffect, useId, useRef, useState } from "react";
import { mercadoPagoCardPayment } from "../../../lib/mercadopagoCard";

export default function MercadoPagoCardForm({
  publicKey,
  email,
  amountCents,
  onSubmit,
  onBusyChange,
}: {
  publicKey: string;
  email: string;
  amountCents: number;
  onSubmit: (payment: any) => Promise<void>;
  onBusyChange: (busy: boolean) => void;
}) {
  const containerId = `baby-card-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const callbacks = useRef({ onSubmit, onBusyChange });
  callbacks.current = { onSubmit, onBusyChange };
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    let disposed = false;
    let controller: { unmount: () => void | Promise<void> } | undefined;
    let submitting = false;
    setReady(false);
    const mp = new (window as any).MercadoPago(publicKey, { locale: "es-PE" });
    // Let the official Brick resolve country/BIN/issuer validation, rather
    // than choosing the first getPaymentMethods result or guessing CVV rules.
    mp.bricks()
      .create("cardPayment", containerId, {
        initialization: { amount: amountCents / 100, payer: { email } },
        customization: {
          paymentMethods: {
            types: { excluded: ["prepaid_card"] },
            minInstallments: 1,
            maxInstallments: 1,
          },
          visual: {
            style: {
              theme: "dark",
              customVariables: {
                baseColor: "#e60023",
                baseColorFirstVariant: "#c90020",
                baseColorSecondVariant: "#a6001b",
                buttonTextColor: "#ffffff",
                formBackgroundColor: "#0b0b0b",
                inputBackgroundColor: "#000000",
                textPrimaryColor: "#ffffff",
                textSecondaryColor: "#b3b3b3",
                outlinePrimaryColor: "#4d4d4d",
                outlineSecondaryColor: "#e60023",
                fontSizeMedium: "16px",
                formPadding: "0px",
              },
            },
          },
        },
        callbacks: {
          onReady: () => {
            if (!disposed) setReady(true);
          },
          onError: () => {
            // Provider errors can contain payment data. Never log them.
            if (!disposed)
              setError(
                "No pudimos cargar o validar el formulario seguro. Revisa los datos o vuelve a abrir la página.",
              );
          },
          onSubmit: async (form: any, additional: any) => {
            if (disposed || submitting) return;
            submitting = true;
            callbacks.current.onBusyChange(true);
            setError("");
            try {
              await callbacks.current.onSubmit(
                mercadoPagoCardPayment(form, additional),
              );
            } catch (failure) {
              if (!disposed)
                setError(
                  failure instanceof Error
                    ? failure.message
                    : "Revisa los datos de la tarjeta.",
                );
            } finally {
              submitting = false;
              callbacks.current.onBusyChange(false);
            }
          },
        },
      })
      .then(async (value: typeof controller) => {
        if (disposed) await value?.unmount();
        else controller = value;
      })
      .catch(() => {
        if (!disposed)
          setError(
            "No pudimos cargar el formulario de Mercado Pago. Vuelve a abrir la página.",
          );
      });
    return () => {
      disposed = true;
      void controller?.unmount();
    };
  }, [publicKey, email, amountCents, containerId]);
  return (
    <div className="mt-4 min-w-0">
      {!ready && !error && (
        <p role="status" className="py-4 text-sm text-white/50">
          Cargando formulario seguro…
        </p>
      )}
      <div id={containerId} />
      {error && (
        <p role="alert" className="mt-4 text-sm leading-6 text-red-300">
          {error}
        </p>
      )}
    </div>
  );
}
