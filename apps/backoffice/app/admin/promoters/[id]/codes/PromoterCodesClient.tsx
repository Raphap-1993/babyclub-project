"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Copy, ExternalLink, Sparkles, TicketPlus } from "lucide-react";
import { supabaseClient } from "@/lib/supabaseClient";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { SelectNative } from "@/components/ui/select-native";
import { cn } from "@/lib/utils";

type PromoterData = {
  id: string;
  code: string | null;
  is_active: boolean | null;
  person: {
    first_name: string | null;
    last_name: string | null;
    email: string | null;
    dni: string | null;
  } | null;
};

type EventOption = {
  id: string;
  name: string;
  starts_at: string | null;
  event_prefix: string | null;
};

type BatchItem = {
  id: string;
  event_id: string;
  created_at: string;
  quantity: number;
  prefix: string | null;
  expires_at: string | null;
  is_active: boolean | null;
  event_name: string | null;
  latest_code: string | null;
  preview_codes: string[];
};

type GeneratedBatch = {
  batchId: string;
  codes: string[];
  prefix: string | null;
  eventId: string;
};

const MAX_QUANTITY = 500;

async function getAuthHeaders(): Promise<Record<string, string>> {
  if (!supabaseClient) return {};
  const { data } = await supabaseClient.auth.getSession();
  const token = data?.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function cleanToken(input: string, max = 12): string {
  const sanitized = input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return sanitized.slice(0, max);
}

function formatDate(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("es-PE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

async function copyText(text: string) {
  if (navigator?.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
  }
}

export default function PromoterCodesClient({
  promoter,
  events,
  recentBatches,
}: {
  promoter: PromoterData;
  events: EventOption[];
  recentBatches: BatchItem[];
}) {
  const [eventId, setEventId] = useState(events[0]?.id ?? "");
  const [quantity, setQuantity] = useState(20);
  const [maxUses, setMaxUses] = useState(1);
  const [prefix, setPrefix] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generated, setGenerated] = useState<GeneratedBatch | null>(null);
  const [batches, setBatches] = useState<BatchItem[]>(recentBatches);

  const promoterName = useMemo(() => {
    const person = promoter.person;
    const fullName = [person?.first_name, person?.last_name].filter(Boolean).join(" ").trim();
    return fullName || promoter.code || `Promotor ${promoter.id.slice(0, 8)}`;
  }, [promoter.code, promoter.id, promoter.person]);

  const selectedEvent = useMemo(
    () => events.find((event) => event.id === eventId) || null,
    [eventId, events],
  );

  const suggestedPrefix = useMemo(() => {
    const eventToken = cleanToken(selectedEvent?.event_prefix || selectedEvent?.name || "", 10);
    const promoterToken = cleanToken(promoter.code || promoterName, 12);
    const merged = [eventToken, promoterToken].filter(Boolean).join("-");
    return merged || "courtesy";
  }, [promoter.code, promoterName, selectedEvent?.event_prefix, selectedEvent?.name]);

  const effectivePrefix = prefix.trim() || suggestedPrefix;

  async function handleGenerate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!eventId) {
      setError("Selecciona un evento.");
      return;
    }
    if (!Number.isFinite(quantity) || quantity < 1 || quantity > MAX_QUANTITY) {
      setError(`La cantidad debe estar entre 1 y ${MAX_QUANTITY}.`);
      return;
    }
    if (!Number.isFinite(maxUses) || maxUses < 1 || maxUses > 50) {
      setError("max_uses debe estar entre 1 y 50.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/promoters/generate-codes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(await getAuthHeaders()),
        },
        body: JSON.stringify({
          promoter_id: promoter.id,
          event_id: eventId,
          quantity,
          max_uses: maxUses,
          prefix: prefix.trim() || null,
          notes: notes.trim() || null,
          expires_at: null,
        }),
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error || "No se pudo generar el lote de códigos");
      }

      const newBatchId = payload.batch_id as string;
      const generatedCodes = (payload.codes || []) as string[];
      const generatedPrefix = (payload.prefix || null) as string | null;
      const eventName = selectedEvent?.name || null;

      setGenerated({
        batchId: newBatchId,
        codes: generatedCodes,
        prefix: generatedPrefix,
        eventId,
      });

      setBatches((prev) => [
        {
          id: newBatchId,
          event_id: eventId,
          created_at: new Date().toISOString(),
          quantity: generatedCodes.length,
          prefix: generatedPrefix,
          expires_at: null,
          is_active: true,
          event_name: eventName,
          latest_code: generatedCodes[0] || null,
          preview_codes: generatedCodes.slice(0, 5),
        },
        ...prev.filter((item) => item.id !== newBatchId),
      ]);
    } catch (err: any) {
      setError(err?.message || "Error inesperado al generar códigos");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card className="border-[#252525] bg-[#121212]">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Promotor</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Info label="Nombre" value={promoterName} />
          <Info label="Código" value={promoter.code || "—"} />
          <Info label="DNI" value={promoter.person?.dni || "—"} />
          <div className="space-y-1">
            <p className="text-[11px] uppercase tracking-[0.12em] text-white/55">Estado</p>
            <Badge variant={promoter.is_active ? "success" : "default"}>
              {promoter.is_active ? "Activo" : "Inactivo"}
            </Badge>
          </div>
        </CardContent>
      </Card>

      <Card className="border-[#252525]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <TicketPlus className="h-4 w-4 text-rose-300" />
            Generar lote de cortesía
          </CardTitle>
          <CardDescription>
            Códigos friendly con prefijo legible por evento y promotor. Ejemplo:{" "}
            <span className="font-mono text-white/80">{effectivePrefix}-ab12cd</span>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleGenerate} className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <label className="space-y-1.5">
                <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/55">Evento</span>
                <SelectNative value={eventId} onChange={(e) => setEventId(e.target.value)}>
                  <option value="">Selecciona evento</option>
                  {events.map((event) => (
                    <option key={event.id} value={event.id}>
                      {event.name}
                    </option>
                  ))}
                </SelectNative>
              </label>

              <label className="space-y-1.5">
                <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/55">Cantidad</span>
                <Input
                  type="number"
                  min={1}
                  max={MAX_QUANTITY}
                  value={quantity}
                  onChange={(e) => setQuantity(Number(e.target.value))}
                />
              </label>

              <label className="space-y-1.5">
                <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/55">Max usos</span>
                <Input
                  type="number"
                  min={1}
                  max={50}
                  value={maxUses}
                  onChange={(e) => setMaxUses(Number(e.target.value))}
                />
              </label>

              <label className="space-y-1.5">
                <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/55">Prefijo</span>
                <Input
                  value={prefix}
                  onChange={(e) => setPrefix(e.target.value)}
                  placeholder={suggestedPrefix}
                />
              </label>
            </div>

            <label className="block space-y-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/55">Notas internas</span>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Opcional, para control operativo"
                className="w-full rounded-lg border border-[#2b2b2b] bg-[#151515] px-3 py-2 text-sm text-white placeholder:text-white/35 outline-none transition focus:border-[#a60c2f]/50"
              />
            </label>

            <div className="flex flex-wrap items-center gap-2">
              <Button type="submit" disabled={loading}>
                {loading ? "Generando..." : "Generar códigos"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setPrefix(suggestedPrefix);
                }}
              >
                <Sparkles className="h-4 w-4" />
                Usar prefijo sugerido
              </Button>
            </div>

            {error ? <p className="text-sm text-red-300">{error}</p> : null}
          </form>
        </CardContent>
      </Card>

      {generated ? (
        <Card className="border-[#252525] bg-[#101315]">
          <CardHeader>
            <CardTitle className="text-base">Lote generado</CardTitle>
            <CardDescription className="font-mono">
              batch: {generated.batchId}
              {generated.prefix ? ` · prefijo: ${generated.prefix}` : ""}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => copyText(generated.codes.join("\n"))}
              >
                <Copy className="h-4 w-4" />
                Copiar códigos
              </Button>
              <Link
                href={`/admin/codes?event_id=${generated.eventId}&batch_id=${generated.batchId}`}
                className={cn(buttonVariants({ variant: "outline" }))}
              >
                <ExternalLink className="h-4 w-4" />
                Abrir en Códigos
              </Link>
            </div>

            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {generated.codes.map((code) => (
                <div
                  key={code}
                  className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 font-mono text-sm text-white/90"
                >
                  {code}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card className="border-[#252525]">
        <CardHeader>
          <CardTitle className="text-base">Lotes recientes</CardTitle>
          <CardDescription>Historial de generación para este promotor.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {batches.length === 0 ? (
            <p className="text-sm text-white/60">Aún no hay lotes generados.</p>
          ) : (
            batches.map((batch) => (
              <div
                key={batch.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-white/10 bg-black/20 px-3 py-2"
              >
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-white">
                    {batch.event_name || "Evento"} · {batch.quantity} códigos
                  </p>
                  <p className="font-mono text-xs text-white/65">
                    {batch.id}
                    {batch.prefix ? ` · ${batch.prefix}` : ""}
                  </p>
                  {batch.latest_code ? (
                    <p className="font-mono text-sm text-emerald-200">
                      {batch.latest_code}
                    </p>
                  ) : null}
                  {batch.preview_codes.length > 1 ? (
                    <div className="flex flex-wrap gap-1.5 pt-0.5">
                      {batch.preview_codes.slice(1, 4).map((code) => (
                        <span
                          key={code}
                          className="rounded border border-white/10 bg-black/30 px-1.5 py-0.5 font-mono text-[11px] text-white/70"
                        >
                          {code}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
                <div className="flex items-center gap-2 text-xs text-white/65">
                  <span>{formatDate(batch.created_at)}</span>
                  <Badge variant={batch.is_active ? "success" : "default"}>
                    {batch.is_active ? "Activo" : "Inactivo"}
                  </Badge>
                  {batch.latest_code ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => copyText(batch.latest_code || "")}
                    >
                      <Copy className="h-3.5 w-3.5" />
                      Copiar
                    </Button>
                  ) : null}
                  <Link
                    href={`/admin/codes?event_id=${batch.event_id}&batch_id=${batch.id}`}
                    className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
                  >
                    Ver
                  </Link>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <p className="text-[11px] uppercase tracking-[0.12em] text-white/55">{label}</p>
      <p className="text-sm font-semibold text-white">{value}</p>
    </div>
  );
}
