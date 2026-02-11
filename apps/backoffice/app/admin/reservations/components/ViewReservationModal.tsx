"use client";

import { useState, useEffect } from "react";
import { X, Calendar, MapPin, Ticket, FileText, User, Mail, Phone, CreditCard, Check, Clock, XCircle, Send, Trash2 } from "lucide-react";
import { formatLimaFromDb } from "shared/limaTime";
import { authedFetch } from "@/lib/authedFetch";

interface ReservationDetail {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  doc_type?: string | null;
  document?: string | null;
  voucher_url: string | null;
  status: string;
  codes: string[] | null;
  friendly_code?: string | null; // ✅ Código amigable de reserva
  created_at: string;
  table_name: string;
  event_name: string;
  event_starts_at: string | null;
  event_location: string | null;
  ticket_quantity?: number | null;
}

interface ViewReservationModalProps {
  reservationId: string;
  isOpen: boolean;
  onClose: () => void;
  onUpdate?: () => void;
}

const statusConfig: Record<string, { label: string; icon: any; color: string }> = {
  pending: { label: "Pendiente", icon: Clock, color: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20" },
  approved: { label: "Aprobada", icon: Check, color: "bg-green-500/10 text-green-400 border-green-500/20" },
  rejected: { label: "Rechazada", icon: XCircle, color: "bg-red-500/10 text-red-400 border-red-500/20" },
  confirmed: { label: "Confirmada", icon: Check, color: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
};

export default function ViewReservationModal({ reservationId, isOpen, onClose, onUpdate }: ViewReservationModalProps) {
  const [reservation, setReservation] = useState<ReservationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    if (!isOpen || !reservationId) return;

    const fetchReservation = async () => {
      setLoading(true);
      setError(null);

      try {
        const res = await authedFetch(`/api/admin/reservations/${reservationId}`);
        if (!res.ok) throw new Error("No se pudo cargar la reserva");
        
        const data = await res.json();
        setReservation(data.reservation);
      } catch (err: any) {
        setError(err.message || "Error al cargar reserva");
      } finally {
        setLoading(false);
      }
    };

    fetchReservation();
  }, [isOpen, reservationId]);

  const handleResendEmail = async () => {
    if (!reservation || actionLoading) return;
    
    if (!confirm("¿Reenviar correo de confirmación?")) return;
    
    setActionLoading(true);
    try {
      const res = await authedFetch(`/api/admin/reservations/${reservationId}/resend`, { 
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      
      if (res.ok) {
        alert("✅ Correo reenviado exitosamente");
      } else {
        const data = await res.json();
        alert(`❌ Error: ${data.error || "No se pudo reenviar el correo"}`);
      }
    } catch (err: any) {
      alert(`❌ Error: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancelReservation = async () => {
    if (!reservation || actionLoading) return;
    
    if (!confirm("⚠️ ¿Estás seguro de anular esta reserva? Se invalidarán sus códigos/tickets y se notificará por correo.")) return;
    
    setActionLoading(true);
    try {
      const res = await authedFetch(`/api/reservations/update`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: reservationId, status: "rejected" }),
      });
      const data = await res.json().catch(() => ({} as any));
      
      if (res.ok && data?.success) {
        if (data?.emailError) {
          alert(`✅ Reserva anulada, pero hubo un problema al enviar el correo: ${data.emailError}`);
        } else if (data?.emailSent) {
          alert("✅ Reserva anulada y correo de notificación enviado");
        } else {
          alert("✅ Reserva anulada");
        }
        onUpdate?.();
        onClose();
      } else {
        alert(`❌ Error: ${data?.error || "No se pudo anular la reserva"}`);
      }
    } catch (err: any) {
      alert(`❌ Error: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  
  if (!isOpen) return null;

  const status = reservation?.status || "pending";
  const config = statusConfig[status] || statusConfig.pending;
  const StatusIcon = config.icon;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-3xl max-h-[90vh] overflow-y-auto bg-slate-900 rounded-2xl border border-slate-700/50 shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between p-6 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border-b border-slate-700/50">
          <div>
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Reserva</div>
            <h2 className="text-xl font-bold text-slate-100">Detalle de reserva</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-slate-700/50 text-slate-400 hover:text-slate-200 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-rose-500"></div>
            </div>
          )}

          {error && (
            <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-4 text-red-400 text-sm">
              {error}
            </div>
          )}

          {!loading && !error && reservation && (
            <>
              {/* Status Badge */}
              <div className="flex items-center justify-between gap-2">
                <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border ${config.color} text-sm font-medium`}>
                  <StatusIcon className="h-4 w-4" />
                  {config.label}
                </div>
                {reservation.friendly_code && (
                  <div className="bg-rose-500/10 border border-rose-500/30 rounded-lg px-4 py-2">
                    <div className="text-xs text-rose-300/70 uppercase tracking-wider mb-0.5">Código de Reserva</div>
                    <div className="text-base font-bold text-rose-200 font-mono">{reservation.friendly_code}</div>
                  </div>
                )}
              </div>

              {/* Grid Layout */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Left Column */}
                <div className="space-y-4">
                  {/* Cliente */}
                  <div className="bg-slate-800/40 rounded-lg p-4 border border-slate-700/50">
                    <div className="flex items-center gap-2 mb-3">
                      <User className="h-4 w-4 text-rose-400" />
                      <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wide">Cliente</h3>
                    </div>
                    <div className="space-y-2">
                      <div>
                        <div className="text-xs text-slate-500 mb-0.5">Nombres</div>
                        <div className="text-base font-medium text-slate-100">{reservation.full_name}</div>
                      </div>
                      
                      {reservation.document && (
                        <div>
                          <div className="text-xs text-slate-500 mb-0.5">Documento</div>
                          <div className="text-sm text-slate-200 font-mono">
                            {(reservation.doc_type || "DNI").toUpperCase()} • {reservation.document}
                          </div>
                        </div>
                      )}
                      
                      {reservation.email && (
                        <div className="flex items-center gap-2 text-sm text-slate-300">
                          <Mail className="h-3.5 w-3.5 text-slate-400" />
                          {reservation.email}
                        </div>
                      )}
                      
                      {reservation.phone && (
                        <div className="flex items-center gap-2 text-sm text-slate-300">
                          <Phone className="h-3.5 w-3.5 text-slate-400" />
                          {reservation.phone}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Evento */}
                  <div className="bg-slate-800/40 rounded-lg p-4 border border-slate-700/50">
                    <div className="flex items-center gap-2 mb-3">
                      <Calendar className="h-4 w-4 text-blue-400" />
                      <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wide">Evento</h3>
                    </div>
                    <div className="space-y-2">
                      <div className="text-base font-medium text-slate-100">{reservation.event_name}</div>
                      {reservation.event_starts_at && (
                        <div className="text-sm text-slate-400">
                          {formatLimaFromDb(reservation.event_starts_at)}
                        </div>
                      )}
                      {reservation.event_location && (
                        <div className="flex items-center gap-2 text-sm text-slate-400">
                          <MapPin className="h-3.5 w-3.5" />
                          {reservation.event_location}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right Column */}
                <div className="space-y-4">
                  {/* Mesa y Entradas */}
                  <div className="bg-slate-800/40 rounded-lg p-4 border border-slate-700/50">
                    <div className="flex items-center gap-2 mb-3">
                      <Ticket className="h-4 w-4 text-purple-400" />
                      <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wide">Mesa</h3>
                    </div>
                    <div className="space-y-2">
                      <div className="text-base font-medium text-slate-100">{reservation.table_name}</div>
                      {(reservation.ticket_quantity ?? reservation.codes?.length) && (
                        <div className="text-sm text-slate-400">
                          Entradas: {reservation.ticket_quantity ?? reservation.codes?.length}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Voucher */}
                  {reservation.voucher_url && (
                    <div className="bg-slate-800/40 rounded-lg p-4 border border-slate-700/50">
                      <div className="flex items-center gap-2 mb-3">
                        <FileText className="h-4 w-4 text-green-400" />
                        <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wide">Voucher</h3>
                      </div>
                      <a
                        href={reservation.voucher_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block rounded-lg overflow-hidden border border-slate-600/50 hover:border-rose-500/30 transition-colors"
                      >
                        <img
                          src={reservation.voucher_url}
                          alt="Voucher"
                          className="w-full h-auto object-contain bg-slate-950"
                        />
                      </a>
                    </div>
                  )}

                  {/* Metadata */}
                  <div className="bg-slate-800/40 rounded-lg p-4 border border-slate-700/50">
                    <div className="flex items-center gap-2 mb-3">
                      <Clock className="h-4 w-4 text-slate-400" />
                      <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wide">Creada</h3>
                    </div>
                    <div className="text-sm text-slate-400">
                      {formatLimaFromDb(reservation.created_at)}
                    </div>
                  </div>
                </div>
              </div>

              {/* Códigos generados */}
              {reservation.codes && reservation.codes.length > 0 && (
                <div className="bg-slate-800/40 rounded-lg p-4 border border-slate-700/50">
                  <div className="flex items-center gap-2 mb-3">
                    <CreditCard className="h-4 w-4 text-amber-400" />
                    <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wide">
                      Códigos generados
                    </h3>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {reservation.codes.map((code, index) => (
                      <div
                        key={index}
                        className="bg-slate-900/80 rounded-lg px-3 py-2 border border-slate-600/50 font-mono text-sm text-slate-200 hover:border-rose-500/30 transition-colors"
                      >
                        {code}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer Actions */}
        {!loading && !error && reservation && (
          <div className="sticky bottom-0 flex items-center justify-between gap-2 p-4 bg-slate-900/95 backdrop-blur-sm border-t border-slate-700/50">
            <div className="flex items-center gap-2">
              {reservation.status === "approved" && (
                <button
                  onClick={handleResendEmail}
                  disabled={actionLoading}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-green-600/20 hover:bg-green-600/30 text-green-400 hover:text-green-300 font-medium transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed border border-green-600/30"
                >
                  <Send className="h-4 w-4" />
                  Reenviar correo
                </button>
              )}
              
              {reservation.status !== "rejected" && (
                <button
                  onClick={handleCancelReservation}
                  disabled={actionLoading}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600/20 hover:bg-red-600/30 text-red-400 hover:text-red-300 font-medium transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed border border-red-600/30"
                >
                  <XCircle className="h-4 w-4" />
                  Anular reserva
                </button>
              )}
            </div>
            
            <button
              onClick={onClose}
              disabled={actionLoading}
              className="px-4 py-2 rounded-lg bg-slate-700/50 hover:bg-slate-700 text-slate-200 font-medium transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cerrar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
