import { notFound } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import Link from "next/link";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

type TicketView = {
  id: string;
  qr_token: string;
  full_name: string | null;
  dni: string | null;
  email: string | null;
  phone: string | null;
  code: { code: string };
  event: { name: string; location: string | null; starts_at: string };
  promoter?: { code: string | null; person?: { first_name: string; last_name: string } | null } | null;
  reservation_codes?: string[] | null;
};

async function getTicket(id: string): Promise<TicketView | null> {
  if (!supabaseUrl || !supabaseServiceKey) return null;
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data, error } = await supabase
    .from("tickets")
    .select(
      "id,qr_token,full_name,dni,email,phone,code:codes(code),event:events(name,location,starts_at),promoter:promoters(code,person:persons(first_name,last_name))"
    )
    .eq("id", id)
    .maybeSingle();

  if (error || !data) return null;
  return data as TicketView;
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
    .select("codes")
    .or(`email.eq.${email || ""},phone.eq.${phone || ""}`)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return [];
  return data.codes || [];
}

export const dynamic = "force-dynamic";

export default async function TicketPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ticket = await getTicket(id);
  if (!ticket) return notFound();

  const promoterName =
    ticket.promoter?.person ? `${ticket.promoter.person.first_name} ${ticket.promoter.person.last_name}`.trim() : null;
  const extraCodes = await getReservationCodesFor(ticket);

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

        <VerticalTicket ticket={ticket} promoterName={promoterName} extraCodes={extraCodes} />
      </div>
    </main>
  );
}
function VerticalTicket({
  ticket,
  promoterName,
  extraCodes,
}: {
  ticket: TicketView;
  promoterName: string | null;
  extraCodes: string[];
}) {
  const eventDate = new Date(ticket.event.starts_at);
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=260x260&data=${encodeURIComponent(ticket.qr_token)}`;

  return (
    <div className="relative overflow-hidden rounded-[36px] border border-white/30 bg-[#0c0c0c] p-6 shadow-[0_20px_80px_rgba(0,0,0,0.5)]">
      <Notches />

      <div className="space-y-5">
        <div className="flex items-center justify-between text-xs uppercase tracking-[0.2em] text-white/60">
          <span>Ticket #{ticket.id.slice(0, 8)}</span>
          <span>{eventDate.toLocaleDateString("es-PE", { year: "numeric", month: "short", day: "2-digit" })}</span>
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

        <div className="rounded-2xl border border-white/20 bg-[#0a0a0a] p-4">
          <p className="text-sm font-semibold text-white/70">Evento</p>
          <h2 className="text-2xl font-bold">{ticket.event.name}</h2>
          <p className="text-sm text-white/60">{ticket.event.location || "Por definir"}</p>
          <p className="text-sm text-white/60">
            {eventDate.toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit", hour12: false })}
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Info label="Nombre" value={ticket.full_name || "—"} />
          <Info label="DNI" value={ticket.dni || "—"} />
          <Info label="Email" value={ticket.email || "—"} />
          <Info label="Teléfono" value={ticket.phone || "—"} />
          <Info label="Promotor" value={promoterName || "Sin promotor"} />
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
