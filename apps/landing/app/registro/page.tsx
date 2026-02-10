"use client";

import { FormEvent, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { DOCUMENT_TYPES, validateDocument, type DocumentType } from "shared/document";
import TableMap, { type MapSlot, percentToViewBox } from "./TableMap";

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
  x: number;
  y: number;
  w: number;
  h: number;
};

type TableSlotWithData = MapSlot & { table: TableInfo | null };

const TABLES: TableSlot[] = [
  { id: "M1", label: "1", x: percentToViewBox(21, "x"), y: percentToViewBox(8.5, "y"), w: percentToViewBox(14, "x"), h: percentToViewBox(10, "y") },
  { id: "M2", label: "2", x: percentToViewBox(13.5, "x"), y: percentToViewBox(16.5, "y"), w: percentToViewBox(8, "x"), h: percentToViewBox(5, "y") },
  { id: "M3", label: "3", x: percentToViewBox(12, "x"), y: percentToViewBox(50, "y"), w: percentToViewBox(14, "x"), h: percentToViewBox(10, "y") },
  { id: "M4", label: "4", x: percentToViewBox(13.5, "x"), y: percentToViewBox(44, "y"), w: percentToViewBox(8, "x"), h: percentToViewBox(5, "y") },
  { id: "M5", label: "5", x: percentToViewBox(18.5, "x"), y: percentToViewBox(60, "y"), w: percentToViewBox(14, "x"), h: percentToViewBox(10, "y") },
  { id: "M6", label: "6", x: percentToViewBox(70, "x"), y: percentToViewBox(80, "y"), w: percentToViewBox(16, "x"), h: percentToViewBox(12, "y") },
];

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

function joinLastNames(apellidoPaterno: string, apellidoMaterno: string) {
  return [apellidoPaterno, apellidoMaterno].filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
}

function splitLastNames(full: string) {
  const normalized = full.replace(/\s+/g, " ").trim();
  if (!normalized) return { apellido_paterno: "", apellido_materno: "" };
  const tokens = normalized.split(" ");
  if (tokens.length === 1) {
    return { apellido_paterno: tokens[0], apellido_materno: "" };
  }
  // Estrategia elegida: preservar apellidos paternos compuestos en el bloque izquierdo.
  // Ejemplo: "De la Cruz Gomez" => paterno "De la Cruz", materno "Gomez".
  const apellidoMaterno = tokens[tokens.length - 1];
  const apellidoPaterno = tokens.slice(0, -1).join(" ");
  return {
    apellido_paterno: apellidoPaterno || "",
    apellido_materno: apellidoMaterno || "",
  };
}

const LOCAL_MAP_ASSET = "/maps/venue-plan.png";
const ENABLE_MAP_ZOOM = process.env.NEXT_PUBLIC_MAP_ENABLE_ZOOM !== "false";

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
  const tableLayoutUrl = process.env.NEXT_PUBLIC_TABLE_LAYOUT_URL || LOCAL_MAP_ASSET;
  const initialCover = process.env.NEXT_PUBLIC_REGISTRO_COVER_URL || "";
  const [coverUrl, setCoverUrl] = useState<string>(initialCover);
  const [logoUrl, setLogoUrl] = useState<string | null>(process.env.NEXT_PUBLIC_LOGO_URL || null);
  const [step, setStep] = useState<1 | 2>(1);
  const initialFormState = {
    doc_type: "dni",
    document: "",
    dni: "",
    nombre: "",
    apellido_paterno: "",
    apellido_materno: "",
    email: "",
    telefono: "",
    promoter_id: "",
    birthdate: "",
  };
  const initialReservationState = {
    doc_type: "dni",
    document: "",
    dni: "",
    nombre: "",
    apellido_paterno: "",
    apellido_materno: "",
    email: "",
    phone: "",
    voucher_url: "",
  };
  const [form, setForm] = useState({ ...initialFormState });
  const [tab, setTab] = useState<"ticket" | "mesa">("ticket");
  const [reniecLoading, setReniecLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [promoters, setPromoters] = useState<Array<{ id: string; name: string }>>([]);
  const [codeInfo, setCodeInfo] = useState<{ type?: string | null; promoter_id?: string | null; event_id?: string | null } | null>(null);
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [selectedTable, setSelectedTable] = useState<string>("");
  const [reservation, setReservation] = useState({ ...initialReservationState });
  const [selectedProduct, setSelectedProduct] = useState<string>("");
  const [uploadingVoucher, setUploadingVoucher] = useState(false);
  const [reservationCodes, setReservationCodes] = useState<string[] | null>(null);
  const [reservationError, setReservationError] = useState<string | null>(null);
  const [reservationLoading, setReservationLoading] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [copyFeedback, setCopyFeedback] = useState<"idle" | "copied" | "error">("idle");
  const [showReservationSent, setShowReservationSent] = useState(false);
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
  const yapeNumber = "950 144 641";
  const yapeHolder = "Kevin Andree Huansi Ruiz";

  const loadTables = useCallback(async (eventId?: string | null) => {
    const query = eventId ? `?event_id=${encodeURIComponent(eventId)}` : "";
    try {
      const res = await fetch(`/api/tables${query}`, { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      const loadedTables = data?.tables || [];
      setTables(loadedTables);
      const firstTable = loadedTables.find((t: any) => !t.is_reserved) || loadedTables?.[0];
      setSelectedTable(firstTable?.id || "");
      const firstProduct = firstTable?.products?.find((p: any) => p.is_active !== false);
      setSelectedProduct(firstProduct?.id || "");
    } catch (_err) {
      setTables([]);
      setSelectedTable("");
      setSelectedProduct("");
    }
  }, []);

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

  const lookupDocument = async () => {
    if (!validateDocument(form.doc_type as DocumentType, form.document)) {
      setError("Documento inválido");
      return;
    }
    await loadPersonData(form.document, { force: true, docType: form.doc_type as DocumentType });
    if (form.doc_type !== "dni") return;
    setReniecLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/reniec?dni=${form.document}`);
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
      await loadPersonData(form.document, { docType: "dni" });
    } catch (err: any) {
      setError(err?.message || "Error al validar DNI");
    } finally {
      setReniecLoading(false);
    }
  };

  useEffect(() => {
    if (validateDocument(form.doc_type as DocumentType, form.document)) {
      loadPersonData(form.document, { docType: form.doc_type as DocumentType });
    }
  }, [form.doc_type, form.document]);

  useEffect(() => {
    if (validateDocument(reservation.doc_type as DocumentType, reservation.document)) {
      loadPersonData(reservation.document, { docType: reservation.doc_type as DocumentType });
    }
  }, [reservation.doc_type, reservation.document]);

  useEffect(() => {
    // sincroniza datos del formulario principal con el de reserva si están vacíos
    setReservation((prev) => {
      const nombreFromForm = form.nombre.trim();
      const apellidoPaternoFromForm = form.apellido_paterno.trim();
      const apellidoMaternoFromForm = form.apellido_materno.trim();
      return {
        ...prev,
        doc_type: prev.doc_type || form.doc_type || "dni",
        document: prev.document || form.document || "",
        dni: prev.dni || form.document || "",
        nombre: prev.nombre || nombreFromForm,
        apellido_paterno: prev.apellido_paterno || apellidoPaternoFromForm,
        apellido_materno: prev.apellido_materno || apellidoMaternoFromForm,
        email: prev.email || form.email,
        phone: prev.phone || form.telefono,
      };
    });
  }, [form.doc_type, form.document, form.nombre, form.apellido_paterno, form.apellido_materno, form.email, form.telefono]);

  useEffect(() => {
    fetch("/api/promoters", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => setPromoters(data?.promoters || []))
      .catch(() => setPromoters([]));
    fetch("/api/layout")
      .then((res) => res.json())
      .then((data) => setLayoutUrl(data?.layout_url || null))
      .catch(() => null);
    loadTables();
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
  }, [loadTables]);

  useEffect(() => {
    if (codeInfo?.event_id) {
      loadTables(codeInfo.event_id);
    }
  }, [codeInfo?.event_id, loadTables]);

  const tableSlots = useMemo<TableSlotWithData[]>(
    () =>
      TABLES.map((slot) => {
        const table = findTableForSlot(slot.label, tables);
        const x = table?.pos_x != null ? percentToViewBox(table.pos_x, "x") : slot.x;
        const y = table?.pos_y != null ? percentToViewBox(table.pos_y, "y") : slot.y;
        const w = table?.pos_w != null ? percentToViewBox(table.pos_w, "x") : slot.w;
        const h = table?.pos_h != null ? percentToViewBox(table.pos_h, "y") : slot.h;
        const status: MapSlot["status"] = table ? (table.is_reserved ? "reserved" : "available") : "unavailable";
        return {
          ...slot,
          x,
          y,
          w,
          h,
          table,
          tableId: table?.id,
          tableName: table?.name || `Mesa ${slot.label}`,
          capacity: table?.ticket_count ?? null,
          status,
        };
      }),
    [tables]
  );
  const mapUrl = layoutUrl || tableLayoutUrl || LOCAL_MAP_ASSET;
  const enableMapZoom = ENABLE_MAP_ZOOM;

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

  const totalPrice = selectedProductInfo?.price ?? tableInfo?.price ?? tableInfo?.min_consumption ?? null;
  const totalLabel = totalPrice != null ? formatCurrency(totalPrice) : null;

  const aforoWidth = Math.max(0, Math.min(aforo, 100));
  const reservationDocError =
    reservation.document && !validateDocument(reservation.doc_type as DocumentType, reservation.document)
      ? "Documento inválido"
      : "";
  const reservationFullName = useMemo(
    () =>
      [reservation.nombre, reservation.apellido_paterno, reservation.apellido_materno]
        .filter(Boolean)
        .join(" ")
        .replace(/\s+/g, " ")
        .trim(),
    [reservation.nombre, reservation.apellido_paterno, reservation.apellido_materno]
  );

  const copyYapeNumber = async () => {
    try {
      await navigator.clipboard.writeText(yapeNumber.replace(/\s/g, ""));
      setCopyFeedback("copied");
      setTimeout(() => setCopyFeedback("idle"), 1800);
    } catch (_err) {
      setCopyFeedback("error");
      setTimeout(() => setCopyFeedback("idle"), 1800);
    }
  };

  const openReservationSummary = () => {
    setReservationError(null);
    setModalError(null);
    setReservationCodes(null);
    setCopyFeedback("idle");
    setShowReservationSent(false);

    if (!selectedTable) {
      setReservationError("Selecciona una mesa");
      return;
    }
    if (!validateDocument(reservation.doc_type as DocumentType, reservation.document) || !reservationFullName) {
      setReservationError("Ingresa documento y nombres y apellidos de la reserva");
      return;
    }
    if (products.length > 0 && !selectedProduct) {
      setReservationError("Elige un pack para tu mesa");
      return;
    }
    setShowPaymentModal(true);
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-black px-6 py-10 text-white">
      <div className="w-full max-w-7xl space-y-6">
        {coverUrl && (
          <div className="relative mx-auto w-full overflow-hidden rounded-3xl border border-white/10 bg-[#0b0b0b]">
            <img
              src={coverUrl}
              alt="Cover"
              className="h-auto w-full object-cover"
              style={{
                aspectRatio: "32 / 14",
                objectPosition: "center",
                WebkitMaskImage:
                  "linear-gradient(to bottom, rgba(0,0,0,1) 60%, rgba(0,0,0,0.6) 78%, rgba(0,0,0,0) 100%)",
                maskImage:
                  "linear-gradient(to bottom, rgba(0,0,0,1) 60%, rgba(0,0,0,0.6) 78%, rgba(0,0,0,0) 100%)",
              }}
            />
            <div
              className="pointer-events-none absolute inset-x-0 bottom-0"
              style={{
                height: "45%",
                background: "linear-gradient(to bottom, rgba(0,0,0,0) 0%, rgba(0,0,0,0.55) 65%, rgba(0,0,0,1) 100%)",
              }}
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
                className="progress-attention-red h-full rounded-full"
                style={{ width: `${aforoWidth}%` }}
              />
            </div>
          </div>
          <h1 className="text-3xl font-semibold">Registro</h1>
          
        </div>

        {step === 1 && (
          <form onSubmit={(e) => { e.preventDefault(); }} className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="block space-y-2 text-sm font-semibold text-white">
                Tipo de documento
                <select
                  value={form.doc_type as DocumentType}
                  onChange={(e) => setForm((prev) => ({ ...prev, doc_type: e.target.value as DocumentType }))}
                  className="w-full rounded-xl border border-white/10 bg-[#111111] px-4 py-3 text-base text-white focus:border-white focus:outline-none"
                >
                  {DOCUMENT_TYPES.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </label>
              <Field
                label="Número de documento"
                value={form.document}
                onChange={handleChange("document")}
                placeholder={form.doc_type === "dni" ? "00000000" : "Documento"}
                required
                onBlur={lookupDocument}
                inputMode={form.doc_type === "dni" || form.doc_type === "ruc" ? "numeric" : "text"}
                digitOnly={form.doc_type === "dni" || form.doc_type === "ruc"}
                maxLength={form.doc_type === "dni" ? 8 : form.doc_type === "ruc" ? 11 : 12}
                autoComplete="off"
                allowClear
                error={
                  form.document && !validateDocument(form.doc_type as DocumentType, form.document)
                    ? "Documento inválido"
                    : ""
                }
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
                label="Apellidos"
                value={joinLastNames(form.apellido_paterno, form.apellido_materno)}
                onChange={(value) => {
                  const parsed = splitLastNames(value);
                  setForm((prev) => ({ ...prev, ...parsed }));
                }}
                placeholder="Apellidos"
                required
              />
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
            </div>

            {(reniecLoading || personLoading) && (
              <p className="text-xs text-white/60">Buscando datos del DNI...</p>
            )}
            {error && <p className="text-xs font-semibold text-[#ff9a9a]">{error}</p>}

            <div className="flex flex-col gap-3">
              <button
                type="button"
                onClick={() => createTicketAndRedirect()}
                className="w-full rounded-xl px-4 py-3 text-center text-sm font-semibold uppercase tracking-wide btn-smoke transition"
              >
                {existingTicketId ? "Ver mi QR" : "Generar QR"}
              </button>
              <div className="relative overflow-hidden rounded-2xl border border-white/15 bg-black">
                <button
                  type="button"
                  onClick={() => {
                    if (tables.length === 0) {
                      createTicketAndRedirect();
                    } else {
                      setReservation((prev) => ({
                        ...prev,
                        doc_type: form.doc_type as DocumentType,
                        document: form.document,
                        dni: form.document,
                        nombre: form.nombre,
                        apellido_paterno: form.apellido_paterno,
                        apellido_materno: form.apellido_materno,
                        email: form.email,
                        phone: form.telefono,
                      }));
                      setStep(2);
                    }
                  }}
                  className="relative w-full rounded-2xl px-4 py-3 text-center text-sm font-semibold uppercase tracking-wide btn-attention-red transition"
                >
                  {tables.length > 0 ? "Reservar mesa (opcional)" : "No hay mesas disponibles (generar QR)"}
                </button>
              </div>
              <p className="text-center text-xs text-white/60">Opcional: separa tu mesa y asigna tus tickets.</p>
            </div>
          </form>
        )}

        {step === 2 && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              openReservationSummary();
            }}
            className="space-y-4"
          >
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.3em] text-white/60">Paso 2</p>
                  <h2 className="text-xl font-semibold text-white">Elige tu mesa en el mapa</h2>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-[10px] uppercase tracking-[0.12em] text-white/50">
                  <span className="flex items-center gap-1">
                    <span className="h-3 w-3 rounded-full border border-white/30 bg-white/10" /> Disponible
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="h-3 w-3 rounded-full border border-white/15 bg-white/5" /> Reservada
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="h-3 w-3 rounded-full border border-[#e91e63] bg-[#e91e63]" /> Seleccionada
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-6 md:grid-cols-[1.5fr_1fr] lg:grid-cols-[1.8fr_1fr] md:items-start">
                <div className="mx-auto w-full max-w-[520px] md:max-w-none">
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
                    layoutUrl={mapUrl}
                    enableZoom={enableMapZoom}
                  />
                </div>

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
                                    ? "border-[#e91e63] bg-[#e91e63]/10 text-white shadow-[0_8px_25px_rgba(233,30,99,0.35)]"
                                    : "border-[#f2f2f2]/40 bg-white/5 text-[#f2f2f2] hover:border-[#f2f2f2]"
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
                                  ? "border-[#e91e63] bg-[#e91e63]/10 shadow-[0_10px_30px_rgba(233,30,99,0.3)]"
                                  : "border-[#f2f2f2]/20 bg-black/30 hover:border-[#f2f2f2]"
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

                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="grid gap-3 md:grid-cols-[0.55fr,1fr,1.45fr]">
                <label className="block space-y-2 text-sm font-semibold text-white">
                  Tipo de documento
                  <select
                    value={reservation.doc_type as DocumentType}
                    onChange={(e) =>
                      setReservation((p) => ({
                        ...p,
                        doc_type: e.target.value as DocumentType,
                        document: "",
                      }))
                    }
                    className="w-full rounded-xl border border-white/10 bg-[#111111] px-4 py-3 text-base text-white focus:border-white focus:outline-none"
                  >
                    {DOCUMENT_TYPES.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </label>
                <Field
                  label="Número de documento"
                  value={reservation.document || ""}
                  onChange={(v) => setReservation((p) => ({ ...p, document: v }))}
                  onBlur={() =>
                    validateDocument(reservation.doc_type as DocumentType, reservation.document) &&
                    loadPersonData(reservation.document, { force: true, docType: reservation.doc_type as DocumentType })
                  }
                  required
                  inputMode={reservation.doc_type === "dni" || reservation.doc_type === "ruc" ? "numeric" : "text"}
                  digitOnly={reservation.doc_type === "dni" || reservation.doc_type === "ruc"}
                  maxLength={reservation.doc_type === "dni" ? 8 : reservation.doc_type === "ruc" ? 11 : 12}
                  allowClear
                  error={reservationDocError}
                  onClear={resetReservationForm}
                />
                <Field
                  label="Nombres"
                  value={reservation.nombre}
                  onChange={(v) => setReservation((p) => ({ ...p, nombre: v }))}
                  required
                />
              </div>
              <Field
                label="Apellidos"
                value={joinLastNames(reservation.apellido_paterno, reservation.apellido_materno)}
                onChange={(value) => {
                  const parsed = splitLastNames(value);
                  setReservation((prev) => ({ ...prev, ...parsed }));
                }}
                required
              />
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
            </div>

            {reservationError && <p className="text-xs font-semibold text-[#ff9a9a]">{reservationError}</p>}
            {reservationCodes && reservationCodes.length > 0 && (
              <div className="rounded-2xl border border-white/15 bg-white/5 p-4 text-sm text-white">
                <p className="font-semibold">Reserva registrada.</p>
                <p className="text-xs text-white/70">Validaremos el pago y te enviaremos los códigos por correo.</p>
              </div>
            )}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="w-1/3 rounded-xl px-4 py-3 text-center text-sm font-semibold uppercase tracking-wide btn-smoke-outline transition"
              >
                Atrás
              </button>
              <button
                type="submit"
                disabled={reservationLoading}
                className="w-2/3 rounded-full px-4 py-3 text-center text-sm font-semibold uppercase tracking-wide btn-attention-red transition disabled:opacity-70"
              >
                {reservationLoading ? "Procesando..." : "Revisar pago y enviar"}
              </button>
            </div>
          </form>
        )}
      </div>

      {showPaymentModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 px-4 py-6 sm:items-center">
          <div className="relative w-full max-w-2xl space-y-4 rounded-3xl border border-white/15 bg-gradient-to-b from-[#111111] to-[#050505] p-6 shadow-[0_30px_90px_rgba(0,0,0,0.6)] max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <p className="text-xs font-semibold uppercase tracking-[0.35em] text-white/60">Revisión</p>
                <h3 className="text-2xl font-semibold text-white">Recuento y pago Yape</h3>
                <p className="text-sm text-white/60">Confirma tu reserva y adjunta el comprobante.</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowPaymentModal(false);
                  setModalError(null);
                  setCopyFeedback("idle");
                }}
                className="rounded-full px-3 py-1 text-xs font-semibold btn-smoke-outline transition"
              >
                Editar datos
              </button>
            </div>

              <div className="space-y-3 rounded-2xl border border-white/10 bg-[#0b0b0b] p-4 text-sm text-white/80">
              <div className="flex items-center justify-between text-white">
                <span className="font-semibold">Mesa</span>
                <span className="font-semibold">{tableInfo?.name || "Por definir"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Pack seleccionado</span>
                <span className="font-semibold text-white">{selectedProductInfo?.name || "Sin pack"}</span>
              </div>
              {totalLabel && (
                <div className="flex items-center justify-between text-white">
                  <span className="text-white/80">Total a pagar</span>
                  <span className="text-lg font-semibold text-[#e91e63]">{totalLabel}</span>
                </div>
              )}
              <div className="flex flex-col gap-1 text-xs text-white/60">
                <span>Documento: {reservation.document || "—"} ({reservation.doc_type})</span>
                <span>Nombre: {reservationFullName || "—"}</span>
                <span>Email: {reservation.email || "—"}</span>
                <span>Teléfono: {reservation.phone || "—"}</span>
              </div>
            </div>

            <div className="space-y-2 rounded-2xl border border-white/10 bg-[#0b0b0b] p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-white/60">Paga con Yape/Plin</p>
                  <p className="text-2xl font-semibold leading-tight text-white">{yapeNumber}</p>
                  <p className="text-xs text-white/60">Titular: {yapeHolder}</p>
                </div>
                <button
                  type="button"
                  onClick={copyYapeNumber}
                  className="flex items-center gap-2 rounded-full px-3 py-2 text-xs font-semibold btn-smoke-outline transition"
                >
                  {copyFeedback === "copied" ? "Copiado" : copyFeedback === "error" ? "No se pudo copiar" : "Copiar número"}
                  <span className="text-[#f2f2f2]/70">(para abrir Yape)</span>
                </button>
              </div>
              {totalLabel && (
                <div className="rounded-xl bg-[#e91e63]/10 p-3 text-sm text-white/80">
                  Envía <span className="font-semibold text-white">{totalLabel}</span> al número indicado y adjunta el comprobante abajo.
                </div>
              )}
            </div>

            <div className="space-y-2 rounded-2xl border border-white/10 bg-[#0b0b0b] p-4">
              <label className="text-sm font-semibold text-white">Comprobante de pago</label>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={onVoucherChange}
                disabled={uploadingVoucher || reservationLoading}
                className="w-full rounded-xl border border-white/10 bg-[#111111] px-4 py-3 text-sm text-white file:mr-3 file:rounded-xl file:border-0 file:bg-white/10 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white"
              />
              <div className="flex items-center gap-2 text-xs text-white/60">
                {uploadingVoucher ? "Subiendo comprobante..." : "Formatos: JPG, PNG, WEBP. Máx 5MB."}
              </div>
              {reservation.voucher_url && (
                <a
                  href={reservation.voucher_url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs font-semibold text-[#e91e63] underline-offset-4 hover:underline"
                >
                  Ver comprobante subido
                </a>
              )}
            </div>

            {modalError && <p className="text-xs font-semibold text-[#ff9a9a]">{modalError}</p>}

            <div className="rounded-2xl border border-white/10 bg-black/40 p-3 text-xs text-white/70">
              Validaremos el pago manualmente. Te confirmaremos por correo tu reserva en los próximos minutos.
            </div>

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => {
                  setShowPaymentModal(false);
                  setModalError(null);
                  setCopyFeedback("idle");
                }}
                className="rounded-full px-4 py-2 text-xs font-semibold btn-smoke-outline transition"
              >
                Volver al formulario
              </button>
              <button
                type="button"
                onClick={submitReservation}
                disabled={reservationLoading || uploadingVoucher}
                className="flex items-center justify-center gap-2 rounded-full px-4 py-3 text-xs font-semibold uppercase tracking-wide btn-attention-red transition disabled:opacity-60"
              >
                {reservationLoading ? "Enviando..." : "Enviar reserva"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showReservationSent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-6">
          <div className="w-full max-w-md space-y-3 rounded-3xl border border-white/15 bg-gradient-to-b from-[#111111] to-[#050505] p-6 text-white shadow-[0_30px_90px_rgba(0,0,0,0.6)]">
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-white/60">Reserva recibida</p>
              <h3 className="text-xl font-semibold">Estamos validando tu pago</h3>
              <p className="text-sm text-white/70">
                Enviaremos por correo los detalles y QR de tu reserva cuando sea aprobada. Mantén tu comprobante a la mano por si lo
                solicitamos.
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/30 p-3 text-xs text-white/70">
              Recibirás un correo desde BABY con la confirmación. Si no lo ves, revisa tu carpeta de spam.
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setShowReservationSent(false)}
                className="rounded-full px-4 py-2 text-xs font-semibold btn-smoke-outline transition"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}

    </main>
  );

  async function onVoucherChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingVoucher(true);
    setReservationError(null);
    setModalError(null);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("tableName", selectedTable || "mesa");
    try {
      const res = await fetch("/api/uploads/voucher", { method: "POST", body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        const msg = data?.error || "No se pudo subir el voucher";
        setReservationError(msg);
        setModalError(msg);
      } else {
        setReservation((prev) => ({ ...prev, voucher_url: data.url }));
      }
    } catch (err: any) {
      const msg = err?.message || "Error al subir voucher";
      setReservationError(msg);
      setModalError(msg);
    } finally {
      setUploadingVoucher(false);
      if (e.target) e.target.value = "";
    }
  }

  async function submitReservation() {
    setReservationError(null);
    setReservationCodes(null);
    setModalError(null);
    if (!selectedTable || !validateDocument(reservation.doc_type as DocumentType, reservation.document) || !reservationFullName) {
      const msg = "Selecciona una mesa e ingresa documento y nombres y apellidos";
      setModalError(msg);
      setReservationError(msg);
      return;
    }
    if (!reservation.voucher_url) {
      const msg = "Sube tu comprobante de pago para continuar.";
      setModalError(msg);
      setReservationError(msg);
      return;
    }
    if (products.length > 0 && !selectedProduct) {
      const msg = "Elige un pack para tu mesa";
      setModalError(msg);
      setReservationError(msg);
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
          doc_type: reservation.doc_type,
          document: reservation.document,
          full_name: reservationFullName,
          email: reservation.email,
          phone: reservation.phone,
          voucher_url: reservation.voucher_url,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        const msg = data?.error || "No se pudo registrar la reserva";
        setReservationError(msg);
        setModalError(msg);
      } else {
        setReservationCodes(data.codes || []);
        setShowPaymentModal(false);
        setShowReservationSent(true);
        resetReservationForm();
        setStep(1);
      }
    } catch (err: any) {
      const msg = err?.message || "Error al registrar reserva";
      setReservationError(msg);
      setModalError(msg);
    } finally {
      setReservationLoading(false);
    }
  }

  async function loadPersonData(dni: string, opts: { force?: boolean; docType?: DocumentType } = {}) {
    if (!dni) return;
    const docType = opts.docType || "dni";
    if (!opts.force && lastPersonLookup.current === `${docType}:${dni}`) return;
    lastPersonLookup.current = `${docType}:${dni}`;
    setPersonLoading(true);
    try {
      const res = await fetch(
        `/api/persons?document=${encodeURIComponent(dni)}&doc_type=${docType}${code ? `&code=${encodeURIComponent(code)}` : ""}`
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.person) return;
      const p = data.person;
      const [apPat, ...rest] = (p.last_name || "").split(" ");
      const apMat = rest.join(" ").trim();
      const promoterFromTicket = (p as any)?.ticket_promoter_id || "";
      const ticketFromPerson = (p as any)?.ticket_id || null;
      setForm((prev) => ({
        ...prev,
        doc_type: prev.doc_type || docType,
        document: prev.document || dni,
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
        doc_type: prev.doc_type || docType,
        document: prev.document || dni,
        dni: prev.dni || dni,
        nombre: prev.nombre || p.first_name || "",
        apellido_paterno: prev.apellido_paterno || apPat || "",
        apellido_materno: prev.apellido_materno || apMat || "",
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
    if (extraCodes?.length) setReservationError(null);
    if (ticketId) {
      router.push(`/ticket/${ticketId}`);
      return;
    }
    if (!validateDocument(form.doc_type as DocumentType, form.document)) {
      setError("Documento inválido");
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
          doc_type: form.doc_type,
          document: form.document,
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
        const msg = data?.error || "No se pudo generar la entrada";
        setError(msg);
        return;
      }
      setTicketId(data.ticketId);
      setExistingTicketId(data.ticketId);
      router.push(`/ticket/${data.ticketId}`);
    } catch (err: any) {
      const msg = err?.message || "Error al generar entrada";
      setError(msg);
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
        className="flex w-full items-center justify-between rounded-xl border border-[#e91e63]/40 bg-[#0f0f0f] px-4 py-3 text-left text-base text-white transition hover:border-[#e91e63] focus:border-[#e91e63] focus:outline-none"
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
