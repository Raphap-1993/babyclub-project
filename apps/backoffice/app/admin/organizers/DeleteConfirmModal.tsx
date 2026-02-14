"use client";

import { AlertTriangle, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface DeleteConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  organizerName: string;
  isLoading?: boolean;
}

export function DeleteConfirmModal({ 
  isOpen, 
  onClose, 
  onConfirm, 
  organizerName, 
  isLoading = false 
}: DeleteConfirmModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative w-full max-w-md mx-4 bg-neutral-800 rounded-xl border border-neutral-700 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-neutral-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-500/20 rounded-lg">
              <AlertTriangle className="h-5 w-5 text-red-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">
                Confirmar Eliminación
              </h2>
              <p className="text-sm text-neutral-400">
                Esta acción no se puede deshacer
              </p>
            </div>
          </div>
          
          <Button
            onClick={onClose}
            variant="ghost"
            size="icon"
            className="h-9 w-9 text-neutral-400 hover:bg-neutral-700 hover:text-neutral-200"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Content */}
        <div className="p-6">
          <p className="text-neutral-300 mb-2">
            ¿Estás seguro que deseas eliminar el organizador:
          </p>
          <p className="text-white font-semibold text-lg mb-4">
            "{organizerName}"
          </p>
          <div className="bg-red-900/30 border border-red-700 rounded-lg p-3 mb-6">
            <p className="text-red-200 text-sm">
              ⚠️ Solo se puede eliminar si no tiene eventos activos asociados.
            </p>
          </div>

          {/* Buttons */}
          <div className="flex gap-3">
            <Button
              type="button"
              onClick={onClose}
              variant="outline"
              className="flex-1 border-neutral-600 text-neutral-300 hover:bg-neutral-700"
            >
              Cancelar
            </Button>
            <Button
              onClick={onConfirm}
              disabled={isLoading}
              className="flex-1 bg-gradient-to-r from-red-500 to-red-600 text-white hover:from-red-400 hover:to-red-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isLoading ? 'Eliminando...' : 'Eliminar'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
