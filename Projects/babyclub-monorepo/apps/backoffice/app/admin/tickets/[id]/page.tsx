import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

type TicketDetail = {
  id: string;
  created_at: string;
  dni: string | null;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  qr_token: string | null;
  event_id: string | null;
  code_id: string | null;
  event_name: string | null;
  code_value: string | null;
  promoter_name: string | null;
  table_codes: string[];
  table_name?: string | null;
  product_name?: string | null;
  product_items?: string[] | null;
};

async function getTicket(id: string): Promise<{ ticket: TicketDetail | null; error?: string }> {
  if (!supabaseUrl || !supabaseServiceKey) return { ticket: null, error: "Falta configuración de Supabase" };
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data, error } = await supabase
    .from("tickets")
    .select("id,created_at,dni,full_name,email,phone,qr_token,event_id,code_id,promoter_id")
    .eq("id", id)
    .limit(1)
    .maybeSingle();

  if (error || !data) return { ticket: null, error: error?.message || "Ticket no encontrado" };

  const [eventRes, codeRes] = await Promise.all([
    data.event_id ? supabase.from("events").select("id,name").eq("id", data.event_id).limit(1).maybeSingle() : Promise.resolve({ data: null }),
    data.code_id ? supabase.from("codes").select("id,code,promoter_id").eq("id", data.code_id).limit(1).maybeSingle() : Promise.resolve({ data: null }),
  ]);

  const codeData = codeRes.data as any;
  const promoterId = data.promoter_id || codeData?.promoter_id || null;
  const promoterRes = promoterId
    ? await supabase
        .from("promoters")
        .select("code,person:persons(first_name,last_name)")
        .eq("id", promoterId)
        .limit(1)
        .maybeSingle()
    : { data: null as any };

  const promoterData = (promoterRes as any)?.data;
  const promoterPerson = Array.isArray(promoterData?.person) ? promoterData.person?.[0] : promoterData?.person;
  const promoterName =
    [promoterPerson?.first_name, promoterPerson?.last_name].filter(Boolean).join(" ").trim() || promoterData?.code || null;

  // Buscar códigos asociados a una reserva de mesa del mismo email/teléfono
  let tableCodes: string[] = [];
  let tableName: string | null = null;
  let productName: string | null = null;
  let productItems: string[] | null = null;
  if (data.email || data.phone) {
    const { data: resv } = await supabase
      .from("table_reservations")
      .select("codes,status,table:tables(name),product:table_products(name,items)")
      .or(
        [
          data.email ? `email.eq.${data.email}` : "",
          data.phone ? `phone.eq.${data.phone}` : "",
        ]
          .filter(Boolean)
          .join(",")
      )
      .order("created_at", { ascending: false })
      .limit(1);
    const first = resv?.[0];
    tableCodes = first?.codes ? (first.codes as any[]).filter(Boolean) : [];
    const tableRel = Array.isArray(first?.table) ? first?.table?.[0] : first?.table;
    const prodRel = Array.isArray(first?.product) ? first?.product?.[0] : first?.product;
    tableName = tableRel?.name || null;
    productName = prodRel?.name || null;
    productItems = prodRel?.items || null;
  }

  return {
    ticket: {
      id: data.id,
      created_at: data.created_at,
      dni: data.dni ?? null,
      full_name: data.full_name ?? null,
      email: data.email ?? null,
      phone: data.phone ?? null,
      qr_token: data.qr_token ?? null,
      event_id: data.event_id ?? null,
      code_id: data.code_id ?? null,
      event_name: eventRes.data?.name ?? null,
      code_value: codeRes.data?.code ?? null,
      promoter_name: promoterName,
      table_codes: tableCodes,
      table_name: tableName,
      product_name: productName,
      product_items: productItems,
    },
  };
}

export const dynamic = "force-dynamic";

export default async function TicketDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { ticket, error } = await getTicket(id);
  if (!ticket) {
    return (
      <main className="min-h-screen bg-black px-4 py-8 text-white sm:px-6 lg:px-10">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#f2f2f2]/60">Tickets / QR</p>
            <h1 className="text-3xl font-semibold">Ticket no encontrado</h1>
            <p className="text-sm text-white/60">ID: {id}</p>
            {error && <p className="mt-2 text-xs text-[#ff9a9a]">Detalle: {error}</p>}
          </div>
          <Link
            href="/admin/tickets"
            className="inline-flex items-center justify-center rounded-full border border-white/15 px-4 py-2 text-sm font-semibold text-white transition hover:border-white"
          >
            ← Volver
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black px-4 py-8 text-white sm:px-6 lg:px-10">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0 space-y-1">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#f2f2f2]/60">Tickets / QR</p>
          <h1 className="text-3xl font-semibold leading-tight">Detalle del ticket</h1>
          <p className="text-sm text-white/60">Vista solo lectura para personal admin/staff.</p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/admin/tickets"
            className="inline-flex items-center justify-center rounded-full border border-white/15 px-4 py-2 text-sm font-semibold text-white transition hover:border-white"
          >
            ← Volver
          </Link>
          <Link
            href={`/ticket/${encodeURIComponent(ticket.id)}`}
            target="_blank"
            className="inline-flex items-center justify-center rounded-full border border-white/15 px-4 py-2 text-sm font-semibold text-white transition hover:border-[#e91e63] hover:text-[#e91e63]"
          >
            Ver / descargar formato
          </Link>
        </div>
      </div>

      <div className="rounded-3xl border border-white/10 bg-[#0c0c0c] p-6 shadow-[0_20px_80px_rgba(0,0,0,0.45)]">
        <div className="grid gap-8 lg:grid-cols-[280px,1fr]">
          <div className="flex items-center justify-center rounded-2xl border border-white/10 bg-black/60 p-4">
            {ticket.qr_token ? (
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=260x260&data=${encodeURIComponent(ticket.qr_token)}`}
                alt="QR"
                className="h-56 w-56 max-w-full rounded-xl bg-white p-2 object-contain"
              />
            ) : (
              <p className="text-sm text-white/60">Sin QR</p>
            )}
          </div>

          <dl className="grid min-w-0 gap-4 text-sm text-white/80 md:grid-cols-2">
            <Info label="ID" value={ticket.id} mono />
            <Info
              label="Fecha de creación"
              value={new Date(ticket.created_at).toLocaleString("es-PE", { dateStyle: "short", timeStyle: "short" })}
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
              <div className="md:col-span-2 space-y-1">
                <p className="text-[11px] uppercase tracking-[0.12em] text-white/50">Pack</p>
                <p className="text-base font-semibold text-white">{ticket.product_name}</p>
                {ticket.product_items && ticket.product_items.length > 0 && (
                  <ul className="list-disc pl-5 text-sm text-white/70">
                    {ticket.product_items.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}
            {ticket.table_codes.length > 0 && (
              <div className="md:col-span-2 space-y-1">
                <p className="text-[11px] uppercase tracking-[0.12em] text-white/50">Códigos de mesa</p>
                <div className="flex flex-wrap gap-2">
                  {ticket.table_codes.map((c) => (
                    <span key={c} className="rounded-full border border-white/15 px-3 py-1 text-xs font-semibold text-white">
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

function Info({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="space-y-1 min-w-0 break-words">
      <p className="text-[11px] uppercase tracking-[0.12em] text-white/50">{label}</p>
      <p className={`text-base font-semibold text-white break-words ${mono ? "font-mono break-all" : ""}`}>{value}</p>
    </div>
  );
}
