"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@repo/ui";
import { X, Download, Mail, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type TicketDetail = {
  id: string;
  created_at: string;
  dni: string | null;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  qr_token: string | null;
  event_name: string | null;
  code_value: string | null;
  promoter_name: string | null;
  table_codes?: string[];
  table_name?: string | null;
  product_name?: string | null;
  product_items?: string[] | null;
};

export default function TicketDetailModal({
  ticketId,
  open,
  onOpenChange,
}: {
  ticketId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [ticket, setTicket] = useState<TicketDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [showEmailInput, setShowEmailInput] = useState(false);
  const [customEmail, setCustomEmail] = useState("");
  const [emailSuccess, setEmailSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (open && ticketId) {
      setLoading(true);
      setError(null);
      setEmailSuccess(null);
      setShowEmailInput(false);
      setCustomEmail("");
      
      fetch(`/api/tickets/${ticketId}`)
        .then((res) => {
          if (!res.ok) throw new Error("Error al cargar el ticket");
          return res.json();
        })
        .then((data) => {
          setTicket(data.ticket);
          setCustomEmail(data.ticket.email || "");
          setLoading(false);
        })
        .catch((err) => {
          setError(err.message);
          setLoading(false);
        });
    }
  }, [open, ticketId]);

  const handleDownloadPDF = () => {
    if (!ticket) return;
    // En desarrollo, landing corre en puerto 3001, backoffice en 3000
    // En producción, usar el dominio de producción
    const landingUrl = typeof window !== 'undefined' && window.location.hostname === 'localhost'
      ? 'http://localhost:3001'
      : 'https://babyclubaccess.com';
    // El parámetro ?download=1 activará la descarga automática en la página del ticket
    window.open(`${landingUrl}/ticket/${encodeURIComponent(ticket.id)}?download=1`, '_blank');
  };

  const handleSendEmail = async (email: string) => {
    if (!ticket || !email) return;
    
    setSending(true);
    setEmailSuccess(null);
    setError(null);

    try {
      const res = await fetch("/api/tickets/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          ticketId: ticket.id,
          email: email 
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Error al enviar el email");
      }

      setEmailSuccess(`Email enviado exitosamente a ${email}`);
      setTimeout(() => setEmailSuccess(null), 5000);
      setShowEmailInput(false);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange} className="max-w-4xl">
      <DialogHeader className="bg-neutral-800/30 border-b border-neutral-700/50 backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <DialogTitle className="text-xl font-bold bg-gradient-to-r from-white via-neutral-200 to-neutral-400 bg-clip-text text-transparent">
              Detalle del ticket
            </DialogTitle>
          </div>
          <Button
            onClick={() => onOpenChange(false)}
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-neutral-400 hover:bg-neutral-700/50 hover:text-neutral-200"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>
      </DialogHeader>

      <DialogContent className="max-h-[70vh] overflow-y-auto bg-neutral-800/20">
        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-neutral-600 border-t-rose-500"></div>
          </div>
        )}

        {error && (
          <div className="rounded-lg bg-red-500/20 border border-red-500/30 p-4 text-sm text-red-400">
            ⚠️ {error}
          </div>
        )}

        {emailSuccess && (
          <div className="rounded-lg bg-green-500/20 border border-green-500/30 p-4 text-sm text-green-400">
            ✅ {emailSuccess}
          </div>
        )}

        {ticket && !loading && (
          <div className="grid gap-6 lg:grid-cols-[280px,1fr]">
            {/* QR Code */}
            <div className="flex items-center justify-center rounded-xl border border-neutral-600/50 bg-neutral-900/50 p-4">
              {ticket.qr_token ? (
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(ticket.qr_token)}`}
                  alt="QR"
                  className="h-56 w-56 max-w-full rounded-lg bg-white p-3 object-contain shadow-lg"
                />
              ) : (
                <p className="text-sm text-neutral-500">Sin QR</p>
              )}
            </div>

            {/* Información del ticket */}
            <dl className="grid min-w-0 gap-4 text-sm md:grid-cols-2">
              <Info label="ID" value={ticket.id} mono />
              <Info
                label="Fecha de creación"
                value={new Date(ticket.created_at).toLocaleString("es-PE", {
                  day: "2-digit",
                  month: "2-digit",
                  year: "2-digit",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              />
              <Info label="DNI" value={ticket.dni || "—"} />
              <Info label="Nombre completo" value={ticket.full_name || "—"} />
              <Info label="Email" value={ticket.email || "—"} />
              <Info label="Teléfono" value={ticket.phone || "—"} />
              <Info label="Evento" value={ticket.event_name || "—"} />
              <Info label="Código" value={ticket.code_value || "—"} />
              <Info label="Promotor" value={ticket.promoter_name || "—"} />
              <Info label="QR token" value={ticket.qr_token || "—"} mono />

              {ticket.table_name && <Info label="Mesa" value={ticket.table_name} />}

              {ticket.product_name && (
                <div className="md:col-span-2 space-y-2 rounded-lg bg-neutral-700/30 border border-neutral-600/30 p-4">
                  <p className="text-xs uppercase tracking-wider text-neutral-400">📦 Pack</p>
                  <p className="text-base font-semibold text-neutral-100">{ticket.product_name}</p>
                  {ticket.product_items && ticket.product_items.length > 0 && (
                    <ul className="list-disc pl-5 text-sm text-neutral-300 space-y-1">
                      {ticket.product_items.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {ticket.table_codes && ticket.table_codes.length > 0 && (
                <div className="md:col-span-2 space-y-2 rounded-lg bg-neutral-700/30 border border-neutral-600/30 p-4">
                  <p className="text-xs uppercase tracking-wider text-neutral-400">🔖 Códigos de mesa</p>
                  <div className="flex flex-wrap gap-2">
                    {ticket.table_codes.map((c) => (
                      <span
                        key={c}
                        className="rounded-lg bg-neutral-600/50 border border-neutral-500/30 px-3 py-1.5 text-xs font-semibold text-neutral-200"
                      >
                        {c}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </dl>
          </div>
        )}
      </DialogContent>

      {ticket && !loading && (
        <DialogFooter className="bg-neutral-800/30 border-t border-neutral-700/50 backdrop-blur-sm">
          <div className="flex flex-col gap-3 w-full">
            {/* Botones de acción principales */}
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                onClick={handleDownloadPDF}
                className="bg-gradient-to-r from-neutral-500 to-neutral-600 text-sm font-semibold text-white shadow-lg transition-all hover:from-neutral-400 hover:to-neutral-500 hover:shadow-xl hover:scale-105"
              >
                <Download className="h-4 w-4" />
                Ver/Descargar Ticket
              </Button>

              {ticket.email && !showEmailInput && (
                <Button
                  onClick={() => handleSendEmail(ticket.email!)}
                  disabled={sending}
                  className="bg-gradient-to-r from-green-500 to-green-600 text-sm font-semibold text-white shadow-lg transition-all hover:from-green-400 hover:to-green-500 hover:shadow-xl hover:scale-105 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {sending ? (
                    <>
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                      Enviando...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4" />
                      Enviar al cliente
                    </>
                  )}
                </Button>
              )}

              <Button
                onClick={() => setShowEmailInput(!showEmailInput)}
                variant="outline"
                className="border-neutral-600 text-sm font-semibold text-neutral-200 hover:border-neutral-500 hover:bg-neutral-800"
              >
                <Mail className="h-4 w-4" />
                {showEmailInput ? "Cancelar" : "Enviar a otro email"}
              </Button>
            </div>

            {/* Input de email personalizado */}
            {showEmailInput && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-neutral-700/30 border border-neutral-600/30">
                <Input
                  type="email"
                  value={customEmail}
                  onChange={(e) => setCustomEmail(e.target.value)}
                  placeholder="correo@ejemplo.com"
                  className="h-10 flex-1 border-neutral-600 bg-neutral-800/50 text-sm text-neutral-200 placeholder:text-neutral-400 focus:border-green-500/50 focus:ring-2 focus:ring-green-500/50"
                />
                <Button
                  onClick={() => handleSendEmail(customEmail)}
                  disabled={sending || !customEmail}
                  className="bg-gradient-to-r from-green-500 to-green-600 text-sm font-semibold text-white transition-all hover:from-green-400 hover:to-green-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {sending ? (
                    <>
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                      Enviando...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4" />
                      Enviar
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>
        </DialogFooter>
      )}
    </Dialog>
  );
}

function Info({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="space-y-1 min-w-0 break-words">
      <p className="text-xs uppercase tracking-wider text-neutral-400">{label}</p>
      <p className={`text-base font-semibold text-neutral-100 break-words ${mono ? "font-mono break-all text-xs" : ""}`}>
        {value}
      </p>
    </div>
  );
}
