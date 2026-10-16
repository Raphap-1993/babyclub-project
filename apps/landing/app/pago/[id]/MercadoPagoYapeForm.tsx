"use client";
import { useRef, useState, type FormEvent } from "react";
import { LockKeyhole, Smartphone } from "lucide-react";
import { tokenizeMercadoPagoYape } from "../../../lib/mercadopagoYape";

export default function MercadoPagoYapeForm({
  publicKey,
  amountCents,
  environment,
  onSubmit,
  onBusyChange,
}: {
  publicKey: string;
  amountCents: number;
  environment: "test" | "live";
  onSubmit: (payment: any) => Promise<void>;
  onBusyChange: (busy: boolean) => void;
}) {
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const inFlight = useRef(false);
  async function pay(event: FormEvent) {
    event.preventDefault();
    if (inFlight.current) return;
    inFlight.current = true;
    setSubmitting(true);
    onBusyChange(true);
    setError("");
    try {
      const sdk = new (window as any).MercadoPago(publicKey, {
        locale: "es-PE",
      });
      const payment = await tokenizeMercadoPagoYape(sdk, {
        phoneNumber: phone,
        otp,
        amountCents,
        environment,
      });
      setOtp("");
      await onSubmit(payment);
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "No pudimos conectar con Yape. Inténtalo nuevamente.",
      );
    } finally {
      setOtp("");
      setSubmitting(false);
      onBusyChange(false);
      inFlight.current = false;
    }
  }
  const inputClass =
    "mt-2 h-12 w-full min-w-0 rounded-lg border border-white/20 bg-black px-3 text-base text-white outline-none focus:border-[#e60023] focus:ring-1 focus:ring-[#e60023] disabled:opacity-50";
  return (
    <form onSubmit={pay} className="mt-5 space-y-5">
      <div className="rounded-xl border border-white/10 bg-white/[.03] p-4 text-sm leading-6 text-white/70">
        <p className="mb-2 flex items-center gap-2 font-medium text-white">
          <Smartphone size={18} /> Abre tu app Yape
        </p>
        <p>
          En el menú, elige{" "}
          <strong className="text-white">Código de aprobación</strong> e ingresa
          aquí los 6 dígitos. Es un código temporal para confirmar esta compra.
        </p>
      </div>
      {environment === "test" && (
        <p className="text-xs leading-5 text-amber-200">
          Modo de prueba. Usa el celular 111111111 y el código 123456. No se
          realizará un cobro real.
        </p>
      )}
      <label className="block text-sm text-white/70">
        Celular asociado a Yape
        <input
          className={inputClass}
          type="tel"
          inputMode="numeric"
          autoComplete="tel-national"
          placeholder="9 dígitos"
          pattern="[0-9]{9}"
          maxLength={9}
          required
          value={phone}
          onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
          disabled={submitting}
        />
      </label>
      <label className="block text-sm text-white/70">
        Código de aprobación
        <input
          className={`${inputClass} tracking-[.3em]`}
          type="password"
          inputMode="numeric"
          autoComplete="off"
          placeholder="6 dígitos"
          pattern="[0-9]{6}"
          maxLength={6}
          required
          value={otp}
          onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
          disabled={submitting}
          aria-describedby="yape-code-help"
        />
      </label>
      <p id="yape-code-help" className="text-xs leading-5 text-white/50">
        Usa el código de aprobación, no tu clave de ingreso a Yape. El monto
        debe estar dentro del límite que tienes configurado en tu app.
      </p>
      {error && (
        <p role="alert" className="text-sm leading-6 text-red-300">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={submitting}
        className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#e60023] p-4 font-semibold text-white transition-colors hover:bg-[#c90020] disabled:cursor-wait disabled:opacity-50"
      >
        <LockKeyhole size={16} />{" "}
        {submitting
          ? "Procesando…"
          : `Pagar ${new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN" }).format(amountCents / 100)} con Yape`}
      </button>
      <p className="text-center text-xs leading-5 text-white/45">
        Mercado Pago confirma el pago y BABY genera tu QR de ingreso.
      </p>
    </form>
  );
}
