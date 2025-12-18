"use client";

import { FormEvent, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type TableInfo = {
  id: string;
  event_id?: string | null;
  name: string;
  ticket_count?: number | null;
  min_consumption?: number | null;
  price?: number | null;
  notes?: string | null;
  is_reserved?: boolean | null;
  pos_x?: number | null;
  pos_y?: number | null;
  pos_w?: number | null;
  pos_h?: number | null;
  products?: Array<{
    id: string;
    name: string;
    description?: string | null;
    items?: string[] | null;
    price?: number | null;
    tickets_included?: number | null;
    is_active?: boolean | null;
    sort_order?: number | null;
  }>;
};

type TableSlot = {
  id: string;
  label: string;
  left: string;
  top: string;
  width: string;
  height: string;
};

type TableSlotWithData = TableSlot & { table: TableInfo | null };

const TABLE_LAYOUT: TableSlot[] = [
  { id: "slot-1", label: "1", left: "18%", top: "10%", width: "14%", height: "10%" },
  { id: "slot-2", label: "2", left: "12%", top: "30%", width: "14%", height: "10%" },
  { id: "slot-3", label: "3", left: "12%", top: "50%", width: "14%", height: "10%" },
  { id: "slot-4", label: "4", left: "12%", top: "68%", width: "14%", height: "10%" },
  { id: "slot-5", label: "5", left: "24%", top: "80%", width: "14%", height: "10%" },
  { id: "slot-6", label: "6", left: "70%", top: "80%", width: "16%", height: "12%" },
];

const DEFAULT_LAYOUT_RATIO = 1.18; // fallback ratio to keep the overlay aligned while the image loads or is missing

const normalizeTableName = (name: string) => name.replace(/\s+/g, "").toLowerCase();

function findTableForSlot(label: string, tables: TableInfo[]) {
  const normalizedLabel = label.toLowerCase();
  return (
    tables.find((t) => normalizeTableName(t.name).includes(normalizedLabel)) ||
    tables.find((t) => normalizeTableName(t.name).includes(`mesa${normalizedLabel}`)) ||
    tables.find((t) => normalizeTableName(t.name).includes(`table${normalizedLabel}`)) ||
    null
  );
}

const formatCurrency = (value?: number | null) => {
  if (value == null) return "—";
  return `S/ ${value}`;
};

const formatDateInput = (date: Date) => date.toISOString().slice(0, 10);

export default function RegistroPage() {
  return (
    <Suspense fallback={<Placeholder />}>
      <RegistroContent />
    </Suspense>
  );
}

function RegistroContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const code = searchParams.get("code") || "";
  const tableLayoutUrl = process.env.NEXT_PUBLIC_TABLE_LAYOUT_URL || "";
  const initialCover = process.env.NEXT_PUBLIC_REGISTRO_COVER_URL || "";
  const [coverUrl, setCoverUrl] = useState<string>(initialCover);
  const [logoUrl, setLogoUrl] = useState<string | null>(process.env.NEXT_PUBLIC_LOGO_URL || null);
  const [step, setStep] = useState<1 | 2>(1);
  const initialFormState = {
    dni: "",
    nombre: "",
    apellido_paterno: "",
    apellido_materno: "",
    email: "",
    telefono: "",
    promoter_id: "",
    birthdate: "",
  };
  const initialReservationState = { dni: "", full_name: "", email: "", phone: "", voucher_url: "" };
  const [form, setForm] = useState({ ...initialFormState });
  const [tab, setTab] = useState<"ticket" | "mesa">("ticket");
  const [reniecLoading, setReniecLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [promoters, setPromoters] = useState<Array<{ id: string; name: string }>>([]);
  const [codeInfo, setCodeInfo] = useState<{ type?: string | null; promoter_id?: string | null } | null>(null);
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [selectedTable, setSelectedTable] = useState<string>("");
  const [reservation, setReservation] = useState({ ...initialReservationState });
  const [selectedProduct, setSelectedProduct] = useState<string>("");
  const [uploadingVoucher, setUploadingVoucher] = useState(false);
  const [reservationCodes, setReservationCodes] = useState<string[] | null>(null);
  const [reservationError, setReservationError] = useState<string | null>(null);
  const [reservationLoading, setReservationLoading] = useState(false);
  const [ticketId, setTicketId] = useState<string | null>(null);
  const [existingTicketId, setExistingTicketId] = useState<string | null>(null);
  const [aforo, setAforo] = useState<number>(0);
  const [aforoMeta, setAforoMeta] = useState<{ used: number; capacity: number } | null>(null);
  const [personLoading, setPersonLoading] = useState(false);
  const [layoutUrl, setLayoutUrl] = useState<string | null>(null);
  const lastPersonLookup = useRef<string | null>(null);
  const maxBirthdate = useMemo(() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() - 18);
    return formatDateInput(d);
  }, []);
  const hidePromoterSelect = useMemo(
    () => (codeInfo?.type || "").toLowerCase() === "courtesy",
    [codeInfo]
  );

  const resetMainForm = () => {
    setForm({ ...initialFormState });
    setExistingTicketId(null);
    setTicketId(null);
    setError(null);
    setReniecLoading(false);
    lastPersonLookup.current = null;
    setReservation({ ...initialReservationState });
  };

  const resetReservationForm = () => {
    setReservation({ ...initialReservationState });
    setReservationCodes(null);
    setReservationError(null);
  };

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
    await loadPersonData(form.dni, { force: true });
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
    if (form.dni && form.dni.length === 8) {
      loadPersonData(form.dni);
    }
  }, [form.dni]);

  useEffect(() => {
    if (reservation.dni && reservation.dni.length === 8) {
      loadPersonData(reservation.dni);
    }
  }, [reservation.dni]);

  useEffect(() => {
    // sincroniza datos del formulario principal con el de reserva si están vacíos
    setReservation((prev) => {
      const fullNameFromForm = `${form.nombre} ${form.apellido_paterno} ${form.apellido_materno}`.trim();
      return {
        ...prev,
        dni: prev.dni || form.dni || "",
        full_name: prev.full_name || fullNameFromForm,
        email: prev.email || form.email,
        phone: prev.phone || form.telefono,
      };
    });
  }, [form.dni, form.nombre, form.apellido_paterno, form.apellido_materno, form.email, form.telefono]);

  useEffect(() => {
    fetch("/api/promoters", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => setPromoters(data?.promoters || []))
      .catch(() => setPromoters([]));
    fetch("/api/layout")
      .then((res) => res.json())
      .then((data) => setLayoutUrl(data?.layout_url || null))
      .catch(() => null);
    fetch("/api/tables", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        const loadedTables = data?.tables || [];
        setTables(loadedTables);
        const firstTable = loadedTables.find((t: any) => !t.is_reserved) || loadedTables?.[0];
        setSelectedTable(firstTable?.id || "");
        const firstProduct = firstTable?.products?.find((p: any) => p.is_active !== false);
        setSelectedProduct(firstProduct?.id || "");
      })
      .catch(() => setTables([]));
    fetch("/api/branding")
      .then((res) => res.json())
      .then((data) => {
        if (data?.logo_url) setLogoUrl(data.logo_url);
      })
      .catch(() => null);
    if (code) {
      fetch(`/api/codes/info?code=${encodeURIComponent(code)}`)
        .then((res) => res.json())
        .then((data) => setCodeInfo(data?.error ? null : data))
        .catch(() => setCodeInfo(null));
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

  const tableSlots = useMemo<TableSlotWithData[]>(
    () => TABLE_LAYOUT.map((slot) => ({ ...slot, table: findTableForSlot(slot.label, tables) })),
    [tables]
  );

  const tableInfo = useMemo(() => {
    const direct = tables.find((t) => t.id === selectedTable);
    if (direct) return direct;
    return tableSlots.find((slot) => slot.table?.id === selectedTable)?.table || null;
  }, [selectedTable, tableSlots, tables]);

  const fallbackTables = useMemo(
    () => tables.filter((t) => !tableSlots.some((slot) => slot.table?.id === t.id)),
    [tableSlots, tables]
  );

  const products = useMemo(
    () => (tableInfo?.products || []).filter((p: any) => p.is_active !== false).sort((a: any, b: any) => (a.sort_order || 0) - (b.sort_order || 0)),
    [tableInfo]
  );
  const selectedProductInfo = products.find((p: any) => p.id === selectedProduct) || products[0] || null;

  const aforoWidth = Math.max(0, Math.min(aforo, 100));
  const dniError = form.dni && form.dni.length !== 8 ? "El DNI debe tener 8 dígitos" : "";
  const reservationDniError = reservation.dni && reservation.dni.length !== 8 ? "El DNI debe tener 8 dígitos" : "";

  return (
    <main className="flex min-h-screen items-center justify-center bg-black px-6 py-10 text-white">
      <div className="w-full max-w-4xl space-y-6">
        {coverUrl && (
          <div className="mx-auto w-full max-w-[700px] overflow-hidden rounded-3xl border border-white/10 bg-[#0b0b0b]">
            <img
              src={coverUrl}
              alt="Cover"
              className="h-auto w-full object-cover"
              style={{ aspectRatio: "32 / 14", objectPosition: "center" }}
            />
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
            <div className="h-2 w-full max-w-md overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-[#e91e63] shadow-[0_0_12px_rgba(233,30,99,0.55)]"
                style={{ width: `${aforoWidth}%` }}
              />
            </div>
          </div>
          <h1 className="text-3xl font-semibold">Registro</h1>
          
        </div>

        {step === 1 && (
          <form onSubmit={(e) => { e.preventDefault(); }} className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <Field
                label="DNI"
                value={form.dni}
                onChange={handleChange("dni")}
                placeholder="00000000"
                required
                onBlur={lookupDni}
                inputMode="numeric"
                digitOnly
                maxLength={8}
                autoComplete="off"
                allowClear
                error={dniError}
                onClear={resetMainForm}
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
                required
                inputMode="tel"
                autoComplete="tel"
              />
              <BirthdateField value={form.birthdate} onChange={handleChange("birthdate")} max={maxBirthdate} />
              {!hidePromoterSelect && (
                <label className="block space-y-2 text-sm font-semibold text-white">
                  Invitado por:
                  <select
                    value={form.promoter_id}
                    onChange={(e) => handleChange("promoter_id")(e.target.value)}
                    required
                    className="w-full rounded-xl border border-white/10 bg-[#111111] px-4 py-3 text-base text-white placeholder:text-white/40 focus:border-white focus:outline-none"
                  >
                    <option value="">Seleccionar</option>
                    {promoters.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>

            {(reniecLoading || personLoading) && (
              <p className="text-xs text-white/60">Buscando datos del DNI...</p>
            )}
            {error && <p className="text-xs font-semibold text-[#ff9a9a]">{error}</p>}

            <div className="flex flex-col gap-3">
              <button
                type="button"
                onClick={() => createTicketAndRedirect()}
                className="w-full rounded-xl bg-white px-4 py-3 text-center text-sm font-semibold uppercase tracking-wide text-black transition hover:scale-[1.01]"
              >
                {existingTicketId ? "Ver mi QR" : "Generar QR"}
              </button>
              <div className="relative overflow-hidden rounded-2xl border border-white/15 bg-black">
                <div className="pointer-events-none absolute inset-0 shimmer-glow" />
                <button
                  type="button"
                  onClick={() => {
                    if (tables.length === 0) {
                      createTicketAndRedirect();
                    } else {
                      setReservation((prev) => ({
                        ...prev,
                        dni: form.dni,
                        full_name: `${form.nombre} ${form.apellido_paterno} ${form.apellido_materno}`.trim(),
                        email: form.email,
                        phone: form.telefono,
                      }));
                      setStep(2);
                    }
                  }}
                  className="relative w-full rounded-2xl px-4 py-3 text-center text-sm font-semibold uppercase tracking-wide text-white transition hover:scale-[1.01]"
                >
                  {tables.length > 0 ? "Reservar mesa (opcional)" : "No hay mesas disponibles (generar QR)"}
                </button>
              </div>
              <p className="text-center text-xs text-white/60">Opcional: separa tu mesa y asigna tus tickets.</p>
            </div>
          </form>
        )}

        {step === 2 && (
          <form onSubmit={(e) => { e.preventDefault(); submitReservation(); }} className="space-y-4">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.3em] text-white/60">Paso 2</p>
                  <h2 className="text-xl font-semibold text-white">Elige tu mesa en el mapa</h2>
                </div>
                <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.12em] text-white/50">
                  <span className="h-3 w-3 rounded-full border border-white/30 bg-white/10" /> Disponible
                  <span className="h-3 w-3 rounded-full border border-[#e91e63] bg-[#e91e63]" /> Seleccionada
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-[1.4fr,1fr]">
                <TableMap
                  slots={tableSlots}
                  selectedTableId={selectedTable}
                  onSelect={(id) => {
                    setSelectedTable(id);
                    const nextTable = tables.find((t) => t.id === id);
                    const nextProduct = nextTable?.products?.find((p: any) => p.is_active !== false);
                    setSelectedProduct(nextProduct?.id || "");
                  }}
                  loading={tables.length === 0}
                  layoutUrl={layoutUrl || tableLayoutUrl || undefined}
                />

                <div className="space-y-3">
                  <div className="rounded-2xl border border-white/10 bg-[#0a0a0a] p-4 text-sm text-white/80">
                    {tableInfo ? (
                      <div className="space-y-1">
                        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-white/50">Mesa seleccionada</p>
                        <p className="text-lg font-semibold text-white">{tableInfo.name}</p>
                        <p className="text-white/70">
                          Tickets incluidos: <span className="font-semibold text-white">{tableInfo.ticket_count ?? "—"}</span>
                        </p>
                        <p className="text-white/70">
                          Consumo mínimo: <span className="font-semibold text-white">{formatCurrency(tableInfo.min_consumption)}</span>
                        </p>
                        <p className="text-white/70">
                          Precio: <span className="font-semibold text-white">{formatCurrency(tableInfo.price)}</span>
                        </p>
                        {tableInfo.notes && <p className="pt-1 text-white/60">{tableInfo.notes}</p>}
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-white/50">Mesa seleccionada</p>
                        <p className="text-white/60">Toca una mesa en el mapa o elige una de la lista.</p>
                      </div>
                    )}
                  </div>

                  {tables.length > 0 && (
                    <div className="rounded-2xl border border-white/10 bg-[#0b0b0b] p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-white/50">Lista rápida</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {tables.map((t) => {
                          const isActive = t.id === selectedTable;
                          const reserved = !!t.is_reserved;
                          return (
                            <button
                              key={t.id}
                              type="button"
                              onClick={() => !reserved && setSelectedTable(t.id)}
                              disabled={reserved}
                              className={`rounded-full border px-3 py-2 text-xs font-semibold transition ${
                                reserved
                                  ? "border-white/10 bg-white/5 text-white/40 cursor-not-allowed"
                                  : isActive
                                    ? "border-[#e91e63] bg-[#e91e63] text-white shadow-[0_8px_25px_rgba(233,30,99,0.35)]"
                                    : "border-white/15 bg-white/5 text-white hover:border-white/40"
                              }`}
                            >
                              {t.name}
                            </button>
                          );
                        })}
                      </div>
                      {fallbackTables.length > 0 && (
                        <p className="mt-2 text-[11px] text-white/50">
                          Estas mesas no están en el mapa, pero puedes seleccionarlas aquí.
                        </p>
                      )}
                    </div>
                  )}

                  {products.length > 0 && (
                    <div className="rounded-2xl border border-white/10 bg-[#0b0b0b] p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-white/50">Elige tu pack</p>
                      <div className="mt-3 grid gap-3 md:grid-cols-2">
                        {products.map((p: any) => {
                          const active = p.id === selectedProduct;
                          return (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() => setSelectedProduct(p.id)}
                              className={`text-left rounded-2xl border px-4 py-3 transition ${
                                active
                                  ? "border-[#e91e63] bg-[#e91e63]/10 shadow-[0_10px_30px_rgba(233,30,99,0.25)]"
                                  : "border-white/10 bg-black/30 hover:border-white/30"
                              }`}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <div>
                                  <p className="text-sm font-semibold text-white">{p.name}</p>
                                  {p.description && <p className="text-xs text-white/60">{p.description}</p>}
                                </div>
                                <div className="text-right text-sm font-semibold text-white">{p.price != null ? `S/ ${p.price}` : ""}</div>
                              </div>
                              {Array.isArray(p.items) && p.items.length > 0 && (
                                <ul className="mt-2 space-y-1 text-xs text-white/70">
                                  {p.items.map((it: string) => (
                                    <li key={it} className="flex items-start gap-2">
                                      <span className="mt-[6px] h-[6px] w-[6px] rounded-full bg-white/50" />
                                      <span>{it}</span>
                                    </li>
                                  ))}
                                </ul>
                              )}
                              {p.tickets_included != null && (
                                <p className="mt-2 text-xs text-white/60">Incluye {p.tickets_included} tickets</p>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {tableLayoutUrl && (
                    <details className="rounded-2xl border border-white/10 bg-[#0b0b0b] p-3 text-sm text-white/70">
                      <summary className="cursor-pointer text-white">Ver plano original (imagen)</summary>
                      <div className="mt-3 overflow-hidden rounded-xl border border-white/10">
                        <img src={tableLayoutUrl} alt="Distribución de mesas" className="w-full object-cover" />
                      </div>
                    </details>
                  )}
                </div>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-[0.6fr,1.4fr]">
              <Field
                label="DNI"
                value={reservation.dni || ""}
                onChange={(v) => setReservation((p) => ({ ...p, dni: v }))}
                onBlur={() => reservation.dni?.length === 8 && loadPersonData(reservation.dni, { force: true })}
                required
                inputMode="numeric"
                digitOnly
                maxLength={8}
                allowClear
                error={reservationDniError}
                onClear={resetReservationForm}
              />
              <Field
                label="Nombre completo"
                value={reservation.full_name}
                onChange={(v) => setReservation((p) => ({ ...p, full_name: v }))}
                required
              />
            </div>
            <div className="grid gap-3 md:grid-cols-[1.3fr,0.7fr]">
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
      <style jsx global>{`
        @keyframes shimmerBorder {
          0% {
            transform: translateX(-120%);
          }
          100% {
            transform: translateX(120%);
          }
        }
        .shimmer-glow::before {
          content: "";
          position: absolute;
          inset: 0;
          background: linear-gradient(120deg, transparent, rgba(233, 30, 99, 0.6), transparent);
          transform: translateX(-120%);
          animation: shimmerBorder 2.4s linear infinite;
        }
        .shimmer-glow {
          overflow: hidden;
          filter: drop-shadow(0 0 12px rgba(233, 30, 99, 0.15));
        }
      `}</style>
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
    if (!selectedTable || !reservation.full_name.trim() || !reservation.voucher_url || reservation.dni.length !== 8) {
      setReservationError("Selecciona una mesa, ingresa DNI, nombre y sube el voucher");
      return;
    }
    if (products.length > 0 && !selectedProduct) {
      setReservationError("Elige un pack para tu mesa");
      return;
    }
    const tableInfo = tables.find((t) => t.id === selectedTable);
    setReservationLoading(true);
    try {
      const res = await fetch("/api/reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          table_id: selectedTable,
          product_id: selectedProduct || null,
          event_id: tableInfo?.event_id || null,
          code,
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

  async function loadPersonData(dni: string, opts: { force?: boolean } = {}) {
    if (!dni || dni.length !== 8) return;
    if (!opts.force && lastPersonLookup.current === dni) return;
    lastPersonLookup.current = dni;
    setPersonLoading(true);
    try {
      const res = await fetch(`/api/persons?dni=${dni}${code ? `&code=${encodeURIComponent(code)}` : ""}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.person) return;
      const p = data.person;
      const [apPat, ...rest] = (p.last_name || "").split(" ");
      const apMat = rest.join(" ").trim();
      const promoterFromTicket = (p as any)?.ticket_promoter_id || "";
      const ticketFromPerson = (p as any)?.ticket_id || null;
      setForm((prev) => ({
        ...prev,
        nombre: prev.nombre || p.first_name || "",
        apellido_paterno: prev.apellido_paterno || apPat || "",
        apellido_materno: prev.apellido_materno || apMat || "",
        email: prev.email || p.email || "",
        telefono: prev.telefono || p.phone || "",
        birthdate: prev.birthdate || (p.birthdate ? p.birthdate.slice(0, 10) : ""),
        promoter_id: prev.promoter_id || promoterFromTicket,
      }));
      setReservation((prev) => ({
        ...prev,
        dni: prev.dni || dni,
        full_name: prev.full_name || `${p.first_name || ""} ${apPat || ""} ${apMat || ""}`.trim(),
        email: prev.email || p.email || "",
        phone: prev.phone || p.phone || "",
      }));
      if (ticketFromPerson) {
        setExistingTicketId(ticketFromPerson);
        setTicketId(ticketFromPerson);
      }
    } catch (_err) {
      // ignore
    } finally {
      setPersonLoading(false);
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
    if (!hidePromoterSelect && !form.promoter_id) {
      setError("Selecciona el campo 'Invitado por'");
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

function TableMap({
  slots,
  selectedTableId,
  onSelect,
  loading = false,
  layoutUrl,
}: {
  slots: TableSlotWithData[];
  selectedTableId: string;
  onSelect: (tableId: string) => void;
  loading?: boolean;
  layoutUrl?: string;
}) {
  const [aspectRatio, setAspectRatio] = useState<number | null>(null);

  useEffect(() => {
    if (!layoutUrl) {
      setAspectRatio(null);
      return;
    }
    const img = new Image();
    img.onload = () => {
      if (img.naturalWidth && img.naturalHeight) {
        setAspectRatio(img.naturalWidth / img.naturalHeight);
      }
    };
    img.onerror = () => setAspectRatio(null);
    img.src = layoutUrl;
    return () => {
      img.onload = null;
      img.onerror = null;
    };
  }, [layoutUrl]);

  const mapRatio = aspectRatio || DEFAULT_LAYOUT_RATIO;

  return (
    <div className="rounded-3xl border border-white/10 bg-gradient-to-b from-[#121212] to-[#050505] p-4 shadow-[0_25px_80px_rgba(0,0,0,0.45)] sm:p-5 md:p-6">
      <div
        className="relative w-full overflow-hidden rounded-2xl border border-white/10 bg-black/80"
        style={{
          backgroundImage: layoutUrl ? `url(${layoutUrl})` : undefined,
          backgroundSize: "contain",
          backgroundRepeat: "no-repeat",
          backgroundPosition: "center",
          aspectRatio: mapRatio,
        }}
      >
        {/* mesas */}
        <div className="absolute inset-0">
          {slots.map((slot) => {
            const isAvailable = !!slot.table;
            const isReserved = slot.table?.is_reserved;
            const canSelect = isAvailable && !isReserved;
            const isSelected = slot.table?.id === selectedTableId;
            const tableLabel = slot.table?.name || `Mesa ${slot.label}`;
            const left = slot.table?.pos_x != null ? `${slot.table.pos_x}%` : slot.left;
            const top = slot.table?.pos_y != null ? `${slot.table.pos_y}%` : slot.top;
            const width = slot.table?.pos_w != null ? `${slot.table.pos_w}%` : "9%";
            const height = slot.table?.pos_h != null ? `${slot.table.pos_h}%` : "6%";
            const match = tableLabel.match(/(\d+)/);
            const shortLabel = match ? `M${match[1]}` : slot.label;

            return (
              <button
                key={slot.id}
                type="button"
                disabled={!canSelect}
                onClick={() => slot.table && canSelect && onSelect(slot.table.id)}
                className={`absolute flex flex-col items-center justify-center gap-1 rounded-xl border text-center text-[11px] font-semibold transition focus:outline-none ${
                  isSelected
                    ? "border-[#e91e63] bg-[#e91e63] text-white shadow-[0_15px_35px_rgba(233,30,99,0.35)]"
                    : canSelect
                      ? "border-white/50 bg-white/10 text-white hover:border-white"
                      : "cursor-not-allowed border-white/10 bg-white/5 text-white/30"
                }`}
                style={{
                  left,
                  top,
                  width,
                  height,
                  minWidth: "40px",
                  minHeight: "40px",
                  maxWidth: "140px",
                  maxHeight: "120px",
                }}
              >
                <span className="leading-none">{shortLabel}</span>
                {isReserved && <span className="text-[10px] font-normal leading-tight text-white/60">Reservada</span>}
              </button>
            );
          })}
        </div>

        {loading && <div className="absolute inset-0 animate-pulse bg-white/5" />}
      </div>
    </div>
  );
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
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  autoComplete?: string;
  error?: string;
  allowClear?: boolean;
  onClear?: () => void;
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
  inputMode,
  autoComplete,
  error,
  allowClear = false,
  onClear,
  digitOnly = false,
  maxLength,
}: FieldProps & { digitOnly?: boolean; maxLength?: number }) {
  const showClear = allowClear && value.length > 0;
  return (
    <label className={`block space-y-2 text-sm font-semibold text-white ${className}`}>
      {label}
      <div className="relative">
        <input
          type={type}
          value={value}
          onChange={(e) => {
            let next = e.target.value;
            if (digitOnly) {
              next = next.replace(/\D/g, "");
              if (maxLength) next = next.slice(0, maxLength);
            }
            onChange(next);
          }}
          onBlur={onBlur}
          inputMode={inputMode}
          autoComplete={autoComplete}
          maxLength={maxLength}
          className={`w-full rounded-xl border bg-[#111111] px-4 py-3 text-base text-white placeholder:text-white/40 focus:border-white focus:outline-none ${
            error ? "border-[#ff9a9a]" : "border-white/10"
          } ${showClear ? "pr-11" : ""}`}
          placeholder={placeholder}
          required={required}
        />
        {showClear && (
          <button
            type="button"
            onClick={() => {
              if (onClear) onClear();
              else onChange("");
            }}
            className="absolute right-3 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-xs text-white hover:bg-white/20"
            aria-label={`Borrar ${label}`}
          >
            ×
          </button>
        )}
      </div>
      {error && <p className="text-xs font-semibold text-[#ff9a9a]">{error}</p>}
    </label>
  );
}

function BirthdateField({ value, onChange, max }: { value: string; onChange: (v: string) => void; max: string }) {
  const [open, setOpen] = useState(false);
  const [day, setDay] = useState<string>("");
  const [month, setMonth] = useState<string>("");
  const [year, setYear] = useState<string>("");

  useEffect(() => {
    if (value) {
      const [y, m, d] = value.split("-");
      if (y && m && d) {
        setYear(y);
        setMonth(m);
        setDay(d);
        return;
      }
      return;
    }
    setYear("");
    setMonth("");
    setDay("");
  }, [value, max]);

  const years = useMemo(() => {
    const maxDate = new Date(max);
    const start = maxDate.getFullYear();
    const list: number[] = [];
    for (let i = 0; i < 80; i++) {
      list.push(start - i);
    }
    return list;
  }, [max]);

  const months = [
    { label: "Enero", value: "01" },
    { label: "Febrero", value: "02" },
    { label: "Marzo", value: "03" },
    { label: "Abril", value: "04" },
    { label: "Mayo", value: "05" },
    { label: "Junio", value: "06" },
    { label: "Julio", value: "07" },
    { label: "Agosto", value: "08" },
    { label: "Septiembre", value: "09" },
    { label: "Octubre", value: "10" },
    { label: "Noviembre", value: "11" },
    { label: "Diciembre", value: "12" },
  ];

  const days = Array.from({ length: 31 }, (_v, idx) => String(idx + 1).padStart(2, "0"));

  const updateValue = (nextYear: string, nextMonth: string, nextDay: string) => {
    if (!nextYear || !nextMonth || !nextDay) return;
    const iso = `${nextYear}-${nextMonth}-${nextDay}`;
    onChange(iso);
  };

  const displayValue = (() => {
    const src = value || (year && month && day ? `${year}-${month}-${day}` : "");
    if (!src) return "dd/mm/aaaa";
    const [y, m, d] = src.split("-");
    if (!y || !m || !d) return "dd/mm/aaaa";
    return `${d}/${m}/${y}`;
  })();

  return (
    <label className="block space-y-2 text-sm font-semibold text-white">
      Fecha de nacimiento
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-[#0f0f0f] px-4 py-3 text-left text-base text-white transition hover:border-white/30 focus:border-white focus:outline-none"
      >
        <span className={value ? "text-white" : "text-white/40"}>{displayValue}</span>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="text-white/60">
          <rect x="3" y="4" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="1.5" />
          <path d="M8 2V6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <path d="M16 2V6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <path d="M3 10H21" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>
      {open && (
        <div className="relative z-10">
          <div className="mt-2 grid gap-3 rounded-2xl border border-white/10 bg-[#0c0c0c] p-3 shadow-[0_20px_60px_rgba(0,0,0,0.4)] md:grid-cols-3">
            <Select label="Día" value={day} onChange={(v) => { setDay(v); updateValue(year, month, v); }} options={days} />
            <Select
              label="Mes"
              value={month}
              onChange={(v) => { setMonth(v); updateValue(year, v, day); }}
              options={months.map((m) => ({ label: m.label, value: m.value }))}
            />
            <Select
              label="Año"
              value={year}
              onChange={(v) => { setYear(v); updateValue(v, month, day); }}
              options={years.map((y) => ({ label: String(y), value: String(y) }))}
            />
          </div>
        </div>
      )}
      <p className="text-xs font-normal text-white/60">Debes ser mayor de 18 años.</p>
    </label>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { label: string; value: string }[] | string[];
}) {
  const normalized =
    typeof options[0] === "string"
      ? (options as string[]).map((v) => ({ label: v, value: v }))
      : (options as { label: string; value: string }[]);
  return (
    <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-[0.08em] text-white/70">
      {label}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-white/10 bg-[#111111] px-3 py-2 text-sm text-white focus:border-white focus:outline-none"
      >
        <option value="">—</option>
        {normalized.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function Placeholder() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-black px-6 py-10 text-white">
      <div className="text-sm text-white/70">Cargando...</div>
    </main>
  );
}
