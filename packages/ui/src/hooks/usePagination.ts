"use client"

import { useState, useMemo } from "react"
import { useRouter, useSearchParams } from "next/navigation"

export interface PaginationState {
  page: number
  pageSize: number
  total: number
}

export interface PaginationInfo {
  page: number
  pageSize: number
  total: number
  totalPages: number
  hasNext: boolean
  hasPrev: boolean
  from: number
  to: number
}

export interface UsePaginationOptions {
  initialPage?: number
  initialPageSize?: number
  pageSizeOptions?: number[]
  basePath?: string
  searchParamKeys?: {
    page?: string
    pageSize?: string
  }
}

export interface UsePaginationReturn {
  // Estado actual
  pagination: PaginationInfo
  
  // Acciones
  setPage: (page: number) => void
  setPageSize: (pageSize: number) => void
  nextPage: () => void
  prevPage: () => void
  goToFirstPage: () => void
  goToLastPage: () => void
  
  // Para queries BD
  getDbParams: () => { offset: number; limit: number }
  
  // Para URLs
  getPageUrl: (page: number) => string
  getPageSizeUrl: (pageSize: number) => string
  
  // Opciones
  pageSizeOptions: number[]
}

export function usePagination({
  initialPage = 1,
  initialPageSize = 10,
  pageSizeOptions = [5, 10, 20, 50, 100],
  basePath,
  searchParamKeys = { page: 'page', pageSize: 'pageSize' }
}: UsePaginationOptions = {}): UsePaginationReturn {
  const router = useRouter()
  const searchParams = useSearchParams()
  
  // Leer parámetros de URL si están disponibles
  const urlPage = searchParams.get(searchParamKeys.page || 'page')
  const urlPageSize = searchParams.get(searchParamKeys.pageSize || 'pageSize')
  
  const [page, setPageState] = useState(() => {
    return urlPage ? Math.max(1, parseInt(urlPage)) : initialPage
  })
  
  const [pageSize, setPageSizeState] = useState(() => {
    const size = urlPageSize ? parseInt(urlPageSize) : initialPageSize
    return pageSizeOptions.includes(size) ? size : initialPageSize
  })
  
  const [total, setTotalState] = useState(0)

  // Información calculada
  const pagination = useMemo((): PaginationInfo => {
    const totalPages = Math.max(1, Math.ceil(total / pageSize))
    const currentPage = Math.min(page, totalPages)
    
    return {
      page: currentPage,
      pageSize,
      total,
      totalPages,
      hasNext: currentPage < totalPages,
      hasPrev: currentPage > 1,
      from: total === 0 ? 0 : (currentPage - 1) * pageSize + 1,
      to: Math.min(currentPage * pageSize, total)
    }
  }, [page, pageSize, total])

  // Función para actualizar URL
  const updateUrl = (newPage: number, newPageSize?: number) => {
    if (!basePath) return
    
    const params = new URLSearchParams(searchParams.toString())
    params.set(searchParamKeys.page || 'page', newPage.toString())
    
    if (newPageSize !== undefined) {
      params.set(searchParamKeys.pageSize || 'pageSize', newPageSize.toString())
    }
    
    router.push(`${basePath}?${params.toString()}`)
  }

  // Acciones
  const setPage = (newPage: number) => {
    const safePage = Math.max(1, Math.min(newPage, pagination.totalPages))
    setPageState(safePage)
    updateUrl(safePage)
  }

  const setPageSize = (newPageSize: number) => {
    if (!pageSizeOptions.includes(newPageSize)) return
    
    setPageSizeState(newPageSize)
    // Recalcular página para mantener posición aproximada
    const currentItem = (page - 1) * pageSize + 1
    const newPage = Math.max(1, Math.ceil(currentItem / newPageSize))
    setPageState(newPage)
    updateUrl(newPage, newPageSize)
  }

  const nextPage = () => {
    if (pagination.hasNext) {
      setPage(page + 1)
    }
  }

  const prevPage = () => {
    if (pagination.hasPrev) {
      setPage(page - 1)
    }
  }

  const goToFirstPage = () => setPage(1)
  
  const goToLastPage = () => setPage(pagination.totalPages)

  // Para consultas a BD
  const getDbParams = () => ({
    offset: (pagination.page - 1) * pagination.pageSize,
    limit: pagination.pageSize
  })

  // Para construir URLs
  const getPageUrl = (targetPage: number) => {
    if (!basePath) return '#'
    const params = new URLSearchParams(searchParams.toString())
    params.set(searchParamKeys.page || 'page', targetPage.toString())
    return `${basePath}?${params.toString()}`
  }

  const getPageSizeUrl = (targetPageSize: number) => {
    if (!basePath) return '#'
    const params = new URLSearchParams(searchParams.toString())
    params.set(searchParamKeys.pageSize || 'pageSize', targetPageSize.toString())
    params.set(searchParamKeys.page || 'page', '1') // Reset a página 1
    return `${basePath}?${params.toString()}`
  }

  // Método para que el componente padre actualice el total
  const updateTotal = (newTotal: number) => {
    setTotalState(newTotal)
  }

  return {
    pagination,
    setPage,
    setPageSize,
    nextPage,
    prevPage,
    goToFirstPage,
    goToLastPage,
    getDbParams,
    getPageUrl,
    getPageSizeUrl,
    pageSizeOptions,
    // Función interna para actualizar total (no la exportamos en el tipo)
    updateTotal
  } as UsePaginationReturn & { updateTotal: (total: number) => void }
}