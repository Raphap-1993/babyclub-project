/* Compra de mesas/tickets con upload de voucher */
"use client";

import { useEffect, useState } from "react";
import MiniTableMap from "./MiniTableMap";
import { DOCUMENT_TYPES, validateDocument, type DocumentType } from "shared/document";

type TableRow = {
  id: string;
  event_id?: string | null;
  name: string;
  ticket_count?: number | null;
  min_consumption?: number | null;
  price?: number | null;
  notes?: string | null;
  products?: Array<{
    id: string;
    name: string;
    price?: number | null;
    tickets_included?: number | null;
    description?: string | null;
    items?: string[] | null;
    is_active?: boolean | null;
    sort_order?: number | null;
  }>;
  pos_x?: number | null;
  pos_y?: number | null;
  pos_w?: number | null;
  pos_h?: number | null;
  is_reserved?: boolean | null;
};

type EventOption = {
  id: string;
  name?: string | null;
  starts_at?: string | null;
  location?: string | null;
  is_active?: boolean | null;
};

type TicketSalePhase = "early_bird" | "all_night";

export default function CompraPage() {
  const [tables, setTables] = useState<TableRow[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [form, setForm] = useState({
    doc_type: "dni",
    document: "",
    nombre: "",
    apellido_paterno: "",
    apellido_materno: "",
    email: "",
    phone: "",
    voucher_url: "",
  });
  const [ticketForm, setTicketForm] = useState({
    doc_type: "dni",
    document: "",
    nombre: "",
    apellido_paterno: "",
    apellido_materno: "",
    email: "",
    phone: "",
  });
  const [selectedProduct, setSelectedProduct] = useState<string>("");
  const [mode, setMode] = useState<"mesa" | "ticket">("mesa");
  const [uploading, setUploading] = useState(false);
  const [ticketUploading, setTicketUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [ticketLoading, setTicketLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ticketError, setTicketError] = useState<string | null>(null);
  const [successCodes, setSuccessCodes] = useState<string[] | null>(null);
  const [ticketReservationId, setTicketReservationId] = useState<string | null>(null);
  const [layoutUrl, setLayoutUrl] = useState<string | null>(null);
  const [showSummary, setShowSummary] = useState(false);
  const [showTicketSummary, setShowTicketSummary] = useState(false);
  const [showTicketConfirmation, setShowTicketConfirmation] = useState(false);
  const [showReservationConfirmation, setShowReservationConfirmation] = useState(false);
  const [mesaReservationId, setMesaReservationId] = useState<string | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);
  const [ticketModalError, setTicketModalError] = useState<string | null>(null);
  const [copyFeedback, setCopyFeedback] = useState<"idle" | "copied" | "error">("idle");
  const [ticketCopyFeedback, setTicketCopyFeedback] = useState<"idle" | "copied" | "error">("idle");
  const [reservationSubmitted, setReservationSubmitted] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState<string>("");
  const [ticketEventId, setTicketEventId] = useState<string>("");
  const [eventOptions, setEventOptions] = useState<EventOption[]>([]);
  const [ticketVoucherUrl, setTicketVoucherUrl] = useState<string>("");
  const [ticketQuantity, setTicketQuantity] = useState<1 | 2>(1);
  const [isDragging, setIsDragging] = useState(false);
  const [ticketIsDragging, setTicketIsDragging] = useState(false);
  const defaultCode = process.env.NEXT_PUBLIC_DEFAULT_CODE || "public";
  const dniErrorTicket =
    ticketForm.document && !validateDocument(ticketForm.doc_type as DocumentType, ticketForm.document) ? "Documento inválido" : "";
  const dniErrorMesa =
    form.document && !validateDocument(form.doc_type as DocumentType, form.document) ? "Documento inválido" : "";
  const yapeNumber = "950 144 641";
  const yapeHolder = "Kevin Andree Huansi Ruiz";

  const formatPrice = (value?: number | null) => {
    if (value == null) return null;
    return `S/ ${value.toLocaleString("es-PE")}`;
  };

  const splitLastName = (lastName: string) => {
    const parts = lastName.trim().split(/\s+/).filter(Boolean);
    return {
      apellidoPaterno: parts[0] || "",
      apellidoMaterno: parts.slice(1).join(" "),
    };
  };

  const buildFullName = (nombre: string, apellidoPaterno: string, apellidoMaterno: string) =>
    [nombre, apellidoPaterno, apellidoMaterno].map((part) => part.trim()).filter(Boolean).join(" ");

  const resetTicketForm = () => {
    setTicketForm({
      doc_type: "dni",
      document: "",
      nombre: "",
      apellido_paterno: "",
      apellido_materno: "",
      email: "",
      phone: "",
    });
    setTicketError(null);
    setTicketReservationId(null);
  };

  const resetMesaForm = () => {
    setForm({
      doc_type: "dni",
      document: "",
      nombre: "",
      apellido_paterno: "",
      apellido_materno: "",
      email: "",
      phone: "",
      voucher_url: "",
    });
    setError(null);
    setSuccessCodes(null);
    setMesaReservationId(null);
  };

  const clearTicketInputs = () => {
    resetTicketForm();
    setTicketVoucherUrl("");
    setTicketModalError(null);
    setTicketUploading(false);
    setTicketQuantity(1);
  };

  const clearMesaInputs = () => {
    resetMesaForm();
    setReservationSubmitted(false);
    setModalError(null);
    setUploading(false);
  };

  const organizerId = process.env.NEXT_PUBLIC_ORGANIZER_ID;

  // Cargar mesas filtradas por organizador solamente (NO por evento)
  // Las mesas pueden no tener event_id asignado y estar disponibles para todos los eventos del organizador
  useEffect(() => {
    if (!organizerId) {
      setTables([]);
      return;
    }
    
    fetch(`/api/tables?organizer_id=${organizerId}`, { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        const tables = data?.tables || [];
        setTables(tables);
        
        // Seleccionar primera mesa disponible
        const firstAvailable = tables.find((t: any) => !t.is_reserved) || tables[0];
        if (firstAvailable) {
          setSelected(firstAvailable.id);
          const firstProduct = firstAvailable.products?.find((p: any) => p.is_active !== false);
          setSelectedProduct(firstProduct?.id || "");
        }
      })
      .catch(() => setTables([]));
  }, [organizerId]);

  // Cargar layout del organizador (NO depende del evento, es del organizador)
  useEffect(() => {
    if (!organizerId) return;
    
    fetch(`/api/layout?organizer_id=${organizerId}`)
      .then((res) => res.json())
      .then((data) => setLayoutUrl(data?.layout_url || null))
      .catch(() => setLayoutUrl(null));
  }, [organizerId]);

  useEffect(() => {
    fetch("/api/events", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        const events = Array.isArray(data?.events) ? data.events : [];
        setEventOptions(events);
        if (events.length > 0) {
          setTicketEventId((prev) => prev || events[0]?.id || "");
        }
      })
      .catch(() => setEventOptions([]));
  }, []);

  useEffect(() => {
    if (validateDocument(ticketForm.doc_type as DocumentType, ticketForm.document)) {
      lookupPerson(ticketForm.document, "ticket", ticketForm.doc_type as DocumentType);
    }
  }, [ticketForm.doc_type, ticketForm.document]);

  useEffect(() => {
    if (validateDocument(form.doc_type as DocumentType, form.document)) {
      lookupPerson(form.document, "mesa", form.doc_type as DocumentType);
    }
  }, [form.doc_type, form.document]);

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await handleFileUpload(file);
  };

  const handleFileUpload = async (file: File) => {
    // Validar tipo y tamaño
    const validTypes = ['image/png', 'image/jpeg', 'image/webp', 'image/jpg'];
    const maxSize = 5 * 1024 * 1024; // 5MB

    if (!validTypes.includes(file.type)) {
      setModalError("Solo se permiten imágenes JPG, PNG o WEBP");
      return;
    }

    if (file.size > maxSize) {
      setModalError("La imagen no debe superar 5MB");
      return;
    }

    setUploading(true);
    setError(null);
    setModalError(null);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("tableName", selected || "mesa");
    try {
      const res = await fetch("/api/uploads/voucher", { method: "POST", body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        setModalError(data?.error || "No se pudo subir el voucher");
      } else {
        setForm((prev) => ({ ...prev, voucher_url: data.url }));
      }
    } catch (err: any) {
      setModalError(err?.message || "Error al subir voucher");
    } finally {
      setUploading(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const file = e.dataTransfer.files?.[0];
    if (file) {
      await handleFileUpload(file);
    }
  };

  const handleTicketFileUpload = async (file: File) => {
    // Validar tipo y tamaño
    const validTypes = ['image/png', 'image/jpeg', 'image/webp', 'image/jpg'];
    const maxSize = 5 * 1024 * 1024; // 5MB

    if (!validTypes.includes(file.type)) {
      setTicketModalError("Solo se permiten imágenes JPG, PNG o WEBP");
      return;
    }

    if (file.size > maxSize) {
      setTicketModalError("La imagen no debe superar 5MB");
      return;
    }

    setTicketUploading(true);
    setTicketModalError(null);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("tableName", "ticket");
    try {
      const res = await fetch("/api/uploads/voucher", { method: "POST", body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        setTicketModalError(data?.error || "No se pudo subir el voucher");
      } else {
        setTicketVoucherUrl(data.url);
      }
    } catch (err: any) {
      setTicketModalError(err?.message || "Error al subir voucher");
    } finally {
      setTicketUploading(false);
    }
  };

  const handleTicketDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setTicketIsDragging(true);
  };

  const handleTicketDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setTicketIsDragging(false);
  };

  const handleTicketDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setTicketIsDragging(false);

    const file = e.dataTransfer.files?.[0];
    if (file) {
      await handleTicketFileUpload(file);
    }
  };

  const lookupPerson = async (document: string, target: "ticket" | "mesa", docType: DocumentType = "dni") => {
    try {
      // /api/persons ya hace el lookup en BD primero y solo consulta RENIEC si no existe
      // Esto evita consumir el token de API Perú innecesariamente
      const res = await fetch(`/api/persons?document=${encodeURIComponent(document)}&doc_type=${docType}`);
      const data = await res.json().catch(() => ({}));
      const person = res.ok ? data?.person : null;

      if (!person) return;

      const { apellidoPaterno, apellidoMaterno } = splitLastName(person.last_name || "");
      const nombre = person.first_name || "";
      if (target === "ticket") {
        setTicketForm((prev) => ({
          ...prev,
          nombre: prev.nombre || nombre,
          apellido_paterno: prev.apellido_paterno || apellidoPaterno,
          apellido_materno: prev.apellido_materno || apellidoMaterno,
          email: prev.email || person.email || "",
          phone: prev.phone || person.phone || "",
        }));
      } else {
        setForm((prev) => ({
          ...prev,
          doc_type: prev.doc_type || docType,
          document: prev.document || document,
          nombre: prev.nombre || nombre,
          apellido_paterno: prev.apellido_paterno || apellidoPaterno,
          apellido_materno: prev.apellido_materno || apellidoMaterno,
          email: prev.email || person.email || "",
          phone: prev.phone || person.phone || "",
        }));
      }
    } catch (_err) {
      // ignore
    }
  };

  const ticketPricingPhaseEnv = (process.env.NEXT_PUBLIC_TICKET_SALE_PHASE || "early_bird").toLowerCase();
  const ticketSalePhase: TicketSalePhase = ticketPricingPhaseEnv === "all_night" ? "all_night" : "early_bird";
  const earlyBirdEndsLabel = process.env.NEXT_PUBLIC_EARLY_BIRD_ENDS_LABEL || "13 feb, 11:59 p. m.";
  const isEarlyBirdActive = ticketSalePhase === "early_bird";
  const earlyBirdPriceSingle = 15;
  const earlyBirdPriceDouble = 25;
  const allNightPriceSingle = 20;
  const allNightPriceDouble = 35;

  // header text tweak
  const headerSubtitle = "Genera tu entrada o reserva tu mesa con voucher (Yape/Plin) y obtén los QR.";
  const ticketPrice = isEarlyBirdActive
    ? ticketQuantity === 1
      ? earlyBirdPriceSingle
      : earlyBirdPriceDouble
    : ticketQuantity === 1
      ? allNightPriceSingle
      : allNightPriceDouble;
  const ticketSaleLabel = isEarlyBirdActive ? "EARLY BABY" : "ALL NIGHT";
  const ticketFullName = buildFullName(ticketForm.nombre, ticketForm.apellido_paterno, ticketForm.apellido_materno);
  const mesaFullName = buildFullName(form.nombre, form.apellido_paterno, form.apellido_materno);
  const ticketNameComplete = Boolean(
    ticketForm.nombre.trim() && ticketForm.apellido_paterno.trim() && ticketForm.apellido_materno.trim()
  );
  const mesaNameComplete = Boolean(form.nombre.trim() && form.apellido_paterno.trim() && form.apellido_materno.trim());

  // sincronia de datos entre solo entrada y reserva
  useEffect(() => {
    if (mode === "mesa") {
      setForm((prev) => ({
        ...prev,
        doc_type: prev.doc_type || ticketForm.doc_type,
        document: prev.document || ticketForm.document,
        nombre: prev.nombre || ticketForm.nombre,
        apellido_paterno: prev.apellido_paterno || ticketForm.apellido_paterno,
        apellido_materno: prev.apellido_materno || ticketForm.apellido_materno,
        email: prev.email || ticketForm.email,
        phone: prev.phone || ticketForm.phone,
      }));
    } else if (mode === "ticket") {
      setTicketForm((prev) => ({
        ...prev,
        doc_type: prev.doc_type || form.doc_type,
        document: prev.document || form.document,
        nombre: prev.nombre || form.nombre,
        apellido_paterno: prev.apellido_paterno || form.apellido_paterno,
        apellido_materno: prev.apellido_materno || form.apellido_materno,
        email: prev.email || form.email,
        phone: prev.phone || form.phone,
      }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  const handleOpenSummary = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setModalError(null);
    setSuccessCodes(null);
    setCopyFeedback("idle");
    setReservationSubmitted(false);

    if (mesaEventOptions.length > 0 && !selectedEventId) {
      setError("Selecciona el evento para esta reserva");
      return;
    }
    if (!selected || !validateDocument(form.doc_type as DocumentType, form.document) || !mesaNameComplete) {
      setError("Selecciona una mesa e ingresa documento, nombres y apellidos");
      return;
    }
    if (!selectedProduct) {
      setError("Selecciona un pack de consumo");
      return;
    }
    setShowSummary(true);
  };

  const confirmReservation = async () => {
    setModalError(null);
    setError(null);
    setReservationSubmitted(false);

    if (!form.voucher_url) {
      setModalError("Sube tu comprobante de pago para continuar.");
      return;
    }
    if (!selected || !validateDocument(form.doc_type as DocumentType, form.document) || !mesaNameComplete) {
      setModalError("Revisa los datos obligatorios: mesa, documento, nombres y apellidos.");
      return;
    }

    setLoading(true);
    const tableInfo = tables.find((t) => t.id === selected);
    try {
      const res = await fetch("/api/reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          table_id: selected,
          doc_type: form.doc_type,
          document: form.document,
          full_name: mesaFullName,
          email: form.email,
          phone: form.phone,
          product_id: selectedProduct || null,
          event_id: selectedEventId || tableInfo?.event_id || null,
          code: defaultCode,
          voucher_url: form.voucher_url,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        setModalError(data?.error || "No se pudo registrar la reserva");
      } else {
        setSuccessCodes(data.codes || []);
        setReservationSubmitted(true);
        setMesaReservationId(data.reservationId || null);
        setShowSummary(false);
        setShowReservationConfirmation(true);
      }
    } catch (err: any) {
      setModalError(err?.message || "Error al registrar reserva");
    } finally {
      setLoading(false);
    }
  };

  const copyYapeNumber = () => {
    try {
      const text = yapeNumber.replace(/\s/g, "");
      if (navigator?.clipboard?.writeText) {
        navigator.clipboard.writeText(text);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = text;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }
      setCopyFeedback("copied");
      setTimeout(() => setCopyFeedback("idle"), 1800);
    } catch (_err) {
      setCopyFeedback("error");
    }
  };

  const copyYapeNumberTicket = () => {
    try {
      const text = yapeNumber.replace(/\s/g, "");
      if (navigator?.clipboard?.writeText) {
        navigator.clipboard.writeText(text);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = text;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }
      setTicketCopyFeedback("copied");
      setTimeout(() => setTicketCopyFeedback("idle"), 1800);
    } catch (_err) {
      setTicketCopyFeedback("error");
    }
  };

  const onSubmitTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    handleOpenTicketSummary(e);
  };

  const handleOpenTicketSummary = (e: React.FormEvent) => {
    e.preventDefault();
    setTicketError(null);
    setTicketModalError(null);
    setTicketReservationId(null);
    if (ticketRequiresEvent && !ticketEventId) {
      setTicketError("Selecciona el evento");
      return;
    }
    if (!validateDocument(ticketForm.doc_type as DocumentType, ticketForm.document) || !ticketNameComplete) {
      setTicketError("Ingresa documento, nombres y apellidos");
      return;
    }
    setShowTicketSummary(true);
  };

  const confirmTicketPurchase = async () => {
    setTicketModalError(null);
    setTicketError(null);
    if (ticketRequiresEvent && !ticketEventId) {
      setTicketModalError("Selecciona el evento");
      return;
    }
    if (!validateDocument(ticketForm.doc_type as DocumentType, ticketForm.document) || !ticketNameComplete) {
      setTicketModalError("Ingresa documento, nombres y apellidos");
      return;
    }
    if (!ticketVoucherUrl) {
      setTicketModalError("Sube tu comprobante de pago para continuar.");
      return;
    }
    setTicketLoading(true);
    try {
      const payload = {
        event_id: ticketEventId,
        doc_type: ticketForm.doc_type,
        document: ticketForm.document,
        nombre: ticketForm.nombre,
        apellido_paterno: ticketForm.apellido_paterno,
        apellido_materno: ticketForm.apellido_materno,
        email: ticketForm.email,
        telefono: ticketForm.phone,
        voucher_url: ticketVoucherUrl,
        ticket_quantity: ticketQuantity,
        pricing_phase: ticketSalePhase,
      };
      const res = await fetch("/api/ticket-reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        setTicketModalError(data?.error || "No se pudo registrar la reserva");
      } else {
        setTicketReservationId(data.reservationId || null);
        setShowTicketSummary(false);
        setShowTicketConfirmation(true);
      }
    } catch (err: any) {
      setTicketModalError(err?.message || "Error al registrar reserva");
    } finally {
      setTicketLoading(false);
    }
  };

  const tableInfo = tables.find((t) => t.id === selected);
  const activeProducts =
    (tableInfo?.products?.filter((p) => p.is_active !== false) || []).sort(
      (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)
    );
  const selectedProductInfo = activeProducts.find((p) => p.id === selectedProduct);
  const totalPrice = selectedProductInfo?.price ?? tableInfo?.price ?? tableInfo?.min_consumption ?? null;
  const reservationDone = !!(successCodes && successCodes.length > 0);
  const totalLabel = formatPrice(totalPrice);
  const eventsFromTables: EventOption[] = Array.from(
    new Map(
      tables
        .map((t) => {
          const eventRel = Array.isArray((t as any).event) ? (t as any).event?.[0] : (t as any).event;
          return t.event_id || eventRel?.id
            ? {
                id: t.event_id || eventRel?.id,
                name: eventRel?.name || `Evento ${ (t.event_id || eventRel?.id || "").slice(0, 6)}`,
              }
            : null;
        })
        .filter(Boolean)
        .map((e: any) => [e.id, e])
    ).values()
  );
  const mesaEventOptions = eventsFromTables.length > 0 ? eventsFromTables : eventOptions;
  const ticketEventOptions = eventOptions.length > 0 ? eventOptions : eventsFromTables;
  const ticketSelectedEvent = ticketEventOptions.find((ev) => ev.id === ticketEventId);
  const ticketRequiresEvent = ticketEventOptions.length > 0;
  const firstTicketEventId = ticketEventOptions[0]?.id || "";

  useEffect(() => {
    if (!ticketEventId && firstTicketEventId) {
      setTicketEventId(firstTicketEventId);
    }
  }, [ticketEventId, firstTicketEventId]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-black px-4 py-10 text-white">
      <div className="w-full max-w-5xl space-y-6 rounded-3xl border border-white/10 bg-gradient-to-b from-[#0f0f0f] to-[#050505] p-6 shadow-[0_25px_80px_rgba(0,0,0,0.45)]">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-white/70">BABY</p>
            <h1 className="text-3xl font-semibold">Compra / Reserva</h1>
            <p className="text-sm text-white/60">{headerSubtitle}</p>
          </div>
          <button
            type="button"
            onClick={() => window.history.back()}
            className="rounded-full px-4 py-2 text-sm font-semibold btn-smoke-outline transition"
          >
            ← Volver
          </button>
        </div>


        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setMode("ticket")}
            className={`flex-1 rounded-full px-4 py-2 text-sm font-semibold transition ${
              mode === "ticket" ? "btn-smoke" : "btn-smoke-outline"
            }`}
          >
            Solo entrada
          </button>
          <button
            type="button"
            onClick={() => setMode("mesa")}
            className={`flex-1 rounded-full px-4 py-2 text-sm font-semibold transition ${
              mode === "mesa" ? "btn-smoke" : "btn-smoke-outline"
            }`}
          >
            Reserva mesa
          </button>
        </div>

        {mode === "ticket" && (
          <form onSubmit={onSubmitTicket} className="space-y-4 rounded-2xl border border-white/10 bg-[#0b0b0b] p-4">
            <div className="space-y-3">
              <div
                className={`rounded-xl border px-3 py-2 text-xs ${
                  isEarlyBirdActive
                    ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-200"
                    : "border-[#e91e63]/50 bg-[#e91e63]/10 text-[#ffd3e5]"
                }`}
              >
                {isEarlyBirdActive ? (
                  <span>
                    EARLY BIRD activo. Termina: <strong>{earlyBirdEndsLabel}</strong>.
                  </span>
                ) : (
                  <span>
                    EARLY BIRD finalizado. Ahora está activo <strong>ALL NIGHT</strong>.
                  </span>
                )}
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <label
                  className={`flex flex-wrap items-center gap-2 rounded-2xl border px-4 py-3 text-sm font-semibold ${
                    isEarlyBirdActive
                      ? "border-[#e91e63]/60 bg-[#e91e63]/10 text-white"
                      : "border-white/10 bg-[#0a0a0a] text-white/45"
                  }`}
                >
                  <input
                    type="radio"
                    name="ticketQty"
                    checked={isEarlyBirdActive && ticketQuantity === 1}
                    onChange={() => setTicketQuantity(1)}
                    disabled={!isEarlyBirdActive}
                    className="h-4 w-4 accent-[#e91e63]"
                  />
                  <span>1 QR EARLY BABY - S/ {earlyBirdPriceSingle}</span>
                  <span className={`text-xs font-normal ${isEarlyBirdActive ? "text-white/70" : "text-white/35"}`}>
                    Incluye 1 trago de cortesía
                  </span>
                </label>
                <label
                  className={`flex flex-wrap items-center gap-2 rounded-2xl border px-4 py-3 text-sm font-semibold ${
                    isEarlyBirdActive
                      ? "border-[#e91e63]/60 bg-[#e91e63]/10 text-white"
                      : "border-white/10 bg-[#0a0a0a] text-white/45"
                  }`}
                >
                  <input
                    type="radio"
                    name="ticketQty"
                    checked={isEarlyBirdActive && ticketQuantity === 2}
                    onChange={() => setTicketQuantity(2)}
                    disabled={!isEarlyBirdActive}
                    className="h-4 w-4 accent-[#e91e63]"
                  />
                  <span>2 QR EARLY BABY - S/ {earlyBirdPriceDouble}</span>
                  <span className={`text-xs font-normal ${isEarlyBirdActive ? "text-white/70" : "text-white/35"}`}>
                    Incluye 2 tragos de cortesía
                  </span>
                </label>
                <label
                  className={`flex flex-wrap items-center gap-2 rounded-2xl border px-4 py-3 text-sm font-semibold ${
                    isEarlyBirdActive
                      ? "border-white/10 bg-[#0a0a0a] text-white/45"
                      : "border-[#e91e63]/60 bg-[#e91e63]/10 text-white"
                  }`}
                >
                  <input
                    type="radio"
                    name="ticketQty"
                    checked={!isEarlyBirdActive && ticketQuantity === 1}
                    onChange={() => setTicketQuantity(1)}
                    disabled={isEarlyBirdActive}
                    className="h-4 w-4 accent-[#e91e63]"
                  />
                  <span>1 QR ALL NIGHT - S/ {allNightPriceSingle}</span>
                  <span className={`text-xs font-normal ${isEarlyBirdActive ? "text-white/35" : "text-white/70"}`}>
                    {isEarlyBirdActive ? "Bloqueado hasta fin de Early Bird" : "Incluye 1 trago de cortesía"}
                  </span>
                </label>
                <label
                  className={`flex flex-wrap items-center gap-2 rounded-2xl border px-4 py-3 text-sm font-semibold ${
                    isEarlyBirdActive
                      ? "border-white/10 bg-[#0a0a0a] text-white/45"
                      : "border-[#e91e63]/60 bg-[#e91e63]/10 text-white"
                  }`}
                >
                  <input
                    type="radio"
                    name="ticketQty"
                    checked={!isEarlyBirdActive && ticketQuantity === 2}
                    onChange={() => setTicketQuantity(2)}
                    disabled={isEarlyBirdActive}
                    className="h-4 w-4 accent-[#e91e63]"
                  />
                  <span>2 QR ALL NIGHT - S/ {allNightPriceDouble}</span>
                  <span className={`text-xs font-normal ${isEarlyBirdActive ? "text-white/35" : "text-white/70"}`}>
                    {isEarlyBirdActive ? "Bloqueado hasta fin de Early Bird" : "Incluye 2 tragos de cortesía"}
                  </span>
                </label>
              </div>
            </div>
            {ticketEventOptions.length > 0 && (
              <div className="space-y-2">
                <label className="text-sm font-semibold text-white">Evento</label>
                <select
                  value={ticketEventId}
                  onChange={(e) => setTicketEventId(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-[#111111] px-4 py-3 text-base text-white focus:border-white focus:outline-none"
                >
                  <option value="">Selecciona el evento</option>
                  {ticketEventOptions.map((ev) => (
                    <option key={ev.id} value={ev.id}>
                      {ev.name || `Evento ${ev.id.slice(0, 6)}`}
                    </option>
                  ))}
                </select>
                {!ticketEventId && <p className="text-xs text-[#ff9a9a]">Selecciona el evento para continuar.</p>}
              </div>
            )}
            <div className="grid gap-3 md:grid-cols-[0.55fr,1fr,1.45fr]">
              <label className="block space-y-2 text-sm font-semibold text-white">
                Tipo de documento
                <select
                  value={ticketForm.doc_type as DocumentType}
                  onChange={(e) => setTicketForm((p) => ({ ...p, doc_type: e.target.value as DocumentType, document: "" }))}
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
                value={ticketForm.document}
                onChange={(v) => setTicketForm((p) => ({ ...p, document: v }))}
                inputMode={ticketForm.doc_type === "dni" || ticketForm.doc_type === "ruc" ? "numeric" : "text"}
                digitOnly={ticketForm.doc_type === "dni" || ticketForm.doc_type === "ruc"}
                maxLength={ticketForm.doc_type === "dni" ? 8 : ticketForm.doc_type === "ruc" ? 11 : 12}
                required
                error={dniErrorTicket}
                allowClear
                onClear={resetTicketForm}
              />
              <Field
                label="Nombres"
                value={ticketForm.nombre}
                onChange={(v) => setTicketForm((p) => ({ ...p, nombre: v }))}
                required
              />
            </div>
            <Field
              label="Apellidos"
              value={[ticketForm.apellido_paterno, ticketForm.apellido_materno].filter(Boolean).join(' ')}
              onChange={(v) => {
                const parts = v.trim().split(/\s+/);
                setTicketForm((p) => ({
                  ...p,
                  apellido_paterno: parts[0] || '',
                  apellido_materno: parts.slice(1).join(' ') || '',
                }));
              }}
              placeholder="Apellido paterno y materno"
              required
            />
            <div className="grid gap-3 md:grid-cols-[1.3fr,0.7fr]">
              <Field label="Email" value={ticketForm.email} onChange={(v) => setTicketForm((p) => ({ ...p, email: v }))} type="email" />
              <Field label="Teléfono" value={ticketForm.phone} onChange={(v) => setTicketForm((p) => ({ ...p, phone: v }))} placeholder="+51 999 999 999" />
            </div>
            {ticketError && <p className="text-xs font-semibold text-[#ff9a9a]">{ticketError}</p>}
            {ticketReservationId && (
              <div className="rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm text-white">
                Solicitud enviada. El equipo BABY validará tu pago y recibirás la confirmación en tu bandeja de correo.
              </div>
            )}
            <button
              type="submit"
              disabled={ticketLoading}
              className="w-full rounded-full px-4 py-3 text-center text-sm font-semibold uppercase tracking-wide btn-smoke transition disabled:opacity-70"
            >
              {ticketLoading ? "Procesando..." : "Revisar pago y enviar"}
            </button>
            <button
              type="button"
              onClick={() => {
                setForm((prev) => ({
                  ...prev,
                  doc_type: prev.doc_type || ticketForm.doc_type,
                  document: prev.document || ticketForm.document,
                  nombre: prev.nombre || ticketForm.nombre,
                  apellido_paterno: prev.apellido_paterno || ticketForm.apellido_paterno,
                  apellido_materno: prev.apellido_materno || ticketForm.apellido_materno,
                  email: prev.email || ticketForm.email,
                  phone: prev.phone || ticketForm.phone,
                }));
                setMode("mesa");
              }}
              className="relative w-full overflow-hidden rounded-full px-4 py-3 text-center text-sm font-semibold uppercase tracking-wide btn-attention-red transition"
            >
              Quiero reservar mesa (opcional)
            </button>
          </form>
        )}

        {mode === "mesa" && (
          <form onSubmit={handleOpenSummary} className="space-y-5">
            <div className="grid gap-4 lg:grid-cols-[1.3fr,1fr] lg:items-start">
              <div className="space-y-3 lg:col-start-1 lg:row-start-1">
                <div className="flex flex-wrap gap-2">
                  {tables.map((t) => {
                    const eventRel = Array.isArray((t as any)?.event) ? (t as any)?.event?.[0] : (t as any)?.event;
                    const evId = t.event_id || eventRel?.id || "";
                    const isReserved = !!t.is_reserved;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => {
                          if (isReserved) return;
                          setSelected(t.id);
                          const firstProd = t.products?.find((p) => p.is_active !== false);
                          setSelectedProduct(firstProd?.id || "");
                          if (evId) setSelectedEventId(evId);
                        }}
                        disabled={isReserved}
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${
                          isReserved
                            ? "border border-white/10 bg-white/5 text-white/40 cursor-not-allowed"
                            : selected === t.id
                              ? "border border-[#e91e63] bg-[#e91e63]/10 text-white"
                              : "border border-[#f2f2f2]/40 text-[#f2f2f2]"
                        }`}
                      >
                        {t.name}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-3 rounded-2xl border border-white/10 bg-[#0c0c0c] p-3 text-xs text-white/70 lg:col-start-2 lg:row-start-1 lg:row-span-2">
                <p className="font-semibold text-white">Plano de mesas</p>
                <MiniTableMap
                  tables={tables}
                  selectedId={selected}
                  onSelect={(id) => {
                    setSelected(id);
                    const next = tables.find((t) => t.id === id);
                    const firstProd = next?.products?.find((p) => p.is_active !== false);
                    setSelectedProduct(firstProd?.id || "");
                  }}
                  layoutUrl={layoutUrl}
                />
              </div>

              <div className="space-y-3 lg:col-start-1 lg:row-start-2">
                <div className="rounded-2xl border border-white/10 bg-[#0a0a0a] p-3 text-xs text-white/70">
                  <p className="mb-2 text-sm font-semibold text-white">Packs de consumo</p>
                  {activeProducts.length > 0 ? (
                    <div className="grid gap-2 md:grid-cols-2">
                      {activeProducts.map((p) => (
                        <button
                          type="button"
                          key={p.id}
                          onClick={() => setSelectedProduct(p.id)}
                          className={`rounded-xl border p-2 text-left ${
                            selectedProduct === p.id
                              ? "border-[#e91e63] bg-[#e91e63]/10 text-white"
                              : "border-[#f2f2f2]/30 bg-black/40 text-[#f2f2f2]"
                          }`}
                        >
                          <div className="text-sm font-semibold text-white">{p.name}</div>
                          {p.price != null && <div className="text-[#e91e63] font-semibold text-sm">S/ {p.price}</div>}
                          {p.tickets_included != null && <div>Incluye {p.tickets_included} tickets</div>}
                          {p.items && p.items.length > 0 && (
                            <ul className="mt-1 space-y-1">
                              {p.items.map((item, idx) => (
                                <li key={idx}>• {item}</li>
                              ))}
                            </ul>
                          )}
                          {p.description && <div className="mt-1 text-white/60">{p.description}</div>}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="text-white/60">No hay packs configurados para esta mesa.</p>
                  )}
                </div>

                {mesaEventOptions.length > 0 && (
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-white">Evento</label>
                    <select
                      value={selectedEventId}
                      onChange={(e) => setSelectedEventId(e.target.value)}
                      className="w-full rounded-xl border border-white/10 bg-[#111111] px-3 py-3 text-sm text-white focus:border-white focus:outline-none"
                    >
                      <option value="">Selecciona el evento</option>
                      {mesaEventOptions.map((ev) => (
                        <option key={ev.id} value={ev.id}>
                          {ev.name || `Evento ${ev.id.slice(0, 6)}`}
                        </option>
                      ))}
                    </select>
                    {!selectedEventId && <p className="text-xs text-[#ff9a9a]">Selecciona el evento para continuar.</p>}
                  </div>
                )}

                <div className="grid gap-3 md:grid-cols-[0.5fr,1fr,1.5fr]">
                  <label className="block space-y-2 text-sm font-semibold text-white">
                    Tipo doc
                    <select
                      value={form.doc_type as DocumentType}
                      onChange={(e) => setForm((p) => ({ ...p, doc_type: e.target.value as DocumentType, document: "" }))}
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
                    onChange={(v) => setForm((p) => ({ ...p, document: v }))}
                    inputMode={form.doc_type === "dni" || form.doc_type === "ruc" ? "numeric" : "text"}
                    digitOnly={form.doc_type === "dni" || form.doc_type === "ruc"}
                    maxLength={form.doc_type === "dni" ? 8 : form.doc_type === "ruc" ? 11 : 12}
                    required
                    error={dniErrorMesa}
                    allowClear
                    onClear={resetMesaForm}
                  />
                  <Field label="Nombres" value={form.nombre} onChange={(v) => setForm((p) => ({ ...p, nombre: v }))} required />
                </div>

                <Field
                  label="Apellidos (paterno y materno)"
                  value={[form.apellido_paterno, form.apellido_materno].filter(Boolean).join(' ')}
                  onChange={(v) => {
                    const parts = v.trim().split(/\s+/);
                    setForm((p) => ({
                      ...p,
                      apellido_paterno: parts[0] || '',
                      apellido_materno: parts.slice(1).join(' ') || '',
                    }));
                  }}
                  placeholder="Ej: García López"
                  required
                />

                <div className="grid gap-3 md:grid-cols-2">
                  <Field label="Email" value={form.email} onChange={(v) => setForm((p) => ({ ...p, email: v }))} type="email" />
                  <Field
                    label="Teléfono"
                    value={form.phone}
                    onChange={(v) => setForm((p) => ({ ...p, phone: v }))}
                    placeholder="+51 999 999 999"
                  />
                </div>

                <div className="rounded-2xl border border-white/10 bg-[#0a0a0a] px-4 py-3 text-sm text-white/70">
                  Subirás el comprobante y verás el recuento antes de enviar la reserva.
                </div>
              </div>
            </div>

            {error && <p className="text-xs font-semibold text-[#ff9a9a]">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-full px-4 py-3 text-center text-sm font-semibold uppercase tracking-wide btn-smoke transition disabled:opacity-70"
            >
              {loading ? "Procesando..." : "Revisar pago y enviar"}
            </button>
          </form>
        )}
      </div>

      {showSummary && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 px-4 py-6 sm:items-center">
          <div className="relative w-full max-w-2xl space-y-4 rounded-3xl border border-white/15 bg-gradient-to-b from-[#111111] to-[#050505] p-6 shadow-[0_30px_90px_rgba(0,0,0,0.6)] max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <p className="text-xs font-semibold uppercase tracking-[0.35em] text-white/60">Revisión</p>
                <h3 className="text-2xl font-semibold text-white">Recuento y pago Yape</h3>
                <p className="text-sm text-white/60">Confirma tu pedido y sube el comprobante.</p>
              </div>
              <button
                type="button"
                onClick={() => setShowSummary(false)}
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
              <div className="flex items-center justify-between text-white">
                <span>Documento</span>
                <span className="font-semibold text-white">
                  {form.document || "—"} ({form.doc_type})
                </span>
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
              {selectedProductInfo?.items && selectedProductInfo.items.length > 0 && (
                <div className="pt-2 text-xs text-white/60">
                  Incluye:
                  <ul className="mt-1 space-y-1">
                    {selectedProductInfo.items.map((item, idx) => (
                      <li key={idx}>• {item}</li>
                    ))}
                  </ul>
                </div>
              )}
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
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`relative overflow-hidden rounded-xl border-2 border-dashed transition-all duration-200 ${
                  isDragging
                    ? "border-[#e91e63] bg-[#e91e63]/10 scale-[1.02]"
                    : uploading || reservationDone
                    ? "border-white/10 bg-[#111111] cursor-not-allowed opacity-60"
                    : "border-white/20 bg-[#111111] hover:border-white/40 hover:bg-[#151515]"
                }`}
              >
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/jpg"
                  onChange={onFileChange}
                  disabled={uploading || reservationDone}
                  className="absolute inset-0 z-10 cursor-pointer opacity-0"
                  id="voucher-upload"
                />
                <label
                  htmlFor="voucher-upload"
                  className={`flex flex-col items-center justify-center gap-3 px-6 py-8 ${
                    uploading || reservationDone ? "cursor-not-allowed" : "cursor-pointer"
                  }`}
                >
                  {uploading ? (
                    <>
                      <div className="h-12 w-12 animate-spin rounded-full border-4 border-white/10 border-t-[#e91e63]"></div>
                      <p className="text-sm font-semibold text-white">Subiendo comprobante...</p>
                    </>
                  ) : form.voucher_url ? (
                    <>
                      <svg className="h-12 w-12 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <p className="text-sm font-semibold text-emerald-400">Comprobante subido</p>
                      <p className="text-xs text-white/60">Haz clic o arrastra para reemplazar</p>
                    </>
                  ) : (
                    <>
                      <svg className="h-12 w-12 text-white/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                        />
                      </svg>
                      <div className="text-center">
                        <p className="text-sm font-semibold text-white">
                          {isDragging ? "Suelta la imagen aquí" : "Arrastra tu comprobante o haz clic"}
                        </p>
                        <p className="mt-1 text-xs text-white/60">JPG, PNG, WEBP • Máx 5MB</p>
                      </div>
                    </>
                  )}
                </label>
              </div>

              {form.voucher_url && (
                <a
                  href={form.voucher_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 text-xs font-semibold text-[#e91e63] underline-offset-4 hover:underline"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                  Ver comprobante subido
                </a>
              )}
            </div>

            {modalError && <p className="text-xs font-semibold text-[#ff9a9a]">{modalError}</p>}

            {reservationSubmitted ? (
              <div className="space-y-3 rounded-2xl border-2 border-emerald-400/70 bg-emerald-500/15 p-5 text-white shadow-[0_12px_40px_rgba(0,255,170,0.2)]">
                <p className="text-lg font-bold">Reserva enviada.</p>
                <p className="text-base text-white/80">Validaremos el pago manualmente y te confirmaremos por correo en los próximos minutos.</p>
                {successCodes && successCodes.length > 0 && (
                  <>
                    <div className="space-y-1">
                      {successCodes.map((c) => (
                        <div key={c} className="rounded-xl bg-black/30 px-3 py-2 font-mono text-xs">
                          {c}
                        </div>
                      ))}
                    </div>
                    <p className="text-sm text-white/70">Comparte estos códigos con tu grupo para que generen sus QR.</p>
                  </>
                )}
              </div>
            ) : (
              <div className="rounded-2xl border border-white/10 bg-black/40 p-4 text-base font-semibold text-white/80">
                Validaremos el pago manualmente. Te confirmaremos por correo tu reserva en los próximos minutos.
              </div>
            )}

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setShowSummary(false)}
                className="rounded-full px-4 py-2 text-xs font-semibold btn-smoke-outline transition"
              >
                Volver al formulario
              </button>
              <button
                type="button"
                onClick={confirmReservation}
                disabled={loading || uploading || reservationSubmitted}
                className="flex items-center justify-center gap-2 rounded-full px-4 py-3 text-xs font-semibold uppercase tracking-wide btn-attention-red transition disabled:opacity-60"
              >
                {loading ? "Enviando..." : reservationSubmitted ? "Reserva enviada" : "Enviar reserva"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showTicketSummary && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 px-4 py-6 sm:items-center">
          <div className="relative w-full max-w-2xl space-y-4 rounded-3xl border border-white/15 bg-gradient-to-b from-[#111111] to-[#050505] p-6 shadow-[0_30px_90px_rgba(0,0,0,0.6)] max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <p className="text-xs font-semibold uppercase tracking-[0.35em] text-white/60">Revisión</p>
                <h3 className="text-2xl font-semibold text-white">Pago Yape</h3>
                <p className="text-sm text-white/60">Confirma tus datos y paga con Yape/Plin.</p>
              </div>
              <button
                type="button"
                onClick={() => setShowTicketSummary(false)}
                className="rounded-full px-3 py-1 text-xs font-semibold btn-smoke-outline transition"
              >
                Editar datos
              </button>
            </div>

            <div className="space-y-3 rounded-2xl border border-white/10 bg-[#0b0b0b] p-4 text-sm text-white/80">
              <div className="flex items-center justify-between text-white">
                <span className="font-semibold">Documento</span>
                <span className="font-semibold">
                  {ticketForm.document || "—"} ({ticketForm.doc_type})
                </span>
              </div>
              {ticketRequiresEvent && (
                <div className="flex items-center justify-between">
                  <span>Evento</span>
                  <span className="font-semibold text-white">{ticketSelectedEvent?.name || "—"}</span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span>Modalidad</span>
                <span className="font-semibold text-white">
                  {ticketSaleLabel} • {ticketQuantity === 1 ? "SOLO" : "DUO"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Nombre</span>
                <span className="font-semibold text-white">{ticketFullName || "—"}</span>
              </div>
              <div className="flex flex-col gap-1 text-xs text-white/60">
                <span>Email: {ticketForm.email || "—"}</span>
                <span>Teléfono: {ticketForm.phone || "—"}</span>
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
                  onClick={copyYapeNumberTicket}
                  className="flex items-center gap-2 rounded-full px-3 py-2 text-xs font-semibold btn-smoke-outline transition"
                >
                  {ticketCopyFeedback === "copied" ? "Copiado" : ticketCopyFeedback === "error" ? "No se pudo copiar" : "Copiar número"}
                  <span className="text-[#f2f2f2]/70">(para abrir Yape)</span>
                </button>
              </div>
              <div className="rounded-xl bg-[#e91e63]/10 p-3 text-sm text-white/80">
                Envía S/ {ticketPrice} al número indicado y adjunta el comprobante abajo.
              </div>
            </div>

            <div className="space-y-2 rounded-2xl border border-white/10 bg-[#0b0b0b] p-4">
              <label className="text-sm font-semibold text-white">Comprobante de pago</label>
              
              <div
                onDragOver={handleTicketDragOver}
                onDragLeave={handleTicketDragLeave}
                onDrop={handleTicketDrop}
                className={`relative overflow-hidden rounded-xl border-2 border-dashed transition-all duration-200 ${
                  ticketIsDragging
                    ? "border-[#e91e63] bg-[#e91e63]/10 scale-[1.02]"
                    : ticketUploading
                    ? "border-white/10 bg-[#111111] cursor-not-allowed opacity-60"
                    : "border-white/20 bg-[#111111] hover:border-white/40 hover:bg-[#151515]"
                }`}
              >
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/jpg"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (file) await handleTicketFileUpload(file);
                  }}
                  disabled={ticketUploading}
                  className="absolute inset-0 z-10 cursor-pointer opacity-0"
                  id="ticket-voucher-upload"
                />
                <label
                  htmlFor="ticket-voucher-upload"
                  className={`flex flex-col items-center justify-center gap-3 px-6 py-8 ${
                    ticketUploading ? "cursor-not-allowed" : "cursor-pointer"
                  }`}
                >
                  {ticketUploading ? (
                    <>
                      <div className="h-12 w-12 animate-spin rounded-full border-4 border-white/10 border-t-[#e91e63]"></div>
                      <p className="text-sm font-semibold text-white">Subiendo comprobante...</p>
                    </>
                  ) : ticketVoucherUrl ? (
                    <>
                      <svg className="h-12 w-12 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <p className="text-sm font-semibold text-emerald-400">Comprobante subido</p>
                      <p className="text-xs text-white/60">Haz clic o arrastra para reemplazar</p>
                    </>
                  ) : (
                    <>
                      <svg className="h-12 w-12 text-white/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                        />
                      </svg>
                      <div className="text-center">
                        <p className="text-sm font-semibold text-white">
                          {ticketIsDragging ? "Suelta la imagen aquí" : "Arrastra tu comprobante o haz clic"}
                        </p>
                        <p className="mt-1 text-xs text-white/60">JPG, PNG, WEBP • Máx 5MB</p>
                      </div>
                    </>
                  )}
                </label>
              </div>

              {ticketVoucherUrl && (
                <a
                  href={ticketVoucherUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 text-xs font-semibold text-[#e91e63] underline-offset-4 hover:underline"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                  Ver comprobante subido
                </a>
              )}
            </div>

            {ticketModalError && <p className="text-xs font-semibold text-[#ff9a9a]">{ticketModalError}</p>}

            <div className="rounded-2xl border border-white/10 bg-black/40 p-3 text-xs text-white/70">
              Recibimos tu solicitud de compra. El equipo BABY validará el pago y te enviaremos la confirmación a tu
              bandeja de correo.
            </div>

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setShowTicketSummary(false)}
                className="rounded-full px-4 py-2 text-xs font-semibold btn-smoke-outline transition"
              >
                Volver al formulario
              </button>
              <button
                type="button"
                onClick={confirmTicketPurchase}
                disabled={ticketLoading}
                className="flex items-center justify-center gap-2 rounded-full px-4 py-3 text-xs font-semibold uppercase tracking-wide btn-smoke transition disabled:opacity-60"
              >
                {ticketLoading ? "Enviando..." : "Enviar solicitud"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showTicketConfirmation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-6">
          <div className="w-full max-w-lg space-y-5 rounded-3xl border border-white/15 bg-gradient-to-b from-[#111111] to-[#050505] p-6 text-white shadow-[0_30px_90px_rgba(0,0,0,0.6)]">
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-emerald-500/80">
                ✓ Solicitud recibida
              </p>
              <h3 className="text-2xl font-semibold">Revisaremos tu solicitud de compra</h3>
              <p className="text-sm text-white/70">
                El equipo BABY validará tu comprobante y te confirmaremos por correo en tu bandeja con tu entrada y QR.
              </p>
            </div>
            
            {ticketReservationId && (
              <div className="rounded-2xl border border-[#e91e63]/30 bg-[#e91e63]/10 p-4 space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-white/80">Código de reserva</p>
                <div className="flex items-center justify-between gap-3 rounded-xl bg-black/40 px-4 py-3">
                  <span className="font-mono text-lg font-bold text-white tracking-wider">{ticketReservationId}</span>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard?.writeText(ticketReservationId);
                    }}
                    className="rounded-lg bg-white/10 px-3 py-1 text-xs font-semibold text-white hover:bg-white/20 transition"
                  >
                    Copiar
                  </button>
                </div>
                <p className="text-xs text-white/60">
                  Guarda este código para consultar el estado de tu solicitud.
                </p>
              </div>
            )}

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setShowTicketConfirmation(false);
                  clearTicketInputs();
                }}
                className="rounded-full px-5 py-2.5 text-sm font-semibold btn-smoke transition"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}

      {showReservationConfirmation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-6">
          <div className="w-full max-w-lg space-y-5 rounded-3xl border border-white/15 bg-gradient-to-b from-[#111111] to-[#050505] p-6 text-white shadow-[0_30px_90px_rgba(0,0,0,0.6)]">
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-emerald-500/80">✓ Reserva recibida</p>
              <h3 className="text-2xl font-semibold">Validaremos tu reserva de mesa</h3>
              <p className="text-sm text-white/70">
                Revisaremos tu comprobante y te confirmaremos por correo con el estado de la reserva y los códigos.
              </p>
            </div>
            
            {mesaReservationId && (
              <div className="rounded-2xl border border-[#e91e63]/30 bg-[#e91e63]/10 p-4 space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-white/80">Código de reserva</p>
                <div className="flex items-center justify-between gap-3 rounded-xl bg-black/40 px-4 py-3">
                  <span className="font-mono text-lg font-bold text-white tracking-wider">{mesaReservationId}</span>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard?.writeText(mesaReservationId);
                    }}
                    className="rounded-lg bg-white/10 px-3 py-1 text-xs font-semibold text-white hover:bg-white/20 transition"
                  >
                    Copiar
                  </button>
                </div>
                <p className="text-xs text-white/60">
                  Guarda este código para consultar el estado de tu reserva.
                </p>
              </div>
            )}

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setShowReservationConfirmation(false);
                  clearMesaInputs();
                }}
                className="rounded-full px-5 py-2.5 text-sm font-semibold btn-smoke transition"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  required,
  className = "",
  inputMode,
  maxLength,
  digitOnly = false,
  error,
  allowClear = false,
  onClear,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  required?: boolean;
  className?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  maxLength?: number;
  digitOnly?: boolean;
  error?: string;
  allowClear?: boolean;
  onClear?: () => void;
}) {
  const showClear = allowClear && value.length > 0;
  return (
    <label className={`block space-y-2 text-sm font-semibold text-white ${className}`}>
      {label}
      <div className="relative">
        <input
          value={value}
          onChange={(e) => {
            let next = e.target.value;
            if (digitOnly) {
              next = next.replace(/\D/g, "");
              if (maxLength) next = next.slice(0, maxLength);
            }
            onChange(next);
          }}
          placeholder={placeholder}
          type={type}
          required={required}
          inputMode={inputMode}
          maxLength={maxLength}
          className={`w-full rounded-xl border bg-[#111111] px-4 py-3 text-base text-white placeholder:text-white/40 focus:border-white focus:outline-none ${
            error ? "border-[#ff9a9a]" : "border-white/10"
          } ${showClear ? "pr-11" : ""}`}
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
