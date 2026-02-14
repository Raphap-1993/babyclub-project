import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { applyNotDeleted } from "shared/db/softDelete";

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

  const ticketQuery = applyNotDeleted(
    supabase
      .from("tickets")
      .select("id,created_at,dni,full_name,email,phone,qr_token,event_id,code_id,promoter_id,table_reservation_id")
      .eq("id", id)
      .limit(1)
  );
  const { data, error } = await ticketQuery.maybeSingle();

  if (error || !data) return { ticket: null, error: error?.message || "Ticket no encontrado" };

  const [eventRes, codeRes] = await Promise.all([
    data.event_id
      ? applyNotDeleted(supabase.from("events").select("id,name").eq("id", data.event_id).limit(1)).maybeSingle()
      : Promise.resolve({ data: null }),
    data.code_id
      ? applyNotDeleted(
          supabase.from("codes").select("id,code,promoter_id,table_reservation_id").eq("id", data.code_id).limit(1)
        ).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const codeData = codeRes.data as any;
  const promoterId = data.promoter_id || codeData?.promoter_id || null;
  const promoterRes = promoterId
    ? await applyNotDeleted(
        supabase.from("promoters").select("code,person:persons(first_name,last_name)").eq("id", promoterId).limit(1)
      ).maybeSingle()
    : { data: null as any };

  const promoterData = (promoterRes as any)?.data;
  const promoterPerson = Array.isArray(promoterData?.person) ? promoterData.person?.[0] : promoterData?.person;
  const promoterName =
    [promoterPerson?.first_name, promoterPerson?.last_name].filter(Boolean).join(" ").trim() || promoterData?.code || null;

  // Buscar códigos de mesa priorizando la relación directa ticket -> reserva
  let tableCodes: string[] = [];
  let tableName: string | null = null;
  let productName: string | null = null;
  let productItems: string[] | null = null;
  const tableReservationId = (data as any).table_reservation_id || codeData?.table_reservation_id || null;
  if (tableReservationId) {
    const resvByIdQuery = applyNotDeleted(
      supabase
        .from("table_reservations")
        .select("codes,table:tables(name),product:table_products(name,items)")
        .eq("id", tableReservationId)
        .limit(1)
    );
    const { data: first } = await resvByIdQuery.maybeSingle();
    tableCodes = first?.codes ? (first.codes as any[]).filter(Boolean) : [];
    const tableRel = Array.isArray(first?.table) ? first?.table?.[0] : first?.table;
    const prodRel = Array.isArray(first?.product) ? first?.product?.[0] : first?.product;
    tableName = tableRel?.name || null;
    productName = prodRel?.name || null;
    productItems = prodRel?.items || null;
  } else if (data.email || data.phone) {
    // Fallback legacy: registros antiguos sin table_reservation_id.
    const resvByContactQuery = applyNotDeleted(
      supabase
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
        .limit(1)
    );
    const { data: resv } = await resvByContactQuery;
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
            {error && <p className="mt-2 text-xs text-red-400">⚠️ Detalle: {error}</p>}
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
          <p className="text-sm text-neutral-400">Vista solo lectura para personal admin/staff.</p>
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
            {ticket.qr_token ? (
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=${encodeURIComponent(ticket.qr_token)}`}
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
                day: '2-digit',
                month: '2-digit', 
                year: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
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
            
            {ticket.table_codes.length > 0 && (
              <div className="md:col-span-2 space-y-2 rounded-lg bg-neutral-700/30 border border-neutral-600/30 p-4">
                <p className="text-xs uppercase tracking-wider text-neutral-400">🔖 Códigos de mesa</p>
                <div className="flex flex-wrap gap-2">
                  {ticket.table_codes.map((c) => (
                    <span key={c} className="rounded-lg bg-neutral-600/50 border border-neutral-500/30 px-3 py-1.5 text-xs font-semibold text-neutral-200">
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
      <p className="text-xs uppercase tracking-wider text-neutral-400">{label}</p>
      <p className={`text-base font-semibold text-neutral-100 break-words ${mono ? "font-mono break-all text-xs" : ""}`}>{value}</p>
    </div>
  );
}
