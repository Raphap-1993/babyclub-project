"use client";

import { FormEvent, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { DOCUMENT_TYPES, validateDocument, type DocumentType } from "shared/document";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@repo/ui/components/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/components/card";
import { ScrollArea } from "@repo/ui/components/scroll-area";
import SimpleTableMap from "./SimpleTableMap";

// Importar utilidades del TableMap original
const MAP_VIEWBOX = { width: 1080, height: 1659 };
function percentToViewBox(value: number, axis: "x" | "y") {
  const size = axis === "x" ? MAP_VIEWBOX.width : MAP_VIEWBOX.height;
  return (size * value) / 100;
}

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
  const numeric = Number(value);
  if (Number.isNaN(numeric)) return "—";
  return `S/ ${numeric.toLocaleString("es-PE", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
};

const formatDateInput = (date: Date) => date.toISOString().slice(0, 10);

function getActiveProductsForTable(table?: TableInfo | null) {
  return (table?.products || [])
    .filter((p) => p.is_active !== false)
    .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
}

function getDisplayPriceForTable(table?: TableInfo | null) {
  const firstProductWithPrice = getActiveProductsForTable(table).find((p) => p.price != null);
  return firstProductWithPrice?.price ?? table?.price ?? table?.min_consumption ?? null;
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

  // Preload cover image
  useEffect(() => {
    if (coverUrl) {
      const link = document.createElement('link');
      link.rel = 'preload';
      link.as = 'image';
      link.href = coverUrl;
      link.fetchPriority = 'high';
      document.head.appendChild(link);
      return () => {
        document.head.removeChild(link);
      };
    }
  }, [coverUrl]);
  const [step, setStep] = useState<1 | 2>(1);
  const initialFormState = {
    doc_type: "dni",
    document: "",
    dni: "",
    nombre: "",
    apellidos: "",
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
    promoter_id: "",
  };
  const [form, setForm] = useState({ ...initialFormState });
  const [tab, setTab] = useState<"ticket" | "mesa">("ticket");
  const [reniecLoading, setReniecLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [promoters, setPromoters] = useState<Array<{ id: string; name: string }>>([]);
  const [codeInfo, setCodeInfo] = useState<{ type?: string | null; promoter_id?: string | null } | null>(null);
  const [codeEventId, setCodeEventId] = useState<string | null>(null);
  const [eventInfo, setEventInfo] = useState<{ name?: string; starts_at?: string; location?: string } | null>(null);
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
  const [existingTicketEventId, setExistingTicketEventId] = useState<string | null>(null);
  const [aforo, setAforo] = useState<number>(0);
  const [aforoMeta, setAforoMeta] = useState<{ used: number; capacity: number } | null>(null);
  const [personLoading, setPersonLoading] = useState(false);
  const [layoutUrl, setLayoutUrl] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>("seleccion");
  const lastPersonLookup = useRef<string | null>(null);
  const maxBirthdate = useMemo(() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() - 18);
    return formatDateInput(d);
  }, []);
  const hidePromoterSelect = useMemo(
    () => ["courtesy", "table"].includes((codeInfo?.type || "").toLowerCase()),
    [codeInfo]
  );
  const yapeNumber = "950 144 641";
  const yapeHolder = "Kevin Andree Huansi Ruiz";

  const resetMainForm = () => {
    setForm({ ...initialFormState });
    setExistingTicketId(null);
    setTicketId(null);
    setExistingTicketEventId(null);
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
    setForm((prev) => {
      const next = { ...prev, [field]: value };
      if (field === "apellidos") {
        const parts = value.trim().split(/\s+/);
        next.apellido_paterno = parts[0] || "";
        next.apellido_materno = parts.slice(1).join(" ") || "";
      }
      return next;
    });
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
    
    // /api/persons ya hace todo:
    // 1. Busca en BD primero
    // 2. Si no existe y es DNI, consulta API Perú
    // 3. Guarda los datos de API Perú en BD para futuras consultas
    setReniecLoading(true);
    setError(null);
    try {
      await loadPersonData(form.document, { force: true, docType: form.doc_type as DocumentType });
    } catch (err: any) {
      setError(err?.message || "Error al validar documento");
    } finally {
      setReniecLoading(false);
    }
  };

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
        promoter_id: prev.promoter_id || form.promoter_id || "",
      };
    });
  }, [form.doc_type, form.document, form.nombre, form.apellido_paterno, form.apellido_materno, form.email, form.telefono, form.promoter_id]);

  // Auto-búsqueda de persona cuando el documento es válido (paso 2)
  useEffect(() => {
    if (step === 2 && validateDocument(reservation.doc_type as DocumentType, reservation.document)) {
      loadPersonData(reservation.document, { docType: reservation.doc_type as DocumentType });
    }
  }, [reservation.doc_type, reservation.document, step]);

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
      // Cargar manifiesto primero para obtener el cover lo antes posible
      Promise.all([
        fetch(`/api/manifiesto?code=${encodeURIComponent(code)}`, { 
          cache: "force-cache",
          next: { revalidate: 300 } // 5 min cache
        })
          .then((res) => res.json())
          .then((data) => {
            if (data?.cover_url) {
              setCoverUrl(data.cover_url);
            } else if (data?.url) {
              setCoverUrl(data.url);
            }
            // Guardar información del evento para mostrar contexto
            if (data?.event_name || data?.event_starts_at || data?.event_location) {
              setEventInfo({
                name: data.event_name || null,
                starts_at: data.event_starts_at || null,
                location: data.event_location || null,
              });
            }
          })
          .catch(() => null),
        fetch(`/api/codes/info?code=${encodeURIComponent(code)}`)
          .then((res) => res.json())
          .then((data) => {
            setCodeInfo(data?.error ? null : data);
            if (data?.event_id) setCodeEventId(data.event_id);
          })
          .catch(() => setCodeInfo(null))
      ]);
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

  const tableSlots = useMemo(() => {
    const slots = TABLES.map((slot) => {
      // Buscar mesa por nombre (ej: "Mesa 1", "Mesa1", "1")
      const table = findTableForSlot(slot.label, tables);
      if (!table) {
        return {
          id: slot.id,
          label: slot.label,
          x: slot.x,
          y: slot.y,
          width: slot.w,
          height: slot.h,
          reserved: true,
        };
      }

      const x = table?.pos_x != null ? percentToViewBox(table.pos_x, "x") : slot.x;
      const y = table?.pos_y != null ? percentToViewBox(table.pos_y, "y") : slot.y;
      const w = table?.pos_w != null ? percentToViewBox(table.pos_w, "x") : slot.w;
      const h = table?.pos_h != null ? percentToViewBox(table.pos_h, "y") : slot.h;

      return {
        id: table.id, // Usar el ID real de la mesa de BD
        label: table.name,
        x,
        y,
        width: w,
        height: h,
        reserved: !!table.is_reserved,
      };
    });
    
    // Debug logs
    if (typeof window !== 'undefined') {
      console.log('[Registro] Tables loaded:', tables.length);
      console.log('[Registro] Slots mapped:', slots.length);
      console.log('[Registro] Available slots:', slots.filter(s => !s.reserved).length);
      console.log('[Registro] Slots detail:', slots.map(s => ({ 
        label: s.label, 
        id: s.id.substring(0, 8), 
        reserved: s.reserved 
      })));
    }
    
    return slots;
  }, [tables]);
  
  const mapUrl = layoutUrl || tableLayoutUrl || LOCAL_MAP_ASSET;

  const tableInfo = useMemo(() => {
    return tables.find((t) => t.id === selectedTable) || null;
  }, [selectedTable, tables]);

  const fallbackTables = useMemo(
    () => tables.filter((t) => !TABLES.some((slot) => slot.id === t.id)),
    [tables]
  );

  const products = useMemo(() => getActiveProductsForTable(tableInfo), [tableInfo]);
  const selectedProductInfo = products.find((p) => p.id === selectedProduct) || products[0] || null;

  const totalPrice = selectedProductInfo?.price ?? tableInfo?.price ?? tableInfo?.min_consumption ?? null;
  const totalLabel = totalPrice != null ? formatCurrency(totalPrice) : null;

  useEffect(() => {
    if (!selectedTable) {
      if (selectedProduct) setSelectedProduct("");
      return;
    }
    if (products.length === 0) {
      if (selectedProduct) setSelectedProduct("");
      return;
    }
    if (!products.some((p) => p.id === selectedProduct)) {
      setSelectedProduct(products[0]?.id || "");
    }
  }, [selectedTable, products, selectedProduct]);

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
    <main className="flex min-h-screen items-start justify-center bg-black px-6 py-6 lg:py-10 text-white">
      <div className="w-full max-w-7xl space-y-4 lg:space-y-6">
        {coverUrl && (
          <div className="relative mx-auto w-full overflow-hidden rounded-3xl bg-[#0b0b0b]">
            <div className="relative w-full h-[280px] sm:h-[320px] lg:h-[360px]">
              <Image
                src={coverUrl}
                alt="Cover"
                fill
                priority
                fetchPriority="high"
                unoptimized={coverUrl.startsWith('http')}
                className="object-cover object-center"
                sizes="100vw"
              />
              <div
                className="pointer-events-none absolute inset-0"
                style={{
                  background: "linear-gradient(to bottom, rgba(0,0,0,0) 0%, rgba(0,0,0,0.1) 30%, rgba(0,0,0,0.4) 60%, rgba(0,0,0,0.75) 85%, rgba(0,0,0,0.95) 100%)",
                }}
              />
            </div>
          </div>
        )}

        <div className="space-y-2 lg:space-y-3 text-center pt-4 lg:pt-6">
          <h1 className="text-2xl lg:text-3xl font-semibold">Registro</h1>
          
          <div className="mx-auto max-w-md space-y-3">
            <div className="flex flex-col items-center gap-2 lg:gap-3">
              <div className="flex items-center gap-2 text-[10px] lg:text-xs font-semibold text-white/80">
                <span>AFORO</span>
                <span className="text-white">{aforoWidth}%</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-[#e91e63] shadow-[0_0_12px_rgba(233,30,99,0.55)]"
                  style={{ width: `${aforoWidth}%` }}
                />
              </div>
            </div>
            
            {eventInfo?.name && (
              <div className="rounded-xl border border-white/10 bg-gradient-to-br from-[#0a0a0a] to-[#111111] p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#e91e63]/10 text-[#e91e63]">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="4" width="18" height="18" rx="2" />
                      <path d="M8 2v4M16 2v4M3 10h18" strokeLinecap="round" />
                    </svg>
                  </div>
                  <div className="flex-1 space-y-1 text-left">
                    <p className="text-xs font-semibold uppercase tracking-wider text-white/50">Registro para evento</p>
                    <p className="text-base font-bold text-white">{eventInfo.name}</p>
                    {eventInfo.starts_at && (
                      <p className="text-sm text-white/70">
                        {new Date(eventInfo.starts_at).toLocaleDateString('es-PE', { 
                          weekday: 'long', 
                          year: 'numeric', 
                          month: 'long', 
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </p>
                    )}
                    {eventInfo.location && (
                      <p className="text-sm text-white/60">📍 {eventInfo.location}</p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {step === 1 && (
          <div className="mx-auto max-w-md">
            <form onSubmit={(e) => { e.preventDefault(); }} className="space-y-4">
              <label className="block space-y-2 text-sm font-semibold text-white">
                Tipo de documento
                <select
                  value={form.doc_type as DocumentType}
                  onChange={(e) => setForm((prev) => ({ ...prev, doc_type: e.target.value as DocumentType }))}
                  className="w-full rounded-xl border border-white/10 bg-[#111111] px-4 py-2.5 lg:py-3 text-base text-white focus:border-white focus:outline-none"
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
                actionButton={{
                  icon: (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="11" cy="11" r="8" />
                      <path d="m21 21-4.35-4.35" strokeLinecap="round" />
                    </svg>
                  ),
                  onClick: lookupDocument,
                  label: "Buscar datos del documento",
                  loading: reniecLoading || personLoading,
                }}
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
                value={form.apellidos}
                onChange={handleChange("apellidos")}
                placeholder="Apellido paterno y materno"
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

              {(reniecLoading || personLoading) && (
                <p className="text-xs text-white/60">Buscando datos del DNI...</p>
              )}
              {error && <p className="text-xs font-semibold text-[#ff9a9a]">{error}</p>}

              <button
                type="button"
                onClick={() => createTicketAndRedirect()}
                className="w-full rounded-xl px-4 py-3 text-center text-sm font-semibold uppercase tracking-wide btn-smoke transition"
              >
                {existingTicketId ? "Ver mi QR" : "Generar QR"}
              </button>
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
                  className="w-full rounded-xl px-4 py-3 text-center text-sm font-semibold uppercase tracking-wide btn-attention-red transition"
                >
                  {tables.length > 0 ? "Reservar mesa (opcional)" : "No hay mesas disponibles"}
                </button>
              <p className="text-center text-xs text-white/60">Opcional: separa tu mesa y asigna tus tickets.</p>
            </form>
          </div>
        )}

        {step === 2 && (
          <div className="mx-auto w-full max-w-[1600px]">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                openReservationSummary();
              }}
              className="space-y-3"
            >
              {/* Header compacto */}
              <div className="flex items-end justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/60">Paso 2</p>
                  <h2 className="text-xl font-semibold text-white">Reserva de mesa</h2>
                </div>
                <div className="hidden items-center gap-2 text-[9px] uppercase tracking-[0.1em] text-white/50 lg:flex">
                  <span className="flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full border border-white/30 bg-white/10" /> Libre
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full border border-white/15 bg-white/5" /> Reservada
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full border border-[#e91e63] bg-[#e91e63]" /> Seleccionada
                  </span>
                </div>
              </div>

              {/* Layout principal - 2 columnas compactas */}
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-[400px_1fr]">
                {/* Columna 1: Mapa compacto y optimizado */}
                <div className="relative h-[380px] overflow-hidden rounded-xl border border-white/10 bg-black/20 lg:h-[calc(100vh-220px)] lg:max-h-[600px]">
                  <SimpleTableMap
                    slots={tableSlots}
                    selectedTableId={selectedTable}
                    onSelect={(id) => {
                      setSelectedTable(id);
                      const nextTable = tables.find((t) => t.id === id);
                      const nextProduct = nextTable?.products?.find((p: any) => p.is_active !== false);
                      // Auto-seleccionar el primer pack activo (obligatorio)
                      if (nextProduct) {
                        setSelectedProduct(nextProduct.id);
                      }
                    }}
                    loading={tables.length === 0}
                    layoutUrl={mapUrl}
                  />
                </div>

                {/* Columna 2: Tabs shadcn */}
                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                  <TabsList className="grid w-full grid-cols-2 bg-[#111111] h-11">
                    <TabsTrigger 
                      value="seleccion"
                      className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-[#e91e63] data-[state=active]:to-[#c2185b] data-[state=active]:text-white data-[state=active]:font-bold data-[state=inactive]:text-white/50 transition-all"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mr-1.5">
                        <rect x="3" y="3" width="7" height="7" rx="1" />
                        <rect x="14" y="3" width="7" height="7" rx="1" />
                        <rect x="14" y="14" width="7" height="7" rx="1" />
                        <rect x="3" y="14" width="7" height="7" rx="1" />
                      </svg>
                      Seleccionar Mesa
                    </TabsTrigger>
                    <TabsTrigger 
                      value="datos"
                      className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-[#e91e63] data-[state=active]:to-[#c2185b] data-[state=active]:text-white data-[state=active]:font-bold data-[state=inactive]:text-white/50 transition-all"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mr-1.5">
                        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                        <circle cx="9" cy="7" r="4" />
                      </svg>
                      Completar Reserva
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="seleccion" className="mt-0 border-x border-b border-white/10 rounded-b-xl bg-[#0a0a0a]">
                    <ScrollArea maxHeight="calc(100vh - 280px)" className="p-3">
                      <div className="space-y-3">
                        {/* Selección de mesa compacta y sin redundancia */}
                        {!selectedTable ? (
                          <Card className="bg-[#111111] border-white/10">
                            <CardContent className="p-3">
                              <div className="text-center py-2">
                                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mx-auto mb-2 text-white/40">
                                  <rect x="3" y="3" width="7" height="7" rx="1" />
                                  <rect x="14" y="3" width="7" height="7" rx="1" />
                                  <rect x="14" y="14" width="7" height="7" rx="1" />
                                  <rect x="3" y="14" width="7" height="7" rx="1" />
                                </svg>
                                <p className="text-xs font-semibold text-white/50">Selecciona una mesa</p>
                                <p className="text-[10px] text-white/40 mt-0.5">Toca en el mapa o en la lista abajo</p>
                              </div>
                            </CardContent>
                          </Card>
                        ) : (
                          <Card className="bg-gradient-to-br from-[#e91e63]/10 to-transparent border-[#e91e63]/30">
                            <CardContent className="p-3">
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex-1">
                                  <p className="text-[9px] font-semibold uppercase tracking-wider text-white/50 mb-1">Mesa seleccionada</p>
                                  <p className="text-lg font-bold text-white mb-2">{tableInfo?.name}</p>
                                  <div className="flex gap-2 text-[10px]">
                                    <div className="flex items-center gap-1">
                                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-white/50">
                                        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                                        <circle cx="9" cy="7" r="4" />
                                      </svg>
                                      <span className="text-white/70">{tableInfo?.ticket_count ?? 0} tickets</span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-[#e91e63]">
                                        <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                                      </svg>
                                      <span className="text-white font-semibold">{totalLabel || formatCurrency(getDisplayPriceForTable(tableInfo))}</span>
                                    </div>
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedTable("");
                                    setSelectedProduct("");
                                  }}
                                  className="rounded-md px-2 py-1 text-[10px] font-semibold text-white/60 hover:text-white hover:bg-white/10 transition"
                                >
                                  Cambiar
                                </button>
                              </div>
                            </CardContent>
                          </Card>
                        )}

                        {/* Lista de mesas - Solo si no hay selección */}
                        {!selectedTable && tables.length > 0 && (
                          <Card className="bg-[#111111] border-white/10">
                            <CardContent className="p-2.5">
                              <p className="text-[10px] font-semibold text-white/70 mb-2">Mesas disponibles</p>
                              <div className="grid grid-cols-3 gap-1.5">
                                {tables.map((t) => {
                                  const reserved = !!t.is_reserved;
                                  return (
                                    <button
                                      key={t.id}
                                      type="button"
                                      onClick={() => {
                                        if (!reserved) {
                                          setSelectedTable(t.id);
                                          const firstPack = t.products?.find((p: any) => p.is_active !== false);
                                          if (firstPack) setSelectedProduct(firstPack.id);
                                        }
                                      }}
                                      disabled={reserved}
                                      className={`rounded-md border px-2.5 py-2 text-[11px] font-semibold transition ${
                                        reserved
                                          ? "border-white/10 bg-white/5 text-white/40 cursor-not-allowed"
                                          : "border-white/20 bg-white/5 text-white hover:border-[#e91e63] hover:bg-[#e91e63]/10 hover:text-white"
                                      }`}
                                    >
                                      <div>{t.name}</div>
                                      {!reserved && (
                                        <div className="text-[9px] text-white/50 mt-0.5">{formatCurrency(getDisplayPriceForTable(t))}</div>
                                      )}
                                    </button>
                                  );
                                })}
                              </div>
                            </CardContent>
                          </Card>
                        )}

                        {/* Packs - Solo cuando hay mesa seleccionada */}
                        {selectedTable && (
                          <Card className="bg-[#111111] border-[#e91e63]/30 border-2">
                            <CardHeader className="p-2.5 pb-0 border-none">
                              <CardTitle className="flex items-center justify-between text-sm">
                                <div className="flex items-center gap-2">
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-[#e91e63]">
                                    <circle cx="9" cy="21" r="1" />
                                    <circle cx="20" cy="21" r="1" />
                                    <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
                                  </svg>
                                  Pack incluido
                                </div>
                                <span className="text-[9px] font-normal text-white/50">Obligatorio</span>
                              </CardTitle>
                            </CardHeader>
                            <CardContent className="p-2.5">
                              {products.length > 0 ? (
                                <div className="space-y-1.5">
                                  {products.map((p: any) => {
                                    const active = p.id === selectedProduct;
                                    return (
                                      <button
                                        key={p.id}
                                        type="button"
                                        onClick={() => setSelectedProduct(p.id)}
                                        className={`w-full text-left rounded-md border p-2.5 transition ${
                                          active
                                            ? "border-[#e91e63] bg-[#e91e63]/10 shadow-md ring-1 ring-[#e91e63]/20"
                                            : "border-white/10 bg-black/30 hover:border-white/20 hover:bg-black/40"
                                        }`}
                                      >
                                        <div className="flex items-start justify-between gap-2 mb-1">
                                          <div className="flex items-center gap-1.5 flex-1">
                                            {active && (
                                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="text-[#e91e63] shrink-0">
                                                <polyline points="20 6 9 17 4 12" />
                                              </svg>
                                            )}
                                            <p className="text-xs font-semibold text-white">{p.name}</p>
                                          </div>
                                          <p className="text-xs font-bold text-white whitespace-nowrap">{p.price != null ? formatCurrency(p.price) : "Incluido"}</p>
                                        </div>
                                        {Array.isArray(p.items) && p.items.length > 0 && (
                                          <ul className="space-y-0.5 text-[10px] text-white/70">
                                            {p.items.slice(0, 3).map((it: string, idx: number) => (
                                              <li key={idx} className="flex items-start gap-1.5">
                                                <span className="mt-1 h-1 w-1 rounded-full bg-white/50 shrink-0" />
                                                <span className="line-clamp-1">{it}</span>
                                              </li>
                                            ))}
                                            {p.items.length > 3 && (
                                              <li className="text-[9px] text-white/50 ml-2.5">+{p.items.length - 3} más incluidos</li>
                                            )}
                                          </ul>
                                        )}
                                      </button>
                                    );
                                  })}
                                </div>
                              ) : (
                                <div className="py-3 text-center">
                                  <p className="text-[10px] text-white/50">No hay packs disponibles</p>
                                </div>
                              )}
                            </CardContent>
                          </Card>
                        )}

                        {/* Botón continuar */}
                        {selectedTable && selectedProduct && (
                          <button
                            type="button"
                            onClick={() => setActiveTab("datos")}
                            className="w-full rounded-lg px-4 py-2.5 text-xs font-bold uppercase tracking-wide btn-attention-red transition flex items-center justify-center gap-2"
                          >
                            Continuar con Datos
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </ScrollArea>
                  </TabsContent>

                  <TabsContent value="datos" className="mt-0 border-x border-b border-white/10 rounded-b-xl bg-[#0a0a0a]">
                    <ScrollArea maxHeight="calc(100vh - 280px)" className="p-3">
                      <div className="space-y-2.5">
                        {/* Resumen ultra compacto */}
                        <Card className="bg-gradient-to-br from-[#e91e63]/10 to-transparent border-[#e91e63]/30">
                          <CardContent className="p-2.5">
                            <div className="flex items-center justify-between">
                              <div className="flex-1">
                                <p className="text-[9px] font-semibold uppercase tracking-wider text-white/50 mb-1">Tu reserva</p>
                                <div className="flex items-center gap-2 text-[10px]">
                                  <span className="text-white/70">{tableInfo?.name}</span>
                                  <span className="text-white/40">•</span>
                                  <span className="text-white/70 line-clamp-1 max-w-[120px]">
                                    {products.find((p: any) => p.id === selectedProduct)?.name || "-"}
                                  </span>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="text-[9px] text-white/50 mb-0.5">Total</p>
                                <p className="text-base font-bold text-[#e91e63]">{totalLabel || "—"}</p>
                              </div>
                            </div>
                          </CardContent>
                        </Card>

                        {/* Formulario ultra compacto */}
                        <Card className="bg-[#111111] border-white/10">
                          <CardContent className="p-2.5 space-y-2">
                            {/* Documento distribuido balanceadamente */}
                            <div>
                              <label className="text-sm font-semibold text-white mb-2 block">Documento</label>
                              <div className="grid grid-cols-[100px_1fr] gap-2">
                                <select
                                  value={reservation.doc_type as DocumentType}
                                  onChange={(e) =>
                                    setReservation((p) => ({
                                      ...p,
                                      doc_type: e.target.value as DocumentType,
                                      document: "",
                                    }))
                                  }
                                  className="w-full rounded-xl border border-white/10 bg-[#111111] px-4 py-3 text-base text-white focus:border-white focus:outline-none transition"
                                >
                                  {DOCUMENT_TYPES.map((opt) => (
                                    <option key={opt.value} value={opt.value}>
                                      {opt.label}
                                    </option>
                                  ))}
                                </select>
                                <div className="relative flex items-center">
                                  <input
                                    type="text"
                                    value={reservation.document || ""}
                                    onChange={(e) => {
                                      let val = e.target.value;
                                      const digitOnly = reservation.doc_type === "dni" || reservation.doc_type === "ruc";
                                      if (digitOnly) val = val.replace(/\D/g, "");
                                      const maxLen = reservation.doc_type === "dni" ? 8 : reservation.doc_type === "ruc" ? 11 : 12;
                                      if (val.length <= maxLen) {
                                        setReservation((p) => ({ ...p, document: val }));
                                      }
                                    }}
                                    inputMode={reservation.doc_type === "dni" || reservation.doc_type === "ruc" ? "numeric" : "text"}
                                    maxLength={reservation.doc_type === "dni" ? 8 : reservation.doc_type === "ruc" ? 11 : 12}
                                    required
                                    placeholder={reservation.doc_type === "dni" ? "00000000" : "Número"}
                                    className="w-full rounded-xl border border-white/10 bg-[#111111] px-4 py-3 pr-24 text-base text-white placeholder:text-white/40 focus:border-white focus:outline-none transition"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (validateDocument(reservation.doc_type as DocumentType, reservation.document)) {
                                        loadPersonData(reservation.document, { force: true, docType: reservation.doc_type as DocumentType });
                                      }
                                    }}
                                    disabled={personLoading}
                                    className="absolute right-1 h-[42px] rounded-xl bg-white/5 hover:bg-white/10 px-3 text-xs font-semibold text-white/70 hover:text-white transition flex items-center gap-1.5 disabled:opacity-50"
                                  >
                                    {personLoading ? (
                                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                                    ) : (
                                      <>
                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                          <circle cx="11" cy="11" r="8" />
                                          <path d="m21 21-4.35-4.35" strokeLinecap="round" />
                                        </svg>
                                        Buscar
                                      </>
                                    )}
                                  </button>
                                </div>
                              </div>
                              {reservationDocError && (
                                <p className="text-xs font-semibold text-[#ff9a9a] mt-2">{reservationDocError}</p>
                              )}
                            </div>

                            {/* Nombre completo en 2 columnas */}
                            <div className="grid grid-cols-2 gap-1.5">
                              <Field
                                label="Nombres"
                                value={reservation.nombre}
                                onChange={(v) => setReservation((p) => ({ ...p, nombre: v }))}
                                required
                              />
                              <Field
                                label="Apellidos"
                                value={[reservation.apellido_paterno, reservation.apellido_materno].filter(Boolean).join(" ")}
                                onChange={(v) => {
                                  const parts = v.trim().split(/\s+/);
                                  setReservation((p) => ({
                                    ...p,
                                    apellido_paterno: parts[0] || "",
                                    apellido_materno: parts.slice(1).join(" ") || "",
                                  }));
                                }}
                                placeholder="Paterno y materno"
                                required
                              />
                            </div>

                            {/* Contacto en 2 columnas */}
                            <div className="grid grid-cols-2 gap-1.5">
                              <Field
                                label="Email"
                                type="email"
                                value={reservation.email}
                                onChange={(v) => setReservation((p) => ({ ...p, email: v }))}
                                placeholder="correo@ejemplo.com"
                              />
                              <Field
                                label="Teléfono"
                                value={reservation.phone}
                                onChange={(v) => setReservation((p) => ({ ...p, phone: v }))}
                                placeholder="999 999 999"
                              />
                            </div>

                            {/* Mensajes de estado */}
                            {reservationError && <p className="text-[10px] font-semibold text-[#ff9a9a]">{reservationError}</p>}
                            {reservationCodes && reservationCodes.length > 0 && (
                              <div className="rounded-md border border-white/15 bg-white/5 p-2 text-[10px] text-white">
                                <p className="font-semibold">Reserva registrada</p>
                                <p className="text-white/70">Te enviaremos confirmación por correo</p>
                              </div>
                            )}

                            {/* Botones en 2 columnas */}
                            <div className="grid grid-cols-2 gap-1.5 pt-1">
                              <button
                                type="button"
                                onClick={() => setActiveTab("seleccion")}
                                className="rounded-md px-3 py-2 text-[11px] font-semibold uppercase tracking-wide btn-smoke-outline transition"
                              >
                                ← Atrás
                              </button>
                              <button
                                type="submit"
                                disabled={reservationLoading}
                                className="rounded-md px-3 py-2 text-[11px] font-semibold uppercase tracking-wide btn-attention-red transition disabled:opacity-70"
                              >
                                {reservationLoading ? "Enviando..." : "Continuar"}
                              </button>
                            </div>
                          </CardContent>
                        </Card>
                      </div>
                    </ScrollArea>
                  </TabsContent>
                </Tabs>
              </div>
            </form>
          </div>
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
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  e.currentTarget.classList.add('border-[#e91e63]', 'bg-[#e91e63]/5');
                }}
                onDragLeave={(e) => {
                  e.currentTarget.classList.remove('border-[#e91e63]', 'bg-[#e91e63]/5');
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.currentTarget.classList.remove('border-[#e91e63]', 'bg-[#e91e63]/5');
                  const file = e.dataTransfer.files[0];
                  if (file && file.type.startsWith('image/')) {
                    const fakeEvent = { target: { files: [file] } } as any;
                    onVoucherChange(fakeEvent);
                  }
                }}
                className="relative flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-white/20 bg-white/5 px-6 py-8 transition-all hover:border-white/40 hover:bg-white/10"
              >
                {uploadingVoucher ? (
                  <div className="flex flex-col items-center gap-2">
                    <div className="h-8 w-8 animate-spin rounded-full border-4 border-white/20 border-t-[#e91e63]" />
                    <p className="text-sm text-white/80">Subiendo comprobante...</p>
                  </div>
                ) : reservation.voucher_url ? (
                  <div className="flex flex-col items-center gap-3">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-green-400">
                      <path d="M9 11l3 3L22 4" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
                    </svg>
                    <div className="text-center">
                      <p className="text-sm font-semibold text-white">Comprobante subido</p>
                      <a
                        href={reservation.voucher_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-[#e91e63] underline-offset-2 hover:underline"
                      >
                        Ver archivo
                      </a>
                    </div>
                  </div>
                ) : (
                  <>
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-white/40">
                      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" strokeLinecap="round" strokeLinejoin="round" />
                      <polyline points="17 8 12 3 7 8" strokeLinecap="round" strokeLinejoin="round" />
                      <line x1="12" y1="3" x2="12" y2="15" strokeLinecap="round" />
                    </svg>
                    <div className="text-center">
                      <p className="text-sm font-semibold text-white">Arrastra tu comprobante aquí</p>
                      <p className="text-xs text-white/60">o haz click para seleccionar</p>
                    </div>
                  </>
                )}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={onVoucherChange}
                  disabled={uploadingVoucher || reservationLoading}
                  className="absolute inset-0 cursor-pointer opacity-0"
                />
              </div>
              <p className="text-xs text-white/60 text-center">
                Formatos: JPG, PNG, WEBP • Máximo 5MB
              </p>
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

    // Validar tipo y tamaño
    const validTypes = ['image/png', 'image/jpeg', 'image/webp', 'image/jpg'];
    const maxSize = 5 * 1024 * 1024; // 5MB

    if (!validTypes.includes(file.type)) {
      const msg = "Solo se permiten imágenes JPG, PNG o WEBP";
      setModalError(msg);
      setReservationError(msg);
      return;
    }

    if (file.size > maxSize) {
      const msg = "La imagen no debe superar 5MB";
      setModalError(msg);
      setReservationError(msg);
      return;
    }

    setUploadingVoucher(true);
    setReservationError(null);
    setModalError(null);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("tableName", tableInfo?.name || selectedTable || "mesa");
    try {
      const res = await fetch("/api/uploads/voucher", { method: "POST", body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        const msg = data?.error || "No se pudo subir el comprobante";
        setReservationError(msg);
        setModalError(msg);
      } else {
        setReservation((prev) => ({ ...prev, voucher_url: data.url }));
      }
    } catch (err: any) {
      const msg = err?.message || "Error al subir comprobante";
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
          promoter_id: reservation.promoter_id || form.promoter_id || null,
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
    // Incluir codeEventId en la cache key para re-ejecutar cuando cambie
    const cacheKey = `${docType}:${dni}:${codeEventId || 'no-event'}`;
    if (!opts.force && lastPersonLookup.current === cacheKey) return;
    lastPersonLookup.current = cacheKey;
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
      const apellidosCompletos = [apPat, apMat].filter(Boolean).join(" ");
      const promoterFromTicket = (p as any)?.ticket_promoter_id || "";
      const ticketFromPerson = (p as any)?.ticket_id || null;
      const ticketEventIdFromPerson = (p as any)?.ticket_event_id || null;
      setForm((prev) => ({
        ...prev,
        doc_type: prev.doc_type || docType,
        document: prev.document || dni,
        nombre: prev.nombre || p.first_name || "",
        apellidos: prev.apellidos || apellidosCompletos,
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
      // Solo aceptar el ticket si es del mismo evento que el código actual
      // Esto evita mostrar "Ver mi QR" con tickets de eventos anteriores
      const isTicketFromCurrentEvent = !codeEventId || ticketEventIdFromPerson === codeEventId;
      
      if (ticketFromPerson && isTicketFromCurrentEvent) {
        setExistingTicketId(ticketFromPerson);
        setTicketId(ticketFromPerson);
        setExistingTicketEventId(ticketEventIdFromPerson); // Trackear event_id del ticket
      } else if (ticketFromPerson && !isTicketFromCurrentEvent) {
        // Limpiar ticket antiguo si es de otro evento
        setExistingTicketId(null);
        setTicketId(null);
        setExistingTicketEventId(null);
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
    
    // Validar que el ticket existente sea del evento actual antes de redirigir
    if (ticketId) {
      // Si tenemos info del evento del ticket y del código, validar que coincidan
      if (codeEventId && existingTicketEventId && existingTicketEventId !== codeEventId) {
        // Ticket es de otro evento, limpiar y continuar con creación/validación
        setTicketId(null);
        setExistingTicketId(null);
        setExistingTicketEventId(null);
        // No return, continuar con el flujo normal
      } else {
        // Ticket válido para este evento, redirigir
        router.push(`/ticket/${ticketId}`);
        return;
      }
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
      // Trackear el event_id del ticket creado
      if (data.eventId || codeEventId) {
        setExistingTicketEventId(data.eventId || codeEventId);
      }
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
  actionButton?: {
    icon: React.ReactNode;
    onClick: () => void;
    label: string;
    loading?: boolean;
  };
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
  actionButton,
  digitOnly = false,
  maxLength,
}: FieldProps & { digitOnly?: boolean; maxLength?: number }) {
  const showClear = allowClear && value.length > 0;
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && actionButton && !actionButton.loading) {
      e.preventDefault();
      actionButton.onClick();
    }
  };
  return (
    <label className={`block space-y-2 text-sm font-semibold text-white ${className}`}>
      {label}
      <div className="relative flex gap-2">
        <div className="relative flex-1">
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
            onKeyDown={handleKeyDown}
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
        {actionButton && (
          <button
            type="button"
            onClick={actionButton.onClick}
            disabled={actionButton.loading}
            className="flex h-[50px] w-[50px] items-center justify-center rounded-xl border border-white/20 bg-[#1a1a1a] text-white transition hover:border-white hover:bg-[#252525] disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label={actionButton.label}
            title={actionButton.label}
          >
            {actionButton.loading ? (
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/20 border-t-white"></div>
            ) : (
              actionButton.icon
            )}
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
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-white/10 border-t-[#e91e63]"></div>
        <div className="text-sm text-[#e91e63] font-semibold">Cargando...</div>
      </div>
    </main>
  );
}
