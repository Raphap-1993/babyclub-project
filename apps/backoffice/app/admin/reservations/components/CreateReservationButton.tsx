"use client";

import type React from "react";
import { useEffect, useMemo, useState } from "react";
import { supabaseClient } from "@/lib/supabaseClient";
import { authedFetch } from "@/lib/authedFetch";
import { DOCUMENT_TYPES, validateDocument, type DocumentType } from "shared/document";

type EventOption = { id: string; name: string; starts_at?: string | null; is_active?: boolean | null };
type TableOption = {
  id: string;
  name: string;
  event_id: string | null;
  ticket_count?: number | null;
  min_consumption?: number | null;
  price?: number | null;
  is_active?: boolean | null;
};
type ProductOption = { id: string; table_id: string; name: string; price?: number | null; tickets_included?: number | null; is_active?: boolean | null };
type ReservationOption = { table_id: string; status: string; full_name?: string | null };

type Mode = "existing_ticket" | "new_customer";

const sortByName = <T extends { name?: string | null }>(items: T[]) => {
  return [...items].sort((a, b) =>
    (a.name || "").localeCompare(b.name || "", "es", { sensitivity: "base", numeric: true })
  );
};

const sortEvents = (events: EventOption[]) => {
  return [...events].sort((a, b) => {
    const activeDiff = Number(Boolean(b.is_active)) - Number(Boolean(a.is_active));
    if (activeDiff !== 0) return activeDiff;
    const aTime = a.starts_at ? new Date(a.starts_at).getTime() : Number.POSITIVE_INFINITY;
    const bTime = b.starts_at ? new Date(b.starts_at).getTime() : Number.POSITIVE_INFINITY;
    if (aTime !== bTime) return aTime - bTime;
    return (a.name || "").localeCompare(b.name || "", "es", { sensitivity: "base", numeric: true });
  });
};

export default function CreateReservationButton() {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("existing_ticket");
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [emailInfo, setEmailInfo] = useState<string | null>(null);

  const [events, setEvents] = useState<EventOption[]>([]);
  const [tables, setTables] = useState<TableOption[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [reservations, setReservations] = useState<ReservationOption[]>([]);

  const [eventId, setEventId] = useState<string>("");
  const [tableId, setTableId] = useState<string>("");
  const [productId, setProductId] = useState<string>("");
  const [status, setStatus] = useState<string>("approved");
  const [voucherUrl, setVoucherUrl] = useState<string>("");
  const [uploadingVoucher, setUploadingVoucher] = useState(false);
  const [notes, setNotes] = useState<string>("");
  const [autoCodes, setAutoCodes] = useState<boolean>(true);
  const [createdByStaffId, setCreatedByStaffId] = useState<string>("");
  const [createdByStaffName, setCreatedByStaffName] = useState<string>("");
  const [personLoading, setPersonLoading] = useState(false);

  const [fullName, setFullName] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [phone, setPhone] = useState<string>("");
  const [docType, setDocType] = useState<DocumentType>("dni");
  const [document, setDocument] = useState<string>("");
  const [ticketId, setTicketId] = useState<string>("");
  const [searchValue, setSearchValue] = useState<string>("");
  const [ticketLookupLoading, setTicketLookupLoading] = useState(false);
  const [ticketLookupError, setTicketLookupError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || loadingOptions || events.length > 0) return;
    setLoadingOptions(true);
    authedFetch("/api/admin/reservations/options")
      .then((res) => res.json())
      .then((data) => {
        if (data?.error) {
          setError(data.error);
          return;
        }
        const sortedEvents = sortEvents(data.events || []);
        const sortedTables = sortByName<TableOption>(data.tables || []);
        const sortedProducts = sortByName<ProductOption>(data.products || []);
        setEvents(sortedEvents);
        setTables(sortedTables);
        setProducts(sortedProducts);
        setReservations(data.reservations || []);
        // preseleccionar evento activo y primera mesa libre
        const activeEvent = sortedEvents.find((e: any) => e.is_active) || sortedEvents[0];
        const nextEventId = activeEvent?.id || "";
        if (nextEventId) setEventId(nextEventId);
        const eventTables = sortedTables.filter((t: any) => t.event_id === nextEventId);
        const reservedIds = new Set((data.reservations || []).map((r: any) => r.table_id));
        const freeTable = eventTables.find((t: any) => !reservedIds.has(t.id)) || eventTables[0];
        if (freeTable?.id) setTableId(freeTable.id);
      })
      .catch((err) => setError(err?.message || "No se pudieron cargar opciones"))
      .finally(() => setLoadingOptions(false));

    // set current staff id from auth session
    if (supabaseClient) {
      supabaseClient.auth.getSession().then((res) => {
        const userId = res.data.session?.user?.id;
        if (userId) {
          authedFetch("/api/admin/users/staff-by-auth", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ auth_user_id: userId }),
          })
            .then((r) => r.json())
            .then((payload) => {
              if (payload?.staff_id) {
                setCreatedByStaffId((prev) => prev || payload.staff_id);
              }
              if (payload?.staff_name) {
                setCreatedByStaffName(payload.staff_name);
              }
            })
            .catch(() => null);
        }
      });
    }
  }, [open, loadingOptions, events.length]);

  const eventTables = useMemo(
    () => tables.filter((t) => !eventId || t.event_id === eventId || t.event_id === null),
    [tables, eventId]
  );
  const tableProducts = useMemo(
    () => products.filter((p) => p.table_id === tableId && p.is_active !== false),
    [products, tableId]
  );
  const reservedMap = useMemo(() => {
    const map = new Map<string, ReservationOption>();
    reservations.forEach((r) => {
      map.set(r.table_id, r);
    });
    return map;
  }, [reservations]);
  const selectedTableReserved = tableId ? reservedMap.has(tableId) : false;

  useEffect(() => {
    // reset product when table changes, choose first activo
    if (tableProducts.length > 0) {
      setProductId(tableProducts[0].id);
    } else {
      setProductId("");
    }
  }, [tableId, tableProducts]);

  useEffect(() => {
    if (!eventId) return;
    const selectedTable = tables.find((t) => t.id === tableId);
    if ((selectedTable && selectedTable.event_id && selectedTable.event_id !== eventId) || reservedMap.has(tableId)) {
      const eventList = tables.filter((t) => t.event_id === eventId);
      const free = eventList.find((t) => !reservedMap.has(t.id)) || eventList[0];
      setTableId(free?.id || "");
      setProductId("");
    }
  }, [eventId, tables, tableId, reservedMap]);

  const parsedCodes = useMemo(() => {
    return [];
  }, []);

  const docPlaceholder = docType === "dni" ? "00000000" : docType === "ruc" ? "00000000000" : "Documento";
  const docInputMode = docType === "dni" || docType === "ruc" ? "numeric" : "text";
  const docMaxLength = docType === "dni" ? 8 : docType === "ruc" ? 11 : undefined;
  const docTypeLabel = useMemo(
    () => DOCUMENT_TYPES.find((d) => d.value === docType)?.label || docType.toUpperCase(),
    [docType]
  );
  const docCleanValue = document.trim();
  const docIsValid = validateDocument(docType, docCleanValue);

  const resetForm = () => {
    setMode("existing_ticket");
    setTableId("");
    setProductId("");
    setStatus("approved");
    setVoucherUrl("");
    setUploadingVoucher(false);
    setNotes("");
    setAutoCodes(true);
    setFullName("");
    setEmail("");
    setPhone("");
    setDocType("dni");
    setDocument("");
    setTicketId("");
    setSearchValue("");
    setSuccess(null);
    setError(null);
    setEmailInfo(null);
    setTicketLookupError(null);
  };

  const lookupPerson = async (docValue: string, docTypeOverride?: DocumentType) => {
    const targetDocType = docTypeOverride || docType;
    const docClean = (docValue || "").trim();
    if (!validateDocument(targetDocType, docClean)) return;
    setPersonLoading(true);
    try {
      const params = new URLSearchParams({ doc_type: targetDocType, document: docClean });
      const res = await fetch(`/api/admin/persons?${params.toString()}`);
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.person) {
        const p = data.person;
        const full = `${p.first_name || ""} ${p.last_name || ""}`.trim();
        setFullName((prev) => (prev ? prev : full));
        setEmail((prev) => prev || p.email || "");
        setPhone((prev) => prev || p.phone || "");
      }
    } catch (_err) {
      // ignore
    } finally {
      setPersonLoading(false);
    }
  };

  const handleLookupTicket = async () => {
    setTicketLookupError(null);
    const payload: Record<string, any> = { event_id: eventId || undefined };
    const docClean = document.trim();
    const hasValidDoc = validateDocument(docType, docClean);
    if (hasValidDoc) {
      payload.doc_type = docType;
      payload.document = docClean;
      if (docType === "dni") payload.dni = docClean;
    }
    if (ticketId) payload.ticket_id = ticketId;
    if (email) payload.email = email;
    if (phone) payload.phone = phone;
    if (searchValue) {
      const looksUuid = /^[0-9a-fA-F-]{8}-[0-9a-fA-F-]{4}-[0-9a-fA-F-]{4}-[0-9a-fA-F-]{4}-[0-9a-fA-F-]{12}$/.test(searchValue);
      const looksEmail = /@/.test(searchValue);
      const onlyDigits = /^[0-9]+$/.test(searchValue);
      const searchValueTrim = searchValue.trim();
      if (looksUuid) {
        payload.ticket_id = payload.ticket_id || searchValue;
      } else if (looksEmail) {
        payload.email = payload.email || searchValue;
        setEmail((prev) => prev || searchValue);
      } else if (onlyDigits && searchValue.length === 8) {
        const validAsDoc = validateDocument(docType, searchValueTrim);
        if (validAsDoc) {
          payload.document = payload.document || searchValueTrim;
          payload.doc_type = payload.doc_type || docType;
          if (docType === "dni") payload.dni = payload.dni || searchValueTrim;
          setDocument((prev) => prev || searchValueTrim);
        } else {
          payload.dni = payload.dni || searchValueTrim;
        }
      } else if (onlyDigits && searchValue.length >= 7) {
        payload.phone = payload.phone || searchValue;
        setPhone((prev) => prev || searchValue);
      } else {
        payload.code = searchValue;
      }
    }
    if (!payload.ticket_id && !payload.document && !payload.dni && !payload.email && !payload.phone && !payload.code) {
      setTicketLookupError("Ingresa ticket_id o DNI/Email/Teléfono/Código");
      return;
    }
    setTicketLookupLoading(true);
    try {
      const res = await authedFetch("/api/admin/tickets/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success || !data?.ticket) {
        setTicketLookupError(data?.error || "No se encontró el ticket");
        return;
      }
      const t = data.ticket;
      setTicketId(t.id || "");
      setFullName(t.full_name || "");
      setEmail(t.email || "");
      setPhone(t.phone || "");
      const ticketDocType = DOCUMENT_TYPES.some((opt) => opt.value === t.doc_type) ? (t.doc_type as DocumentType) : docType;
      const ticketDocument = t.document || t.dni || "";
      if (ticketDocument) setDocument(ticketDocument);
      setDocType(ticketDocType);
      if (t.event_id && t.event_id !== eventId) {
        setEventId(t.event_id);
      }
      setTicketLookupError(null);
    } catch (err: any) {
      setTicketLookupError(err?.message || "Error buscando ticket");
    } finally {
      setTicketLookupLoading(false);
    }
  };

  const handleSubmit = async () => {
    setError(null);
    setSuccess(null);
    const docClean = document.trim();
    const hasValidDoc = validateDocument(docType, docClean);
    if (!tableId) {
      setError("Selecciona una mesa");
      return;
    }
    if (!eventId) {
      setError("Selecciona un evento");
      return;
    }
    if (mode === "new_customer" && !fullName.trim()) {
      setError("Ingresa el nombre completo");
      return;
    }
    if (mode === "new_customer" && !hasValidDoc) {
      setError("Documento inválido");
      return;
    }
    if (mode === "existing_ticket" && !ticketId && !hasValidDoc && !email && !phone && !searchValue) {
      setError("Ingresa ticket_id o Documento/Email/Teléfono/Código para buscar el ticket");
      return;
    }

    setSaving(true);
    try {
      const res = await authedFetch("/api/admin/reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode,
          table_id: tableId,
          event_id: eventId,
          product_id: productId || null,
          status,
          voucher_url: voucherUrl || null,
          notes: notes || null,
          codes: parsedCodes,
          codes_count: autoCodes ? undefined : 0,
          created_by_staff_id: createdByStaffId || null,
          doc_type: docType,
          document: hasValidDoc ? docClean : undefined,
          dni: docType === "dni" && hasValidDoc ? docClean : undefined,
          ...(mode === "existing_ticket"
            ? {
                ticket_id: ticketId || undefined,
                email: email || undefined,
                phone: phone || undefined,
                code: searchValue || undefined,
                full_name: fullName || undefined,
              }
            : {
                full_name: fullName,
                email: email || undefined,
                phone: phone || undefined,
              }),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        setError(data?.error || "No se pudo crear la reserva");
        setEmailInfo(null);
        return;
      }
      setSuccess("Reserva creada");
      if (data?.emailSent) {
        setEmailInfo("Correo enviado al cliente con su QR y códigos.");
      } else if (status === "approved") {
        setEmailInfo("Reserva aprobada. Si el cliente tiene email, se intentó enviar notificación.");
      } else {
        setEmailInfo(null);
      }
      setTimeout(() => {
        window.location.reload();
      }, 600);
    } catch (err: any) {
      setError(err?.message || "Error de red");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          setSuccess(null);
          setError(null);
        }}
        className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-[#e91e63] to-[#ff77b6] px-4 py-2 text-sm font-semibold text-white shadow-[0_12px_30px_rgba(233,30,99,0.35)] transition hover:shadow-[0_14px_36px_rgba(233,30,99,0.45)]"
      >
        Crear reserva
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 px-4 py-10 backdrop-blur-sm">
          <div className="w-full max-w-5xl rounded-3xl border border-white/10 bg-[#0b0b0b] p-4 shadow-[0_24px_80px_rgba(0,0,0,0.5)] sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-[11px] uppercase tracking-[0.18em] text-white/50">Nueva reserva</p>
                <h2 className="text-2xl font-semibold text-white">Crear manualmente</h2>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    resetForm();
                  }}
                  className="rounded-full border border-white/15 px-3 py-2 text-sm font-semibold text-white/80 transition hover:border-white/40"
                >
                  Cerrar
                </button>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold uppercase tracking-[0.1em] text-white/60">
              <button
                type="button"
                onClick={() => setMode("existing_ticket")}
                className={`rounded-full px-3 py-1.5 ${mode === "existing_ticket" ? "bg-white text-black" : "bg-white/5 text-white"}`}
              >
                Con ticket
              </button>
              <button
                type="button"
                onClick={() => setMode("new_customer")}
                className={`rounded-full px-3 py-1.5 ${mode === "new_customer" ? "bg-white text-black" : "bg-white/5 text-white"}`}
              >
                Nuevo cliente
              </button>
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-[1.2fr,0.8fr]">
              <div className="space-y-4 rounded-2xl border border-white/10 bg-[#0f0f0f] p-4">
                <SectionTitle title="Evento y mesa" />
                <div className="grid gap-3 md:grid-cols-2">
                  <FieldSelect
                    label="Evento"
                    value={eventId}
                    onChange={(v) => setEventId(v)}
                    options={events.map((e) => ({ value: e.id, label: e.name || "Sin nombre" }))}
                    placeholder={loadingOptions ? "Cargando..." : "Selecciona evento"}
                  />
                  <FieldSelect
                    label="Mesa"
                    value={tableId}
                    onChange={(v) => setTableId(v)}
                    options={eventTables.map((t) => {
                      const reserved = reservedMap.has(t.id);
                      return {
                        value: t.id,
                        label: `${t.name}${reserved ? " • Ocupada" : ""}`,
                        disabled: t.is_active === false || reserved,
                      };
                    })}
                    placeholder={eventTables.length === 0 ? "No hay mesas" : "Selecciona mesa"}
                  />
                  <FieldSelect
                    label="Pack / Producto"
                    value={productId}
                    onChange={(v) => setProductId(v)}
                    options={tableProducts.map((p) => ({
                      value: p.id,
                      label: p.name + (p.price ? ` • S/ ${p.price}` : ""),
                    }))}
                    placeholder={tableProducts.length === 0 ? "Sin packs" : "Opcional"}
                    allowEmpty
                  />
                  <FieldSelect
                    label="Estado"
                    value={status}
                    onChange={(v) => setStatus(v)}
                    options={[
                      { value: "approved", label: "Aprobada" },
                      { value: "pending", label: "Pendiente" },
                      { value: "rejected", label: "Rechazada" },
                    ]}
                  />
                </div>

                <SectionTitle title="Datos del cliente" />
                {mode === "existing_ticket" && (
                  <div className="grid items-end gap-3 md:grid-cols-[1.2fr,0.8fr]">
                    <FieldInput
                      label="Documento (DNI/CE/...) / Código / Email / Teléfono / UUID"
                      value={searchValue}
                      onChange={(v) => setSearchValue(v)}
                      placeholder="Ingresa primero el documento si lo tienes"
                    />
                    <button
                      type="button"
                      onClick={handleLookupTicket}
                      disabled={ticketLookupLoading}
                      className="h-[46px] rounded-full bg-white px-4 text-sm font-semibold text-black transition hover:scale-[1.01] disabled:opacity-60"
                    >
                      {ticketLookupLoading ? "Buscando..." : "Buscar ticket"}
                    </button>
                  </div>
                )}
                <div className="grid gap-3 md:grid-cols-3">
                  <FieldSelect
                    label="Tipo de documento"
                    value={docType}
                    onChange={(v) => setDocType((v as DocumentType) || "dni")}
                    options={DOCUMENT_TYPES}
                  />
                  <FieldInput
                    label="Nro. documento"
                    value={document}
                    onChange={(v) => {
                      setDocument(v);
                      if (mode === "new_customer" && validateDocument(docType, v)) lookupPerson(v);
                    }}
                    onBlur={() => mode === "new_customer" && validateDocument(docType, document) && lookupPerson(document)}
                    inputMode={docInputMode}
                    maxLength={docMaxLength}
                    placeholder={docPlaceholder}
                    required={mode === "new_customer"}
                  />
                  <div className="md:col-span-2">
                    <FieldInput
                      label="Nombre completo"
                      value={fullName}
                      onChange={setFullName}
                      required={mode === "new_customer"}
                      placeholder="Nombre y apellidos"
                    />
                  </div>
                  <FieldInput label="Email" value={email} onChange={setEmail} placeholder="cliente@correo.com" />
                  <FieldInput label="Teléfono" value={phone} onChange={setPhone} placeholder="+51 999 999 999" />
                </div>
                {(ticketLookupError || personLoading) && (
                  <p className="text-sm font-semibold text-white/70">
                    {ticketLookupError ? ticketLookupError : "Buscando datos por documento..."}
                  </p>
                )}

                <SectionTitle title="Extras" />
                <div className="grid gap-3 md:grid-cols-2">
                  <FileInput
                    label="Subir voucher (imagen)"
                    onUpload={async (file) => {
                      setUploadingVoucher(true);
                      try {
                        const fd = new FormData();
                        fd.append("file", file);
                        const res = await authedFetch("/api/uploads/layout", { method: "POST", body: fd });
                        const data = await res.json().catch(() => ({}));
                        if (!res.ok || !data?.url) {
                          setError(data?.error || "No se pudo subir el voucher");
                        } else {
                          setVoucherUrl(data.url);
                        }
                      } catch (err: any) {
                          setError(err?.message || "Error al subir voucher");
                        } finally {
                          setUploadingVoucher(false);
                        }
                      }}
                      uploading={uploadingVoucher}
                    />
                  <FieldInput label="Notas (opcional)" value={notes} onChange={setNotes} placeholder="Notas internas" />
                <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-[#111111] px-3 py-2.5 text-sm font-semibold text-white">
                  <input
                    type="checkbox"
                    checked={autoCodes}
                    onChange={(e) => setAutoCodes(e.target.checked)}
                      className="h-4 w-4 rounded border-white/30 bg-black text-[#e91e63] focus:ring-white/40"
                    />
                    <span className="text-white/80">Generar códigos extra según tickets de mesa</span>
                  </label>
                  <FieldInput
                    label="Staff (auto)"
                    value={createdByStaffName || createdByStaffId}
                    onChange={setCreatedByStaffId}
                    placeholder="Se completará si tu usuario es staff"
                    disabled
                  />
                </div>
              </div>

              <div className="space-y-4 rounded-2xl border border-white/10 bg-[#0f0f0f] p-4">
                <h3 className="text-sm font-semibold uppercase tracking-[0.1em] text-white/60">Resumen</h3>
                <SummaryItem label="Evento" value={events.find((e) => e.id === eventId)?.name || "—"} />
                <SummaryItem
                  label="Mesa"
                  value={
                    tables.find((t) => t.id === tableId)?.name ||
                    (eventTables.length === 0 ? "No hay mesas para este evento" : "Selecciona una mesa")
                  }
                  warning={selectedTableReserved ? "Ocupada por otra reserva" : undefined}
                />
                <SummaryItem label="Pack" value={products.find((p) => p.id === productId)?.name || "N/A"} />
                <SummaryItem label="Estado" value={status} />
                {mode === "existing_ticket" ? (
                  <SummaryItem label="Ticket" value={ticketId || "Buscar por DNI/Email/Teléfono/Código"} />
                ) : (
                  <SummaryItem label="Cliente" value={fullName || "—"} />
                )}
                <SummaryItem
                  label="Documento"
                  value={docIsValid ? `${docTypeLabel} • ${docCleanValue}` : "—"}
                />
                <SummaryItem label="Códigos" value={parsedCodes.length > 0 ? parsedCodes.join(", ") : autoCodes ? "Auto" : "0 extra"} />
                {notes && <SummaryItem label="Notas" value={notes} />}
                <div className="pt-2">
                  {error && <p className="text-sm font-semibold text-[#ff9a9a]">{error}</p>}
                  {success && <p className="text-sm font-semibold text-emerald-400">{success}</p>}
                  {emailInfo && <p className="text-xs text-white/70">{emailInfo}</p>}
                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      disabled={saving}
                      onClick={handleSubmit}
                      className="flex-1 rounded-full bg-white px-4 py-3 text-center text-sm font-semibold text-black transition hover:scale-[1.01] disabled:opacity-60"
                    >
                      {saving ? "Guardando..." : "Guardar reserva"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setOpen(false);
                        resetForm();
                      }}
                      className="rounded-full border border-white/15 px-4 py-3 text-sm font-semibold text-white/80 transition hover:border-white/40"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function FieldInput({
  label,
  value,
  onChange,
  placeholder,
  inputMode,
  required,
  maxLength,
  type = "text",
  onBlur,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  required?: boolean;
  maxLength?: number;
  type?: string;
  onBlur?: () => void;
  disabled?: boolean;
}) {
  return (
    <label className="block space-y-1 text-sm font-semibold text-white">
      <span className="text-white/70">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        inputMode={inputMode}
        maxLength={maxLength}
        required={required}
        onBlur={onBlur}
        disabled={disabled}
        className="w-full rounded-xl border border-white/10 bg-[#111111] px-3 py-2.5 text-sm text-white placeholder:text-white/40 focus:border-white focus:outline-none disabled:opacity-60"
      />
    </label>
  );
}

function FileInput({
  label,
  onUpload,
  uploading,
}: {
  label: string;
  onUpload: (file: File) => Promise<void>;
  uploading?: boolean;
}) {
  return (
    <label className="block space-y-1 text-sm font-semibold text-white">
      <span className="text-white/70">{label}</span>
      <input
        type="file"
        accept="image/*"
        disabled={uploading}
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (file) await onUpload(file);
          e.target.value = "";
        }}
        className="w-full rounded-xl border border-white/10 bg-[#111111] px-3 py-2.5 text-sm text-white file:mr-3 file:rounded-lg file:border-0 file:bg-white/10 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white placeholder:text-white/40 focus:border-white focus:outline-none disabled:opacity-60"
      />
    </label>
  );
}

function FieldSelect({
  label,
  value,
  onChange,
  options,
  placeholder,
  allowEmpty = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string; disabled?: boolean }[];
  placeholder?: string;
  allowEmpty?: boolean;
}) {
  return (
    <label className="block space-y-1 text-sm font-semibold text-white">
      <span className="text-white/70">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-white/10 bg-[#111111] px-3 py-2.5 text-sm text-white focus:border-white focus:outline-none"
      >
        <option value="">{placeholder || "Seleccionar"}</option>
        {allowEmpty && <option value="">—</option>}
        {options.map((opt) => (
          <option key={opt.value} value={opt.value} disabled={opt.disabled}>
            {opt.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function SectionTitle({ title }: { title: string }) {
  return <p className="text-[11px] uppercase tracking-[0.18em] text-white/50">{title}</p>;
}

function SummaryItem({ label, value, warning }: { label: string; value: string; warning?: string }) {
  return (
    <div className="rounded-xl border border-white/5 bg-black/30 px-3 py-2">
      <p className="text-[11px] uppercase tracking-[0.12em] text-white/50">{label}</p>
      <p className="text-sm font-semibold text-white">{value || "—"}</p>
      {warning && <p className="text-xs font-semibold text-[#ff9a9a]">{warning}</p>}
    </div>
  );
}
