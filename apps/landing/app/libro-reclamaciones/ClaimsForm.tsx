"use client";

import { FormEvent, useState } from "react";

type ClaimFormState = {
  claim_type: "reclamo" | "queja";
  consumer_name: string;
  doc_type: "dni" | "ce" | "passport";
  document_number: string;
  address: string;
  phone: string;
  email: string;
  service_description: string;
  event_reference: string;
  claimed_amount: string;
  detail: string;
  requested_solution: string;
  accepted: boolean;
};

const initialState: ClaimFormState = {
  claim_type: "reclamo",
  consumer_name: "",
  doc_type: "dni",
  document_number: "",
  address: "",
  phone: "",
  email: "",
  service_description: "Entradas digitales / reserva de mesa para evento BABY",
  event_reference: "",
  claimed_amount: "",
  detail: "",
  requested_solution: "",
  accepted: false,
};

export default function ClaimsForm() {
  const [form, setForm] = useState<ClaimFormState>(initialState);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{
    code: string;
    emailWarning?: string;
  } | null>(null);

  const update = <K extends keyof ClaimFormState>(
    key: K,
    value: ClaimFormState[K],
  ) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    if (!form.accepted) {
      setError("Confirma la declaración para registrar tu solicitud.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/reclamaciones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        setError(data?.error || "No se pudo registrar la solicitud.");
        return;
      }
      setSuccess({
        code: data.claimCode,
        emailWarning: data.emailWarning,
      });
      setForm(initialState);
    } catch (err: any) {
      setError(err?.message || "No se pudo registrar la solicitud.");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="rounded-3xl border border-emerald-400/40 bg-emerald-500/10 p-5 text-sm text-white">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-300">
          Solicitud registrada
        </p>
        <h2 className="mt-2 text-2xl font-semibold">Código {success.code}</h2>
        <p className="mt-2 leading-6 text-white/70">
          Conserva este código. BABY responderá en un plazo máximo de 30 días
          calendario al correo registrado.
        </p>
        {success.emailWarning ? (
          <p className="mt-3 rounded-2xl border border-amber-400/30 bg-amber-400/10 p-3 text-xs text-amber-100">
            {success.emailWarning}
          </p>
        ) : null}
        <button
          type="button"
          onClick={() => setSuccess(null)}
          className="mt-4 rounded-full px-4 py-2 text-xs font-semibold btn-smoke-outline transition"
        >
          Registrar otra solicitud
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-4 rounded-3xl border border-white/10 bg-[#0a0a0a] p-5"
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-2 text-sm font-semibold text-white">
          Tipo de solicitud
          <select
            value={form.claim_type}
            onChange={(e) =>
              update(
                "claim_type",
                e.target.value as ClaimFormState["claim_type"],
              )
            }
            className="w-full rounded-xl border border-white/10 bg-[#111111] px-4 py-3 text-sm text-white focus:border-white focus:outline-none"
          >
            <option value="reclamo">Reclamo</option>
            <option value="queja">Queja</option>
          </select>
        </label>
        <Field
          label="Nombres y apellidos"
          value={form.consumer_name}
          onChange={(value) => update("consumer_name", value)}
          required
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-[0.6fr,1fr]">
        <label className="space-y-2 text-sm font-semibold text-white">
          Tipo doc
          <select
            value={form.doc_type}
            onChange={(e) =>
              update("doc_type", e.target.value as ClaimFormState["doc_type"])
            }
            className="w-full rounded-xl border border-white/10 bg-[#111111] px-4 py-3 text-sm text-white focus:border-white focus:outline-none"
          >
            <option value="dni">DNI</option>
            <option value="ce">Carné de extranjería</option>
            <option value="passport">Pasaporte</option>
          </select>
        </label>
        <Field
          label="Número de documento"
          value={form.document_number}
          onChange={(value) => update("document_number", value)}
          required
        />
      </div>

      <Field
        label="Domicilio"
        value={form.address}
        onChange={(value) => update("address", value)}
        required
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <Field
          label="Teléfono"
          value={form.phone}
          onChange={(value) => update("phone", value)}
          required
        />
        <Field
          label="Correo electrónico"
          value={form.email}
          onChange={(value) => update("email", value)}
          required
          type="email"
        />
      </div>

      <Field
        label="Producto o servicio"
        value={form.service_description}
        onChange={(value) => update("service_description", value)}
        required
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <Field
          label="Evento, reserva o código"
          value={form.event_reference}
          onChange={(value) => update("event_reference", value)}
          placeholder="Opcional"
        />
        <Field
          label="Monto reclamado"
          value={form.claimed_amount}
          onChange={(value) => update("claimed_amount", value)}
          placeholder="Opcional"
          type="number"
          min="0"
          step="0.01"
        />
      </div>

      <TextArea
        label="Detalle"
        value={form.detail}
        onChange={(value) => update("detail", value)}
        required
      />
      <TextArea
        label="Pedido del consumidor"
        value={form.requested_solution}
        onChange={(value) => update("requested_solution", value)}
        required
      />

      <label className="flex items-start gap-3 rounded-2xl border border-white/10 bg-black/30 p-3 text-xs leading-5 text-white/70">
        <input
          type="checkbox"
          checked={form.accepted}
          onChange={(e) => update("accepted", e.target.checked)}
          className="mt-1 h-4 w-4 shrink-0 accent-[#e91e63]"
        />
        <span>
          Declaro que la información registrada es verdadera y autorizo el
          tratamiento de mis datos para atender esta solicitud.
        </span>
      </label>

      {error ? (
        <p className="text-xs font-semibold text-[#ff9a9a]">{error}</p>
      ) : null}

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-full px-4 py-3 text-sm font-semibold uppercase tracking-wide btn-attention-red transition disabled:opacity-60"
      >
        {loading ? "Registrando..." : "Registrar solicitud"}
      </button>
    </form>
  );
}

function Field({
  label,
  value,
  onChange,
  required,
  placeholder,
  type = "text",
  min,
  step,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  placeholder?: string;
  type?: string;
  min?: string;
  step?: string;
}) {
  return (
    <label className="space-y-2 text-sm font-semibold text-white">
      {label}
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        placeholder={placeholder}
        type={type}
        min={min}
        step={step}
        className="w-full rounded-xl border border-white/10 bg-[#111111] px-4 py-3 text-sm text-white placeholder:text-white/40 focus:border-white focus:outline-none"
      />
    </label>
  );
}

function TextArea({
  label,
  value,
  onChange,
  required,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
}) {
  return (
    <label className="space-y-2 text-sm font-semibold text-white">
      {label}
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        rows={4}
        className="w-full resize-y rounded-xl border border-white/10 bg-[#111111] px-4 py-3 text-sm text-white placeholder:text-white/40 focus:border-white focus:outline-none"
      />
    </label>
  );
}
