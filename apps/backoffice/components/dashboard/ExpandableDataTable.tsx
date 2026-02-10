"use client";

import React, { ReactNode, useState, useEffect } from "react";
import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Pagination,
  usePagination,
  PaginationInfo
} from "@repo/ui";
import { ChevronDown, ChevronUp, ChevronLeft, ChevronRight } from "lucide-react";

interface ExpandableColumn<T> {
  key: keyof T | string;
  label: string;
  render?: (value: any, row: T) => ReactNode;
  width?: string;
  className?: string;
  expandable?: boolean; // Mostrar en el contenido expandido
}

interface ExpandableDataTableProps<T> {
  data: T[];
  columns: ExpandableColumn<T>[];
  expandedContent?: (row: T) => ReactNode; // Contenido personalizado al expandir
  actions?: (row: T) => ReactNode;
  // Nueva interfaz de paginación mejorada
  pagination?: {
    page?: number;
    pageSize?: number;
    total: number;
    basePath?: string;
    onPageChange?: (page: number) => void;
    onPageSizeChange?: (pageSize: number) => void;
    pageSizeOptions?: number[];
    showPageSizeSelector?: boolean;
  };
  emptyMessage?: string;
  visibleColumns?: number; // Columnas visibles en modo compacto (default 3)
  loading?: boolean;
}

export function ExpandableDataTable<T extends Record<string, any>>({
  data,
  columns,
  expandedContent,
  actions,
  pagination,
  emptyMessage = "No hay datos disponibles",
  visibleColumns = 3,
  loading = false,
}: ExpandableDataTableProps<T>) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  
  // Hook interno de paginación (solo si no se proporciona control externo)
  const internalPagination = usePagination({
    initialPageSize: 10,
    pageSizeOptions: pagination?.pageSizeOptions || [5, 10, 20, 50]
  });

  // Usar paginación interna si no se proporciona control externo
  const currentPagination: PaginationInfo = pagination ? {
    page: pagination.page || 1,
    pageSize: pagination.pageSize || pagination.pageSizeOptions?.[0] || 10,
    total: pagination.total,
    totalPages: Math.max(1, Math.ceil(pagination.total / (pagination.pageSize || pagination.pageSizeOptions?.[0] || 10))),
    hasNext: (pagination.page || 1) * (pagination.pageSize || pagination.pageSizeOptions?.[0] || 10) < pagination.total,
    hasPrev: (pagination.page || 1) > 1,
    from: ((pagination.page || 1) - 1) * (pagination.pageSize || pagination.pageSizeOptions?.[0] || 10) + 1,
    to: Math.min((pagination.page || 1) * (pagination.pageSize || pagination.pageSizeOptions?.[0] || 10), pagination.total)
  } : internalPagination.pagination;

  // Actualizar total en paginación interna cuando cambie
  useEffect(() => {
    if (!pagination && typeof (internalPagination as any).updateTotal === 'function') {
      (internalPagination as any).updateTotal(data.length);
    }
  }, [data.length, pagination, internalPagination]);

  // Datos paginados (solo si usamos paginación interna)
  const paginatedData = pagination ? data : data.slice(
    (currentPagination.page - 1) * currentPagination.pageSize,
    currentPagination.page * currentPagination.pageSize
  );

  // Función para obtener ID único de la fila
  const getRowId = (row: T, index: number): string => {
    if (row.id) return String(row.id);
    if (row.uuid) return String(row.uuid);
    if (row.slug) return String(row.slug);
    return `row-${index}`;
  };

  // Separar columnas visibles de las expandibles
  const visibleCols = columns.filter((col, idx) => 
    !col.expandable && idx < visibleColumns
  );
  const expandableCols = columns.filter((col) => col.expandable);

  const handlePageChange = (page: number) => {
    if (pagination?.onPageChange) {
      pagination.onPageChange(page);
    } else {
      internalPagination.setPage(page);
    }
    // Cerrar filas expandidas al cambiar página
    setExpandedId(null);
  };

  const handlePageSizeChange = (pageSize: number) => {
    if (pagination?.onPageSizeChange) {
      pagination.onPageSizeChange(pageSize);
    } else {
      internalPagination.setPageSize(pageSize);
    }
    // Cerrar filas expandidas al cambiar tamaño de página
    setExpandedId(null);
  };
  const currentPage = pagination?.page ?? 1;
  const pageSize = pagination?.pageSize ?? 10;
  const totalPages = currentPagination.totalPages;
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
              <TableHead className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-300 w-10">
                ▼
              </TableHead>
              {visibleCols.map((col) => (
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
                <TableCell colSpan={visibleCols.length + (actions ? 2 : 1)} className="px-4 py-8 text-center text-slate-400">
                  {emptyMessage}
                </TableCell>
              </TableRow>
            ) : (
              data.map((row, idx) => {
                const rowId = getRowId(row, idx);
                const isExpanded = expandedId === rowId;

                return (
                  <React.Fragment key={rowId}>
                    {/* Fila principal */}
                    <TableRow className="border-slate-700 hover:bg-slate-800/30 transition-colors cursor-pointer group">
                      <TableCell
                        className="px-4 py-3 text-right w-10"
                        onClick={() => setExpandedId(isExpanded ? null : rowId)}
                      >
                        {isExpanded ? (
                          <ChevronUp className="h-4 w-4 text-rose-500" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-slate-400 group-hover:text-slate-300" />
                        )}
                      </TableCell>
                      {visibleCols.map((col) => (
                        <TableCell
                          key={String(col.key)}
                          className={`px-4 py-3 text-sm text-slate-200 ${col.width || ""} ${col.className || ""}`}
                          onClick={() => setExpandedId(isExpanded ? null : rowId)}
                        >
                          {col.render ? col.render(row[col.key], row) : (row[col.key] ?? "—")}
                        </TableCell>
                      ))}
                      {actions && (
                        <TableCell className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                          {actions(row)}
                        </TableCell>
                      )}
                    </TableRow>

                    {/* Fila expandida */}
                    {isExpanded && (
                      <TableRow className="border-slate-700 bg-slate-800/50">
                        <TableCell colSpan={visibleCols.length + (actions ? 2 : 1)} className="px-4 py-6">
                          <div className="space-y-6">
                            {/* Campos expandibles */}
                            {expandedContent ? (
                              expandedContent(row)
                            ) : (
                              <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
                                {expandableCols.map((col) => (
                                  <div key={String(col.key)} className="space-y-1">
                                    <p className="text-xs font-semibold uppercase text-slate-400">{col.label}</p>
                                    <p className="text-sm text-slate-200">
                                      {col.render ? col.render(row[col.key], row) : (row[col.key] ?? "—")}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Acciones en expandido */}
                            {actions && (
                              <div className="border-t border-slate-700 pt-4">
                                <p className="text-xs font-semibold uppercase text-slate-400 mb-3">Acciones</p>
                                <div className="flex flex-wrap gap-2">
                                  {actions(row)}
                                </div>
                              </div>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Mobile Cards */}
      <div className="space-y-3 lg:hidden">
        {data.map((row, idx) => {
          const rowId = getRowId(row, idx);
          const isExpanded = expandedId === rowId;

          return (
            <div key={rowId} className="rounded-lg border border-slate-700 bg-slate-900 overflow-hidden">
              <div
                className="flex items-center justify-between gap-4 p-4 cursor-pointer hover:bg-slate-800/50 transition-colors"
                onClick={() => setExpandedId(isExpanded ? null : rowId)}
              >
                <div className="flex-1 min-w-0 space-y-1">
                  {visibleCols.slice(0, 1).map((col) => (
                    <div key={String(col.key)}>
                      <p className="text-xs font-semibold uppercase text-slate-400">{col.label}</p>
                      <p className="text-sm font-semibold text-white truncate">
                        {col.render ? col.render(row[col.key], row) : (row[col.key] ?? "—")}
                      </p>
                    </div>
                  ))}
                </div>
                {isExpanded ? (
                  <ChevronUp className="h-5 w-5 text-rose-500 flex-shrink-0" />
                ) : (
                  <ChevronDown className="h-5 w-5 text-slate-400 flex-shrink-0" />
                )}
              </div>

              {isExpanded && (
                <div className="border-t border-slate-700 bg-slate-800/50 p-4 space-y-4">
                  {expandedContent ? (
                    expandedContent(row)
                  ) : (
                    <div className="space-y-3">
                      {expandableCols.map((col) => (
                        <div key={String(col.key)} className="flex justify-between gap-2">
                          <p className="text-xs font-semibold uppercase text-slate-400">{col.label}</p>
                          <p className="text-sm text-slate-200 text-right">
                            {col.render ? col.render(row[col.key], row) : (row[col.key] ?? "—")}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Acciones en mobile */}
                  {actions && (
                    <div className="border-t border-slate-700 pt-4 space-y-2">
                      <p className="text-xs font-semibold uppercase text-slate-400">Acciones</p>
                      <div className="flex flex-wrap gap-2">
                        {actions(row)}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Pagination Controls */}
      {pagination && currentPagination.totalPages > 1 && (
        <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-4 space-y-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase text-slate-400">Resultados</p>
              <p className="text-sm text-slate-300">
                Mostrando <span className="font-semibold text-white">{data.length}</span> de{" "}
                <span className="font-semibold text-white">{pagination.total}</span> registros
                {" "}(Página <span className="font-semibold text-white">{currentPagination.page}</span> de{" "}
                <span className="font-semibold text-white">{currentPagination.totalPages}</span>)
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">Por página:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  const newSize = parseInt(e.target.value, 10);
                  window.location.href = buildUrl(1, newSize);
                }}
                className="rounded border border-slate-600 bg-slate-900 px-3 py-1.5 text-sm text-slate-200 transition hover:border-slate-500 hover:bg-slate-800"
              >
                {[5, 10, 15, 20, 30, 50].map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Pagination Buttons */}
          <div className="flex items-center justify-center gap-1 flex-wrap">
            {currentPage > 1 && (
              <Link
                href={buildUrl(1, pageSize)}
                className="inline-flex items-center justify-center rounded border border-slate-600 p-2 text-slate-300 transition hover:border-slate-500 hover:bg-slate-800"
                title="Primera página"
              >
                <span className="text-xs font-semibold">«</span>
              </Link>
            )}

            {currentPage > 1 && (
              <Link
                href={buildUrl(currentPage - 1, pageSize)}
                className="inline-flex items-center justify-center rounded border border-slate-600 p-2 text-slate-300 transition hover:border-slate-500 hover:bg-slate-800"
                title="Página anterior"
              >
                <ChevronLeft className="h-4 w-4" />
              </Link>
            )}

            {Array.from({ length: Math.min(7, totalPages) }, (_, i) => {
              let page: number;
              if (totalPages <= 7) {
                page = i + 1;
              } else if (currentPage <= 4) {
                page = i + 1;
              } else if (currentPage >= totalPages - 3) {
                page = totalPages - 6 + i;
              } else {
                page = currentPage - 3 + i;
              }

              const isActive = page === currentPage;

              return (
                <Link
                  key={page}
                  href={buildUrl(page, pageSize)}
                  className={`inline-flex items-center justify-center rounded px-3 py-2 text-sm font-semibold transition ${
                    isActive
                      ? "bg-rose-500 text-white shadow-lg"
                      : "border border-slate-600 text-slate-300 hover:border-slate-500 hover:bg-slate-800"
                  }`}
                >
                  {page}
                </Link>
              );
            })}

            {currentPage < totalPages && (
              <Link
                href={buildUrl(currentPage + 1, pageSize)}
                className="inline-flex items-center justify-center rounded border border-slate-600 p-2 text-slate-300 transition hover:border-slate-500 hover:bg-slate-800"
                title="Página siguiente"
              >
                <ChevronRight className="h-4 w-4" />
              </Link>
            )}

            {currentPage < totalPages && (
              <Link
                href={buildUrl(totalPages, pageSize)}
                className="inline-flex items-center justify-center rounded border border-slate-600 p-2 text-slate-300 transition hover:border-slate-500 hover:bg-slate-800"
                title="Última página"
              >
                <span className="text-xs font-semibold">»</span>
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
