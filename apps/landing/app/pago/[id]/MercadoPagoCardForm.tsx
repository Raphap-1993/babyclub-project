"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { LockKeyhole } from "lucide-react";
import { tokenizeMercadoPagoCard } from "../../../lib/mercadopagoCard";

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
  const sdk = useRef<any>(null);
  const bin = useRef("");
  const [ready, setReady] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [holder, setHolder] = useState("");
  const [documentType, setDocumentType] = useState("DNI");
  const [document, setDocument] = useState("");
  useEffect(() => {
    const mp = new (window as any).MercadoPago(publicKey, { locale: "es-PE" });
    sdk.current = mp;
    let disposed = false;
    let count = 0;
    const fields = [
      [
        "cardNumber",
        "baby-card-number",
        "Número de tarjeta",
        "1234 1234 1234 1234",
      ],
      ["expirationDate", "baby-card-expiration", "Vencimiento", "MM/AA"],
      ["securityCode", "baby-card-security", "Código de seguridad", "CVV"],
    ].map(([type, id, label, placeholder]) => {
      const field = mp.fields.create(type, {
        placeholder,
        srLabel: label,
        ariaRequired: true,
        style: {
          color: "#ffffff",
          fontSize: "16px",
          fontFamily: "Arial",
          height: "100%",
          placeholderColor: "#737373",
        },
      });
      field.on("ready", () => {
        count++;
        if (!disposed && count === 3) setReady(true);
      });
      field.on("error", () => {
        if (!disposed)
          setError(
            "No pudimos cargar los campos seguros. Vuelve a abrir la página.",
          );
      });
      if (type === "cardNumber")
        field.on("binChange", (event: any) => {
          bin.current = event.bin || "";
        });
      field.mount(id);
      return field;
    });
    return () => {
      disposed = true;
      fields.forEach((field) => field.unmount());
      sdk.current = null;
    };
  }, [publicKey]);
  async function pay(event: FormEvent) {
    event.preventDefault();
    if (submitting || !ready) return;
    setSubmitting(true);
    onBusyChange(true);
    setError("");
    try {
      const payment = await tokenizeMercadoPagoCard(sdk.current, {
        holder,
        documentType,
        document,
        email,
        bin: bin.current,
        amountCents,
      });
      await onSubmit(payment);
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Revisa los datos de la tarjeta e inténtalo nuevamente.",
      );
    } finally {
      setSubmitting(false);
      onBusyChange(false);
    }
  }
  const inputClass =
    "h-12 w-full min-w-0 rounded-lg border border-white/20 bg-black px-3 text-base text-white outline-none focus:border-red-400 focus:ring-1 focus:ring-red-400 disabled:opacity-50";
  return (
    <form onSubmit={pay} className="mt-6 space-y-5">
      {!ready && (
        <p role="status" className="text-sm text-white/50">
          Cargando formulario seguro…
        </p>
      )}
      <div>
        <p id="card-label" className="mb-2 text-sm text-white/70">
          Número de tarjeta
        </p>
        <div
          id="baby-card-number"
          role="group"
          aria-labelledby="card-label"
          className={`${inputClass} py-3`}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <p id="expiration-label" className="mb-2 text-sm text-white/70">
            Vencimiento
          </p>
          <div
            id="baby-card-expiration"
            role="group"
            aria-labelledby="expiration-label"
            className={`${inputClass} py-3`}
          />
        </div>
        <div>
          <p id="security-label" className="mb-2 text-sm text-white/70">
            Código de seguridad
          </p>
          <div
            id="baby-card-security"
            role="group"
            aria-labelledby="security-label"
            className={`${inputClass} py-3`}
          />
        </div>
      </div>
      <label className="block text-sm text-white/70">
        Nombre del titular
        <input
          required
          autoComplete="cc-name"
          className={`${inputClass} mt-2`}
          value={holder}
          onChange={(event) => setHolder(event.target.value)}
          maxLength={100}
          placeholder="Como aparece en la tarjeta"
          disabled={submitting}
        />
      </label>
      <div className="grid grid-cols-[90px_minmax(0,1fr)] gap-3">
        <label className="text-sm text-white/70">
          Tipo
          <select
            className={`${inputClass} mt-2`}
            value={documentType}
            onChange={(event) => {
              setDocumentType(event.target.value);
              setDocument("");
            }}
            disabled={submitting}
          >
            <option value="DNI">DNI</option>
            <option value="CE">C.E</option>
            <option value="RUC">RUC</option>
          </select>
        </label>
        <label className="text-sm text-white/70">
          Documento del titular
          <input
            required
            className={`${inputClass} mt-2`}
            value={document}
            onChange={(event) =>
              setDocument(event.target.value.replace(/[^a-zA-Z0-9]/g, ""))
            }
            inputMode={documentType === "CE" ? "text" : "numeric"}
            maxLength={
              documentType === "DNI" ? 8 : documentType === "RUC" ? 11 : 12
            }
            disabled={submitting}
          />
        </label>
      </div>
      {error && (
        <p role="alert" className="text-sm leading-6 text-red-300">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={!ready || submitting}
        className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-white p-4 font-semibold text-black disabled:cursor-wait disabled:opacity-50"
      >
        <LockKeyhole size={16} />
        {submitting
          ? "Procesando…"
          : `Pagar ${new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN" }).format(amountCents / 100)}`}
      </button>
      <p className="text-center text-xs text-white/45">
        Procesado de forma segura por Mercado Pago
      </p>
    </form>
  );
}
