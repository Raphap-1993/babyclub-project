"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { CirclePlus, MapPin } from "lucide-react";
import EventActions from "./components/EventActions";
import { formatLimaFromDb } from "shared/limaTime";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SelectNative } from "@/components/ui/select-native";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

type EventRow = {
  id: string;
  name: string;
  location: string | null;
  starts_at: string | null;
  capacity: number | null;
  is_active: boolean | null;
  header_image: string | null;
  organizer_name?: string | null;
  code?: string | null;
};

export default function EventsClient({
  events,
  pagination,
  total,
  organizerFilter,
  organizerOptions,
}: {
  events: EventRow[];
  pagination: { page: number; pageSize: number };
  total: number;
  organizerFilter: string;
  organizerOptions: Array<{ id: string; name: string; slug: string | null }>;
}) {
  const { page, pageSize } = pagination;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pathname = usePathname();
  const router = useRouter();

  const onOrganizerChange = (nextOrganizerId: string) => {
    const params = new URLSearchParams();
    params.set("page", "1");
    params.set("pageSize", String(pageSize));
    if (nextOrganizerId) params.set("organizer_id", nextOrganizerId);
    router.push(`${pathname}?${params.toString()}`);
  };

  return (
    <main className="relative overflow-hidden px-3 py-4 text-white sm:px-5 lg:px-8">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_15%_20%,rgba(166,12,47,0.12),transparent_32%),radial-gradient(circle_at_85%_0%,rgba(255,255,255,0.10),transparent_28%),radial-gradient(circle_at_45%_100%,rgba(255,255,255,0.05),transparent_42%)]" />

      <div className="mx-auto w-full max-w-7xl space-y-2.5">
        <Card className="border-[#2b2b2b] bg-[#111111]">
          <CardHeader className="gap-2 pb-3 pt-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="space-y-0.5">
                <CardDescription className="text-[11px] uppercase tracking-[0.16em] text-white/55">
                  Operaciones / Eventos
                </CardDescription>
                <CardTitle className="text-xl sm:text-2xl">Eventos</CardTitle>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Link href="/admin" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
                  Volver
                </Link>
                <Link href="/admin/events/create" className={cn(buttonVariants({ size: "sm" }))}>
                  <CirclePlus className="h-4 w-4" />
                  Crear evento
                </Link>
              </div>
            </div>
            <div className="border-t border-[#252525] pt-3">
              <label className="grid max-w-sm gap-1.5">
                <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/55">Organizador</span>
                <SelectNative value={organizerFilter} onChange={(e) => onOrganizerChange(e.target.value)}>
                  <option value="">Todos</option>
                  {organizerOptions.map((org) => (
                    <option key={org.id} value={org.id}>
                      {org.name}
                    </option>
                  ))}
                </SelectNative>
              </label>
            </div>
          </CardHeader>
        </Card>

        <Card className="hidden overflow-hidden border-[#2b2b2b] lg:block">
          <CardHeader className="border-b border-[#252525] py-2">
            <div className="flex items-center justify-between gap-2">
              <div>
                <CardTitle className="text-base">Resultados</CardTitle>
              </div>
              <Badge>
                Página {currentPage}/{totalPages}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table className="table-fixed" containerClassName="max-h-[44dvh] min-h-[160px]">
              <TableHeader className="[&_th]:sticky [&_th]:top-0 [&_th]:z-[1] [&_th]:bg-[#111111]">
                <TableRow>
                  <TableHead className="w-[24%]">Evento</TableHead>
                  <TableHead className="w-[14%]">Organizador</TableHead>
                  <TableHead className="w-[14%]">Ubicación</TableHead>
                  <TableHead className="w-[14%]">Fecha</TableHead>
                  <TableHead className="w-[8%]">Cap.</TableHead>
                  <TableHead className="w-[10%]">Código</TableHead>
                  <TableHead className="w-[8%]">Estado</TableHead>
                  <TableHead className="w-[8%] text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {events.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="py-10 text-center text-white/55">
                      No hay eventos aún. Crea el primero.
                    </TableCell>
                  </TableRow>
                )}
                {events.map((event) => (
                  <TableRow key={event.id}>
                    <TableCell className="py-2.5">
                      <div className="truncate font-semibold text-white" title={event.name}>{event.name}</div>
                      {event.header_image && (
                        <div className="truncate text-[11px] text-white/45" title={event.header_image}>
                          {assetLabel(event.header_image)}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="py-2.5 text-white/80">{event.organizer_name || "—"}</TableCell>
                    <TableCell className="py-2.5 text-white/80" title={event.location || "—"}>
                      <span className="inline-flex max-w-full items-center gap-1">
                        <MapPin className="h-3.5 w-3.5 text-white/45" />
                        <span className="truncate">{event.location || "—"}</span>
                      </span>
                    </TableCell>
                    <TableCell className="py-2.5 text-white/80">{safeFormat(event.starts_at)}</TableCell>
                    <TableCell className="py-2.5 text-white/80">{event.capacity ?? "—"}</TableCell>
                    <TableCell className="truncate py-2.5 text-white/80" title={event.code ?? "—"}>
                      {event.code ?? "—"}
                    </TableCell>
                    <TableCell className="py-2.5">
                      <Badge variant={event.is_active ? "success" : "default"}>{event.is_active ? "Activo" : "Inactivo"}</Badge>
                    </TableCell>
                    <TableCell className="py-2.5 text-right">
                      <EventActions id={event.id} isActive={event.is_active} compact />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <PaginationControls
          basePath="/admin/events"
          page={currentPage}
          totalPages={totalPages}
          pageSize={pageSize}
          organizerFilter={organizerFilter}
        />

        <div className="space-y-3 lg:hidden">
          {events.length === 0 && (
            <Card>
              <CardContent className="p-4 text-center text-sm text-white/65">No hay eventos aún. Crea el primero.</CardContent>
            </Card>
          )}
          {events.map((event) => (
            <Card key={event.id}>
              <CardContent className="space-y-3 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-base font-semibold text-white">{event.name}</p>
                    <p className="text-xs text-white/60">{safeFormat(event.starts_at)}</p>
                  </div>
                  <Badge variant={event.is_active ? "success" : "default"}>{event.is_active ? "Activo" : "Inactivo"}</Badge>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <Info label="Ubicación" value={event.location || "—"} />
                  <Info label="Organizador" value={event.organizer_name || "—"} />
                  <Info label="Capacidad" value={event.capacity?.toString() || "—"} />
                  <Info label="Código" value={event.code || "—"} />
                </div>
                <div className="flex justify-end">
                  <EventActions id={event.id} isActive={event.is_active} compact />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        <PaginationControls
          basePath="/admin/events"
          page={currentPage}
          totalPages={totalPages}
          pageSize={pageSize}
          organizerFilter={organizerFilter}
          isMobile
        />
      </div>
    </main>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <p className="text-[11px] uppercase tracking-[0.1em] text-white/50">{label}</p>
      <p className="font-semibold text-white">{value}</p>
    </div>
  );
}

function PaginationControls({
  basePath,
  page,
  totalPages,
  pageSize,
  organizerFilter,
  isMobile,
}: {
  basePath: string;
  page: number;
  totalPages: number;
  pageSize: number;
  organizerFilter?: string;
  isMobile?: boolean;
}) {
  const router = useRouter();
  const options = [5, 10, 15, 20, 30, 50];

  const qs = (nextPage: number, size: number) => {
    const params = new URLSearchParams();
    params.set("page", String(nextPage));
    params.set("pageSize", String(size));
    if (organizerFilter) params.set("organizer_id", organizerFilter);
    return `${basePath}?${params.toString()}`;
  };

  return (
    <div className={`${isMobile ? "flex lg:hidden" : "hidden lg:flex"} items-center justify-between gap-3`}>
      <div className="flex items-center gap-2 text-sm text-white/70">
        <span>Filas</span>
        <SelectNative
          value={String(pageSize)}
          onChange={(e) => router.push(qs(1, Number(e.target.value)))}
          className="h-8 min-w-[110px]"
        >
          {options.map((opt) => (
            <option key={opt} value={opt}>
              {opt} / página
            </option>
          ))}
        </SelectNative>
      </div>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={page <= 1}
          onClick={() => router.push(qs(Math.max(1, page - 1), pageSize))}
        >
          Anterior
        </Button>
        <span className="text-xs text-white/60">
          Página {page} de {totalPages}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={page >= totalPages}
          onClick={() => router.push(qs(Math.min(totalPages, page + 1), pageSize))}
        >
          Siguiente
        </Button>
      </div>
    </div>
  );
}

function safeFormat(value?: string | null) {
  if (!value) return "—";
  try {
    return formatLimaFromDb(value);
  } catch (_err) {
    return "—";
  }
}

function assetLabel(value: string) {
  try {
    const pathname = new URL(value).pathname || value;
    const filename = pathname.split("/").pop();
    return filename || "Manifiesto cargado";
  } catch (_err) {
    const filename = value.split("/").pop();
    return filename || "Manifiesto cargado";
  }
}
