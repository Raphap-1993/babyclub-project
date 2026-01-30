"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { BrowserMultiFormatReader } from "@zxing/browser";
import { DateTime } from "luxon";
import { getEntryCutoffDisplay } from "shared/entryLimit";
import { authedFetch } from "@/lib/authedFetch";

type Option = { id: string; name: string; starts_at: string; entry_limit?: string | null };

type ScanLog = {
  ts: number;
  value: string;
  result: string;
  color: string;
  details?: string;
};

type MatchType = "code" | "ticket" | "none";
type ScanResult = "valid" | "duplicate" | "expired" | "inactive" | "invalid" | "not_found" | "exhausted" | "confirmed";

export default function ScanClient({ events, simpleMode = false }: { events: Option[]; simpleMode?: boolean }) {
  const primaryBtn =
    "rounded-full bg-gradient-to-r from-[#a60c2f] via-[#b10e35] to-[#6f0c25] px-4 py-2 text-sm font-semibold text-white shadow-[0_10px_30px_rgba(166,12,47,0.35)] transition hover:shadow-[0_12px_32px_rgba(166,12,47,0.45)] disabled:cursor-not-allowed disabled:opacity-60";
  const [eventId, setEventId] = useState(events[0]?.id || "");
  const [manual, setManual] = useState("");
  const [scanning, setScanning] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [logs, setLogs] = useState<ScanLog[]>([]);
  const [lastResult, setLastResult] = useState<{
    value: string;
    result: ScanResult;
    uses?: number;
    max_uses?: number | null;
    code_id?: string | null;
    ticket_id?: string | null;
    match_type?: MatchType;
    reason?: string | null;
    other_event?: { id: string; name: string | null } | null;
  } | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);
  const controlsRef = useRef<{ stop: () => void } | null>(null);
  const [ready, setReady] = useState(false);
  const selectedEvent = useMemo(() => events.find((ev) => ev.id === eventId), [events, eventId]);
  const entryCutoff = useMemo(() => {
    if (!selectedEvent?.starts_at) return null;
    return getEntryCutoffDisplay(selectedEvent.starts_at, selectedEvent.entry_limit);
  }, [selectedEvent]);
  const entryLimitLabel = entryCutoff
    ? entryCutoff.isNextDay
      ? `${entryCutoff.timeLabel} (${entryCutoff.dateLabel})`
      : entryCutoff.timeLabel
    : null;
  const entryStatus = useMemo(() => {
    if (!entryCutoff?.cutoffIso) return null;
    const cutoff = DateTime.fromISO(entryCutoff.cutoffIso, { zone: "utc" });
    if (!cutoff.isValid) return null;
    return DateTime.now().toUTC() > cutoff ? "late" : "ok";
  }, [entryCutoff]);
  const [modal, setModal] = useState<{
    value: string;
    result: ScanResult;
    uses?: number;
    max_uses?: number | null;
    code_id?: string | null;
    ticket_id?: string | null;
    code_type?: string | null;
    person?: { full_name: string | null; dni: string | null; email: string | null; phone: string | null } | null;
    ticket_used?: boolean;
    match_type?: MatchType;
    reason?: string | null;
    other_event?: { id: string; name: string | null } | null;
    expired_at?: string | null;
    confirmed_at?: string | null;
  } | null>(null);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    return () => stopScanner();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function stopScanner() {
    controlsRef.current?.stop();
    controlsRef.current = null;
    readerRef.current = null;
    setScanning(false);
    setReady(false);
  }

  async function startScanner() {
    if (!videoRef.current) return;
    if (!eventId) {
      setMessage("Selecciona un evento antes de escanear");
      return;
    }
    stopScanner();
    try {
      const reader = new BrowserMultiFormatReader();
      readerRef.current = reader;
      setScanning(true);
      const controls = await reader.decodeFromConstraints(
        {
          video: { facingMode: { ideal: "environment" } },
        } as any,
        videoRef.current,
        (result: any) => {
          if (result?.getText()) {
            handleScan(result.getText());
          }
        }
      );
      controlsRef.current = controls;
      setReady(true);
    } catch (err: any) {
      setMessage(err?.message || "No se pudo iniciar la cámara");
      setScanning(false);
    }
  }

  async function handleScan(value: string) {
    if (!value) return;
    setMessage(null);
    try {
      const res = await authedFetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: value, event_id: eventId }),
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok || !payload?.success) throw new Error(payload?.error || "Error al validar código");
      const result = payload.result as ScanResult;
      const color =
        result === "valid" || result === "confirmed"
          ? "text-green-400"
          : result === "duplicate" || result === "exhausted"
            ? "text-yellow-300"
            : "text-red-300";
      setLogs((prev) => [{ ts: Date.now(), value, result, color }, ...prev].slice(0, 5));
      setMessage(`Resultado: ${result}`);
      setLastResult({
        value,
        result,
        uses: payload.uses,
        max_uses: payload.max_uses,
        code_id: payload.code_id,
        ticket_id: payload.ticket_id,
        match_type: payload.match_type,
        reason: payload.reason,
        other_event: payload.other_event,
      });
      setModal({
        value,
        result,
        uses: payload.uses,
        max_uses: payload.max_uses,
        code_id: payload.code_id,
        ticket_id: payload.ticket_id,
        code_type: payload.code_type ?? null,
        person: payload.person ?? null,
        ticket_used: payload.ticket_used ?? false,
        match_type: payload.match_type,
        reason: payload.reason,
        other_event: payload.other_event,
        expired_at: payload.expired_at ?? null,
        confirmed_at: null,
      });
      stopScanner();
    } catch (err: any) {
      setMessage(err?.message || "Error al validar código");
      setLogs((prev) => [{ ts: Date.now(), value, result: "error", color: "text-red-300", details: err?.message }, ...prev].slice(0, 5));
      setLastResult(null);
      setModal(null);
    }
  }

  return (
    <main className="min-h-screen bg-black px-4 py-8 text-white sm:px-6 lg:px-10">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/60">Control de ingreso</p>
          <h1 className="text-3xl font-semibold">Escanear QR</h1>
          <p className="text-sm text-white/60">Usa la cámara del dispositivo para validar códigos en puerta.</p>
        </div>
      </div>

      <div
        className={`grid gap-3 ${simpleMode ? "" : "md:grid-cols-2"} rounded-3xl border border-white/10 bg-[#0c0c0c] p-3 shadow-[0_20px_80px_rgba(0,0,0,0.45)] mb-3`}
      >
        <div className="space-y-2">
          <label className="block text-sm font-semibold text-white">Evento</label>
          <select
            value={eventId}
            onChange={(e) => setEventId(e.target.value)}
            className="w-full rounded-2xl border border-white/10 bg-black px-3 py-2 text-sm text-white outline-none focus:border-white"
          >
            <option value="">Selecciona evento</option>
            {events.map((ev) => (
              <option key={ev.id} value={ev.id}>
                {ev.name}
              </option>
            ))}
          </select>
          {entryLimitLabel && (
            <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-white/60">
              <span className="rounded-full border border-white/15 px-3 py-1 text-white/80">
                Límite ingreso: {entryLimitLabel}
              </span>
              {entryStatus && (
                <span
                  className={
                    entryStatus === "late"
                      ? "rounded-full border border-red-500/40 bg-red-500/15 px-3 py-1 text-red-200"
                      : "rounded-full border border-emerald-500/40 bg-emerald-500/15 px-3 py-1 text-emerald-200"
                  }
                >
                  {entryStatus === "late" ? "Fuera de hora" : "Dentro de hora"}
                </span>
              )}
            </div>
          )}
        </div>

        {!simpleMode && (
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-white">Código manual</label>
            <div className="flex gap-2">
              <input
                value={manual}
                onChange={(e) => setManual(e.target.value)}
                placeholder="Pega o escribe el código"
                className="w-full rounded-2xl border border-white/10 bg-black px-3 py-2 text-sm text-white outline-none focus:border-white"
              />
              <button
                onClick={() => {
                  if (manual.trim()) {
                    handleScan(manual.trim());
                    setManual("");
                  }
                }}
                className={primaryBtn}
              >
                Validar
              </button>
            </div>
            {message && <p className="text-sm text-white/80">{message}</p>}
            {lastResult && (
              <div
                className="rounded-2xl border border-white/15 bg-black/30 p-3 text-sm text-white/80 shadow-[0_12px_40px_rgba(0,0,0,0.45)]"
              >
                <p className="text-xs uppercase tracking-[0.12em] text-white/50">Último resultado</p>
                <div className="mt-1 flex items-center justify-between gap-2">
                  <span className="font-mono text-[12px] text-white">{lastResult.value}</span>
                  <span
                    className={
                      lastResult.result === "valid" || lastResult.result === "confirmed"
                        ? "rounded-full bg-green-500/15 px-3 py-1 text-[12px] font-semibold text-green-300"
                        : lastResult.result === "duplicate" || lastResult.result === "exhausted"
                          ? "rounded-full bg-yellow-500/15 px-3 py-1 text-[12px] font-semibold text-yellow-200"
                          : "rounded-full bg-red-500/15 px-3 py-1 text-[12px] font-semibold text-red-200"
                    }
                  >
                    {lastResult.result}
                  </span>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-white/70">
                  {lastResult.match_type === "code" && typeof lastResult.uses === "number" && (
                    <div>
                      <p className="text-white/50">Usos</p>
                      <p className="text-white">
                        {lastResult.uses}/{lastResult.max_uses ?? "∞"}
                      </p>
                    </div>
                  )}
                  {lastResult.code_id && (
                    <div>
                      <p className="text-white/50">Code ID</p>
                      <p className="truncate font-mono text-white">{lastResult.code_id}</p>
                    </div>
                  )}
                  {lastResult.ticket_id && (
                    <div>
                      <p className="text-white/50">Ticket ID</p>
                      <p className="truncate font-mono text-white">{lastResult.ticket_id}</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className={`grid gap-4 ${simpleMode ? "" : "md:grid-cols-[2fr,1fr]"}`}>
        <div className="rounded-3xl border border-white/10 bg-[#0c0c0c] p-4 shadow-[0_20px_80px_rgba(0,0,0,0.45)]">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-semibold text-white">Cámara</p>
            <button
              onClick={() => (scanning ? stopScanner() : startScanner())}
              className={`rounded-full border border-white/15 px-6 py-3 text-sm font-semibold text-white transition hover:border-white ${simpleMode ? "w-full justify-center text-center" : ""}`}
            >
              {scanning ? "Detener" : "Iniciar escaneo"}
            </button>
          </div>
          <div className="overflow-hidden rounded-2xl border border-white/10 bg-black">
            {!ready && !scanning && (
              <div className="flex h-[320px] items-center justify-center text-sm text-white/60">
                Selecciona evento y pulsa “Iniciar escaneo”.
              </div>
            )}
            <video ref={videoRef} className="block h-[320px] w-full bg-black object-cover" autoPlay muted playsInline />
          </div>
        </div>

        {!simpleMode && (
          <div className="rounded-3xl border border-white/10 bg-[#0c0c0c] p-4 shadow-[0_20px_80px_rgba(0,0,0,0.45)]">
            <p className="mb-3 text-sm font-semibold text-white">Últimos escaneos</p>
            <div className="space-y-2 text-sm text-white/80">
              {logs.length === 0 && <p className="text-white/50">Sin lecturas aún.</p>}
              {logs.map((l) => (
                <div key={`${l.ts}-${l.value}`} className="rounded-2xl border border-white/10 bg-black/30 px-3 py-2">
                  <div className="flex items-center justify-between text-xs text-white/60">
                    <span>{new Date(l.ts).toLocaleTimeString()}</span>
                    <span className={l.color}>{l.result}</span>
                  </div>
                  <p className="font-mono text-[12px] text-white">{l.value}</p>
                  {l.details && <p className="text-xs text-white/60">{l.details}</p>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {modal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm sm:items-center sm:py-6">
          <div className="w-full max-w-lg rounded-3xl border border-white/15 bg-[#0b0b0b] p-4 shadow-[0_20px_80px_rgba(0,0,0,0.65)] sm:p-6 max-h-[90vh] overflow-y-auto">
            <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.15em] text-white/50">Resultado del scan</p>
                <h3 className="text-xl font-semibold text-white">{getResultTitle(modal.result, modal.reason)}</h3>
                <p className="text-sm text-white/60">{getResultHint(modal)}</p>
              </div>
              <button
                onClick={() => {
                  setModal(null);
                  setLastResult(null);
                }}
                className="rounded-full border border-white/20 px-3 py-1 text-sm font-semibold text-white transition hover:border-white"
              >
                Cerrar
              </button>
            </div>
            <div className="space-y-3 text-sm text-white/80">
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-[12px] text-white">{modal.value}</span>
                <span
                  className={
                    modal.result === "valid" || modal.result === "confirmed"
                      ? "rounded-full bg-green-500/15 px-3 py-1 text-[12px] font-semibold text-green-300"
                      : modal.result === "duplicate" || modal.result === "exhausted"
                        ? "rounded-full bg-yellow-500/15 px-3 py-1 text-[12px] font-semibold text-yellow-200"
                        : "rounded-full bg-red-500/15 px-3 py-1 text-[12px] font-semibold text-red-200"
                  }
                >
                  {modal.result}
                </span>
              </div>
              {modal.result === "confirmed" && (
                <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-100">
                  Ingreso registrado. {getConfirmHint(modal)}
                </div>
              )}
              <div className="rounded-2xl border border-white/10 bg-black/30 p-3 text-sm text-white/80">
                <p className="text-[11px] uppercase tracking-[0.12em] text-white/50">Detalle del scan</p>
                <div className="mt-2 grid gap-2 text-[13px] text-white">
                  <div className="text-white/80">Evento: {getEventName(events, eventId)}</div>
                  <div className="text-white/80">Origen: {getMatchLabel(modal.match_type)}</div>
                  {modal.other_event?.name && (
                    <div className="text-white/80">Otro evento: {modal.other_event.name}</div>
                  )}
                  {modal.code_type === "general" && entryLimitLabel && entryStatus && modal.reason !== "event_mismatch" && (
                    <div className="text-white/80">
                      Límite ingreso: {entryLimitLabel} ·{" "}
                      <span className={entryStatus === "late" ? "text-red-200" : "text-emerald-200"}>
                        {entryStatus === "late" ? "Fuera de hora" : "Dentro de hora"}
                      </span>
                    </div>
                  )}
                  {modal.code_id && (
                    <div className="text-white/80">
                      Code ID: <span className="font-mono">{modal.code_id}</span>
                    </div>
                  )}
                  {modal.ticket_id && (
                    <div className="text-white/80">
                      Ticket ID: <span className="font-mono">{modal.ticket_id}</span>
                    </div>
                  )}
                </div>
              </div>
              {modal.person && (
                <div className="rounded-2xl border border-white/10 bg-black/30 p-3 text-sm text-white/80">
                  <p className="text-[11px] uppercase tracking-[0.12em] text-white/50">Datos del cliente</p>
                  <div className="mt-2 grid gap-2 text-[13px] text-white">
                    <div className="font-semibold">{modal.person.full_name || "—"}</div>
                    <div className="text-white/80">DNI: {modal.person.dni || "—"}</div>
                    <div className="text-white/80">Email: {modal.person.email || "—"}</div>
                    <div className="text-white/80">Teléfono: {modal.person.phone || "—"}</div>
                  </div>
                </div>
              )}
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {modal.match_type === "code" && typeof modal.uses === "number" && (
                  <div className="rounded-2xl border border-white/10 bg-black/30 p-3">
                    <p className="text-[11px] uppercase tracking-[0.12em] text-white/50">Usos</p>
                    <p className="text-white">
                      {modal.uses}/{modal.max_uses ?? "∞"}
                    </p>
                  </div>
                )}
                {modal.ticket_id && (
                  <div className="rounded-2xl border border-white/10 bg-black/30 p-3">
                    <p className="text-[11px] uppercase tracking-[0.12em] text-white/50">Ticket ID</p>
                    <p className="truncate font-mono text-white">{modal.ticket_id}</p>
                  </div>
                )}
                {modal.expired_at && (
                  <div className="rounded-2xl border border-white/10 bg-black/30 p-3">
                    <p className="text-[11px] uppercase tracking-[0.12em] text-white/50">
                      {modal.reason === "entry_cutoff" ? "Límite ingreso" : "Expira"}
                    </p>
                    <p className="text-white">{new Date(modal.expired_at).toLocaleString()}</p>
                  </div>
                )}
                {modal.ticket_used && (
                  <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-3">
                    <p className="text-[11px] uppercase tracking-[0.12em] text-white/70">Estado</p>
                    <p className="text-sm font-semibold text-yellow-200">Este ticket ya fue usado</p>
                  </div>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => {
                    setModal(null);
                  }}
                  className="rounded-full border border-white/20 px-4 py-2 text-sm font-semibold text-white transition hover:border-white"
                >
                  Cerrar
                </button>
                {modal.result === "valid" && (
                  <button
                    disabled={confirming || modal.ticket_used}
                    onClick={async () => {
                      if (!modal?.code_id && !modal?.ticket_id) return;
                      setConfirming(true);
                      try {
                        const res = await authedFetch("/api/scan/confirm", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ code_id: modal.code_id, ticket_id: modal.ticket_id }),
                        });
                        const payload = await res.json().catch(() => null);
                        if (!res.ok || !payload?.success) {
                          const errMsg = payload?.error || "No se pudo confirmar";
                          throw new Error(errMsg);
                        }
                        const confirmedAt = new Date().toISOString();
                        setMessage("Ingreso validado");
                        setModal((prev) =>
                          prev
                            ? {
                                ...prev,
                                result: "confirmed",
                                ticket_used: typeof payload?.ticket_used === "boolean" ? payload.ticket_used : prev.ticket_used,
                                uses: payload?.uses ?? prev.uses,
                                max_uses: payload?.max_uses ?? prev.max_uses,
                                confirmed_at: confirmedAt,
                              }
                            : prev
                        );
                        setLastResult((prev) =>
                          prev
                            ? {
                                ...prev,
                                result: "confirmed",
                                uses: payload?.uses ?? prev.uses,
                                max_uses: payload?.max_uses ?? prev.max_uses,
                              }
                            : prev
                        );
                        setLogs((prev) => [
                          { ts: Date.now(), value: modal.value, result: "confirmed", color: "text-green-300" },
                          ...prev,
                        ].slice(0, 5));
                      } catch (err: any) {
                        const msg = err?.message || "Error al confirmar ingreso";
                        setMessage(msg);
                        setLogs((prev) => [
                          { ts: Date.now(), value: modal.value, result: "error", color: "text-red-300", details: msg },
                          ...prev,
                        ].slice(0, 5));
                      } finally {
                        setConfirming(false);
                      }
                    }}
                    className={primaryBtn}
                  >
                    {confirming ? "Confirmando..." : modal.ticket_used ? "Ya usado" : "Validar ingreso"}
                  </button>
                )}
                <button
                  onClick={() => {
                    setModal(null);
                    startScanner();
                  }}
                  className="rounded-full border border-white/20 px-4 py-2 text-sm font-semibold text-white transition hover:border-white"
                >
                  Volver a escanear
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function getResultTitle(result: string, reason?: string | null) {
  if (result === "expired" && reason === "entry_cutoff") return "Fuera de hora";
  switch (result) {
    case "valid":
      return "Código validado";
    case "confirmed":
      return "Ingreso confirmado";
    case "duplicate":
      return "Código ya usado";
    case "exhausted":
      return "Código sin cupos";
    case "expired":
      return "Código expirado";
    case "inactive":
      return "Código inactivo";
    case "invalid":
      return "Código no pertenece";
    case "not_found":
      return "Código no reconocido";
    default:
      return "Resultado del scan";
  }
}

function getResultHint(modal: {
  result: string;
  reason?: string | null;
  other_event?: { id: string; name: string | null } | null;
  ticket_used?: boolean;
}) {
  if (modal.result === "confirmed") return "Ingreso registrado correctamente.";
  if (modal.result === "valid") return "Puedes confirmar el ingreso.";
  if (modal.reason === "entry_cutoff") return "Superó la hora máxima de ingreso para este evento.";
  if (modal.result === "duplicate" || modal.ticket_used) return "Este QR ya fue validado anteriormente.";
  if (modal.result === "expired") return "El código está vencido.";
  if (modal.result === "inactive") return "El código está inactivo.";
  if (modal.result === "exhausted") return "El código alcanzó el máximo de usos.";
  if (modal.reason === "event_mismatch") {
    return `Pertenece a otro evento${modal.other_event?.name ? `: ${modal.other_event.name}` : ""}.`;
  }
  if (modal.result === "invalid") return "El QR no pertenece a este evento.";
  return "No se encontró en la base de datos.";
}

function getMatchLabel(match?: MatchType) {
  if (match === "code") return "Código";
  if (match === "ticket") return "QR ticket";
  return "No encontrado";
}

function getConfirmHint(modal: { max_uses?: number | null; uses?: number; ticket_used?: boolean }) {
  if (modal.ticket_used) return "Este QR ya no podrá volver a usarse.";
  if (typeof modal.max_uses === "number" && typeof modal.uses === "number") {
    if (modal.uses >= modal.max_uses) return "Este código ya no podrá volver a usarse.";
    return `Uso registrado. Quedan ${modal.max_uses - modal.uses} usos.`;
  }
  return "Este QR ya quedó marcado como usado.";
}

function getEventName(events: Option[], eventId: string) {
  const event = events.find((ev) => ev.id === eventId);
  return event?.name || "—";
}
