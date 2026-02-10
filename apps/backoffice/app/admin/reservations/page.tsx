import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import {
  CalendarClock,
  Eye,
  LayoutDashboard,
  Search,
} from "lucide-react";
import ReservationActions from "./components/ReservationActions";
import CreateReservationButton from "./components/CreateReservationButton";
import { applyNotDeleted } from "shared/db/softDelete";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { SelectNative } from "@/components/ui/select-native";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

type ReservationRow = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  status: string;
  codes: string[] | null;
  ticket_quantity: number | null;
  event_id: string | null;
  table_name: string;
  event_name: string;
};

type EventOption = { id: string; name: string };
type SearchParams = Record<string, string | string[] | undefined>;

type GetReservationsParams = {
  page: number;
  pageSize: number;
  q?: string;
  status?: string;
  event_id?: string;
  include_closed?: boolean;
};

type GetReservationsResult = {
  reservations: ReservationRow[];
  events: EventOption[];
  total: number;
  error?: string;
};

function normalizeParam(value: string | string[] | undefined, fallback = "") {
  if (Array.isArray(value)) return value[0] ?? fallback;
  return value ?? fallback;
}

function resolveStatusVariant(status: string): "default" | "success" | "warning" | "danger" {
  const normalized = status.toLowerCase();
  if (normalized === "approved") return "success";
  if (normalized === "rejected") return "danger";
  return "warning";
}

function applyCommonFilters<T extends { eq: (column: string, value: string) => any; or: (filters: string) => any }>(
  query: T,
  opts: { term: string; eventId: string }
) {
  let candidate: any = query;
  if (opts.term) {
    candidate = candidate.or(
      [
        `full_name.ilike.*${opts.term}*`,
        `email.ilike.*${opts.term}*`,
        `phone.ilike.*${opts.term}*`,
        `document.ilike.*${opts.term}*`,
      ].join(",")
    );
  }
  if (opts.eventId) {
    candidate = candidate.eq("event_id", opts.eventId);
  }
  return candidate as T;
}

async function getReservations(params: GetReservationsParams): Promise<GetReservationsResult> {
  if (!supabaseUrl || !supabaseServiceKey) {
    return {
      reservations: [],
      events: [],
      total: 0,
      error: "Falta configuración de Supabase",
    };
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const start = (params.page - 1) * params.pageSize;
  const end = start + params.pageSize - 1;
  const term = params.q?.trim() || "";
  const eventId = params.event_id?.trim() || "";
  const includeClosed = Boolean(params.include_closed);

  let eventsQuery = applyNotDeleted(supabase.from("events").select("id,name").order("starts_at", { ascending: false }).limit(200));
  if (!includeClosed) {
    eventsQuery = eventsQuery.eq("is_active", true);
  }
  const { data: eventRows, error: eventsError } = await eventsQuery;
  if (eventsError) {
    return {
      reservations: [],
      events: [],
      total: 0,
      error: eventsError.message,
    };
  }

  const events = (eventRows || []).map((event: any) => ({
    id: event.id as string,
    name: event.name as string,
  }));
  const allowedEventIds = new Set(events.map((event: any) => event.id));
  if (!includeClosed && eventId && !allowedEventIds.has(eventId)) {
    return { reservations: [], events, total: 0 };
  }

  let reservationsQuery = applyNotDeleted(
    supabase
      .from("table_reservations")
      .select(
        "id,full_name,email,phone,document,status,codes,ticket_quantity,event_id,table:tables(name,event_id,event:events(name)),event:event_id(name)",
        { count: "exact" }
      )
      .order("created_at", { ascending: false })
      .range(start, end)
  );

  reservationsQuery = applyCommonFilters(reservationsQuery, { term, eventId });
  if (!includeClosed && !eventId) {
    const eventIds = Array.from(allowedEventIds);
    if (eventIds.length === 0) {
      return { reservations: [], events, total: 0 };
    }
    reservationsQuery = reservationsQuery.in("event_id", eventIds);
  }

  if (params.status && params.status !== "all") {
    reservationsQuery = reservationsQuery.eq("status", params.status);
  }

  const reservationsRes = await reservationsQuery;

  if (reservationsRes.error || !reservationsRes.data) {
    return {
      reservations: [],
      events: [],
      total: 0,
      error: reservationsRes.error?.message || "No se pudieron cargar reservas",
    };
  }

  const normalized: ReservationRow[] = (reservationsRes.data as any[]).map((res) => {
    const tableRel = Array.isArray(res.table) ? res.table[0] : res.table;
    const eventRel = tableRel?.event ? (Array.isArray(tableRel.event) ? tableRel.event[0] : tableRel.event) : null;
    const eventFallback = Array.isArray(res.event) ? res.event[0] : res.event;
    return {
      id: res.id,
      full_name: res.full_name ?? "",
      email: res.email ?? null,
      phone: res.phone ?? null,
      status: res.status ?? "",
      codes: res.codes ?? null,
      ticket_quantity: typeof res.ticket_quantity === "number" ? res.ticket_quantity : null,
      event_id: res.event_id ?? tableRel?.event_id ?? null,
      table_name: tableRel?.name ?? "Entrada",
      event_name: eventRel?.name ?? eventFallback?.name ?? "—",
    };
  });

  return {
    reservations: normalized,
    events,
    total: reservationsRes.count ?? normalized.length,
  };
}

export const dynamic = "force-dynamic";

function buildHref(
  filters: { q: string; status: string; event_id: string; page: number; pageSize: number; include_closed: boolean },
  patch: Partial<{ q: string; status: string; event_id: string; page: number; pageSize: number; include_closed: boolean }>
) {
  const next = { ...filters, ...patch };
  const qs = new URLSearchParams();
  if (next.q) qs.set("q", next.q);
  if (next.status && next.status !== "all") qs.set("status", next.status);
  if (next.event_id) qs.set("event_id", next.event_id);
  if (next.include_closed) qs.set("include_closed", "1");
  if (next.page > 1) qs.set("page", String(next.page));
  if (next.pageSize !== 10) qs.set("pageSize", String(next.pageSize));
  const query = qs.toString();
  return query ? `/admin/reservations?${query}` : "/admin/reservations";
}

export default async function ReservationsPage({ searchParams }: { searchParams?: SearchParams | Promise<SearchParams> }) {
  const params = await searchParams;
  const q = normalizeParam(params?.q).trim();
  const status = normalizeParam(params?.status, "all") || "all";
  const event_id = normalizeParam(params?.event_id).trim();
  const include_closed = ["1", "true", "yes", "on"].includes(normalizeParam(params?.include_closed).toLowerCase());
  const page = Math.max(1, parseInt(normalizeParam(params?.page, "1"), 10) || 1);
  const pageSize = Math.min(100, Math.max(5, parseInt(normalizeParam(params?.pageSize, "10"), 10) || 10));

  const { reservations, events, total, error } = await getReservations({
    page,
    pageSize,
    q,
    status,
    event_id,
    include_closed,
  });

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const hasPrev = page > 1;
  const hasNext = page < totalPages;
  const filters = { q, status, event_id, page, pageSize, include_closed };

  return (
    <TooltipProvider>
      <main className="relative overflow-hidden px-3 py-4 text-white sm:px-5 lg:px-8">
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_20%_20%,rgba(166,12,47,0.10),transparent_35%),radial-gradient(circle_at_80%_0%,rgba(255,255,255,0.10),transparent_28%),radial-gradient(circle_at_50%_120%,rgba(255,255,255,0.08),transparent_45%)]" />

        <div className="mx-auto flex w-full max-w-7xl flex-col gap-2.5">
          <Card className="border-[#2b2b2b] bg-[#111111]">
            <CardHeader className="gap-2 pb-3 pt-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-0.5">
                  <CardDescription className="flex items-center gap-2 text-[11px] uppercase tracking-[0.16em] text-white/55">
                    <LayoutDashboard className="h-3.5 w-3.5" />
                    Operaciones / Reservas
                  </CardDescription>
                  <CardTitle className="text-xl font-semibold sm:text-2xl">Reservas</CardTitle>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <CreateReservationButton />
                  <Link href={buildHref(filters, {})} className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}>
                    Refrescar
                  </Link>
                  <Link href="/admin" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
                    Volver
                  </Link>
                </div>
              </div>
            </CardHeader>
            <CardContent className="border-t border-[#252525] p-3">
              <form action="/admin/reservations" method="get" className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-12">
                <label className="sm:col-span-2 xl:col-span-4">
                  <span className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.12em] text-white/55">
                    Búsqueda
                  </span>
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
                    <Input
                      name="q"
                      defaultValue={q}
                      placeholder="Nombre, email, teléfono o documento"
                      className="pl-9"
                    />
                  </div>
                </label>

                <label className="xl:col-span-2">
                  <span className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.12em] text-white/55">
                    Estado
                  </span>
                  <SelectNative name="status" defaultValue={status}>
                    <option value="all">Todos</option>
                    <option value="pending">Pending</option>
                    <option value="approved">Approved</option>
                    <option value="rejected">Rejected</option>
                  </SelectNative>
                </label>

                <label className="sm:col-span-2 xl:col-span-4">
                  <span className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.12em] text-white/55">
                    Evento
                  </span>
                  <SelectNative name="event_id" defaultValue={event_id}>
                    <option value="">Todos</option>
                    {events.map((event) => (
                      <option key={event.id} value={event.id}>
                        {event.name}
                      </option>
                    ))}
                  </SelectNative>
                </label>

                <label className="xl:col-span-2">
                  <span className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.12em] text-white/55">
                    Tamaño
                  </span>
                  <SelectNative name="pageSize" defaultValue={String(pageSize)}>
                    <option value="10">10</option>
                    <option value="20">20</option>
                    <option value="50">50</option>
                    <option value="100">100</option>
                  </SelectNative>
                </label>

                <label className="xl:col-span-2 flex items-center gap-2 pt-6 text-sm text-white/75">
                  <input
                    type="checkbox"
                    name="include_closed"
                    value="1"
                    defaultChecked={include_closed}
                    className="h-4 w-4 rounded border-[#3a3a3a] bg-black accent-[#a60c2f]"
                  />
                  Mostrar cerrados
                </label>

                <div className="sm:col-span-2 xl:col-span-12 flex flex-wrap items-center justify-between gap-2 pt-1">
                  <div className="text-xs text-white/60">
                    Mostrando {reservations.length} de {total} registros.
                  </div>
                  <div className="flex items-center gap-2">
                    <Button type="submit" size="sm">
                      <Search className="h-4 w-4" />
                      Buscar
                    </Button>
                    <Link
                      href={include_closed ? "/admin/reservations?include_closed=1" : "/admin/reservations"}
                      className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
                    >
                      Limpiar
                    </Link>
                  </div>
                </div>
              </form>
            </CardContent>
          </Card>

          <Card className="overflow-hidden border-[#2b2b2b]">
            <CardHeader className="border-b border-[#252525] py-2">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-base">Resultados</CardTitle>
                </div>
                <Badge variant="default">
                  <CalendarClock className="mr-1 h-3.5 w-3.5" />
                  Página {page}/{totalPages}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table containerClassName="max-h-[58dvh] min-h-[280px]">
                <TableHeader className="[&_th]:sticky [&_th]:top-0 [&_th]:z-[1] [&_th]:bg-[#111111]">
                  <TableRow>
                    <TableHead className="w-[14%]">Mesa</TableHead>
                    <TableHead className="w-[18%]">Evento</TableHead>
                    <TableHead className="w-[30%]">Contacto</TableHead>
                    <TableHead className="w-[8%]">Entradas</TableHead>
                    <TableHead className="w-[12%]">Estado</TableHead>
                    <TableHead className="w-[18%] text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reservations.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="py-10 text-center text-sm text-white/55">
                        {error ? `Error: ${error}` : "No hay reservas para los filtros actuales."}
                      </TableCell>
                    </TableRow>
                  )}
                  {reservations.map((res) => (
                    <TableRow key={res.id}>
                      <TableCell className="py-2.5 font-semibold text-white">{res.table_name || "—"}</TableCell>
                      <TableCell className="py-2.5 text-white/80">{res.event_name || "—"}</TableCell>
                      <TableCell className="py-2.5">
                        <p className="truncate font-semibold text-white">{res.full_name || "—"}</p>
                        {res.email ? <p className="truncate text-[11px] text-white/55">{res.email}</p> : null}
                        {res.phone ? <p className="text-[11px] text-white/55">{res.phone}</p> : null}
                      </TableCell>
                      <TableCell className="py-2.5 text-white/80">{res.ticket_quantity ?? 1}</TableCell>
                      <TableCell className="py-2.5">
                        <Badge variant={resolveStatusVariant(res.status)}>{res.status || "pending"}</Badge>
                      </TableCell>
                      <TableCell className="py-2.5">
                        <div className="flex justify-end gap-2">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Link
                                href={`/admin/reservations/${encodeURIComponent(res.id)}`}
                                className={cn(buttonVariants({ variant: "ghost", size: "icon" }))}
                              >
                                <Eye className="h-4 w-4" />
                              </Link>
                            </TooltipTrigger>
                            <TooltipContent>Ver detalle</TooltipContent>
                          </Tooltip>
                          <ReservationActions id={res.id} status={res.status} compact />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-white/60">
              Página {page} de {totalPages}
            </p>
            <div className="flex items-center gap-2">
              <Link
                href={hasPrev ? buildHref(filters, { page: page - 1 }) : "#"}
                aria-disabled={!hasPrev}
                className={cn(
                  buttonVariants({ variant: "ghost", size: "sm" }),
                  !hasPrev && "pointer-events-none opacity-40"
                )}
              >
                Anterior
              </Link>
              <Link
                href={hasNext ? buildHref(filters, { page: page + 1 }) : "#"}
                aria-disabled={!hasNext}
                className={cn(
                  buttonVariants({ variant: "ghost", size: "sm" }),
                  !hasNext && "pointer-events-none opacity-40"
                )}
              >
                Siguiente
              </Link>
            </div>
          </div>
        </div>
      </main>
    </TooltipProvider>
  );
}
