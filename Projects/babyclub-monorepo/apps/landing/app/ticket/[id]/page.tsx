import { notFound } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { EmailSender } from "./EmailSender";
import Link from "next/link";
import { formatEventDate, formatEventDateTime, formatEventTime } from "shared/datetime";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

type TicketView = {
  id: string;
  qr_token: string;
  full_name: string | null;
  dni: string | null;
  email: string | null;
  phone: string | null;
  code: { code: string; type?: string | null; expires_at?: string | null; promoter_id?: string | null };
  event: { name: string; location: string | null; starts_at: string };
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
      "id,qr_token,full_name,dni,email,phone,code:codes(code,type,expires_at,promoter_id),event:events(name,location,starts_at),promoter:promoters(code,person:persons(first_name,last_name))"
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
    qr_token: data.qr_token as string,
    full_name: (data as any).full_name ?? null,
    dni: (data as any).dni ?? null,
    email: (data as any).email ?? null,
    phone: (data as any).phone ?? null,
    code: {
      code: codeRel?.code ?? "",
      type: codeRel?.type ?? null,
      expires_at: codeRel?.expires_at ?? null,
      promoter_id: codeRel?.promoter_id ?? null,
    },
    event: {
      name: eventRel?.name ?? "",
      location: eventRel?.location ?? null,
      starts_at: eventRel?.starts_at ?? "",
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

  // Enlazar a una reserva por email/teléfono para mostrar mesa y pack
  if (normalized.email || normalized.phone) {
    const { data: resv } = await supabase
      .from("table_reservations")
      .select("table:tables(name),product:table_products(name,items)")
      .or(`email.eq.${normalized.email || ""},phone.eq.${normalized.phone || ""}`)
      .order("created_at", { ascending: false })
      .limit(1);
    if (resv && resv[0]) {
      const tableRel = Array.isArray(resv[0].table) ? resv[0].table[0] : (resv[0] as any).table;
      const prodRel = Array.isArray(resv[0].product) ? resv[0].product[0] : (resv[0] as any).product;
      normalized.table_name = tableRel?.name || null;
      normalized.product_name = prodRel?.name || null;
      normalized.product_items = prodRel?.items || null;
    }
  }

  return normalized;
}

async function getReservationCodesFor(ticket: TicketView): Promise<string[]> {
  if (!supabaseUrl || !supabaseServiceKey) return [];
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const email = ticket.email;
  const phone = ticket.phone;

  const { data, error } = await supabase
    .from("table_reservations")
    .select("codes,status,created_at")
    .or(`email.eq.${email || ""},phone.eq.${phone || ""}`)
    .order("created_at", { ascending: false })
    .limit(5);

  if (error || !data) return [];
  const activeStatuses = new Set(["approved", "confirmed", "paid"]);
  const now = Date.now();
  const valid = (data as any[]).find((r) => {
    const status = (r?.status || "").toLowerCase();
    if (!activeStatuses.has(status)) return false;
    if (r?.created_at) {
      const ts = new Date(r.created_at).getTime();
      if (Number.isFinite(ts) && now - ts > 72 * 60 * 60 * 1000) return false;
    }
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
  const expiresAt = ticket.code.expires_at ? new Date(ticket.code.expires_at) : null;
  const expiresLabel = expiresAt ? formatEventTime(expiresAt.toISOString()) : null;
  const eventDateLabel = formatEventDate(ticket.event.starts_at);
  const eventTimeLabel = formatEventTime(ticket.event.starts_at);
  const eventDateTime = formatEventDateTime(ticket.event.starts_at);
  const warnings = buildWarnings({ codeType, isPromoterCode, expiresLabel, eventTimeLabel });

  return (
    <main className="flex min-h-screen items-center justify-center bg-black px-4 py-10 text-white">
      <div className="w-full max-w-xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-white/60">BABY</p>
            <h1 className="text-3xl font-semibold">Entrada generada</h1>
          </div>
          <Link
            href={`/registro?code=${encodeURIComponent(ticket.code.code)}`}
            className="rounded-full border border-white/15 px-4 py-2 text-sm font-semibold text-white transition hover:border-white"
          >
            Volver al registro
          </Link>
        </div>

        <VerticalTicket
          ticket={ticket}
          promoterName={promoterName}
          extraCodes={extraCodes}
          warnings={warnings}
          eventDateLabel={eventDateLabel}
          eventTimeLabel={eventTimeLabel}
          eventDateTime={eventDateTime}
        />

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
  eventDateLabel,
  eventTimeLabel,
  eventDateTime,
}: {
  ticket: TicketView;
  promoterName: string | null;
  extraCodes: string[];
  warnings: Array<{ title: string; body: string }>;
  eventDateLabel: string;
  eventTimeLabel: string;
  eventDateTime: string;
}) {
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=260x260&data=${encodeURIComponent(ticket.qr_token)}`;

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

        <div className="rounded-2xl border border-white/20 bg-[#0a0a0a] p-4">
          <p className="text-sm font-semibold text-white/70">Evento</p>
          <h2 className="text-2xl font-bold">{ticket.event.name}</h2>
          <p className="text-sm text-white/60">{ticket.event.location || "Por definir"}</p>
          <p className="text-sm text-white/60">{eventDateTime}</p>
          <p className="text-[11px] text-white/40">Hora del evento (America/Lima)</p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Info label="Nombre" value={ticket.full_name || "—"} />
          <Info label="DNI" value={ticket.dni || "—"} />
          <Info label="Email" value={ticket.email || "—"} />
          <Info label="Teléfono" value={ticket.phone || "—"} />
          <Info label="Promotor" value={promoterName || "Sin promotor"} />
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
  expiresLabel,
  eventTimeLabel,
}: {
  codeType: string;
  isPromoterCode: boolean;
  expiresLabel: string | null;
  eventTimeLabel: string;
}) {
  const items: { title: string; body: string }[] = [];
  if (codeType === "courtesy" || codeType === "promoter") {
    // códigos de cortesía/promotor: solo indican que son de promotor
    items.push({
      title: "QR de promotor",
      body: "Este QR no tiene límite de hora de ingreso.",
    });
  } else {
    items.push({
      title: "QR público",
      body: expiresLabel
        ? `Hora límite de ingreso: ${expiresLabel}. Horario del evento: ${eventTimeLabel}.`
        : `Hora de ingreso del evento: ${eventTimeLabel}.`,
    });
  }
  return items;
}
