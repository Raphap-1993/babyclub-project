"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { CirclePlus, Search } from "lucide-react";
import PromoterActions from "./components/PromoterActions";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { SelectNative } from "@/components/ui/select-native";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

type PromoterRow = {
  id: string;
  code: string | null;
  is_active: boolean | null;
  person: {
    dni: string | null;
    first_name: string;
    last_name: string;
    email: string | null;
    phone: string | null;
  };
};

export default function PromotersClient({
  promoters,
  error,
  pagination,
  total,
}: {
  promoters: PromoterRow[];
  error: string | null;
  pagination: { page: number; pageSize: number; q: string };
  total: number;
}) {
  const { page, pageSize, q } = pagination;
  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / pageSize)), [total, pageSize]);
  const currentPage = Math.min(page, totalPages);
  const router = useRouter();

  return (
    <main className="relative overflow-hidden px-3 py-4 text-white sm:px-5 lg:px-8">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_20%_10%,rgba(166,12,47,0.10),transparent_30%),radial-gradient(circle_at_82%_0%,rgba(255,255,255,0.08),transparent_28%),radial-gradient(circle_at_50%_100%,rgba(255,255,255,0.05),transparent_45%)]" />

      <div className="mx-auto w-full max-w-7xl space-y-2.5">
        <Card className="border-[#2b2b2b] bg-[#111111]">
          <CardHeader className="gap-2 pb-3 pt-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-0.5">
                <CardDescription className="text-[11px] uppercase tracking-[0.16em] text-white/55">
                  Operaciones / Promotores
                </CardDescription>
                <CardTitle className="text-xl sm:text-2xl">Promotores</CardTitle>
              </div>
              <div className="flex items-center gap-2">
                <Link href="/admin" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
                  Volver
                </Link>
                <Link href="/admin/promoters/create" className={cn(buttonVariants({ size: "sm" }))}>
                  <CirclePlus className="h-4 w-4" />
                  Crear promotor
                </Link>
              </div>
            </div>
          </CardHeader>
          <CardContent className="border-t border-[#252525] p-3">
            <form action="/admin/promoters" method="get" className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-12">
              <label className="sm:col-span-2 xl:col-span-8">
                <span className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.12em] text-white/55">Buscar</span>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
                  <Input name="q" defaultValue={q} placeholder="Nombre, DNI o código" className="pl-9" />
                </div>
              </label>
              <div className="flex items-end gap-2 xl:col-span-2">
                <Button type="submit" size="sm">
                  <Search className="h-4 w-4" />
                  Buscar
                </Button>
                <Link href="/admin/promoters" className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}>
                  Limpiar
                </Link>
              </div>
              <div className="flex items-end justify-end text-xs text-white/60 xl:col-span-2">
                {total} resultado{total === 1 ? "" : "s"}
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
                  <TableHead className="w-[28%]">Nombre</TableHead>
                  <TableHead className="w-[14%]">DNI</TableHead>
                  <TableHead className="w-[24%]">Email</TableHead>
                  <TableHead className="w-[14%]">Código</TableHead>
                  <TableHead className="w-[10%]">Estado</TableHead>
                  <TableHead className="w-[10%] text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {promoters.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="py-10 text-center text-sm text-white/55">
                      {error ? `Error: ${error}` : "No hay promotores aún."}
                    </TableCell>
                  </TableRow>
                )}
                {promoters.map((promoter) => (
                  <TableRow key={promoter.id}>
                    <TableCell className="py-2.5 font-semibold text-white">
                      {promoter.person.first_name} {promoter.person.last_name}
                    </TableCell>
                    <TableCell className="py-2.5 text-white/80">{promoter.person.dni || "—"}</TableCell>
                    <TableCell className="py-2.5 text-white/80">{promoter.person.email || "—"}</TableCell>
                    <TableCell className="py-2.5 text-white/80">{promoter.code || "—"}</TableCell>
                    <TableCell className="py-2.5">
                      <Badge variant={promoter.is_active ? "success" : "default"}>{promoter.is_active ? "Activo" : "Inactivo"}</Badge>
                    </TableCell>
                    <TableCell className="py-2.5 text-right">
                      <PromoterActions id={promoter.id} compact />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <PaginationControls basePath="/admin/promoters" page={currentPage} totalPages={totalPages} pageSize={pageSize} q={q} />

        <div className="space-y-3 lg:hidden">
          {promoters.length === 0 && (
            <Card>
              <CardContent className="p-4 text-center text-sm text-white/65">
                {error ? `Error: ${error}` : "No hay promotores aún."}
              </CardContent>
            </Card>
          )}
          {promoters.map((promoter) => (
            <Card key={promoter.id}>
              <CardContent className="space-y-3 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <p className="text-base font-semibold">
                      {promoter.person.first_name} {promoter.person.last_name}
                    </p>
                    <p className="text-sm text-white/70">{promoter.person.email || "—"}</p>
                  </div>
                  <Badge variant={promoter.is_active ? "success" : "default"}>{promoter.is_active ? "Activo" : "Inactivo"}</Badge>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <Info label="DNI" value={promoter.person.dni || "—"} />
                  <Info label="Código" value={promoter.code || "—"} />
                </div>
                <div className="flex justify-end">
                  <PromoterActions id={promoter.id} compact />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <PaginationControls
          basePath="/admin/promoters"
          page={currentPage}
          totalPages={totalPages}
          pageSize={pageSize}
          q={q}
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
  q,
  isMobile,
}: {
  basePath: string;
  page: number;
  totalPages: number;
  pageSize: number;
  q: string;
  isMobile?: boolean;
}) {
  const router = useRouter();
  const options = [5, 10, 15, 20, 30, 50];

  const qs = (nextPage: number, size: number) => {
    const params = new URLSearchParams();
    params.set("page", String(nextPage));
    params.set("pageSize", String(size));
    if (q) params.set("q", q);
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
