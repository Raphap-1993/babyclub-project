import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import ReservationActions from "../components/ReservationActions";
import ReservationEditor from "../components/ReservationEditor";
import { formatLimaFromDb } from "shared/limaTime";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

type Reservation = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  doc_type?: string | null;
  document?: string | null;
  voucher_url: string | null;
  status: string;
  codes: string[] | null;
  created_by_staff?: { id: string; person?: { first_name?: string | null; last_name?: string | null } | null } | null;
  created_at: string;
  table: { name: string; event: { name: string; starts_at: string | null; location: string | null } | null } | null;
  event_fallback?: { name: string | null; starts_at: string | null; location: string | null } | null;
};

type ReservationResult =
  | { reservation: Reservation; error?: null }
  | { reservation: null; error: string };

async function getReservation(id: string): Promise<ReservationResult> {
  if (!supabaseUrl || !supabaseServiceKey) return { reservation: null, error: "Supabase no configurado" };
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await supabase
    .from("table_reservations")
    .select(
      "id,full_name,email,phone,voucher_url,status,codes,created_at,table:tables(name,event:events(name,starts_at,location)),event:event_id(name,starts_at,location)"
    )
    .eq("id", id)
    .maybeSingle();
  if (error || !data) {
    console.error("[admin/reservations/:id] load error", error?.message || "not found", { id });
    return { reservation: null, error: error?.message || "Reserva no encontrada" };
  }

  const tableRel = Array.isArray((data as any).table) ? (data as any).table?.[0] : (data as any).table;
  const eventRel = tableRel?.event
    ? Array.isArray(tableRel.event)
      ? tableRel.event[0]
      : tableRel.event
    : null;
  const eventDirect = data.event
    ? Array.isArray((data as any).event)
      ? (data as any).event?.[0]
      : (data as any).event
    : null;

  const normalized: Reservation = {
    id: data.id as string,
    full_name: (data as any).full_name ?? "",
    email: (data as any).email ?? null,
    phone: (data as any).phone ?? null,
    doc_type: (data as any).doc_type ?? "dni",
    document: (data as any).document ?? (data as any).dni ?? null,
    voucher_url: (data as any).voucher_url ?? null,
    status: (data as any).status ?? "",
    codes: (data as any).codes ?? null,
    created_by_staff: null,
    created_at: (data as any).created_at ?? "",
    event_fallback: eventDirect
      ? {
          name: eventDirect.name ?? null,
          starts_at: eventDirect.starts_at ?? null,
          location: eventDirect.location ?? null,
        }
      : null,
    table: tableRel
      ? {
          name: tableRel.name ?? "",
          event: eventRel
            ? {
                name: eventRel.name ?? "",
                starts_at: eventRel.starts_at ?? null,
                location: eventRel.location ?? null,
              }
            : null,
        }
      : null,
  };

  return { reservation: normalized };
}

export const dynamic = "force-dynamic";

export default async function ReservationDetail({ params }: { params: { id: string } }) {
  const { id } = params;
  const { reservation, error } = await getReservation(id);
  if (!reservation) {
    return (
      <main className="min-h-screen bg-black px-4 py-8 text-white sm:px-6 lg:px-10">
        <div className="mx-auto max-w-3xl space-y-4 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#f2f2f2]/60">Reservas</p>
          <h1 className="text-3xl font-semibold">Reserva no encontrada</h1>
          <p className="text-sm text-white/70">{error || "La reserva no existe o no está disponible en este entorno."}</p>
          <div className="mt-4 flex justify-center gap-3">
            <Link
              href="/admin/reservations"
              className="inline-flex items-center justify-center rounded-full border border-white/15 px-4 py-2 text-sm font-semibold text-white transition hover:border-white"
            >
              ← Volver a reservas
            </Link>
          </div>
        </div>
      </main>
    );
  }
  const eventData = reservation.table?.event || reservation.event_fallback || null;

  return (
    <main className="min-h-screen bg-black px-4 py-8 text-white sm:px-6 lg:px-10">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#f2f2f2]/60">Reservas</p>
          <h1 className="text-3xl font-semibold">Detalle de reserva</h1>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/admin/reservations"
            className="inline-flex items-center justify-center rounded-full border border-white/15 px-4 py-2 text-sm font-semibold text-white transition hover:border-white"
          >
            ← Volver
          </Link>
          <ReservationActions id={reservation.id} status={reservation.status} />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.1fr,0.9fr]">
        <section className="space-y-4">
          <div className="rounded-3xl border border-white/10 bg-[#0c0c0c] p-6">
            <h2 className="mb-4 text-lg font-semibold">Datos</h2>
            <Info label="Mesa" value={reservation.table?.name || "—"} />
            <Info label="Evento" value={eventData?.name || "—"} />
            <Info label="Fecha evento" value={safeFormat(eventData?.starts_at)} />
            <Info label="Ubicación" value={eventData?.location || "—"} />
            <Info label="Creada" value={formatDate(reservation.created_at)} />
            <div className="mt-2 space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.15em] text-white/50">Voucher</p>
              {reservation.voucher_url ? (
                <>
                  <a
                    href={reservation.voucher_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm font-semibold text-[#e91e63] underline-offset-4 hover:underline"
                  >
                    Ver voucher
                  </a>
                  <div className="overflow-hidden rounded-xl border border-white/10 bg-black/60 p-2">
                    <img
                      src={reservation.voucher_url}
                      alt="Voucher"
                      className="max-h-64 w-full rounded-lg object-contain"
                    />
                  </div>
                </>
              ) : (
                <p className="text-sm text-white/70">—</p>
              )}
            </div>
          </div>

          <ReservationEditor
            id={reservation.id}
            initial={{
              full_name: reservation.full_name,
              email: reservation.email,
              phone: reservation.phone,
              status: reservation.status,
            }}
          />
        </section>

        <section className="rounded-3xl border border-white/10 bg-[#0c0c0c] p-6">
          <h2 className="mb-4 text-lg font-semibold">Códigos generados</h2>
          {reservation.codes && reservation.codes.length > 0 ? (
            <div className="space-y-2">
              {reservation.codes.map((c) => (
                <div key={c} className="rounded-2xl border border-white/10 bg-[#0a0a0a] px-4 py-3 font-mono text-sm">
                  {c}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-white/70">No hay códigos.</p>
          )}
        </section>
      </div>
    </main>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="mb-2">
      <p className="text-xs font-semibold uppercase tracking-[0.15em] text-white/50">{label}</p>
      <p className="text-sm font-semibold text-white">{value}</p>
    </div>
  );
}

function formatDate(dateStr?: string | null) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("es-PE", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function safeFormat(value?: string | null) {
  if (!value) return "—";
  try {
    return formatLimaFromDb(value);
  } catch (_err) {
    return "—";
  }
}
