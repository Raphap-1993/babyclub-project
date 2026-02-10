import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import ReservationActions from "../components/ReservationActions";
import ReservationResendButton from "../components/ReservationResendButton";
import ReservationEditor from "../components/ReservationEditor";
import { formatLimaFromDb } from "shared/limaTime";
import { AdminHeader, AdminPage, AdminPanel } from "@/components/admin/PageScaffold";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

type Reservation = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  doc_type?: string | null;
  document?: string | null;
  name_parts?: { nombres: string; apellido_paterno: string; apellido_materno: string } | null;
  voucher_url: string | null;
  status: string;
  codes: string[] | null;
  ticket_quantity?: number | null;
  created_by_staff?: { id: string; person?: { first_name?: string | null; last_name?: string | null } | null } | null;
  created_at: string;
  table: { name: string; event: { name: string; starts_at: string | null; location: string | null } | null } | null;
  event_fallback?: { name: string | null; starts_at: string | null; location: string | null } | null;
};

type ReservationResult =
  | { reservation: Reservation; error?: null }
  | { reservation: null; error: string };

async function getReservation(id: string): Promise<ReservationResult> {
  if (!id || id === "undefined") {
    return { reservation: null, error: "ID de reserva inválido" };
  }
  if (!supabaseUrl || !supabaseServiceKey) return { reservation: null, error: "Supabase no configurado" };
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await supabase
    .from("table_reservations")
    .select(
      "id,full_name,email,phone,doc_type,document,voucher_url,status,codes,ticket_quantity,created_at,table:tables(name,event:events(name,starts_at,location)),event:event_id(name,starts_at,location),ticket:tickets(id,full_name,doc_type,document,dni,person:persons(first_name,last_name))"
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
  const ticketRel = Array.isArray((data as any).ticket) ? (data as any).ticket?.[0] : (data as any).ticket;
  const ticketPerson = ticketRel?.person
    ? Array.isArray(ticketRel.person)
      ? ticketRel.person[0]
      : ticketRel.person
    : null;
  const eventDirect = data.event
    ? Array.isArray((data as any).event)
      ? (data as any).event?.[0]
      : (data as any).event
    : null;

  const resolvedDocType = (data as any).doc_type ?? ticketRel?.doc_type ?? "dni";
  const resolvedDocument = (data as any).document ?? ticketRel?.document ?? ticketRel?.dni ?? null;
  const resolvedFullName = (data as any).full_name ?? ticketRel?.full_name ?? "";

  let personFirstName = ticketPerson?.first_name ?? "";
  let personLastName = ticketPerson?.last_name ?? "";

  if (!personFirstName && !personLastName) {
    const fallback = await findPersonByContact(supabase, {
      docType: resolvedDocType,
      document: resolvedDocument,
      email: (data as any).email ?? null,
      phone: (data as any).phone ?? null,
    });
    personFirstName = fallback?.first_name ?? "";
    personLastName = fallback?.last_name ?? "";
  }

  const fromFull = splitFullName(resolvedFullName);
  const fromLastName = personLastName ? splitLastName(personLastName) : null;

  const nameParts = {
    nombres: personFirstName || fromFull.nombres,
    apellido_paterno: fromLastName?.apellido_paterno || fromFull.apellido_paterno,
    apellido_materno: fromLastName?.apellido_materno || fromFull.apellido_materno,
  };

  const normalized: Reservation = {
    id: data.id as string,
    full_name: resolvedFullName,
    email: (data as any).email ?? null,
    phone: (data as any).phone ?? null,
    doc_type: resolvedDocType,
    document: resolvedDocument,
    name_parts: nameParts,
    voucher_url: (data as any).voucher_url ?? null,
    status: (data as any).status ?? "",
    codes: (data as any).codes ?? null,
    ticket_quantity: typeof (data as any).ticket_quantity === "number" ? (data as any).ticket_quantity : null,
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

export default async function ReservationDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { reservation, error } = await getReservation(id);
  if (!reservation) {
    return (
      <AdminPage maxWidth="6xl">
        <AdminHeader
          kicker="Operaciones / Reservas"
          title="Reserva no encontrada"
          description={error || "La reserva no existe o no está disponible en este entorno."}
          actions={
            <Link href="/admin/reservations" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
              Volver a reservas
            </Link>
          }
        />
      </AdminPage>
    );
  }
  const eventData = reservation.table?.event || reservation.event_fallback || null;

  return (
    <AdminPage>
      <AdminHeader
        kicker="Operaciones / Reservas"
        title="Detalle de reserva"
        description="Revisión y operación detallada de una reserva específica."
        actions={
          <>
            <Link href="/admin/reservations" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
              Volver
            </Link>
            <ReservationResendButton id={reservation.id} email={reservation.email} status={reservation.status} />
            <ReservationActions id={reservation.id} status={reservation.status} />
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[1.1fr,0.9fr]">
        <section className="space-y-4">
          <AdminPanel contentClassName="p-6">
            <h2 className="mb-4 text-lg font-semibold">Datos</h2>
            <Info label="Mesa" value={reservation.table?.name || "Entrada"} />
            <Info label="Evento" value={eventData?.name || "—"} />
            <Info label="Fecha evento" value={safeFormat(eventData?.starts_at)} />
            <Info label="Ubicación" value={eventData?.location || "—"} />
            <Info label="Creada" value={formatDate(reservation.created_at)} />
            <Info label="Entradas" value={`${reservation.ticket_quantity ?? 1}`} />
            <Info label="Nombres" value={reservation.name_parts?.nombres || "—"} />
            <Info label="Apellido paterno" value={reservation.name_parts?.apellido_paterno || "—"} />
            <Info label="Apellido materno" value={reservation.name_parts?.apellido_materno || "—"} />
            <Info
              label="Documento"
              value={
                reservation.document
                  ? `${(reservation.doc_type || "dni").toUpperCase()} • ${reservation.document}`
                  : "—"
              }
            />
            <div className="mt-2 space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.15em] text-white/50">Voucher</p>
              {reservation.voucher_url ? (
                <>
                  <a
                    href={reservation.voucher_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm font-semibold text-[#a60c2f] underline-offset-4 hover:underline"
                  >
                    Ver voucher
                  </a>
                  <div className="overflow-hidden rounded-xl border border-[#292929] bg-[#121212] p-2">
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
          </AdminPanel>

          <ReservationEditor
            id={reservation.id}
            initial={{
              full_name: reservation.full_name,
              email: reservation.email,
              phone: reservation.phone,
              status: reservation.status,
              doc_type: reservation.doc_type,
              document: reservation.document,
            }}
          />
        </section>

        <AdminPanel contentClassName="p-6">
          <h2 className="mb-4 text-lg font-semibold">Códigos generados</h2>
          {reservation.codes && reservation.codes.length > 0 ? (
            <div className="space-y-2">
              {reservation.codes.map((c) => (
                <div key={c} className="rounded-2xl border border-[#292929] bg-[#0a0a0a] px-4 py-3 font-mono text-sm">
                  {c}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-white/70">No hay códigos.</p>
          )}
        </AdminPanel>
      </div>
    </AdminPage>
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

function splitFullName(fullName: string) {
  const parts = (fullName || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { nombres: "", apellido_paterno: "", apellido_materno: "" };
  if (parts.length === 1) return { nombres: parts[0], apellido_paterno: "", apellido_materno: "" };
  if (parts.length === 2) return { nombres: parts[0], apellido_paterno: parts[1], apellido_materno: "" };
  return {
    nombres: parts.slice(0, -2).join(" "),
    apellido_paterno: parts[parts.length - 2],
    apellido_materno: parts[parts.length - 1],
  };
}

function splitLastName(lastName: string) {
  const parts = (lastName || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { apellido_paterno: "", apellido_materno: "" };
  if (parts.length === 1) return { apellido_paterno: parts[0], apellido_materno: "" };
  return {
    apellido_paterno: parts.slice(0, -1).join(" "),
    apellido_materno: parts[parts.length - 1],
  };
}

async function findPersonByContact(
  supabase: any,
  {
    docType,
    document,
    email,
    phone,
  }: {
    docType?: string | null;
    document?: string | null;
    email?: string | null;
    phone?: string | null;
  }
) {
  const ors: string[] = [];
  const normalizedDoc = (document || "").trim().toLowerCase();
  if (normalizedDoc) {
    ors.push(`document.ilike.${normalizedDoc}`);
    if ((docType || "").toLowerCase() === "dni") {
      ors.push(`dni.eq.${normalizedDoc}`);
    }
  }
  if (email) ors.push(`email.eq.${email}`);
  if (phone) ors.push(`phone.eq.${phone}`);
  if (ors.length === 0) return null;

  const { data } = await supabase
    .from("persons")
    .select("first_name,last_name")
    .or(ors.join(","))
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return data || null;
}
