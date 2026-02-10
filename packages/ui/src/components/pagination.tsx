"use client"

import * as React from "react"
import { Button } from "./button"
import { Select } from "./select"
import { 
  ChevronLeft, 
  ChevronRight, 
  ChevronsLeft, 
  ChevronsRight,
  MoreHorizontal
} from "lucide-react"
import { PaginationInfo } from "../hooks/usePagination"

export interface PaginationProps {
  pagination: PaginationInfo
  onPageChange: (page: number) => void
  onPageSizeChange?: (pageSize: number) => void
  pageSizeOptions?: number[]
  showPageSizeSelector?: boolean
  showInfo?: boolean
  showQuickJumper?: boolean
  className?: string
  compact?: boolean // Versión compacta para mobile
}

export function Pagination({
  pagination,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [5, 10, 20, 50, 100],
  showPageSizeSelector = true,
  showInfo = true,
  // showQuickJumper = false,
  className = "",
  compact = false
}: PaginationProps) {
  const { page, pageSize, total, totalPages, hasNext, hasPrev, from, to } = pagination

  // Generar números de página para mostrar
  const getPageNumbers = (): (number | 'ellipsis')[] => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1)
    }

    const pages: (number | 'ellipsis')[] = []

    // Siempre mostrar primera página
    pages.push(1)

    if (page <= 4) {
      // Páginas iniciales: [1] 2 3 4 5 ... 10
      for (let i = 2; i <= Math.min(5, totalPages); i++) {
        pages.push(i)
      }
      if (totalPages > 5) {
        pages.push('ellipsis')
        pages.push(totalPages)
      }
    } else if (page >= totalPages - 3) {
      // Páginas finales: 1 ... 6 7 8 9 [10]
      pages.push('ellipsis')
      for (let i = Math.max(totalPages - 4, 2); i <= totalPages; i++) {
        pages.push(i)
      }
    } else {
      // Páginas medias: 1 ... 4 [5] 6 ... 10
      pages.push('ellipsis')
      for (let i = page - 1; i <= page + 1; i++) {
        pages.push(i)
      }
      pages.push('ellipsis')
      pages.push(totalPages)
    }

    return pages
  }

  // Versión compacta para mobile
  if (compact) {
    return (
      <div className={`flex items-center justify-between gap-2 ${className}`}>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(page - 1)}
          disabled={!hasPrev}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        
        <span className="text-sm text-gray-600 dark:text-gray-400">
          {page} / {totalPages}
        </span>
        
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(page + 1)}
          disabled={!hasNext}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    )
  }

  return (
    <div className={`flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${className}`}>
      {/* Información y selector de página */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
        {showInfo && (
          <div className="text-sm text-gray-600 dark:text-gray-400">
            Mostrando <span className="font-medium">{from}</span> a <span className="font-medium">{to}</span> de{" "}
            <span className="font-medium">{total}</span> resultados
          </div>
        )}
        
        {showPageSizeSelector && onPageSizeChange && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600 dark:text-gray-400">
              Mostrar:
            </span>
            <Select
              value={pageSize.toString()}
              onChange={(e) => onPageSizeChange(parseInt(e.target.value))}
              options={pageSizeOptions.map(size => ({
                value: size.toString(),
                label: `${size} por página`
              }))}
              className="w-auto min-w-0"
            />
          </div>
        )}
      </div>

      {/* Controles de navegación */}
      <div className="flex items-center gap-1">
        {/* Ir al inicio */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(1)}
          disabled={!hasPrev}
          className="hidden sm:inline-flex"
        >
          <ChevronsLeft className="h-4 w-4" />
        </Button>

        {/* Página anterior */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(page - 1)}
          disabled={!hasPrev}
        >
          <ChevronLeft className="h-4 w-4" />
          <span className="hidden sm:inline">Anterior</span>
        </Button>

        {/* Números de página */}
        <div className="flex items-center gap-1">
          {getPageNumbers().map((pageNum, index) => {
            if (pageNum === 'ellipsis') {
              return (
                <div key={`ellipsis-${index}`} className="px-2">
                  <MoreHorizontal className="h-4 w-4 text-gray-400" />
                </div>
              )
            }
            
            return (
              <Button
                key={pageNum}
                variant={pageNum === page ? "primary" : "outline"}
                size="sm"
                onClick={() => onPageChange(pageNum)}
                className="min-w-[40px]"
              >
                {pageNum}
              </Button>
            )
          })}
        </div>

        {/* Página siguiente */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(page + 1)}
          disabled={!hasNext}
        >
          <span className="hidden sm:inline">Siguiente</span>
          <ChevronRight className="h-4 w-4" />
        </Button>

        {/* Ir al final */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(totalPages)}
          disabled={!hasNext}
          className="hidden sm:inline-flex"
        >
          <ChevronsRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}

// Componente más simple para casos básicos
export function SimplePagination({
  pagination,
  onPageChange,
  className = ""
}: Pick<PaginationProps, 'pagination' | 'onPageChange' | 'className'>) {
  const { page, totalPages, hasNext, hasPrev } = pagination

  return (
    <div className={`flex items-center justify-center gap-2 ${className}`}>
      <Button
        variant="outline"
        size="sm"
        onClick={() => onPageChange(page - 1)}
        disabled={!hasPrev}
      >
        <ChevronLeft className="h-4 w-4" />
        Anterior
      </Button>
      
      <span className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400">
        Página {page} de {totalPages}
      </span>
      
      <Button
        variant="outline"
        size="sm"
        onClick={() => onPageChange(page + 1)}
        disabled={!hasNext}
      >
        Siguiente
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  )
}