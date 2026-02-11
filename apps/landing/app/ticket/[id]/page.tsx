import { notFound } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { EmailSender } from "./EmailSender";
import { TicketDownloader } from "./TicketDownloader";
import Link from "next/link";
import { formatLimaFromDb, toLimaPartsFromDb } from "shared/limaTime";
import { getEntryCutoffDisplay } from "shared/entryLimit";
import { applyNotDeleted } from "shared/db/softDelete";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

type TicketView = {
  id: string;
  event_id: string | null;
  table_reservation_id: string | null;
  qr_token: string;
  full_name: string | null;
  doc_type: string | null;
  document: string | null;
  dni: string | null;
  email: string | null;
  phone: string | null;
  code: {
    code: string;
    type?: string | null;
    expires_at?: string | null;
    promoter_id?: string | null;
    table_reservation_id?: string | null;
  };
  event: { name: string; location: string | null; starts_at: string; entry_limit?: string | null };
  promoter?: { code: string | null; person?: { first_name: string; last_name: string } | null } | null;
  reservation_codes?: string[] | null;
  table_name?: string | null;
  product_name?: string | null;
  product_items?: string[] | null;
};

async function getTicket(id: string): Promise<TicketView | null> {
  if (!supabaseUrl || !supabaseServiceKey) return null;
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data, error } = await supabase
    .from("tickets")
    .select(
      "id,event_id,table_reservation_id,qr_token,full_name,doc_type,document,dni,email,phone,code:codes(code,type,expires_at,promoter_id,table_reservation_id),event:events(name,location,starts_at,entry_limit),promoter:promoters(code,person:persons(first_name,last_name))"
    )
    .eq("id", id)
    .maybeSingle();

  if (error || !data) return null;

  const codeRel = Array.isArray((data as any).code) ? (data as any).code?.[0] : (data as any).code;
  const eventRel = Array.isArray((data as any).event) ? (data as any).event?.[0] : (data as any).event;
  const promoterRel = Array.isArray((data as any).promoter) ? (data as any).promoter?.[0] : (data as any).promoter;
  const promoterPerson = promoterRel?.person
    ? Array.isArray(promoterRel.person)
      ? promoterRel.person[0]
      : promoterRel.person
    : null;

  const normalized: TicketView = {
    id: data.id as string,
    event_id: (data as any).event_id ?? null,
    table_reservation_id: (data as any).table_reservation_id ?? codeRel?.table_reservation_id ?? null,
    qr_token: data.qr_token as string,
    full_name: (data as any).full_name ?? null,
    doc_type: (data as any).doc_type ?? ((data as any).document || (data as any).dni ? "dni" : null),
    document: (data as any).document ?? (data as any).dni ?? null,
    dni: (data as any).dni ?? null,
    email: (data as any).email ?? null,
    phone: (data as any).phone ?? null,
    code: {
      code: codeRel?.code ?? "",
      type: codeRel?.type ?? null,
      expires_at: codeRel?.expires_at ?? null,
      promoter_id: codeRel?.promoter_id ?? null,
      table_reservation_id: (data as any).table_reservation_id ?? codeRel?.table_reservation_id ?? null,
    },
    event: {
      name: eventRel?.name ?? "",
      location: eventRel?.location ?? null,
      starts_at: eventRel?.starts_at ?? "",
      entry_limit: eventRel?.entry_limit ?? null,
    },
    promoter: promoterRel
      ? {
          code: promoterRel?.code ?? null,
          person: promoterPerson
            ? { first_name: promoterPerson.first_name ?? "", last_name: promoterPerson.last_name ?? "" }
            : null,
        }
      : null,
    reservation_codes: (data as any).reservation_codes ?? null,
    table_name: null,
    product_name: null,
    product_items: null,
  };

  // Enlazar a una reserva SOLO si este ticket está explícitamente vinculado a ella
  // Verificar si existe tabla/producto directamente en el ticket (para tickets de reserva)
  const { data: ticketReservation } = await supabase
    .from("tickets")
    .select("table_id,product_id,table:tables(name),product:table_products(name,items)")
    .eq("id", id)
    .maybeSingle();

  if (ticketReservation) {
    const tableRel = Array.isArray(ticketReservation.table) 
      ? ticketReservation.table[0] 
      : (ticketReservation as any).table;
    const prodRel = Array.isArray(ticketReservation.product) 
      ? ticketReservation.product[0] 
      : (ticketReservation as any).product;
    
    if (tableRel || prodRel) {
      normalized.table_name = tableRel?.name || null;
      normalized.product_name = prodRel?.name || null;
      normalized.product_items = prodRel?.items || null;
    }
  }

  // Fallback determinístico para tickets antiguos sin table_id/product_id:
  // resolver mesa/producto/códigos directamente desde table_reservation_id.
  if (normalized.table_reservation_id) {
    const reservationQuery = applyNotDeleted(
      supabase
        .from("table_reservations")
        .select("codes,table:tables(name),product:table_products(name,items)")
        .eq("id", normalized.table_reservation_id)
        .limit(1)
    );
    const { data: reservationRow } = await reservationQuery.maybeSingle();
    if (reservationRow) {
      if (!normalized.table_name) {
        const tableRel = Array.isArray((reservationRow as any).table)
          ? (reservationRow as any).table[0]
          : (reservationRow as any).table;
        normalized.table_name = tableRel?.name || null;
      }
      if (!normalized.product_name) {
        const productRel = Array.isArray((reservationRow as any).product)
          ? (reservationRow as any).product[0]
          : (reservationRow as any).product;
        normalized.product_name = productRel?.name || null;
        normalized.product_items = Array.isArray(productRel?.items) ? productRel.items : null;
      }
      const codesFromReservation = Array.isArray((reservationRow as any).codes)
        ? ((reservationRow as any).codes as any[]).map((value) => String(value || "").trim()).filter(Boolean)
        : [];
      if (!normalized.reservation_codes || normalized.reservation_codes.length === 0) {
        normalized.reservation_codes = codesFromReservation;
      }
    }
  }

  return normalized;
}

async function getReservationCodesFor(ticket: TicketView): Promise<string[]> {
  if (!supabaseUrl || !supabaseServiceKey) return [];
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  if (Array.isArray(ticket.reservation_codes) && ticket.reservation_codes.length > 0) {
    return Array.from(new Set(ticket.reservation_codes.map((code) => String(code || "").trim()).filter(Boolean)));
  }

  if (ticket.table_reservation_id) {
    const reservationByIdQuery = applyNotDeleted(
      supabase
        .from("table_reservations")
        .select("codes,status")
        .eq("id", ticket.table_reservation_id)
        .limit(1)
    );
    const { data: reservationById } = await reservationByIdQuery.maybeSingle();
    const status = String((reservationById as any)?.status || "").toLowerCase();
    const activeStatuses = new Set(["approved", "confirmed", "paid"]);
    if (reservationById && activeStatuses.has(status) && Array.isArray((reservationById as any).codes)) {
      return ((reservationById as any).codes as any[]).map((code) => String(code || "").trim()).filter(Boolean);
    }
  }

  const email = ticket.email;
  const phone = ticket.phone;
  const filters = [email ? `email.eq.${email}` : "", phone ? `phone.eq.${phone}` : ""].filter(Boolean);
  if (filters.length === 0) return [];

  let query = supabase
    .from("table_reservations")
    .select("codes,status,created_at,event_id")
    .or(filters.join(","))
    .order("created_at", { ascending: false })
    .limit(5);
  if (ticket.event_id) {
    query = query.eq("event_id", ticket.event_id);
  }

  const { data, error } = await query;

  if (error || !data) return [];
  const activeStatuses = new Set(["approved", "confirmed", "paid"]);
  // Priorizar la reserva más reciente con códigos y estado activo
  const valid = (data as any[]).find((r) => {
    const status = (r?.status || "").toLowerCase();
    if (!activeStatuses.has(status)) return false;
    return Array.isArray(r.codes) && r.codes.length > 0;
  });
  return valid?.codes || [];
}

export const dynamic = "force-dynamic";

export default async function TicketPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ticket = await getTicket(id);
  if (!ticket) return notFound();

  const promoterName =
    ticket.promoter?.person ? `${ticket.promoter.person.first_name} ${ticket.promoter.person.last_name}`.trim() : null;
  const extraCodes = await getReservationCodesFor(ticket);
  const codeType = (ticket.code.type || "").toLowerCase();
  const isPromoterCode = Boolean(ticket.code.promoter_id || ticket.promoter?.code);
  const hasTableContext = Boolean(ticket.table_name || ticket.product_name || ticket.table_reservation_id);
  const showAdditionalInfo = codeType === "general" || codeType === "free";
  const expiresAt = ticket.code.expires_at ? new Date(ticket.code.expires_at) : null;
  const expiresLabel = expiresAt ? formatLimaFromDb(expiresAt.toISOString()) : null;
  const entryCutoff = getEntryCutoffDisplay(ticket.event.starts_at, ticket.event.entry_limit);
  const entryLimitLabel = entryCutoff
    ? entryCutoff.isNextDay
      ? `${entryCutoff.timeLabel} (${entryCutoff.dateLabel})`
      : entryCutoff.timeLabel
    : null;
  const eventParts = toLimaPartsFromDb(ticket.event.starts_at);
  const eventDateLabel = eventParts.date.replace(/\//g, "/");
  const eventTimeLabel = `${String(eventParts.hour12).padStart(2, "0")}:${String(eventParts.minute).padStart(2, "0")} ${
    eventParts.ampm
  }`;
  const eventDateTime = formatLimaFromDb(ticket.event.starts_at);
  const warnings = buildWarnings({
    codeType,
    isPromoterCode,
    hasTableContext,
    expiresLabel,
    entryLimitLabel,
    eventTimeLabel,
  });

  return (
    <main className="flex min-h-screen items-center justify-center bg-black px-4 py-10 text-white">
      <div className="w-full max-w-xl space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-white/60">BABY</p>
            <h1 className="text-3xl font-semibold">Entrada generada</h1>
          </div>
          <div className="flex items-center gap-3">
            <TicketDownloader ticketId={ticket.id} />
            <Link
              href={`/registro?code=${encodeURIComponent(ticket.code.code)}`}
              className="rounded-full px-4 py-2 text-sm font-semibold btn-smoke-outline transition"
            >
              Volver al registro
            </Link>
          </div>
        </div>

        <div id="ticket-content">
          <VerticalTicket
            ticket={ticket}
            promoterName={promoterName}
            extraCodes={extraCodes}
            warnings={warnings}
            showAdditionalInfo={showAdditionalInfo}
            eventDateLabel={eventDateLabel}
            eventTimeLabel={eventTimeLabel}
            eventDateTime={eventDateTime}
          />
        </div>

        <EmailSender ticketId={ticket.id} defaultEmail={ticket.email} />
      </div>
    </main>
  );
}
function VerticalTicket({
  ticket,
  promoterName,
  extraCodes,
  warnings,
  showAdditionalInfo,
  eventDateLabel,
  eventTimeLabel,
  eventDateTime,
}: {
  ticket: TicketView;
  promoterName: string | null;
  extraCodes: string[];
  warnings: Array<{ title: string; body: string }>;
  showAdditionalInfo: boolean;
  eventDateLabel: string;
  eventTimeLabel: string;
  eventDateTime: string;
}) {
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=260x260&data=${encodeURIComponent(ticket.qr_token)}`;
  const docValue = ticket.document || ticket.dni || "—";
  const docTypeLabel = (ticket.doc_type || (ticket.dni ? "dni" : "")).toUpperCase();
  const documentLabel = docValue === "—" ? "—" : docTypeLabel ? `${docTypeLabel} · ${docValue}` : docValue;

  return (
    <div className="relative overflow-hidden rounded-[36px] border border-white/30 bg-[#0c0c0c] p-6 shadow-[0_20px_80px_rgba(0,0,0,0.5)]">
      <Notches />

      <div className="space-y-5">
        <div className="flex items-center justify-between text-xs uppercase tracking-[0.2em] text-white/60">
          <span>Ticket #{ticket.id.slice(0, 8)}</span>
          <span>{eventDateLabel}</span>
        </div>

        <div className="flex justify-center">
          <img
            src={qrUrl}
            alt="QR de entrada"
            className="rounded-2xl border border-white/20 bg-white p-2"
            width={220}
            height={220}
          />
        </div>

        {warnings.length > 0 && (
          <div className="space-y-2">
            {warnings.map((warn) => (
              <div
                key={warn.title}
                className="rounded-xl border border-amber-400/40 bg-amber-400/10 px-3 py-2 text-[11px] text-amber-50"
              >
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-amber-200">{warn.title}</p>
                <p className="text-xs leading-relaxed text-amber-50/90">{warn.body}</p>
              </div>
            ))}
          </div>
        )}

        {showAdditionalInfo && <AdditionalInfo />}

        <div className="rounded-2xl border border-white/20 bg-[#0a0a0a] p-4">
          <p className="text-sm font-semibold text-white/70">Evento</p>
          <h2 className="text-2xl font-bold">{ticket.event.name}</h2>
          <p className="text-sm text-white/60">{ticket.event.location || "Por definir"}</p>
          <p className="text-sm text-white/60">{eventDateTime}</p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Info label="Nombre" value={ticket.full_name || "—"} />
          <Info label="Documento" value={documentLabel} />
          <Info label="Email" value={ticket.email || "—"} />
          <Info label="Teléfono" value={ticket.phone || "—"} />
          <Info label="Promotor" value={promoterName || "Sin promotor"} />
          {!ticket.table_name && ticket.table_reservation_id && <Info label="Origen" value="Reserva de mesa" />}
          {ticket.table_name && <Info label="Mesa" value={ticket.table_name} />}
          {ticket.product_name && (
            <div className="sm:col-span-2 rounded-2xl border border-white/10 bg-[#0a0a0a] p-3">
              <p className="text-xs font-semibold uppercase tracking-[0.15em] text-white/50">Pack</p>
              <p className="text-sm font-semibold text-white">{ticket.product_name}</p>
              {ticket.product_items && ticket.product_items.length > 0 && (
                <ul className="mt-2 space-y-1 text-xs text-white/70 list-disc pl-4">
                  {ticket.product_items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
          {extraCodes && extraCodes.length > 0 && (
            <div className="sm:col-span-2 rounded-2xl border border-white/10 bg-[#0a0a0a] p-3">
              <p className="text-xs font-semibold uppercase tracking-[0.15em] text-white/50">Códigos de mesa</p>
              <div className="space-y-1 mt-2">
                {extraCodes.map((c) => (
                  <div key={c} className="rounded-xl bg-black/30 px-3 py-2 font-mono text-xs text-white">
                    {c}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#0a0a0a] p-3">
      <p className="text-xs font-semibold uppercase tracking-[0.15em] text-white/50">{label}</p>
      <p className="text-sm font-semibold text-white break-words">{value}</p>
    </div>
  );
}

function AdditionalInfo() {
  const lines = [
    "(+18) Presentando DNI",
    "¿Llegas tarde? Adquiere tu entrada!",
    "Si te registras y no asistes, no tendras acceso al link de registro o seras filtrado para proximos eventos.",
  ];

  return (
    <div className="rounded-2xl border border-white/15 bg-white/5 px-4 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-white/50">Info</p>
      <div className="mt-2 space-y-1 text-xs text-white/80">
        {lines.map((line) => (
          <p key={line} className="leading-relaxed">
            {line}
          </p>
        ))}
      </div>
    </div>
  );
}

function Notches() {
  return (
    <>
      <div className="pointer-events-none absolute inset-0 border border-white/30" />
      <div className="pointer-events-none absolute left-[-14px] top-8 h-7 w-7 rounded-full border border-white/30 bg-black" />
      <div className="pointer-events-none absolute right-[-14px] top-8 h-7 w-7 rounded-full border border-white/30 bg-black" />
      <div className="pointer-events-none absolute left-[-14px] bottom-8 h-7 w-7 rounded-full border border-white/30 bg-black" />
      <div className="pointer-events-none absolute right-[-14px] bottom-8 h-7 w-7 rounded-full border border-white/30 bg-black" />
    </>
  );
}

function Warnings({
  isFreeCode,
  isPromoterCode,
  expiresLabel,
}: {
  isFreeCode: boolean;
  isPromoterCode: boolean;
  expiresLabel: string | null;
}) {
  return null;
}

function buildWarnings({
  codeType,
  isPromoterCode,
  hasTableContext,
  expiresLabel,
  entryLimitLabel,
  eventTimeLabel,
}: {
  codeType: string;
  isPromoterCode: boolean;
  hasTableContext: boolean;
  expiresLabel: string | null;
  entryLimitLabel: string | null;
  eventTimeLabel: string;
}) {
  const items: { title: string; body: string }[] = [];
  if (codeType === "free") {
    items.push({
      title: "QR libre",
      body: expiresLabel
        ? `Hora límite de ingreso: ${expiresLabel}.`
        : "QR libre con hora límite configurable. Llega temprano para asegurar tu ingreso.",
    });
  } else if (codeType === "general") {
    items.push({
      title: "QR general",
      body: entryLimitLabel
        ? `Hora límite de ingreso: ${entryLimitLabel}. Horario del evento: ${eventTimeLabel}.`
        : eventTimeLabel
          ? `Hora de ingreso del evento: ${eventTimeLabel}.`
          : "QR con hora límite configurable.",
    });
  } else {
    items.push({
      title: isPromoterCode || hasTableContext ? "QR de mesa / promotor" : "QR",
      body: "Este QR no tiene límite de hora de ingreso.",
    });
  }
  return items;
}
