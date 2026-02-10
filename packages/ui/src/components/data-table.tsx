"use client";

import React from "react";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  getSortedRowModel,
  SortingState,
  getPaginationRowModel,
  type Table as TanstackTable,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { ChevronUp, ChevronDown, ChevronsUpDown, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { cn } from "../utils";

// Componentes base de tabla compacta y moderna
const TableWrapper = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { 
    compact?: boolean;
    maxHeight?: string;
  }
>(({ className, compact = false, maxHeight = "70vh", ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "w-full overflow-hidden rounded-xl border border-slate-700/60 bg-slate-900/90 backdrop-blur-sm shadow-xl ring-1 ring-slate-700/20",
      compact && "shadow-md",
      className
    )}
    style={{ maxHeight }}
    {...props}
  />
));
TableWrapper.displayName = "TableWrapper";

const Table = React.forwardRef<
  HTMLTableElement,
  React.HTMLAttributes<HTMLTableElement>
>(({ className, ...props }, ref) => (
  <table
    ref={ref}
    className={cn("w-full caption-bottom text-sm table-fixed", className)}
    {...props}
  />
));
Table.displayName = "Table";

const TableHeader = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement> & { compact?: boolean }
>(({ className, compact = false, ...props }, ref) => (
  <thead
    ref={ref}
    className={cn(
      "bg-gradient-to-r from-slate-800/90 via-slate-800/90 to-slate-700/90 border-b border-slate-600/60 sticky top-0 z-10 backdrop-blur-sm",
      compact && "bg-slate-800/95",
      className
    )}
    {...props}
  />
));
TableHeader.displayName = "TableHeader";

const TableBody = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tbody
    ref={ref}
    className={cn("[&_tr:last-child]:border-0", className)}
    {...props}
  />
));
TableBody.displayName = "TableBody";

const TableRow = React.forwardRef<
  HTMLTableRowElement,
  React.HTMLAttributes<HTMLTableRowElement> & { compact?: boolean }
>(({ className, compact = false, ...props }, ref) => (
  <tr
    ref={ref}
    className={cn(
      "border-b border-slate-700/30 transition-all duration-150 hover:bg-gradient-to-r hover:from-slate-800/40 hover:via-slate-800/25 hover:to-transparent data-[state=selected]:bg-slate-800/50",
      compact ? "h-8" : "h-12",
      className
    )}
    {...props}
  />
));
TableRow.displayName = "TableRow";

const TableHead = React.forwardRef<
  HTMLTableCellElement,
  React.ThHTMLAttributes<HTMLTableCellElement> & { 
    compact?: boolean;
    sortable?: boolean;
    sorted?: "asc" | "desc" | false;
    onSort?: () => void;
  }
>(({ className, compact = false, sortable = false, sorted = false, onSort, children, style, ...props }, ref) => (
  <th
    ref={ref}
    className={cn(
      "text-left align-middle font-semibold text-slate-300 border-r border-slate-600/20 last:border-r-0 overflow-hidden",
      compact ? "h-8 px-2 text-xs" : "h-10 px-3 text-xs",
      sortable && "cursor-pointer hover:text-slate-100 select-none transition-colors",
      className
    )}
    onClick={sortable ? onSort : undefined}
    style={style}
    {...props}
  >
    <div className="flex items-center gap-1 truncate">
      {children}
      {sortable && (
        <div className="flex flex-col -space-y-1 flex-shrink-0">
          {sorted === "asc" ? (
            <ChevronUp className="h-3 w-3 text-rose-400" />
          ) : sorted === "desc" ? (
            <ChevronDown className="h-3 w-3 text-rose-400" />
          ) : (
            <ChevronsUpDown className="h-3 w-3 text-slate-500" />
          )}
        </div>
      )}
    </div>
  </th>
));
TableHead.displayName = "TableHead";

const TableCell = React.forwardRef<
  HTMLTableCellElement,
  React.TdHTMLAttributes<HTMLTableCellElement> & { compact?: boolean }
>(({ className, compact = false, style, ...props }, ref) => (
  <td
    ref={ref}
    className={cn(
      "align-middle text-slate-200 border-r border-slate-700/10 last:border-r-0 overflow-hidden",
      compact ? "px-2 py-1 text-xs" : "px-3 py-2 text-sm",
      className
    )}
    style={style}
    {...props}
  />
));
TableCell.displayName = "TableCell";

// Componente de paginador compacto
const DataTablePagination = <TData,>({ table, pageSizeOptions = [10, 15, 25, 50] }: { 
  table: TanstackTable<TData>; 
  pageSizeOptions?: number[];
}) => {
  return (
    <div className="flex items-center justify-between px-2 py-2 border-t border-slate-700/30 bg-slate-800/20 backdrop-blur-sm">
      <div className="flex items-center space-x-2">
        <p className="text-xs text-slate-400">
          Filas por página:
        </p>
        <select
          className="h-7 px-2 py-0 text-xs bg-slate-800/50 border border-slate-700 rounded text-slate-200 focus:outline-none focus:ring-1 focus:ring-rose-500/50"
          value={table.getState().pagination.pageSize}
          onChange={(e) => {
            table.setPageSize(Number(e.target.value));
          }}
        >
          {pageSizeOptions.map((pageSize) => (
            <option key={pageSize} value={pageSize}>
              {pageSize}
            </option>
          ))}
        </select>
      </div>
      
      <div className="flex items-center space-x-1">
        <p className="text-xs text-slate-400 mr-2">
          {table.getRowModel().rows.length === 0 ? (
            "0 registros"
          ) : (
            <>
              {table.getState().pagination.pageIndex * table.getState().pagination.pageSize + 1} - {" "}
              {Math.min((table.getState().pagination.pageIndex + 1) * table.getState().pagination.pageSize, table.getFilteredRowModel().rows.length)} de {" "}
              {table.getFilteredRowModel().rows.length} registros
            </>
          )}
        </p>
        
        <button
          className="inline-flex items-center justify-center h-7 w-7 rounded border border-slate-700 bg-slate-800/50 text-slate-400 hover:text-slate-200 hover:bg-slate-700/50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          onClick={() => table.setPageIndex(0)}
          disabled={!table.getCanPreviousPage()}
          title="Primera página"
        >
          <ChevronsLeft className="h-3 w-3" />
        </button>
        
        <button
          className="inline-flex items-center justify-center h-7 w-7 rounded border border-slate-700 bg-slate-800/50 text-slate-400 hover:text-slate-200 hover:bg-slate-700/50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          onClick={() => table.previousPage()}
          disabled={!table.getCanPreviousPage()}
          title="Página anterior"
        >
          <ChevronLeft className="h-3 w-3" />
        </button>
        
        <button
          className="inline-flex items-center justify-center h-7 w-7 rounded border border-slate-700 bg-slate-800/50 text-slate-400 hover:text-slate-200 hover:bg-slate-700/50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          onClick={() => table.nextPage()}
          disabled={!table.getCanNextPage()}
          title="Página siguiente"
        >
          <ChevronRight className="h-3 w-3" />
        </button>
        
        <button
          className="inline-flex items-center justify-center h-7 w-7 rounded border border-slate-700 bg-slate-800/50 text-slate-400 hover:text-slate-200 hover:bg-slate-700/50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          onClick={() => table.setPageIndex(table.getPageCount() - 1)}
          disabled={!table.getCanNextPage()}
          title="Última página"
        >
          <ChevronsRight className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
};

// Props para el DataTable compacto
interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  className?: string;
  emptyMessage?: string;
  compact?: boolean;
  maxHeight?: string;
  enableSorting?: boolean;
  enableVirtualization?: boolean;
  rowHeight?: number;
  showPagination?: boolean;
  pageSize?: number;
  pageSizeOptions?: number[];
}

// Componente principal DataTable compacto
export function DataTable<TData, TValue>({
  columns,
  data,
  className,
  emptyMessage = "No hay datos disponibles.",
  compact = true,
  maxHeight = "70vh",
  enableSorting = true,
  enableVirtualization = false,
  showPagination = true,
  pageSize = 15,
  pageSizeOptions = [10, 15, 25, 50],
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = React.useState<SortingState>([]);
  
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: enableSorting ? getSortedRowModel() : undefined,
    getPaginationRowModel: showPagination ? getPaginationRowModel() : undefined,
    onSortingChange: setSorting,
    initialState: {
      pagination: {
        pageSize,
      },
    },
    state: {
      sorting,
    },
  });

  // Configuración del virtualizador si está habilitado
  const parentRef = React.useRef<HTMLDivElement>(null);
  
  const virtualizer = useVirtualizer({
    count: data.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => compact ? 48 : 56,
    overscan: 5,
    enabled: enableVirtualization && data.length > 50,
  });

  const rows = table.getRowModel().rows;

  if (!enableVirtualization || data.length <= 50) {
    // Renderizado normal para pocos datos
    return (
      <TableWrapper className={className} compact={compact} maxHeight={maxHeight}>
        <div className="overflow-auto" style={{ maxHeight }}>
          <Table>
            <TableHeader compact={compact}>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id} className="hover:bg-transparent border-b border-slate-600" compact={compact}>
                  {headerGroup.headers.map((header) => (
                    <TableHead 
                      key={header.id} 
                      compact={compact}
                      sortable={header.column.getCanSort()}
                      sorted={
                        header.column.getIsSorted() === "asc" ? "asc" :
                        header.column.getIsSorted() === "desc" ? "desc" : 
                        false
                      }
                      onSort={() => header.column.toggleSorting()}
                      className="uppercase tracking-wider font-bold text-slate-300"
                      style={{ 
                        width: header.column.columnDef.size ? `${header.column.columnDef.size}px` : 'auto',
                        minWidth: header.column.columnDef.size ? `${header.column.columnDef.size}px` : 'auto',
                        maxWidth: header.column.columnDef.size ? `${header.column.columnDef.size}px` : 'auto'
                      }}
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {rows?.length ? (
                rows.map((row) => (
                  <TableRow
                    key={row.id}
                    data-state={row.getIsSelected() && "selected"}
                    className="group cursor-pointer"
                    compact={compact}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell 
                        key={cell.id} 
                        compact={compact} 
                        className="group-hover:text-white transition-colors"
                        style={{ 
                          width: cell.column.columnDef.size ? `${cell.column.columnDef.size}px` : 'auto',
                          minWidth: cell.column.columnDef.size ? `${cell.column.columnDef.size}px` : 'auto',
                          maxWidth: cell.column.columnDef.size ? `${cell.column.columnDef.size}px` : 'auto'
                        }}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow compact={compact}>
                  <TableCell colSpan={columns.length} className="h-24 text-center text-slate-400" compact={compact}>
                    <div className="flex flex-col items-center justify-center space-y-2 py-8">
                      <div className="text-3xl opacity-40">📊</div>
                      <div>{emptyMessage}</div>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        {showPagination && (
          <DataTablePagination table={table} pageSizeOptions={pageSizeOptions} />
        )}
      </TableWrapper>
    );
  }

  // Renderizado virtualizado para muchos datos
  return (
    <TableWrapper className={className} compact={compact} maxHeight={maxHeight}>
      <Table>
        <TableHeader compact={compact}>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id} className="hover:bg-transparent border-b border-slate-600" compact={compact}>
              {headerGroup.headers.map((header) => (
                <TableHead 
                  key={header.id} 
                  compact={compact}
                  sortable={header.column.getCanSort()}
                  sorted={
                    header.column.getIsSorted() === "asc" ? "asc" :
                    header.column.getIsSorted() === "desc" ? "desc" : 
                    false
                  }
                  onSort={() => header.column.toggleSorting()}
                  className="uppercase tracking-wider font-bold text-slate-300"
                >
                  {header.isPlaceholder
                    ? null
                    : flexRender(
                        header.column.columnDef.header,
                        header.getContext()
                      )}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
      </Table>
      
      <div
        ref={parentRef}
        className="overflow-auto"
        style={{ height: `calc(${maxHeight} - 48px)` }}
      >
        <div style={{ height: `${virtualizer.getTotalSize()}px`, position: "relative" }}>
          {virtualizer.getVirtualItems().map((virtualItem) => {
            const row = rows[virtualItem.index];
            return (
              <div
                key={row.id}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  height: `${virtualItem.size}px`,
                  transform: `translateY(${virtualItem.start}px)`,
                }}
              >
                <div className="flex w-full border-b border-slate-700/30 hover:bg-slate-800/30 transition-colors cursor-pointer group">
                  {row.getVisibleCells().map((cell) => (
                    <div
                      key={cell.id}
                      className={cn(
                        "flex-1 px-3 py-2 text-xs text-slate-200 group-hover:text-white transition-colors border-r border-slate-700/10 last:border-r-0 truncate",
                        compact && "py-1.5"
                      )}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </TableWrapper>
  );
}

// Componente de badge para estados
export function StatusBadge({
  status,
  variant = "default",
  className,
  children,
}: {
  status?: boolean | null;
  variant?: "default" | "success" | "danger" | "warning";
  className?: string;
  children?: React.ReactNode;
}) {
  const variants = {
    default: "bg-slate-700/50 text-slate-300 border-slate-600",
    success: "bg-green-500/20 text-green-400 border-green-500/30",
    danger: "bg-red-500/20 text-red-400 border-red-500/30",
    warning: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  };

  const getVariantByStatus = (status: boolean | null) => {
    if (status === true) return "success";
    if (status === false) return "danger";
    return "default";
  };

  const finalVariant = status !== undefined ? getVariantByStatus(status) : variant;

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold transition-colors",
        variants[finalVariant],
        className
      )}
    >
      {children}
    </span>
  );
}

// Componente para códigos
export function CodeDisplay({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <code
      className={cn(
        "rounded-md bg-slate-700/30 border border-slate-600/30 px-2 py-1 text-xs font-mono text-slate-300 shadow-inner",
        className
      )}
    >
      {children}
    </code>
  );
}

export {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
  TableWrapper,
};