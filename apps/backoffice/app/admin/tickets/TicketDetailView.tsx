"use client";
import Link from "next/link";
import { ticketPaymentLabel } from "shared/salePayment";
import { TicketKindBadge } from "./components/TicketKindBadge";
import type { TicketDetail } from "./ticketDetailTypes";
export default function TicketDetailView({
  id,
  ticket,
  error,
}: {
  id: string;
  ticket: TicketDetail | null;
  error?: string;
}) {
  if (!ticket) {
    return (
      <main className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-rose-400/80">
              🎫 Tickets / QR
            </p>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-white via-neutral-200 to-neutral-400 bg-clip-text text-transparent">
              Ticket no encontrado
            </h1>
            <p className="text-sm text-neutral-400">ID: {id}</p>
            {error && (
              <p className="mt-2 text-xs text-red-400">⚠️ Detalle: {error}</p>
            )}
          </div>
          <Link
            href="/admin/tickets"
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-neutral-600 px-4 py-2 text-sm font-semibold text-neutral-200 transition-all hover:border-neutral-500 hover:bg-neutral-800"
          >
            ← Volver
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="space-y-6">
      {/* Header moderno */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-rose-400/80">
            🎫 Tickets / QR
          </p>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-white via-neutral-200 to-neutral-400 bg-clip-text text-transparent">
            Detalle del ticket
          </h1>
          <p className="text-sm text-neutral-400">
            Vista solo lectura para personal admin/staff.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/admin/tickets"
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-neutral-600 px-4 py-2 text-sm font-semibold text-neutral-200 transition-all hover:border-neutral-500 hover:bg-neutral-800"
          >
            ← Volver
          </Link>
          <Link
            href={`/ticket/${encodeURIComponent(ticket.id)}`}
            target="_blank"
            className="inline-flex items-center justify-center gap-2 bg-gradient-to-r from-rose-500 to-pink-600 px-4 py-2 text-sm font-semibold text-white rounded-lg shadow-lg transition-all hover:shadow-xl hover:from-rose-400 hover:to-pink-500 hover:scale-105"
          >
            Ver / descargar formato
          </Link>
        </div>
      </div>

      {/* Contenedor principal moderno */}
      <div className="rounded-xl border border-neutral-700/50 bg-neutral-800/30 p-6 backdrop-blur-sm shadow-xl">
        <div className="grid gap-8 lg:grid-cols-[300px,1fr]">
          {/* QR Code Section */}
          <div className="flex items-center justify-center rounded-xl border border-neutral-600/50 bg-neutral-900/50 p-6">
            {ticket.qr_image ? (
              <img
                src={ticket.qr_image}
                alt="QR"
                className="h-64 w-64 max-w-full rounded-lg bg-white p-3 object-contain shadow-lg"
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
            <Info
              label="Pago / origen"
              value={ticketPaymentLabel(
                ticket.payment_status,
                ticket.sale_origin,
              )}
            />
            <div className="space-y-1 min-w-0 break-words">
              <p className="text-xs uppercase tracking-wider text-neutral-400">
                Tipo
              </p>
              <TicketKindBadge
                codeType={ticket.code_type}
                reservationSaleOrigin={ticket.sale_origin}
                ticketTypeLabel={ticket.ticket_type_label}
                tableName={ticket.table_name}
                promoterName={ticket.promoter_name}
                showKicker
              />
            </div>
            <Info label="Código" value={ticket.code_value || "—"} />
            <Info label="Promotor" value={ticket.promoter_name || "—"} />
            <Info label="QR token" value={ticket.qr_token || "—"} mono />

            {ticket.table_name && (
              <Info label="Mesa" value={ticket.table_name} />
            )}

            {ticket.product_name && (
              <div className="md:col-span-2 space-y-2 rounded-lg bg-neutral-700/30 border border-neutral-600/30 p-4">
                <p className="text-xs uppercase tracking-wider text-neutral-400">
                  📦 Pack
                </p>
                <p className="text-base font-semibold text-neutral-100">
                  {ticket.product_name}
                </p>
                {ticket.product_items && ticket.product_items.length > 0 && (
                  <ul className="list-disc pl-5 text-sm text-neutral-300 space-y-1">
                    {ticket.product_items.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {ticket.table_codes.length > 0 && (
              <div className="md:col-span-2 space-y-2 rounded-lg bg-neutral-700/30 border border-neutral-600/30 p-4">
                <p className="text-xs uppercase tracking-wider text-neutral-400">
                  🔖 Códigos de mesa
                </p>
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
      </div>
    </main>
  );
}

function Info({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="space-y-1 min-w-0 break-words">
      <p className="text-xs uppercase tracking-wider text-neutral-400">
        {label}
      </p>
      <p
        className={`text-base font-semibold text-neutral-100 break-words ${mono ? "font-mono break-all text-xs" : ""}`}
      >
        {value}
      </p>
    </div>
  );
}
