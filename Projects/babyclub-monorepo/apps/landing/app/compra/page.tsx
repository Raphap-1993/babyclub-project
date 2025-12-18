/* Compra de mesas/tickets con upload de voucher */
"use client";

import { useEffect, useState } from "react";
import MiniTableMap from "./MiniTableMap";

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

export default function CompraPage() {
  const [tables, setTables] = useState<TableRow[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [form, setForm] = useState({ dni: "", full_name: "", email: "", phone: "", voucher_url: "" });
  const [ticketForm, setTicketForm] = useState({ dni: "", full_name: "", email: "", phone: "" });
  const [selectedProduct, setSelectedProduct] = useState<string>("");
  const [mode, setMode] = useState<"mesa" | "ticket">("mesa");
  const [uploading, setUploading] = useState(false);
  const [ticketUploading, setTicketUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [ticketLoading, setTicketLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ticketError, setTicketError] = useState<string | null>(null);
  const [successCodes, setSuccessCodes] = useState<string[] | null>(null);
  const [ticketSuccessId, setTicketSuccessId] = useState<string | null>(null);
  const [ticketSuccessIds, setTicketSuccessIds] = useState<string[]>([]);
  const [layoutUrl, setLayoutUrl] = useState<string | null>(null);
  const [showSummary, setShowSummary] = useState(false);
  const [showTicketSummary, setShowTicketSummary] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [ticketModalError, setTicketModalError] = useState<string | null>(null);
  const [copyFeedback, setCopyFeedback] = useState<"idle" | "copied" | "error">("idle");
  const [ticketCopyFeedback, setTicketCopyFeedback] = useState<"idle" | "copied" | "error">("idle");
  const [justSubmitted, setJustSubmitted] = useState(false);
  const [reservationSubmitted, setReservationSubmitted] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState<string>("");
  const [ticketVoucherUrl, setTicketVoucherUrl] = useState<string>("");
  const [ticketQuantity, setTicketQuantity] = useState<1 | 2>(1);
  const defaultCode = process.env.NEXT_PUBLIC_DEFAULT_CODE || "public";
  const dniErrorTicket = ticketForm.dni && ticketForm.dni.length !== 8 ? "El DNI debe tener 8 dígitos" : "";
  const dniErrorMesa = form.dni && form.dni.length !== 8 ? "El DNI debe tener 8 dígitos" : "";
  const yapeNumber = "950 144 641";
  const yapeHolder = "Kevin Andree Huansi Ruiz";

  const formatPrice = (value?: number | null) => {
    if (value == null) return null;
    return `S/ ${value.toLocaleString("es-PE")}`;
  };

  const resetTicketForm = () => {
    setTicketForm({ dni: "", full_name: "", email: "", phone: "" });
    setTicketError(null);
    setTicketSuccessId(null);
  };

  const resetMesaForm = () => {
    setForm({ dni: "", full_name: "", email: "", phone: "", voucher_url: "" });
    setError(null);
    setSuccessCodes(null);
  };

  useEffect(() => {
    fetch("/api/tables", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        setTables(data?.tables || []);
        const firstAvailable = data?.tables?.find((t: any) => !t.is_reserved) || data?.tables?.[0];
        setSelected(firstAvailable?.id || "");
        const firstProduct = firstAvailable?.products?.find((p: any) => p.is_active !== false);
        setSelectedProduct(firstProduct?.id || "");
        const eventRel = Array.isArray((firstAvailable as any)?.event) ? (firstAvailable as any)?.event?.[0] : (firstAvailable as any)?.event;
        const evId = firstAvailable?.event_id || eventRel?.id || "";
        if (evId) setSelectedEventId(evId);
      })
      .catch(() => setTables([]));
    fetch("/api/layout")
      .then((res) => res.json())
      .then((data) => setLayoutUrl(data?.layout_url || null))
      .catch(() => null);
  }, []);

  useEffect(() => {
    if (ticketForm.dni.length === 8) {
      lookupPerson(ticketForm.dni, "ticket");
    }
  }, [ticketForm.dni]);

  useEffect(() => {
    if (form.dni.length === 8) {
      lookupPerson(form.dni, "mesa");
    }
  }, [form.dni]);

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
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

  const lookupPerson = async (dni: string, target: "ticket" | "mesa") => {
    try {
      const res = await fetch(`/api/persons?dni=${dni}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.person) return;
      const p = data.person;
      const [apPat, ...rest] = (p.last_name || "").split(" ");
      const apMat = rest.join(" ").trim();
      const fullName = `${p.first_name || ""} ${apPat || ""} ${apMat || ""}`.trim();
      if (target === "ticket") {
        setTicketForm((prev) => ({
          ...prev,
          full_name: prev.full_name || fullName,
          email: prev.email || p.email || "",
          phone: prev.phone || p.phone || "",
        }));
      } else {
        setForm((prev) => ({
          ...prev,
          full_name: prev.full_name || fullName,
          email: prev.email || p.email || "",
          phone: prev.phone || p.phone || "",
        }));
      }
    } catch (_err) {
      // ignore
    }
  };

  // header text tweak
  const headerSubtitle = "Genera tu entrada o reserva tu mesa con voucher (Yape/Plin) y obtén los QR.";
  const ticketPrice = ticketQuantity === 1 ? 20 : 35;

  // sincronia de datos entre solo entrada y reserva
  useEffect(() => {
    if (mode === "mesa") {
      setForm((prev) => ({
        ...prev,
        dni: prev.dni || ticketForm.dni,
        full_name: prev.full_name || ticketForm.full_name,
        email: prev.email || ticketForm.email,
        phone: prev.phone || ticketForm.phone,
      }));
    } else if (mode === "ticket") {
      setTicketForm((prev) => ({
        ...prev,
        dni: prev.dni || form.dni,
        full_name: prev.full_name || form.full_name,
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

    if (eventsFromTables.length > 0 && !selectedEventId) {
      setError("Selecciona el evento para esta reserva");
      return;
    }
    if (!selected || form.dni.length !== 8 || !form.full_name.trim()) {
      setError("Selecciona una mesa e ingresa DNI y tu nombre");
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
    if (!selected || form.dni.length !== 8 || !form.full_name.trim()) {
      setModalError("Revisa los datos obligatorios: mesa, DNI y nombre.");
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
          dni: form.dni,
          full_name: form.full_name,
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
    setTicketSuccessId(null);
    setTicketSuccessIds([]);
    if (ticketForm.dni.length !== 8 || !ticketForm.full_name.trim()) {
      setTicketError("Ingresa DNI y tu nombre");
      return;
    }
    setShowTicketSummary(true);
  };

  const confirmTicketPurchase = async () => {
    setTicketModalError(null);
    setTicketError(null);
    if (ticketForm.dni.length !== 8 || !ticketForm.full_name.trim()) {
      setTicketModalError("Ingresa DNI y tu nombre");
      return;
    }
    if (!ticketVoucherUrl) {
      setTicketModalError("Sube tu comprobante de pago para continuar.");
      return;
    }
    const codeToUse = defaultCode;
    setTicketLoading(true);
    try {
      const ids: string[] = [];
      const loops = ticketQuantity === 2 ? 2 : 1;
      for (let i = 0; i < loops; i++) {
        const res = await fetch("/api/tickets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            code: codeToUse,
            dni: ticketForm.dni,
            nombre: ticketForm.full_name,
            apellido_paterno: "",
            apellido_materno: "",
            email: ticketForm.email,
            telefono: ticketForm.phone,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data?.success) {
          setTicketModalError(data?.error || "No se pudo generar el ticket");
          break;
        } else {
          ids.push(data.ticketId || "Generado");
        }
      }
      if (ids.length === loops) {
        setTicketSuccessId(ids[0] || null);
        setTicketSuccessIds(ids);
        setShowTicketSummary(false);
      }
    } catch (err: any) {
      setTicketModalError(err?.message || "Error al generar ticket");
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
  const eventsFromTables = Array.from(
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

  useEffect(() => {
    if (reservationSubmitted) {
      setShowSummary(false);
      setJustSubmitted(true);
    }
  }, [reservationSubmitted]);

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
            className="rounded-full border border-white/15 px-4 py-2 text-sm font-semibold text-white transition hover:border-white"
          >
            ← Volver
          </button>
        </div>

      {justSubmitted && (
          <div className="rounded-2xl border border-emerald-500/50 bg-emerald-500/10 p-4 text-sm text-white shadow-[0_12px_40px_rgba(0,255,170,0.12)]">
            <p className="text-base font-semibold text-white">Recibimos tu solicitud.</p>
            <p className="text-sm text-white/80">
              Validaremos el pago manualmente y te confirmaremos por correo en breve. Si hay un problema te contactaremos.
            </p>
          </div>
        )}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setMode("ticket")}
            className={`flex-1 rounded-full px-4 py-2 text-sm font-semibold ${
              mode === "ticket" ? "bg-[#e91e63] text-white" : "border border-white/20 text-white"
            }`}
          >
            Solo entrada
          </button>
          <button
            type="button"
            onClick={() => setMode("mesa")}
            className={`flex-1 rounded-full px-4 py-2 text-sm font-semibold ${
              mode === "mesa" ? "bg-[#e91e63] text-white" : "border border-white/20 text-white"
            }`}
          >
            Reserva mesa
          </button>
        </div>

        {mode === "ticket" && (
          <form onSubmit={onSubmitTicket} className="space-y-4 rounded-2xl border border-white/10 bg-[#0b0b0b] p-4">
            <div className="grid gap-3 md:grid-cols-[0.6fr,1.4fr]">
              <Field
                label="DNI"
                value={ticketForm.dni}
                onChange={(v) => setTicketForm((p) => ({ ...p, dni: v }))}
                inputMode="numeric"
                digitOnly
                maxLength={8}
                required
                error={dniErrorTicket}
                allowClear
                onClear={resetTicketForm}
              />
              <Field
                label="Nombre completo"
                value={ticketForm.full_name}
                onChange={(v) => setTicketForm((p) => ({ ...p, full_name: v }))}
                required
              />
            </div>
            <div className="grid gap-3 md:grid-cols-[1.3fr,0.7fr]">
              <Field label="Email" value={ticketForm.email} onChange={(v) => setTicketForm((p) => ({ ...p, email: v }))} type="email" />
              <Field label="Teléfono" value={ticketForm.phone} onChange={(v) => setTicketForm((p) => ({ ...p, phone: v }))} placeholder="+51 999 999 999" />
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="flex items-center gap-2 rounded-2xl border border-white/10 bg-[#0a0a0a] px-4 py-3 text-sm font-semibold text-white">
                <input
                  type="radio"
                  name="ticketQty"
                  checked={ticketQuantity === 1}
                  onChange={() => setTicketQuantity(1)}
                  className="h-4 w-4 accent-[#e91e63]"
                />
                1 QR – S/ 20
              </label>
              <label className="flex items-center gap-2 rounded-2xl border border-white/10 bg-[#0a0a0a] px-4 py-3 text-sm font-semibold text-white">
                <input
                  type="radio"
                  name="ticketQty"
                  checked={ticketQuantity === 2}
                  onChange={() => setTicketQuantity(2)}
                  className="h-4 w-4 accent-[#e91e63]"
                />
                2 QR – S/ 35
              </label>
            </div>
            {ticketError && <p className="text-xs font-semibold text-[#ff9a9a]">{ticketError}</p>}
            {ticketSuccessId && (
              <div className="rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm text-white">
                Ticket generado. ID(s):{" "}
                <span className="font-mono">
                  {ticketSuccessIds.length > 0 ? ticketSuccessIds.join(", ") : ticketSuccessId}
                </span>
              </div>
            )}
            <button
              type="submit"
              disabled={ticketLoading}
              className="w-full rounded-full bg-gradient-to-r from-[#e91e63] to-[#ff77b6] px-4 py-3 text-center text-sm font-semibold uppercase tracking-wide text-white shadow-[0_12px_35px_rgba(233,30,99,0.35)] transition hover:shadow-[0_14px_38px_rgba(233,30,99,0.45)] disabled:opacity-70"
            >
              {ticketLoading ? "Procesando..." : "Revisar pago y enviar"}
            </button>
            <button
              type="button"
              onClick={() => {
                setForm((prev) => ({
                  ...prev,
                  dni: prev.dni || ticketForm.dni,
                  full_name: prev.full_name || ticketForm.full_name,
                  email: prev.email || ticketForm.email,
                  phone: prev.phone || ticketForm.phone,
                }));
                setMode("mesa");
              }}
              className="relative w-full overflow-hidden rounded-full border border-white/30 px-4 py-3 text-center text-sm font-semibold uppercase tracking-wide text-white transition hover:border-white/60"
            >
              Quiero reservar mesa (opcional)
            </button>
          </form>
        )}

        {mode === "mesa" && (
          <form onSubmit={handleOpenSummary} className="space-y-5">
            <div className="grid gap-4 lg:grid-cols-[1.3fr,1fr]">
              <div className="space-y-3">
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
                                ? "bg-[#e91e63] text-white"
                                : "border border-white/20 text-white/80"
                          }`}
                        >
                          {t.name}
                        </button>
                      );
                    })}
                </div>

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
                            selectedProduct === p.id ? "border-[#e91e63] bg-[#e91e63]/20 text-white" : "border-white/10 bg-black/40 text-white/80"
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

                {eventsFromTables.length > 0 && (
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-white">Evento</label>
                    <select
                      value={selectedEventId}
                      onChange={(e) => setSelectedEventId(e.target.value)}
                      className="w-full rounded-xl border border-white/10 bg-[#111111] px-3 py-3 text-sm text-white focus:border-white focus:outline-none"
                    >
                      <option value="">Selecciona el evento</option>
                      {eventsFromTables.map((ev) => (
                        <option key={ev.id} value={ev.id}>
                          {ev.name}
                        </option>
                      ))}
                    </select>
                    {!selectedEventId && <p className="text-xs text-[#ff9a9a]">Selecciona el evento para continuar.</p>}
                  </div>
                )}

                <div className="grid gap-3 md:grid-cols-[0.6fr,1.4fr]">
              <Field
                label="DNI"
                value={form.dni}
                onChange={(v) => setForm((p) => ({ ...p, dni: v }))}
                inputMode="numeric"
                digitOnly
                maxLength={8}
                required
                error={dniErrorMesa}
                allowClear
                onClear={resetMesaForm}
              />
              <Field label="Nombre completo" value={form.full_name} onChange={(v) => setForm((p) => ({ ...p, full_name: v }))} required />
            </div>

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

              <div className="space-y-3 rounded-2xl border border-white/10 bg-[#0c0c0c] p-3 text-xs text-white/70">
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
            </div>

            {error && <p className="text-xs font-semibold text-[#ff9a9a]">{error}</p>}
            {successCodes && successCodes.length > 0 && (
              <div className="rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-4 text-sm text-white">
                <p className="mb-2 font-semibold">Reserva enviada. Estamos validando tu pago.</p>
                <div className="space-y-1">
                  {successCodes.map((c) => (
                    <div key={c} className="rounded-xl bg-black/30 px-3 py-2 font-mono text-xs">
                      {c}
                    </div>
                  ))}
                </div>
                <p className="mt-2 text-xs text-white/70">
                  Te confirmaremos por correo tu reserva en los próximos minutos. Comparte estos códigos con tu grupo para que generen sus
                  QR.
                </p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-full bg-gradient-to-r from-[#e91e63] to-[#ff77b6] px-4 py-3 text-center text-sm font-semibold uppercase tracking-wide text-white shadow-[0_12px_35px_rgba(233,30,99,0.35)] transition hover:shadow-[0_14px_38px_rgba(233,30,99,0.45)] disabled:opacity-70"
            >
              {loading ? "Procesando..." : "Revisar pago y enviar"}
            </button>
          </form>
        )}
      </div>

      {showSummary && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-6">
          <div className="relative w-full max-w-2xl space-y-4 rounded-3xl border border-white/15 bg-gradient-to-b from-[#111111] to-[#050505] p-6 shadow-[0_30px_90px_rgba(0,0,0,0.6)]">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <p className="text-xs font-semibold uppercase tracking-[0.35em] text-white/60">Revisión</p>
                <h3 className="text-2xl font-semibold text-white">Recuento y pago Yape</h3>
                <p className="text-sm text-white/60">Confirma tu pedido y sube el comprobante.</p>
              </div>
              <button
                type="button"
                onClick={() => setShowSummary(false)}
                className="rounded-full border border-white/15 px-3 py-1 text-xs font-semibold text-white/70 transition hover:border-white"
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
                  className="flex items-center gap-2 rounded-full border border-white/20 px-3 py-2 text-xs font-semibold text-white transition hover:border-white"
                >
                  {copyFeedback === "copied" ? "Copiado" : copyFeedback === "error" ? "No se pudo copiar" : "Copiar número"}
                  <span className="text-white/50">(para abrir Yape)</span>
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
                onChange={onFileChange}
                disabled={uploading || reservationDone}
                className="w-full rounded-xl border border-white/10 bg-[#111111] px-4 py-3 text-sm text-white file:mr-3 file:rounded-xl file:border-0 file:bg-white/10 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white"
              />
              <div className="flex items-center gap-2 text-xs text-white/60">
                {uploading ? "Subiendo comprobante..." : "Formatos: JPG, PNG, WEBP. Máx 5MB."}
              </div>
              {form.voucher_url && (
                <a
                  href={form.voucher_url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs font-semibold text-[#e91e63] underline-offset-4 hover:underline"
                >
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
                className="rounded-full border border-white/20 px-4 py-2 text-xs font-semibold text-white transition hover:border-white"
              >
                Volver al formulario
              </button>
              <button
                type="button"
                onClick={confirmReservation}
                disabled={loading || uploading || reservationSubmitted}
                className="flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#b5003c] to-[#e91e63] px-4 py-3 text-xs font-semibold uppercase tracking-wide text-white shadow-[0_12px_35px_rgba(185,0,60,0.4)] transition hover:shadow-[0_14px_38px_rgba(185,0,60,0.45)] disabled:opacity-60"
              >
                {loading ? "Enviando..." : reservationSubmitted ? "Reserva enviada" : "Enviar reserva"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showTicketSummary && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-6">
          <div className="relative w-full max-w-2xl space-y-4 rounded-3xl border border-white/15 bg-gradient-to-b from-[#111111] to-[#050505] p-6 shadow-[0_30px_90px_rgba(0,0,0,0.6)]">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <p className="text-xs font-semibold uppercase tracking-[0.35em] text-white/60">Revisión</p>
                <h3 className="text-2xl font-semibold text-white">Pago Yape</h3>
                <p className="text-sm text-white/60">Confirma tus datos y paga con Yape/Plin.</p>
              </div>
              <button
                type="button"
                onClick={() => setShowTicketSummary(false)}
                className="rounded-full border border-white/15 px-3 py-1 text-xs font-semibold text-white/70 transition hover:border-white"
              >
                Editar datos
              </button>
            </div>

            <div className="space-y-3 rounded-2xl border border-white/10 bg-[#0b0b0b] p-4 text-sm text-white/80">
              <div className="flex items-center justify-between text-white">
                <span className="font-semibold">DNI</span>
                <span className="font-semibold">{ticketForm.dni}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Nombre</span>
                <span className="font-semibold text-white">{ticketForm.full_name || "—"}</span>
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
                  className="flex items-center gap-2 rounded-full border border-white/20 px-3 py-2 text-xs font-semibold text-white transition hover:border-white"
                >
                  {ticketCopyFeedback === "copied" ? "Copiado" : ticketCopyFeedback === "error" ? "No se pudo copiar" : "Copiar número"}
                  <span className="text-white/50">(para abrir Yape)</span>
                </button>
              </div>
              <div className="rounded-xl bg-[#e91e63]/10 p-3 text-sm text-white/80">
                Envía S/ {ticketPrice} al número indicado y adjunta el comprobante abajo.
              </div>
            </div>

            <div className="space-y-2 rounded-2xl border border-white/10 bg-[#0b0b0b] p-4">
              <label className="text-sm font-semibold text-white">Comprobante de pago</label>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
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
                }}
                disabled={ticketUploading}
                className="w-full rounded-xl border border-white/10 bg-[#111111] px-4 py-3 text-sm text-white file:mr-3 file:rounded-xl file:border-0 file:bg-white/10 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white"
              />
              <div className="flex items-center gap-2 text-xs text-white/60">
                {ticketUploading ? "Subiendo comprobante..." : "Formatos: JPG, PNG, WEBP. Máx 5MB."}
              </div>
              {ticketVoucherUrl && (
                <a
                  href={ticketVoucherUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs font-semibold text-[#e91e63] underline-offset-4 hover:underline"
                >
                  Ver comprobante subido
                </a>
              )}
            </div>

            {ticketModalError && <p className="text-xs font-semibold text-[#ff9a9a]">{ticketModalError}</p>}

            <div className="rounded-2xl border border-white/10 bg-black/40 p-3 text-xs text-white/70">
              Validaremos el pago manualmente. Te confirmaremos por correo tu entrada en los próximos minutos.
            </div>

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setShowTicketSummary(false)}
                className="rounded-full border border-white/20 px-4 py-2 text-xs font-semibold text-white transition hover:border-white"
              >
                Volver al formulario
              </button>
              <button
                type="button"
                onClick={confirmTicketPurchase}
                disabled={ticketLoading}
                className="flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#e91e63] to-[#ff77b6] px-4 py-3 text-xs font-semibold uppercase tracking-wide text-white shadow-[0_12px_35px_rgba(233,30,99,0.35)] transition hover:shadow-[0_14px_38px_rgba(233,30,99,0.45)] disabled:opacity-60"
              >
                {ticketLoading ? "Enviando..." : "Enviar entrada"}
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
