"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { BrowserMultiFormatReader } from "@zxing/browser";
import { DateTime } from "luxon";
import { getEntryCutoffDisplay } from "shared/entryLimit";
import { authedFetch } from "@/lib/authedFetch";
import { AdminHeader, AdminPage } from "@/components/admin/PageScaffold";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { SelectNative } from "@/components/ui/select-native";
import { LogoutButton } from "@/components/LogoutButton";

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
type QrKind =
  | "table"
  | "ticket_early"
  | "ticket_all_night"
  | "ticket_general"
  | "promoter"
  | "courtesy"
  | "unknown";

type PersonSummary = {
  full_name: string | null;
  dni: string | null;
  email: string | null;
  phone: string | null;
};

type ScanSummary = {
  value: string;
  result: ScanResult;
  uses?: number;
  max_uses?: number | null;
  code_id?: string | null;
  ticket_id?: string | null;
  code_type?: string | null;
  person?: PersonSummary | null;
  ticket_used?: boolean;
  match_type?: MatchType;
  reason?: string | null;
  other_event?: { id: string; name: string | null } | null;
  expired_at?: string | null;
  confirmed_at?: string | null;
  qr_kind?: QrKind | null;
  qr_kind_label?: string | null;
  reservation_id?: string | null;
  table_name?: string | null;
  product_name?: string | null;
  ticket_pricing_phase?: "early_bird" | "all_night" | null;
};

export default function ScanClient({ events, simpleMode = false }: { events: Option[]; simpleMode?: boolean }) {
  const [eventId, setEventId] = useState(events[0]?.id || "");
  const [manual, setManual] = useState("");
  const [scanning, setScanning] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logs, setLogs] = useState<ScanLog[]>([]);
  const [lastResult, setLastResult] = useState<ScanSummary | null>(null);
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
  const [modal, setModal] = useState<ScanSummary | null>(null);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    return () => stopScanner();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/branding", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled && data?.logo_url) {
          setLogoUrl(data.logo_url);
        }
      })
      .catch(() => null);
    return () => {
      cancelled = true;
    };
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
      setLogs((prev) => [{ ts: Date.now(), value, result, color }, ...prev].slice(0, 8));
      setMessage(`Resultado: ${result}`);
      const nextSummary: ScanSummary = {
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
        qr_kind: payload.qr_kind ?? null,
        qr_kind_label: payload.qr_kind_label ?? null,
        reservation_id: payload.reservation_id ?? null,
        table_name: payload.table_name ?? null,
        product_name: payload.product_name ?? null,
        ticket_pricing_phase: payload.ticket_pricing_phase ?? null,
      };
      setLastResult(nextSummary);
      setModal(nextSummary);
      stopScanner();
    } catch (err: any) {
      setMessage(err?.message || "Error al validar código");
      setLogs((prev) => [{ ts: Date.now(), value, result: "error", color: "text-red-300", details: err?.message }, ...prev].slice(0, 8));
      setLastResult(null);
      setModal(null);
    }
  }

  const showCameraFrame = scanning || ready;
  const cameraActiveHeightClass = simpleMode ? "h-[34vh] min-h-[190px] max-h-[280px] sm:h-[300px]" : "h-[52vh] min-h-[300px] sm:h-[360px]";
  const cameraIdleHeightClass = simpleMode ? "h-[104px] sm:h-[120px]" : "h-[220px] sm:h-[240px]";

  return (
    <AdminPage>
      {simpleMode ? (
        <div className="-mx-3 sticky top-0 z-40 mb-2 border-b border-[#222222] bg-black/90 px-3 py-2 backdrop-blur sm:-mx-5 sm:px-5 lg:-mx-8 lg:px-8">
          <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-2">
            <div className="flex h-10 min-w-[104px] items-center justify-center rounded-xl border border-[#2b2b2b] bg-[#0f0f0f] px-3">
              {logoUrl ? (
                <img src={logoUrl} alt="Baby Logo" className="h-6 w-auto object-contain" />
              ) : (
                <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/75">Baby</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="default" className="h-10 rounded-xl px-3 text-[11px] uppercase tracking-[0.12em]">
                Modo puerta
              </Badge>
              <LogoutButton className="h-10 min-w-[118px]" />
            </div>
          </div>
        </div>
      ) : null}

      <AdminHeader
        kicker="Control de ingreso"
        title="Escanear QR"
        description="Usa la cámara del celular para validar entradas en puerta."
      />

      <Card className={simpleMode ? "mb-2 rounded-2xl border-[#292929] bg-[#0c0c0c] shadow-[0_14px_44px_rgba(0,0,0,0.4)]" : "mb-4 rounded-3xl border-[#292929] bg-[#0c0c0c] shadow-[0_20px_70px_rgba(0,0,0,0.45)]"}>
        <CardContent className={simpleMode ? "grid gap-2 p-2.5 sm:p-3 md:grid-cols-2" : "grid gap-3 p-3 sm:p-4 md:grid-cols-2"}>
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-white">Evento</label>
            <SelectNative
              value={eventId}
              onChange={(e) => setEventId(e.target.value)}
              className="h-11 rounded-2xl border-[#292929] bg-black text-sm"
            >
              <option value="">Selecciona evento</option>
              {events.map((ev) => (
                <option key={ev.id} value={ev.id}>
                  {ev.name}
                </option>
              ))}
            </SelectNative>
            {entryLimitLabel && (
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="default" className="px-3 py-1 text-[11px] uppercase tracking-[0.12em]">
                  Límite ingreso: {entryLimitLabel}
                </Badge>
                {entryStatus && (
                  <Badge variant={entryStatus === "late" ? "danger" : "success"} className="px-3 py-1 text-[11px] uppercase tracking-[0.12em]">
                    {entryStatus === "late" ? "Fuera de hora" : "Dentro de hora"}
                  </Badge>
                )}
              </div>
            )}
          </div>

          {!simpleMode && (
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-white">Código manual</label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  value={manual}
                  onChange={(e) => setManual(e.target.value)}
                  placeholder="Pega o escribe el código"
                  className="h-11 rounded-2xl border-[#292929] bg-black"
                />
                <Button
                  type="button"
                  onClick={() => {
                    if (manual.trim()) {
                      handleScan(manual.trim());
                      setManual("");
                    }
                  }}
                  className="h-11 rounded-2xl px-5"
                >
                  Validar
                </Button>
              </div>
              {message && (
                <Badge
                  variant={message.toLowerCase().includes("error") ? "danger" : "default"}
                  className="w-full justify-center rounded-xl py-2 text-xs"
                >
                  {message}
                </Badge>
              )}
              {lastResult && (
                <div className="rounded-2xl border border-[#2b2b2b] bg-[#171717] p-3 text-sm text-white/80 shadow-[0_12px_32px_rgba(0,0,0,0.45)]">
                  <p className="text-xs uppercase tracking-[0.12em] text-white/50">Último resultado</p>
                  <div className="mt-1 flex items-center justify-between gap-2">
                    <span className="truncate font-mono text-[12px] text-white">{lastResult.value}</span>
                    <Badge variant={getResultBadgeVariant(lastResult.result)} className="px-3 py-1 text-[12px]">
                      {lastResult.result}
                    </Badge>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-white/70">
                    {lastResult.qr_kind_label && (
                      <div>
                        <p className="text-white/50">Tipo QR</p>
                        <p className="text-white">{lastResult.qr_kind_label}</p>
                      </div>
                    )}
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
        </CardContent>
      </Card>

      <Card className={simpleMode ? "mb-2 rounded-2xl border-[#292929] bg-[#0c0c0c] shadow-[0_14px_44px_rgba(0,0,0,0.4)]" : "mb-4 rounded-3xl border-[#292929] bg-[#0c0c0c] shadow-[0_20px_70px_rgba(0,0,0,0.45)]"}>
        <CardContent className={simpleMode ? "flex flex-wrap gap-2 p-2.5" : "flex flex-wrap gap-2 p-3"}>
          <Badge variant="default" className="rounded-lg px-3 py-1 text-[11px] uppercase tracking-[0.12em]">
            Reglas de hora
          </Badge>
          <Badge variant={entryStatus === "late" ? "danger" : "warning"} className="rounded-lg px-3 py-1 text-[11px]">
            General: {entryLimitLabel ? `hasta ${entryLimitLabel}` : "según evento"}{entryStatus ? ` (${entryStatus === "late" ? "fuera de hora" : "dentro de hora"})` : ""}
          </Badge>
          <Badge variant="success" className="rounded-lg px-3 py-1 text-[11px]">
            Mesa/Box: sin límite horario
          </Badge>
          <Badge variant="success" className="rounded-lg px-3 py-1 text-[11px]">
            EARLY y ALL NIGHT: sin límite horario
          </Badge>
          <Badge variant="success" className="rounded-lg px-3 py-1 text-[11px]">
            Promotor y Cortesía: sin límite horario
          </Badge>
        </CardContent>
      </Card>

      <div className={`grid ${simpleMode ? "gap-2" : "gap-4"} ${simpleMode ? "grid-cols-1" : "grid-cols-1 lg:grid-cols-[1.8fr,1fr]"}`}>
        <Card className={simpleMode ? "rounded-2xl border-[#292929] bg-[#0c0c0c] shadow-[0_14px_44px_rgba(0,0,0,0.4)]" : "rounded-3xl border-[#292929] bg-[#0c0c0c] shadow-[0_20px_70px_rgba(0,0,0,0.45)]"}>
          <CardHeader className={simpleMode ? "flex flex-row flex-wrap items-center justify-between gap-2 p-3 pb-2" : "flex flex-row flex-wrap items-center justify-between gap-2 pb-3"}>
            <CardTitle className="text-sm font-semibold">Cámara</CardTitle>
            <Button
              type="button"
              variant={scanning ? "outline" : "default"}
              size="lg"
              onClick={() => (scanning ? stopScanner() : startScanner())}
              className={`rounded-2xl ${simpleMode ? "h-10 w-full px-4" : "h-11 w-full px-6 sm:w-auto"}`}
            >
              {scanning ? "Detener" : "Iniciar escaneo"}
            </Button>
          </CardHeader>
          <CardContent className={simpleMode ? "px-3 pb-3 pt-0" : "pt-0"}>
            <div className={simpleMode ? "overflow-hidden rounded-xl border border-[#292929] bg-black" : "overflow-hidden rounded-2xl border border-[#292929] bg-black"}>
              {!showCameraFrame && (
                <div className={`flex items-center justify-center px-4 text-center text-sm text-white/60 ${cameraIdleHeightClass}`}>
                  Selecciona evento y pulsa “Iniciar escaneo”.
                </div>
              )}
              <video
                ref={videoRef}
                className={showCameraFrame ? `block w-full bg-black object-cover ${cameraActiveHeightClass}` : "hidden"}
                autoPlay
                muted
                playsInline
              />
            </div>
          </CardContent>
        </Card>

        {!simpleMode && (
          <Card className="rounded-3xl border-[#292929] bg-[#0c0c0c] shadow-[0_20px_70px_rgba(0,0,0,0.45)]">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">Últimos escaneos</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 pt-0 text-sm text-white/80">
              {logs.length === 0 && <p className="text-white/50">Sin lecturas aún.</p>}
              {logs.map((l) => (
                <div key={`${l.ts}-${l.value}`} className="rounded-2xl border border-[#292929] bg-[#171717] px-3 py-2">
                  <div className="flex items-center justify-between text-xs text-white/60">
                    <span>{new Date(l.ts).toLocaleTimeString()}</span>
                    <span className={l.color}>{l.result}</span>
                  </div>
                  <p className="truncate font-mono text-[12px] text-white">{l.value}</p>
                  {l.details && <p className="text-xs text-white/60">{l.details}</p>}
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>

      {modal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-black/70 p-2 sm:items-center sm:p-4">
          <Card className="w-full max-w-lg rounded-3xl border-[#2b2b2b] bg-[#0b0b0b] shadow-[0_20px_80px_rgba(0,0,0,0.65)] max-h-[92vh] overflow-y-auto">
            <CardHeader className="pb-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.15em] text-white/50">Resultado del scan</p>
                  <h3 className="text-xl font-semibold text-white">{getResultTitle(modal.result, modal.reason)}</h3>
                  <p className="text-sm text-white/60">{getResultHint(modal)}</p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setModal(null);
                    setLastResult(null);
                  }}
                  className="self-start rounded-xl"
                >
                  Cerrar
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 pt-0 text-sm text-white/80">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate font-mono text-[12px] text-white">{modal.value}</span>
                <Badge variant={getResultBadgeVariant(modal.result)} className="px-3 py-1 text-[12px]">
                  {modal.result}
                </Badge>
              </div>

              {modal.result === "confirmed" && (
                <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-100">
                  Ingreso registrado. {getConfirmHint(modal)}
                </div>
              )}

              <div className="rounded-2xl border border-[#292929] bg-[#171717] p-3 text-sm text-white/80">
                <p className="text-[11px] uppercase tracking-[0.12em] text-white/50">Detalle del scan</p>
                <div className="mt-2 grid gap-2 text-[13px] text-white">
                  <div className="text-white/80">Evento: {getEventName(events, eventId)}</div>
                  <div className="text-white/80">Tipo QR: {getQrKindLabel(modal.qr_kind, modal.qr_kind_label)}</div>
                  <div className="text-white/80">Origen lectura: {getMatchLabel(modal.match_type)}</div>
                  {modal.ticket_pricing_phase && (
                    <div className="text-white/80">Fase comercial: {modal.ticket_pricing_phase === "early_bird" ? "EARLY" : "ALL NIGHT"}</div>
                  )}
                  {modal.table_name && <div className="text-white/80">Mesa: {modal.table_name}</div>}
                  {modal.product_name && <div className="text-white/80">Pack: {modal.product_name}</div>}
                  {modal.other_event?.name && <div className="text-white/80">Otro evento: {modal.other_event.name}</div>}
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
                <div className="rounded-2xl border border-[#292929] bg-[#171717] p-3 text-sm text-white/80">
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
                  <div className="rounded-2xl border border-[#292929] bg-[#171717] p-3">
                    <p className="text-[11px] uppercase tracking-[0.12em] text-white/50">Usos</p>
                    <p className="text-white">
                      {modal.uses}/{modal.max_uses ?? "∞"}
                    </p>
                  </div>
                )}
                {modal.expired_at && (
                  <div className="rounded-2xl border border-[#292929] bg-[#171717] p-3">
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

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setModal(null);
                  }}
                  className="h-11 rounded-xl"
                >
                  Cerrar
                </Button>
                {modal.result === "valid" && (
                  <Button
                    type="button"
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
                        ].slice(0, 8));
                      } catch (err: any) {
                        const msg = err?.message || "Error al confirmar ingreso";
                        setMessage(msg);
                        setLogs((prev) => [
                          { ts: Date.now(), value: modal.value, result: "error", color: "text-red-300", details: msg },
                          ...prev,
                        ].slice(0, 8));
                      } finally {
                        setConfirming(false);
                      }
                    }}
                    className="h-11 rounded-xl"
                  >
                    {confirming ? "Confirmando..." : modal.ticket_used ? "Ya usado" : "Validar ingreso"}
                  </Button>
                )}
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setModal(null);
                    startScanner();
                  }}
                  className="h-11 rounded-xl"
                >
                  Volver a escanear
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </AdminPage>
  );
}

function getResultBadgeVariant(result: ScanResult): "success" | "warning" | "danger" {
  if (result === "valid" || result === "confirmed") return "success";
  if (result === "duplicate" || result === "exhausted") return "warning";
  return "danger";
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
  qr_kind?: QrKind | null;
}) {
  const qrLabel = getQrKindLabel(modal.qr_kind);
  if (modal.result === "confirmed") return `${qrLabel} registrado correctamente.`;
  if (modal.result === "valid") return `${qrLabel} válido. Puedes confirmar el ingreso.`;
  if (modal.reason === "entry_cutoff") return "Superó la hora máxima de ingreso para este evento.";
  if (modal.result === "duplicate" || modal.ticket_used) return `${qrLabel} ya fue validado anteriormente.`;
  if (modal.result === "expired") return "El código está vencido.";
  if (modal.result === "inactive") return "El código está inactivo.";
  if (modal.result === "exhausted") return "El código alcanzó el máximo de usos.";
  if (modal.reason === "event_mismatch") {
    return `Pertenece a otro evento${modal.other_event?.name ? `: ${modal.other_event.name}` : ""}.`;
  }
  if (modal.result === "invalid") return "El QR no pertenece a este evento.";
  return "No se encontró en la base de datos.";
}

function getQrKindLabel(kind?: QrKind | null, backendLabel?: string | null) {
  if (backendLabel) return backendLabel;
  switch (kind) {
    case "table":
      return "QR de mesa";
    case "ticket_early":
      return "QR EARLY";
    case "ticket_all_night":
      return "QR ALL NIGHT";
    case "ticket_general":
      return "QR entrada general";
    case "promoter":
      return "QR promotor";
    case "courtesy":
      return "QR cortesía";
    default:
      return "QR";
  }
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
