import * as React from "react"
import { toast as sonnerToast, Toaster as SonnerToaster } from "sonner"
import { CheckCircle, XCircle, AlertCircle, Info } from "lucide-react"

export interface ToastProps {
  title?: string
  description?: string
  variant?: "success" | "error" | "warning" | "info" | "default"
  duration?: number
}

// Toast function helper
export const toast = {
  success: (message: string, options?: Omit<ToastProps, "variant">) => {
    return sonnerToast.success(message, {
      duration: options?.duration || 4000,
      icon: <CheckCircle className="w-4 h-4 text-green-500" />,
      ...options,
    })
  },
  
  error: (message: string, options?: Omit<ToastProps, "variant">) => {
    return sonnerToast.error(message, {
      duration: options?.duration || 5000,
      icon: <XCircle className="w-4 h-4 text-red-500" />,
      ...options,
    })
  },
  
  warning: (message: string, options?: Omit<ToastProps, "variant">) => {
    return sonnerToast.warning(message, {
      duration: options?.duration || 4000,
      icon: <AlertCircle className="w-4 h-4 text-amber-500" />,
      ...options,
    })
  },
  
  info: (message: string, options?: Omit<ToastProps, "variant">) => {
    return sonnerToast.info(message, {
      duration: options?.duration || 4000,
      icon: <Info className="w-4 h-4 text-blue-500" />,
      ...options,
    })
  },
  
  default: (message: string, options?: Omit<ToastProps, "variant">) => {
    return sonnerToast(message, {
      duration: options?.duration || 4000,
      ...options,
    })
  },
}

// Toaster component - add this to your root layout
export function Toaster() {
  return (
    <SonnerToaster
      position="bottom-right"
      toastOptions={{
        style: {
          background: 'hsl(var(--card))',
          color: 'hsl(var(--card-foreground))',
          border: '1px solid hsl(var(--border))',
        },
      }}
      className="toaster group"
    />
  )
}

export { sonnerToast as toastBase }