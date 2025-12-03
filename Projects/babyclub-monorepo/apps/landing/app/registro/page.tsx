"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function RegistroPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const code = searchParams.get("code") || "";
  const tableLayoutUrl = process.env.NEXT_PUBLIC_TABLE_LAYOUT_URL || "";
  const initialCover = process.env.NEXT_PUBLIC_REGISTRO_COVER_URL || "";
  const [coverUrl, setCoverUrl] = useState<string>(initialCover);
  const [logoUrl, setLogoUrl] = useState<string | null>(process.env.NEXT_PUBLIC_LOGO_URL || null);
  const [step, setStep] = useState<1 | 2>(1);
  const [form, setForm] = useState({
    dni: "",
    nombre: "",
    apellido_paterno: "",
    apellido_materno: "",
    email: "",
    telefono: "",
    promoter_id: "",
    birthdate: "",
  });
  const [tab, setTab] = useState<"ticket" | "mesa">("ticket");
  const [reniecLoading, setReniecLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [promoters, setPromoters] = useState<Array<{ id: string; name: string }>>([]);
  const [tables, setTables] = useState<Array<any>>([]);
  const [selectedTable, setSelectedTable] = useState<string>("");
  const [reservation, setReservation] = useState({ full_name: "", email: "", phone: "", voucher_url: "" });
  const [uploadingVoucher, setUploadingVoucher] = useState(false);
  const [reservationCodes, setReservationCodes] = useState<string[] | null>(null);
  const [reservationError, setReservationError] = useState<string | null>(null);
  const [reservationLoading, setReservationLoading] = useState(false);
  const [ticketId, setTicketId] = useState<string | null>(null);
  const [aforo, setAforo] = useState<number>(0);
  const [aforoMeta, setAforoMeta] = useState<{ used: number; capacity: number } | null>(null);

  const handleChange = (field: keyof typeof form) => (value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    createTicketAndRedirect();
  };

  const lookupDni = async () => {
    if (!form.dni || form.dni.length !== 8) {
      setError("DNI inválido");
      return;
    }
    setReniecLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/reniec?dni=${form.dni}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || "No se pudo validar DNI");
        return;
      }
      setError(null);
      const apellidoPaterno = data?.apellidoPaterno || data?.apellido_paterno || "";
      const apellidoMaterno = data?.apellidoMaterno || data?.apellido_materno || "";
      setForm((prev) => ({
        ...prev,
        nombre: data?.nombres || prev.nombre,
        apellido_paterno: apellidoPaterno || prev.apellido_paterno,
        apellido_materno: apellidoMaterno || prev.apellido_materno,
      }));
      await loadPersonData(form.dni);
    } catch (err: any) {
      setError(err?.message || "Error al validar DNI");
    } finally {
      setReniecLoading(false);
    }
  };

  useEffect(() => {
    fetch("/api/promoters", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => setPromoters(data?.promoters || []))
      .catch(() => setPromoters([]));
    fetch("/api/tables", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        setTables(data?.tables || []);
        setSelectedTable(data?.tables?.[0]?.id || "");
      })
      .catch(() => setTables([]));
    fetch("/api/branding")
      .then((res) => res.json())
      .then((data) => {
        if (data?.logo_url) setLogoUrl(data.logo_url);
      })
      .catch(() => null);
    if (code) {
      fetch(`/api/manifiesto?code=${encodeURIComponent(code)}`)
        .then((res) => res.json())
        .then((data) => {
          if (data?.cover_url) {
            setCoverUrl(data.cover_url);
          } else if (data?.url) {
            setCoverUrl(data.url);
          }
        })
        .catch(() => null);
    }
    if (code) {
      fetch(`/api/aforo?code=${encodeURIComponent(code)}`)
        .then((res) => res.json())
        .then((data) => {
          if (data?.success) {
            setAforo(Math.min(Math.max(data.percent ?? 0, 0), 100));
            setAforoMeta({ used: data.used ?? 0, capacity: data.capacity ?? 0 });
          }
        })
        .catch(() => null);
    }
  }, []);

  const tableInfo = tables.find((t) => t.id === selectedTable);

  const aforoWidth = Math.max(0, Math.min(aforo, 100));

  return (
    <main className="flex min-h-screen items-center justify-center bg-black px-6 py-10 text-white">
      <div className="w-full max-w-4xl space-y-6">
        {coverUrl && (
          <div className="mx-auto w-full max-w-[650px] overflow-hidden rounded-3xl border border-white/10 bg-[#0b0b0b]">
            <img src={coverUrl} alt="Cover" className="h-48 w-full object-cover" />
          </div>
        )}

        <div className="space-y-3 text-center">
          {logoUrl ? (
            <div className="flex justify-center">
              <img src={logoUrl} alt="BABY" className="h-[100px] w-auto object-contain" />
            </div>
          ) : (
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-white/70">BABY</p>
          )}
          <div className="flex flex-col items-center gap-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-white/80">
              <span>AFORO</span>
              <span className="text-white">{aforoWidth}%</span>
            </div>
            <div className="h-2 w-full max-w-md overflow-hidden rounded-full bg-white/15">
              <div
                className="h-full rounded-full bg-white"
                style={{ width: `${aforoWidth}%` }}
              />
            </div>
          </div>
          <h1 className="text-3xl font-semibold">Registro</h1>
          <p className="text-sm text-white/60">
            Completa tus datos para generar tu QR o separar mesa. {code ? `Código: ${code}` : ""}
          </p>
        </div>

        {step === 1 && (
          <form onSubmit={(e) => { e.preventDefault(); }} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Field
                label="DNI"
                value={form.dni}
                onChange={handleChange("dni")}
                placeholder="00000000"
                required
                onBlur={lookupDni}
              />
              <Field
                label="Nombre"
                value={form.nombre}
                onChange={handleChange("nombre")}
                placeholder="Nombre"
                required
              />
              <Field
                label="Apellido paterno"
                value={form.apellido_paterno}
                onChange={handleChange("apellido_paterno")}
                placeholder="Apellido paterno"
                required
              />
              <Field
                label="Apellido materno"
                value={form.apellido_materno}
                onChange={handleChange("apellido_materno")}
                placeholder="Apellido materno"
                required
              />
              <Field
                label="Email"
                type="email"
                value={form.email}
                onChange={handleChange("email")}
                placeholder="email@baby.club"
                required
              />
              <Field
                label="Teléfono"
                value={form.telefono}
                onChange={handleChange("telefono")}
                placeholder="+51 999 999 999"
                className="md:col-span-2"
                required
              />
              <Field
                label="Fecha de nacimiento"
                type="date"
                value={form.birthdate}
                onChange={handleChange("birthdate")}
                required
              />
              <div className="md:col-span-2">
                <label className="block space-y-2 text-sm font-semibold text-white">
                  Promotor (opcional)
                  <select
                    value={form.promoter_id}
                    onChange={(e) => handleChange("promoter_id")(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-[#111111] px-4 py-3 text-base text-white placeholder:text-white/40 focus:border-white focus:outline-none"
                  >
                    <option value="">Sin promotor</option>
                    {promoters.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>

            {reniecLoading && <p className="text-xs text-white/60">Buscando datos del DNI...</p>}
            {error && <p className="text-xs font-semibold text-[#ff9a9a]">{error}</p>}

            <div className="flex flex-col gap-3">
              <button
                type="button"
                onClick={createTicketAndRedirect}
                className="w-full rounded-xl bg-white px-4 py-3 text-center text-sm font-semibold uppercase tracking-wide text-black transition hover:scale-[1.01]"
              >
                Solo generar mi QR
              </button>
              <button
                type="button"
                onClick={() => {
                  if (tables.length === 0) {
                    createTicketAndRedirect();
                  } else {
                    setReservation((prev) => ({
                      ...prev,
                      full_name: prev.full_name || `${form.nombre} ${form.apellido_paterno} ${form.apellido_materno}`.trim(),
                      email: prev.email || form.email,
                      phone: prev.phone || form.telefono,
                    }));
                    setStep(2);
                  }
                }}
                className="w-full rounded-xl border border-white/20 px-4 py-3 text-center text-sm font-semibold uppercase tracking-wide text-white transition hover:border-white"
              >
                {tables.length > 0 ? "Siguiente: reservar mesa" : "No hay mesas disponibles (generar QR)"}
              </button>
            </div>
          </form>
        )}

        {step === 2 && (
          <form onSubmit={(e) => { e.preventDefault(); submitReservation(); }} className="space-y-4">
            {tableLayoutUrl && (
              <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#0a0a0a]">
                <img src={tableLayoutUrl} alt="Distribución de mesas" className="w-full object-cover" />
              </div>
            )}
            <div className="flex flex-col gap-2">
              <label className="text-sm font-semibold text-white">Mesa</label>
              <select
                value={selectedTable}
                onChange={(e) => setSelectedTable(e.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-[#111111] px-4 py-3 text-sm text-white focus:border-white"
              >
                {tables.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
              {tableInfo && (
                <div className="rounded-2xl border border-white/10 bg-[#0a0a0a] p-3 text-xs text-white/70">
                  <div>Tickets incluidos: {tableInfo.ticket_count ?? "—"}</div>
                  <div>Consumo mínimo: {tableInfo.min_consumption != null ? `S/ ${tableInfo.min_consumption}` : "—"}</div>
                  <div>Precio: {tableInfo.price != null ? `S/ ${tableInfo.price}` : "—"}</div>
                  {tableInfo.notes && <div className="mt-1 text-white/60">{tableInfo.notes}</div>}
                </div>
              )}
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <Field
                label="Nombre completo"
                value={reservation.full_name}
                onChange={(v) => setReservation((p) => ({ ...p, full_name: v }))}
                required
              />
              <Field
                label="Email"
                type="email"
                value={reservation.email}
                onChange={(v) => setReservation((p) => ({ ...p, email: v }))}
              />
              <Field
                label="Teléfono"
                value={reservation.phone}
                onChange={(v) => setReservation((p) => ({ ...p, phone: v }))}
                placeholder="+51 999 999 999"
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-sm font-semibold text-white">Voucher (Yape/Plin)</label>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={onVoucherChange}
                disabled={uploadingVoucher}
                className="w-full rounded-2xl border border-white/10 bg-[#111111] px-4 py-3 text-sm text-white file:mr-3 file:rounded-xl file:border-0 file:bg-white/10 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white"
              />
              {reservation.voucher_url && (
                <a
                  href={reservation.voucher_url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-[#e91e63] underline-offset-4 hover:underline"
                >
                  Ver voucher subido
                </a>
              )}
            </div>

            {reservationError && <p className="text-xs font-semibold text-[#ff9a9a]">{reservationError}</p>}
            {reservationCodes && reservationCodes.length > 0 && (
              <div className="rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-4 text-sm text-white">
                <p className="font-semibold mb-2">Reserva registrada. Códigos generados:</p>
                <div className="space-y-1">
                  {reservationCodes.map((c) => (
                    <div key={c} className="rounded-xl bg-black/30 px-3 py-2 font-mono text-xs">
                      {c}
                    </div>
                  ))}
                </div>
                <p className="mt-2 text-xs text-white/70">Comparte estos códigos con tu grupo para que generen sus QR.</p>
              </div>
            )}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="w-1/3 rounded-xl border border-white/20 px-4 py-3 text-center text-sm font-semibold uppercase tracking-wide text-white transition hover:border-white"
              >
                Atrás
              </button>
              <button
                type="submit"
                disabled={reservationLoading}
                className="w-2/3 rounded-full bg-gradient-to-r from-[#e91e63] to-[#ff77b6] px-4 py-3 text-center text-sm font-semibold uppercase tracking-wide text-white shadow-[0_12px_35px_rgba(233,30,99,0.35)] transition hover:shadow-[0_14px_38px_rgba(233,30,99,0.45)] disabled:opacity-70"
              >
                {reservationLoading ? "Procesando..." : "Confirmar y generar QR"}
              </button>
            </div>
          </form>
        )}
      </div>
    </main>
  );

  async function onVoucherChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingVoucher(true);
    setReservationError(null);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("tableName", selectedTable || "mesa");
    try {
      const res = await fetch("/api/uploads/voucher", { method: "POST", body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        setReservationError(data?.error || "No se pudo subir el voucher");
      } else {
        setReservation((prev) => ({ ...prev, voucher_url: data.url }));
      }
    } catch (err: any) {
      setReservationError(err?.message || "Error al subir voucher");
    } finally {
      setUploadingVoucher(false);
    }
  }

  async function submitReservation() {
    setReservationError(null);
    setReservationCodes(null);
    if (!selectedTable || !reservation.full_name.trim() || !reservation.voucher_url) {
      setReservationError("Selecciona una mesa, ingresa tu nombre y sube el voucher");
      return;
    }
    setReservationLoading(true);
    try {
      const res = await fetch("/api/reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          table_id: selectedTable,
          full_name: reservation.full_name,
          email: reservation.email,
          phone: reservation.phone,
          voucher_url: reservation.voucher_url,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        setReservationError(data?.error || "No se pudo registrar la reserva");
      } else {
        setReservationCodes(data.codes || []);
        await createTicketAndRedirect(data.codes || []);
      }
    } catch (err: any) {
      setReservationError(err?.message || "Error al registrar reserva");
    } finally {
      setReservationLoading(false);
    }
  }

  async function loadPersonData(dni: string) {
    try {
      const res = await fetch(`/api/persons?dni=${dni}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.person) return;
      const p = data.person;
      const [apPat, ...rest] = (p.last_name || "").split(" ");
      const apMat = rest.join(" ").trim();
      setForm((prev) => ({
        ...prev,
        nombre: prev.nombre || p.first_name || "",
        apellido_paterno: prev.apellido_paterno || apPat || "",
        apellido_materno: prev.apellido_materno || apMat || "",
        email: prev.email || p.email || "",
        telefono: prev.telefono || p.phone || "",
        birthdate: prev.birthdate || (p.birthdate ? p.birthdate.slice(0, 10) : ""),
      }));
    } catch (_err) {
      // ignore
    }
  }

  async function createTicketAndRedirect(extraCodes?: string[]) {
    setError(null);
    if (ticketId) {
      router.push(`/ticket/${ticketId}`);
      return;
    }
    if (!form.dni || form.dni.length !== 8) {
      setError("DNI inválido");
      return;
    }
    if (!form.nombre.trim() || !form.apellido_paterno.trim()) {
      setError("Nombre y apellidos requeridos");
      return;
    }
    if (!form.birthdate) {
      setError("Fecha de nacimiento requerida");
      return;
    }
    if (!isAdult(form.birthdate)) {
      setError("Debes ser mayor de 18 años");
      return;
    }
    try {
      const res = await fetch("/api/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code,
          dni: form.dni,
          nombre: form.nombre,
          apellido_paterno: form.apellido_paterno,
          apellido_materno: form.apellido_materno,
          email: form.email,
          telefono: form.telefono,
          promoter_id: form.promoter_id || null,
          birthdate: form.birthdate,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        setError(data?.error || "No se pudo generar la entrada");
        return;
      }
      setTicketId(data.ticketId);
      router.push(`/ticket/${data.ticketId}`);
    } catch (err: any) {
      setError(err?.message || "Error al generar entrada");
    }
  }
}

function isAdult(birthdate: string) {
  const dob = new Date(birthdate);
  if (Number.isNaN(dob.getTime())) return false;
  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  const m = now.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) age--;
  return age >= 18;
}

type FieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  required?: boolean;
  className?: string;
  onBlur?: () => void;
};

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  required,
  className = "",
  onBlur,
}: FieldProps) {
  return (
    <label className={`block space-y-2 text-sm font-semibold text-white ${className}`}>
      {label}
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        className="w-full rounded-xl border border-white/10 bg-[#111111] px-4 py-3 text-base text-white placeholder:text-white/40 focus:border-white focus:outline-none"
        placeholder={placeholder}
        required={required}
      />
    </label>
  );
}
