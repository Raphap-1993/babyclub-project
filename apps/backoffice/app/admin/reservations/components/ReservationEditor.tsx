// apps/backoffice/app/admin/reservations/components/ReservationEditor.tsx
"use client";

import { useMemo, useState, useTransition } from "react";
import { DOCUMENT_TYPES, type DocumentType, validateDocument } from "shared/document";
import { authedFetch } from "@/lib/authedFetch";

type Props = {
  id: string;
  initial: { full_name: string; email: string | null; phone: string | null; status: string; doc_type?: string | null; document?: string | null };
};

export default function ReservationEditor({ id, initial }: Props) {
  const [fullName, setFullName] = useState(initial.full_name);
  const [email, setEmail] = useState(initial.email || "");
  const [phone, setPhone] = useState(initial.phone || "");
  const [docType, setDocType] = useState<DocumentType>((initial.doc_type as DocumentType) || "dni");
  const [document, setDocument] = useState(initial.document || "");
  const [status, setStatus] = useState<"pending" | "approved" | "rejected">(normalizeStatus(initial.status));
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const dirty = useMemo(() => {
    return (
      fullName.trim() !== initial.full_name.trim() ||
      (email || "") !== (initial.email || "") ||
      (phone || "") !== (initial.phone || "") ||
      (docType || "dni") !== ((initial.doc_type as DocumentType) || "dni") ||
      (document || "") !== (initial.document || "") ||
      status !== normalizeStatus(initial.status)
    );
  }, [fullName, email, phone, status, initial, docType, document]);

  const onSave = () => {
    setMessage(null);
    setError(null);
    if (!validateDocument(docType, document)) {
      setError("Documento inválido");
      return;
    }
    startTransition(async () => {
      const payload = {
        id,
        full_name: fullName.trim(),
        email: email.trim(),
        phone: phone.trim(),
        status,
        doc_type: docType,
        document: document.trim(),
      };
      const res = await authedFetch("/api/reservations/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        setError(data?.error || "No se pudo guardar");
        return;
      }
      if (data.emailError) {
        setError(`Reserva aprobada, pero el correo no salió: ${data.emailError}`);
      } else if (data.emailSent) {
        setMessage("Guardado y correo enviado al cliente.");
      } else {
        setMessage("Cambios guardados.");
      }
    });
  };

  return (
    <div className="space-y-3 rounded-2xl border border-white/10 bg-[#0c0c0c] p-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-white/50">Editar y aprobar</p>
          <p className="text-sm text-white/70">Ajusta los datos del contacto y cambia el estado.</p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-[12px] font-semibold ${
            status === "approved"
              ? "bg-emerald-500/20 text-emerald-300"
              : status === "rejected"
                ? "bg-[#ff5f5f]/20 text-[#ff9a9a]"
                : "bg-white/5 text-white/70"
          }`}
        >
          {status}
        </span>
      </div>
      {(error || message) && (
        <div className="space-y-1">
          {error && <p className="text-xs text-[#ff9a9a]">{error}</p>}
          {message && <p className="text-xs text-emerald-200">{message}</p>}
        </div>
      )}

      <div className="space-y-2">
        <label className="text-xs uppercase tracking-[0.1em] text-white/60">Nombre completo</label>
        <input
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          className="w-full rounded-xl border border-white/10 bg-[#111111] px-3 py-2 text-sm text-white placeholder:text-white/40 focus:border-white focus:outline-none"
          placeholder="Nombre del contacto"
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <label className="text-xs uppercase tracking-[0.1em] text-white/60">Tipo documento</label>
          <select
            value={docType}
            onChange={(e) => setDocType(e.target.value as DocumentType)}
            className="w-full rounded-xl border border-white/10 bg-[#111111] px-3 py-2 text-sm text-white focus:border-white focus:outline-none"
          >
            {DOCUMENT_TYPES.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <label className="text-xs uppercase tracking-[0.1em] text-white/60">Nro. documento</label>
          <input
            value={document}
            onChange={(e) => setDocument(e.target.value)}
            inputMode={docType === "dni" || docType === "ruc" ? "numeric" : "text"}
            className="w-full rounded-xl border border-white/10 bg-[#111111] px-3 py-2 text-sm text-white placeholder:text-white/40 focus:border-white focus:outline-none"
            placeholder={docType === "dni" ? "00000000" : "Documento"}
          />
        </div>
        <div className="space-y-2">
          <label className="text-xs uppercase tracking-[0.1em] text-white/60">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-[#111111] px-3 py-2 text-sm text-white placeholder:text-white/40 focus:border-white focus:outline-none"
            placeholder="correo@ejemplo.com"
          />
        </div>
        <div className="space-y-2">
          <label className="text-xs uppercase tracking-[0.1em] text-white/60">Teléfono</label>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-[#111111] px-3 py-2 text-sm text-white placeholder:text-white/40 focus:border-white focus:outline-none"
            placeholder="+51 999 999 999"
          />
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-xs uppercase tracking-[0.1em] text-white/60">Estado</label>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as any)}
          className="w-full rounded-xl border border-white/10 bg-[#111111] px-3 py-2 text-sm text-white focus:border-white focus:outline-none"
        >
          <option value="pending">pending</option>
          <option value="approved">approved</option>
          <option value="rejected">rejected</option>
        </select>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
        <button
          type="button"
          disabled={pending || !dirty}
          onClick={onSave}
          className="rounded-full bg-gradient-to-r from-[#b5003c] to-[#e91e63] px-4 py-2 text-sm font-semibold uppercase tracking-wide text-white shadow-[0_10px_30px_rgba(185,0,60,0.4)] transition hover:shadow-[0_12px_34px_rgba(185,0,60,0.45)] disabled:opacity-60"
        >
          {pending ? "Guardando..." : "Guardar y notificar"}
        </button>
      </div>
    </div>
  );
}

function normalizeStatus(status: string): "pending" | "approved" | "rejected" {
  if (status === "approved" || status === "rejected") return status;
  return "pending";
}
