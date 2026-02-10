"use client";

import { ReactNode } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/ui";
import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";

interface DataTableColumn<T> {
  key: keyof T;
  label: string;
  render?: (value: any, row: T) => ReactNode;
  width?: string;
  className?: string;
}

interface DataTableProps<T> {
  data: T[];
  columns: DataTableColumn<T>[];
  actions?: (row: T) => ReactNode;
  pagination?: {
    page: number;
    pageSize: number;
    total: number;
    basePath: string;
  };
  emptyMessage?: string;
}

export function DataTable<T extends Record<string, any>>({
  data,
  columns,
  actions,
  pagination,
  emptyMessage = "No hay datos disponibles",
}: DataTableProps<T>) {
  const totalPages = pagination ? Math.max(1, Math.ceil(pagination.total / pagination.pageSize)) : 1;
  const currentPage = pagination?.page ?? 1;
  const pageSize = pagination?.pageSize ?? 10;
  const basePath = pagination?.basePath ?? "";

  const buildUrl = (page: number, size: number) => {
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("pageSize", String(size));
    return `${basePath}?${params.toString()}`;
  };

  return (
    <div className="space-y-4">
      {/* Desktop Table */}
      <div className="hidden overflow-hidden rounded-xl border border-slate-700 bg-slate-900 lg:block">
        <Table>
          <TableHeader className="bg-slate-800">
            <TableRow className="border-slate-700">
              {columns.map((col) => (
                <TableHead
                  key={String(col.key)}
                  className={`px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-300 ${col.width || ""} ${col.className || ""}`}
                >
                  {col.label}
                </TableHead>
              ))}
              {actions && <TableHead className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-300">Acciones</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.length === 0 ? (
              <TableRow className="border-slate-700">
                <TableCell colSpan={columns.length + (actions ? 1 : 0)} className="px-4 py-8 text-center text-slate-400">
                  {emptyMessage}
                </TableCell>
              </TableRow>
            ) : (
              data.map((row, idx) => (
                <TableRow key={idx} className="border-slate-700 hover:bg-slate-800/30 transition-colors">
                  {columns.map((col) => (
                    <TableCell
                      key={String(col.key)}
                      className={`px-4 py-3 text-sm text-slate-200 ${col.width || ""} ${col.className || ""}`}
                    >
                      {col.render ? col.render(row[col.key], row) : (row[col.key] ?? "—")}
                    </TableCell>
                  ))}
                  {actions && <TableCell className="px-4 py-3 text-right">{actions(row)}</TableCell>}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Mobile Cards */}
      <div className="space-y-3 lg:hidden">
        {data.length === 0 ? (
          <div className="rounded-lg border border-slate-700 bg-slate-900 px-4 py-8 text-center text-slate-400">
            {emptyMessage}
          </div>
        ) : (
          data.map((row, idx) => (
            <div
              key={idx}
              className="rounded-lg border border-slate-700 bg-slate-900 p-4 space-y-3 hover:border-slate-600 transition-colors"
            >
              <div className="space-y-2">
                {columns.slice(0, 2).map((col) => (
                  <div key={String(col.key)} className="flex justify-between text-sm">
                    <span className="text-slate-400">{col.label}</span>
                    <span className="font-semibold text-slate-200">
                      {col.render ? col.render(row[col.key], row) : (row[col.key] ?? "—")}
                    </span>
                  </div>
                ))}
              </div>
              {columns.length > 2 && (
                <div className="grid grid-cols-2 gap-3 text-xs">
                  {columns.slice(2).map((col) => (
                    <div key={String(col.key)}>
                      <p className="text-slate-500 mb-1">{col.label}</p>
                      <p className="text-slate-200 font-semibold">
                        {col.render ? col.render(row[col.key], row) : (row[col.key] ?? "—")}
                      </p>
                    </div>
                  ))}
                </div>
              )}
              {actions && <div className="flex gap-2 pt-2 border-t border-slate-700">{actions(row)}</div>}
            </div>
          ))
        )}
      </div>

      {/* Pagination */}
      {pagination && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pt-4">
          <div className="flex items-center gap-2">
            <label className="text-sm text-slate-400">Mostrar:</label>
            <select
              defaultValue={pageSize}
              onChange={(e) => {
                const size = parseInt(e.target.value, 10);
                window.location.href = buildUrl(1, size);
              }}
              className="rounded-lg border border-slate-600 bg-slate-800 px-3 py-1.5 text-sm text-slate-200 focus:border-slate-500 focus:outline-none"
            >
              {[5, 10, 15, 20, 30, 50].map((opt) => (
                <option key={opt} value={opt}>
                  {opt} por página
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href={buildUrl(Math.max(1, currentPage - 1), pageSize)}
              className={`inline-flex items-center gap-1 rounded-lg border border-slate-600 px-3 py-1.5 text-sm font-medium transition-colors ${
                currentPage <= 1
                  ? "cursor-not-allowed border-slate-700 text-slate-500"
                  : "text-slate-200 hover:border-slate-500 hover:bg-slate-800"
              }`}
              onClick={(e) => currentPage <= 1 && e.preventDefault()}
            >
              <ChevronLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Anterior</span>
            </Link>

            <div className="text-sm text-slate-400">
              Página <span className="font-semibold text-slate-200">{currentPage}</span> de{" "}
              <span className="font-semibold text-slate-200">{totalPages}</span>
            </div>

            <Link
              href={buildUrl(Math.min(totalPages, currentPage + 1), pageSize)}
              className={`inline-flex items-center gap-1 rounded-lg border border-slate-600 px-3 py-1.5 text-sm font-medium transition-colors ${
                currentPage >= totalPages
                  ? "cursor-not-allowed border-slate-700 text-slate-500"
                  : "text-slate-200 hover:border-slate-500 hover:bg-slate-800"
              }`}
              onClick={(e) => currentPage >= totalPages && e.preventDefault()}
            >
              <span className="hidden sm:inline">Siguiente</span>
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="text-xs text-slate-500 text-center sm:text-right">
            Total: {pagination.total} registros
          </div>
        </div>
      )}
    </div>
  );
}
