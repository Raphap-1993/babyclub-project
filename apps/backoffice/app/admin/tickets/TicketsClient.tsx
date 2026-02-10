"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Download, Search } from "lucide-react";
import TicketActions from "./components/TicketActions";
import DatePickerSimple from "@/components/ui/DatePickerSimple";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { SelectNative } from "@/components/ui/select-native";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

type TicketRow = {
  id: string;
  created_at: string;
  dni: string | null;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  event_name: string | null;
  code_value: string | null;
  promoter_name: string | null;
};

export default function TicketsClient({
  initialTickets,
  error,
  filters,
  promoterOptions,
  organizerOptions,
}: {
  initialTickets: TicketRow[];
  error: string | null;
  filters: {
    from: string;
    to: string;
    q: string;
    promoter_id: string;
    organizer_id: string;
    page: number;
    pageSize: number;
    total: number;
  };
  promoterOptions: Array<{ id: string; label: string }>;
  organizerOptions: Array<{ id: string; label: string }>;
}) {
  const { from, to, q, promoter_id, organizer_id, page, pageSize, total } = filters;
  const [fromDate, setFromDate] = useState(from);
  const [toDate, setToDate] = useState(to);
  const [searchValue, setSearchValue] = useState(q);
  const [promoterId, setPromoterId] = useState(promoter_id);
  const [organizerId, setOrganizerId] = useState(organizer_id);
  const router = useRouter();
  const pathname = usePathname();

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / pageSize)), [total, pageSize]);
  const currentPage = Math.min(page, totalPages);

  const exportHref = useMemo(() => {
    const params = new URLSearchParams();
    if (fromDate) params.set("from", fromDate);
    if (toDate) params.set("to", toDate);
    if (searchValue) params.set("q", searchValue);
    if (promoterId) params.set("promoter_id", promoterId);
    if (organizerId) params.set("organizer_id", organizerId);
    return `/api/admin/tickets/export?${params.toString()}`;
  }, [fromDate, toDate, searchValue, promoterId, organizerId]);

  useEffect(() => {
    setFromDate(from);
    setToDate(to);
    setSearchValue(q);
    setPromoterId(promoter_id);
    setOrganizerId(organizer_id);
  }, [from, to, q, promoter_id, organizer_id]);

  const buildQuery = (params: Record<string, string | number | undefined>) => {
    const search = new URLSearchParams();
    if (params.from) search.set("from", String(params.from));
    if (params.to) search.set("to", String(params.to));
    if (params.q) search.set("q", String(params.q));
    if (params.promoter_id) search.set("promoter_id", String(params.promoter_id));
    if (params.organizer_id) search.set("organizer_id", String(params.organizer_id));
    if (params.page) search.set("page", String(params.page));
    if (params.pageSize) search.set("pageSize", String(params.pageSize));
    return `${pathname}?${search.toString()}`;
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    router.push(
      buildQuery({
        from: fromDate || undefined,
        to: toDate || undefined,
        q: searchValue || undefined,
        promoter_id: promoterId || undefined,
        organizer_id: organizerId || undefined,
        page: 1,
        pageSize,
      })
    );
  };

  return (
    <main className="relative overflow-hidden px-3 py-4 text-white sm:px-5 lg:px-8">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_16%_16%,rgba(166,12,47,0.08),transparent_32%),radial-gradient(circle_at_84%_0%,rgba(255,255,255,0.04),transparent_30%),radial-gradient(circle_at_50%_108%,rgba(255,255,255,0.04),transparent_42%)]" />

      <div className="mx-auto w-full max-w-7xl space-y-2.5">
        <Card className="border-[#2b2b2b] bg-[#111111]">
          <CardHeader className="gap-2 pb-3 pt-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-0.5">
                <CardDescription className="text-[11px] uppercase tracking-[0.16em] text-white/55">
                  Operaciones / Tickets / QR
                </CardDescription>
                <CardTitle className="text-xl sm:text-2xl">Tickets / QR</CardTitle>
              </div>
              <div className="flex items-center gap-2">
                <Link href="/admin" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
                  Volver
                </Link>
                <a href={exportHref} className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}>
                  <Download className="h-4 w-4" />
                  Exportar CSV
                </a>
              </div>
            </div>
          </CardHeader>
          <CardContent className="border-t border-[#252525] p-3">
            <form className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-12" onSubmit={handleSubmit}>
              <label className="space-y-1.5 xl:col-span-2">
                <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/55">Desde</span>
                <DatePickerSimple value={fromDate} onChange={setFromDate} name="from" />
              </label>
              <label className="space-y-1.5 xl:col-span-2">
                <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/55">Hasta</span>
                <DatePickerSimple value={toDate} onChange={setToDate} name="to" />
              </label>
              <label className="space-y-1.5 sm:col-span-2 xl:col-span-5">
                <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/55">Búsqueda</span>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
                  <Input
                    type="text"
                    name="q"
                    value={searchValue}
                    onChange={(e) => setSearchValue(e.target.value)}
                    placeholder="DNI, nombre o email"
                    className="pl-9"
                  />
                </div>
              </label>
              <label className="space-y-1.5 sm:col-span-2 xl:col-span-3">
                <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/55">Promotor</span>
                <SelectNative name="promoter_id" value={promoterId} onChange={(e) => setPromoterId(e.target.value)}>
                  <option value="">Todos</option>
                  {promoterOptions.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.label}
                    </option>
                  ))}
                </SelectNative>
              </label>
              <label className="space-y-1.5 sm:col-span-2 xl:col-span-3">
                <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/55">Organizador</span>
                <SelectNative name="organizer_id" value={organizerId} onChange={(e) => setOrganizerId(e.target.value)}>
                  <option value="">Todos</option>
                  {organizerOptions.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.label}
                    </option>
                  ))}
                </SelectNative>
              </label>
              <div className="flex flex-wrap items-center justify-between gap-2 sm:col-span-2 xl:col-span-12">
                <div className="text-xs text-white/60">
                  {total} resultado{total === 1 ? "" : "s"}
                </div>
                <div className="flex items-center gap-2">
                  <Button type="submit" size="sm">
                    <Search className="h-4 w-4" />
                    Buscar
                  </Button>
                  <Link href="/admin/tickets" className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}>
                    Limpiar
                  </Link>
                </div>
              </div>
            </form>
          </CardContent>
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
            <Table containerClassName="max-h-[58dvh] min-h-[280px]">
              <TableHeader className="[&_th]:sticky [&_th]:top-0 [&_th]:z-[1] [&_th]:bg-[#111111]">
                <TableRow>
                  <TableHead className="w-[18%]">Evento</TableHead>
                  <TableHead className="w-[12%]">DNI</TableHead>
                  <TableHead className="w-[24%]">Nombre</TableHead>
                  <TableHead className="w-[13%]">Teléfono</TableHead>
                  <TableHead className="w-[12%]">Código</TableHead>
                  <TableHead className="w-[13%]">Promotor</TableHead>
                  <TableHead className="w-[8%] text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {initialTickets.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="py-10 text-center text-white/55">
                      {error ? `Error: ${error}` : "No hay tickets en este rango."}
                    </TableCell>
                  </TableRow>
                )}
                {initialTickets.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="py-2.5 font-semibold text-white">{item.event_name || "—"}</TableCell>
                    <TableCell className="py-2.5 font-mono text-white/85">{item.dni || "—"}</TableCell>
                    <TableCell className="py-2.5 text-white/90">{item.full_name || "—"}</TableCell>
                    <TableCell className="py-2.5 text-white/75">{item.phone || "—"}</TableCell>
                    <TableCell className="py-2.5 text-white/75">{item.code_value || "—"}</TableCell>
                    <TableCell className="py-2.5 text-white/75">{item.promoter_name || "—"}</TableCell>
                    <TableCell className="py-2.5 text-right">
                      <TicketActions id={item.id} compact />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <PaginationControls
          basePath="/admin/tickets"
          page={currentPage}
          totalPages={totalPages}
          pageSize={pageSize}
          filters={{ from, to, q, promoter_id: promoterId, organizer_id: organizerId }}
        />

        <div className="space-y-3 lg:hidden">
          {initialTickets.length === 0 && (
            <Card>
              <CardContent className="p-4 text-center text-sm text-white/65">
                {error ? `Error: ${error}` : "No hay tickets en este rango."}
              </CardContent>
            </Card>
          )}
          {initialTickets.map((item) => (
            <Card key={item.id}>
              <CardContent className="space-y-3 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <p className="truncate text-base font-semibold">{item.full_name || "Sin nombre"}</p>
                    <p className="text-sm font-mono text-white/70">{item.dni || "—"}</p>
                  </div>
                  <TicketActions id={item.id} compact />
                </div>
                <div className="space-y-1 text-sm text-white/75">
                  <Info label="Evento" value={item.event_name || "—"} />
                  <Info label="Email" value={item.email || "—"} />
                  <Info label="Teléfono" value={item.phone || "—"} />
                  <Info label="Código" value={item.code_value || "—"} />
                  <Info label="Promotor" value={item.promoter_name || "—"} />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <PaginationControls
          basePath="/admin/tickets"
          page={currentPage}
          totalPages={totalPages}
          pageSize={pageSize}
          filters={{ from, to, q, promoter_id: promoterId, organizer_id: organizerId }}
          isMobile
        />
      </div>
    </main>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <p className="text-sm text-white/75">
      <span className="text-white/50">{label}: </span>
      <span className="font-semibold text-white">{value}</span>
    </p>
  );
}

function PaginationControls({
  basePath,
  page,
  totalPages,
  pageSize,
  filters,
  isMobile,
}: {
  basePath: string;
  page: number;
  totalPages: number;
  pageSize: number;
  filters: { from: string; to: string; q: string; promoter_id: string; organizer_id: string };
  isMobile?: boolean;
}) {
  const router = useRouter();
  const options = [5, 10, 15, 20, 30, 50];

  const qs = (nextPage: number, size: number) => {
    const params = new URLSearchParams();
    if (filters.from) params.set("from", filters.from);
    if (filters.to) params.set("to", filters.to);
    if (filters.q) params.set("q", filters.q);
    if (filters.promoter_id) params.set("promoter_id", filters.promoter_id);
    if (filters.organizer_id) params.set("organizer_id", filters.organizer_id);
    params.set("page", String(nextPage));
    params.set("pageSize", String(size));
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
