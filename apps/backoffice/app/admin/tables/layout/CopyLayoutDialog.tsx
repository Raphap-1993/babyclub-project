"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { SelectNative } from "@/components/ui/select-native";
import { Copy, Loader2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type PreviousEvent = {
  id: string;
  name: string;
  tables_count: number;
};

interface CopyLayoutDialogProps {
  onCopyLayout: (fromEventId: string) => Promise<void>;
  eventId?: string | null;
}

export function CopyLayoutDialog({ onCopyLayout, eventId }: CopyLayoutDialogProps) {
  const [showCopy, setShowCopy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [events, setEvents] = useState<PreviousEvent[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const handleOpenCopy = async () => {
    try {
      setError(null);
      setMessage(null);
      setLoading(true);
      // Fetch closed events with their table layouts
      const res = await fetch(`/api/events/previous-layouts`);
      if (!res.ok) throw new Error("No se pudieron cargar eventos anteriores");
      const data = await res.json();
      setEvents(data.events || []);
      setShowCopy(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyLayout = async () => {
    if (!selectedEventId) {
      setError("Selecciona un evento");
      return;
    }
    try {
      setError(null);
      setMessage(null);
      setLoading(true);
      await onCopyLayout(selectedEventId);
      setMessage("Layout copiado exitosamente");
      setShowCopy(false);
      setSelectedEventId("");
    } catch (err: any) {
      setError(err.message || "Error al copiar layout");
    } finally {
      setLoading(false);
    }
  };

  if (showCopy) {
    return (
      <Card className="border-[#2b2b2b] bg-[#111111]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Copy className="h-4 w-4" />
            Copiar Layout de Evento Anterior
          </CardTitle>
          <CardDescription>
            Reutiliza las posiciones de mesas de un evento anterior
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <div className="rounded-md bg-[#a60c2f]/10 p-3 text-sm text-[#fca5a5]">
              {error}
            </div>
          )}
          {message && (
            <div className="rounded-md bg-[#51cf66]/10 p-3 text-sm text-[#51cf66]">
              {message}
            </div>
          )}

          {events.length === 0 && !loading && (
            <div className="text-sm text-white/50 text-center py-4">
              No hay eventos anteriores con layouts guardados
            </div>
          )}

          {events.length > 0 && (
            <SelectNative
              value={selectedEventId}
              onChange={(e) => setSelectedEventId(e.target.value)}
              className="w-full"
            >
              <option value="">-- Selecciona un evento --</option>
              {events.map((evt) => (
                <option key={evt.id} value={evt.id}>
                  {evt.name} ({evt.tables_count} mesas)
                </option>
              ))}
            </SelectNative>
          )}

          <div className="flex gap-2 justify-end pt-2">
            <Button
              variant="outline"
              onClick={() => {
                setShowCopy(false);
                setSelectedEventId("");
              }}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleCopyLayout}
              disabled={loading || !selectedEventId || events.length === 0}
            >
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Copiar Layout
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleOpenCopy}
      disabled={loading}
    >
      <Copy className="h-4 w-4 mr-2" />
      Copiar Layout
    </Button>
  );
}
