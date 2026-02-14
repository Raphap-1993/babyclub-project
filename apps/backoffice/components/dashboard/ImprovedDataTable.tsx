"use client";

import React, { ReactNode, useState, useEffect } from "react";
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
import { ChevronDown, ChevronUp } from "lucide-react";

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

  return (
    <div className="relative bg-neutral-900 rounded-lg border border-neutral-700 overflow-hidden">
      {/* Loading overlay */}
      {loading && (
        <div className="absolute inset-0 bg-neutral-900/50 flex items-center justify-center z-10">
          <div className="flex items-center gap-2 text-neutral-400">
            <div className="w-4 h-4 border-2 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
            Cargando...
          </div>
        </div>
      )}

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="border-neutral-700 hover:bg-transparent">
              {/* Columna para expandir */}
              <TableHead className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-neutral-300 w-10" />
              
              {/* Columnas visibles */}
              {visibleCols.map((col) => (
                <TableHead
                  key={String(col.key)}
                  className={`px-4 py-3 text-xs font-semibold uppercase tracking-wider text-neutral-300 ${col.width || ""} ${col.className || ""}`}
                >
                  {col.label}
                </TableHead>
              ))}
              
              {/* Columna de acciones */}
              {actions && (
                <TableHead className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-neutral-300">
                  Acciones
                </TableHead>
              )}
            </TableRow>
          </TableHeader>
          
          <TableBody>
            {paginatedData.length === 0 ? (
              <TableRow className="border-neutral-700">
                <TableCell 
                  colSpan={visibleCols.length + (actions ? 2 : 1)} 
                  className="px-4 py-12 text-center text-neutral-400"
                >
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-12 h-12 rounded-full bg-neutral-800 flex items-center justify-center">
                      📋
                    </div>
                    {emptyMessage}
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              paginatedData.map((row, idx) => {
                const rowId = getRowId(row, idx);
                const isExpanded = expandedId === rowId;

                return (
                  <React.Fragment key={rowId}>
                    {/* Fila principal */}
                    <TableRow className="border-neutral-700 hover:bg-neutral-800/30 transition-colors cursor-pointer group">
                      <TableCell
                        className="px-4 py-3 text-right w-10"
                        onClick={() => setExpandedId(isExpanded ? null : rowId)}
                      >
                        {expandableCols.length > 0 && (
                          isExpanded ? (
                            <ChevronUp className="h-4 w-4 text-rose-500" />
                          ) : (
                            <ChevronDown className="h-4 w-4 text-neutral-400 group-hover:text-neutral-300" />
                          )
                        )}
                      </TableCell>
                      
                      {/* Columnas visibles */}
                      {visibleCols.map((col) => (
                        <TableCell
                          key={String(col.key)}
                          className={`px-4 py-3 text-sm text-neutral-200 ${col.width || ""} ${col.className || ""}`}
                          onClick={() => setExpandedId(isExpanded ? null : rowId)}
                        >
                          {col.render ? col.render(row[col.key], row) : (row[col.key] ?? "—")}
                        </TableCell>
                      ))}
                      
                      {/* Columna de acciones */}
                      {actions && (
                        <TableCell className="px-4 py-3 text-right">
                          <div className="flex justify-end gap-1">
                            {actions(row)}
                          </div>
                        </TableCell>
                      )}
                    </TableRow>

                    {/* Fila expandida */}
                    {isExpanded && expandableCols.length > 0 && (
                      <TableRow className="border-neutral-700 bg-neutral-800/50">
                        <TableCell 
                          colSpan={visibleCols.length + (actions ? 2 : 1)} 
                          className="px-4 py-6"
                        >
                          <div className="space-y-6">
                            {/* Contenido expandible personalizado */}
                            {expandedContent ? (
                              expandedContent(row)
                            ) : (
                              /* Campos expandibles por defecto */
                              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                                {expandableCols.map((col) => (
                                  <div key={String(col.key)} className="space-y-1">
                                    <p className="text-xs font-semibold uppercase text-neutral-400">
                                      {col.label}
                                    </p>
                                    <p className="text-sm text-neutral-200">
                                      {col.render ? col.render(row[col.key], row) : (row[col.key] ?? "—")}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Acciones en expandido (opcional) */}
                            {actions && (
                              <div className="border-t border-neutral-700 pt-4">
                                <p className="text-xs font-semibold uppercase text-neutral-400 mb-3">
                                  Acciones
                                </p>
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

      {/* Paginación mejorada */}
      {(pagination?.total || data.length) > 0 && (
        <div className="border-t border-neutral-700 bg-neutral-800/30 p-4">
          <Pagination
            pagination={currentPagination}
            onPageChange={handlePageChange}
            onPageSizeChange={handlePageSizeChange}
            pageSizeOptions={pagination?.pageSizeOptions || [5, 10, 20, 50]}
            showPageSizeSelector={pagination?.showPageSizeSelector !== false}
            showInfo={true}
            className="text-neutral-300"
          />
        </div>
      )}
    </div>
  );
}