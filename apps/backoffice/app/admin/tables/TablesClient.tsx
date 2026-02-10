"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { CirclePlus, LayoutPanelTop } from "lucide-react";
import TableActions from "./components/TableActions";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SelectNative } from "@/components/ui/select-native";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

type TableRow = {
  id: string;
  name: string;
  ticket_count: number | null;
  min_consumption: number | null;
  price: number | null;
  is_active: boolean | null;
  notes: string | null;
  reserved: boolean;
};

export default function TablesClient({
  tables,
  error,
  pagination,
  total,
}: {
  tables: TableRow[];
  error: string | null;
  pagination: { page: number; pageSize: number };
  total: number;
}) {
  const { page, pageSize } = pagination;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(page, totalPages);
  const router = useRouter();

  return (
    <main className="relative overflow-hidden px-3 py-4 text-white sm:px-5 lg:px-8">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_18%_12%,rgba(166,12,47,0.11),transparent_30%),radial-gradient(circle_at_82%_0%,rgba(255,255,255,0.10),transparent_28%),radial-gradient(circle_at_45%_100%,rgba(255,255,255,0.06),transparent_45%)]" />

      <div className="mx-auto w-full max-w-7xl space-y-2.5">
        <Card className="border-[#2b2b2b] bg-[#111111]">
          <CardHeader className="gap-2 pb-3 pt-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="space-y-0.5">
                <CardDescription className="text-[11px] uppercase tracking-[0.16em] text-white/55">
                  Operaciones / Mesas
                </CardDescription>
                <CardTitle className="text-xl sm:text-2xl">Mesas</CardTitle>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Link href="/admin/tables/layout" className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}>
                  <LayoutPanelTop className="h-4 w-4" />
                  Plano
                </Link>
                <Link href="/admin" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
                  Volver
                </Link>
                <Link href="/admin/tables/create" className={cn(buttonVariants({ size: "sm" }))}>
                  <CirclePlus className="h-4 w-4" />
                  Crear mesa
                </Link>
              </div>
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
            <Table containerClassName="max-h-[58dvh] min-h-[280px]">
              <TableHeader className="[&_th]:sticky [&_th]:top-0 [&_th]:z-[1] [&_th]:bg-[#111111]">
                <TableRow>
                  <TableHead className="w-[30%]">Mesa</TableHead>
                  <TableHead className="w-[10%]">Tickets</TableHead>
                  <TableHead className="w-[14%]">Consumo mín.</TableHead>
                  <TableHead className="w-[12%]">Precio</TableHead>
                  <TableHead className="w-[10%]">Estado</TableHead>
                  <TableHead className="w-[12%]">Reserva</TableHead>
                  <TableHead className="w-[12%] text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tables.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="py-10 text-center text-white/55">
                      {error ? `Error: ${error}` : "No hay mesas aún."}
                    </TableCell>
                  </TableRow>
                )}
                {tables.map((table) => (
                  <TableRow key={table.id}>
                    <TableCell className="py-2.5">
                      <div className="font-semibold text-white">{table.name}</div>
                      {table.notes && <p className="line-clamp-1 text-[11px] text-white/55">{table.notes}</p>}
                    </TableCell>
                    <TableCell className="py-2.5 text-white/80">{table.ticket_count ?? "—"}</TableCell>
                    <TableCell className="py-2.5 text-white/80">{table.min_consumption != null ? `S/ ${table.min_consumption}` : "—"}</TableCell>
                    <TableCell className="py-2.5 text-white/80">{table.price != null ? `S/ ${table.price}` : "—"}</TableCell>
                    <TableCell className="py-2.5">
                      <Badge variant={table.is_active ? "success" : "default"}>{table.is_active ? "Activa" : "Inactiva"}</Badge>
                    </TableCell>
                    <TableCell className="py-2.5">
                      <Badge variant={table.reserved ? "warning" : "default"}>{table.reserved ? "Reservada" : "Libre"}</Badge>
                    </TableCell>
                    <TableCell className="py-2.5 text-right">
                      <TableActions id={table.id} reserved={table.reserved} compact />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <PaginationControls basePath="/admin/tables" page={currentPage} totalPages={totalPages} pageSize={pageSize} />

        <div className="space-y-3 lg:hidden">
          {tables.length === 0 && (
            <Card>
              <CardContent className="p-4 text-center text-sm text-white/65">
                {error ? `Error: ${error}` : "No hay mesas aún."}
              </CardContent>
            </Card>
          )}
          {tables.map((table) => (
            <Card key={table.id}>
              <CardContent className="space-y-3 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <p className="text-base font-semibold">{table.name}</p>
                    {table.notes && <p className="text-xs text-white/60">{table.notes}</p>}
                  </div>
                  <Badge variant={table.is_active ? "success" : "default"}>{table.is_active ? "Activa" : "Inactiva"}</Badge>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <Info label="Tickets" value={table.ticket_count?.toString() || "—"} />
                  <Info label="Consumo" value={table.min_consumption != null ? `S/ ${table.min_consumption}` : "—"} />
                  <Info label="Precio" value={table.price != null ? `S/ ${table.price}` : "—"} />
                  <Info label="Reserva" value={table.reserved ? "Reservada" : "Libre"} />
                </div>
                <div className="flex justify-end">
                  <TableActions id={table.id} reserved={table.reserved} compact />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <PaginationControls basePath="/admin/tables" page={currentPage} totalPages={totalPages} pageSize={pageSize} isMobile />
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
  isMobile,
}: {
  basePath: string;
  page: number;
  totalPages: number;
  pageSize: number;
  isMobile?: boolean;
}) {
  const router = useRouter();
  const options = [5, 10, 15, 20, 30, 50];

  const qs = (nextPage: number, size: number) => {
    const params = new URLSearchParams();
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
