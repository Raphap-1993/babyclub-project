"use client";

import { useState, useEffect } from "react";
import { X, Building2, ToggleLeft, ToggleRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface OrganizerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: OrganizerFormData) => void;
  organizer?: {
    id: string;
    name: string;
    slug: string;
    is_active: boolean;
    sort_order: number;
  } | null;
  isLoading?: boolean;
}

export interface OrganizerFormData {
  name: string;
  slug: string;
  is_active: boolean;
}

export function OrganizerModal({ isOpen, onClose, onSave, organizer, isLoading = false }: OrganizerModalProps) {
  const [formData, setFormData] = useState<OrganizerFormData>({
    name: "",
    slug: "",
    is_active: true,
  });
  
  const [errors, setErrors] = useState<{
    name?: string;
    slug?: string;
  }>({});
  const isEditing = !!organizer;

  // Resetear form cuando se abre/cierra modal
  useEffect(() => {
    if (isOpen) {
      if (organizer) {
        setFormData({
          name: organizer.name,
          slug: organizer.slug,
          is_active: organizer.is_active,
        });
      } else {
        setFormData({
          name: "",
          slug: "",
          is_active: true,
        });
      }
      setErrors({});
    }
  }, [isOpen, organizer]);

  // Auto-generar slug cuando se escribe el nombre (solo para crear)
  const handleNameChange = (name: string) => {
    setFormData(prev => ({
      ...prev,
      name,
      slug: !isEditing ? generateSlug(name) : prev.slug
    }));
  };

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
  };

  const validateForm = (): boolean => {
    const newErrors: {
      name?: string;
      slug?: string;
    } = {};
    
    if (!formData.name.trim()) {
      newErrors.name = "El nombre es requerido";
    }
    
    if (!formData.slug.trim()) {
      newErrors.slug = "El slug es requerido";
    } else if (!/^[a-z0-9-]+$/.test(formData.slug)) {
      newErrors.slug = "Solo letras minúsculas, números y guiones";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateForm()) {
      onSave(formData);
    }
  };

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
            <div className="p-2 bg-neutral-500/20 rounded-lg">
              <Building2 className="h-5 w-5 text-neutral-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">
                {isEditing ? "Editar Organizador" : "Nuevo Organizador"}
              </h2>
              <p className="text-sm text-neutral-400">
                {isEditing ? "Modifica los datos del organizador" : "Crea un nuevo organizador"}
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

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Nombre */}
          <div>
            <label className="block text-sm font-medium text-neutral-300 mb-2">
              Nombre del Organizador
            </label>
            <Input
              type="text"
              value={formData.name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="Ej: Baby Club, Colorimetría..."
              className="h-10 border-neutral-600 bg-neutral-700 text-white placeholder:text-neutral-400 focus:border-neutral-500/50 focus:ring-2 focus:ring-neutral-500/50"
            />
            {errors.name && (
              <p className="mt-1 text-sm text-red-400">{errors.name}</p>
            )}
          </div>

          {/* Slug */}
          <div>
            <label className="block text-sm font-medium text-neutral-300 mb-2">
              Identificador (Slug)
            </label>
            <Input
              type="text"
              value={formData.slug}
              onChange={(e) => setFormData(prev => ({ ...prev, slug: e.target.value }))}
              placeholder="baby-club"
              disabled={!isEditing} // Solo editable en modo edición
              className="h-10 border-neutral-600 bg-neutral-700 text-white placeholder:text-neutral-400 focus:border-neutral-500/50 focus:ring-2 focus:ring-neutral-500/50 disabled:cursor-not-allowed disabled:opacity-50"
            />
            {errors.slug && (
              <p className="mt-1 text-sm text-red-400">{errors.slug}</p>
            )}
            <p className="mt-1 text-xs text-neutral-400">
              Se usa en URLs y debe ser único
            </p>
          </div>

          {/* Estado Activo */}
          <div>
            <label className="block text-sm font-medium text-neutral-300 mb-2">
              Estado
            </label>
            <Button
              type="button"
              onClick={() => setFormData(prev => ({ ...prev, is_active: !prev.is_active }))}
              variant="outline"
              className={`w-full justify-start gap-3 p-3 transition-colors ${
                formData.is_active 
                  ? 'bg-green-500/20 border-green-500/50 text-green-300'
                  : 'bg-neutral-700 border-neutral-600 text-neutral-300'
              }`}
            >
              {formData.is_active ? (
                <ToggleRight className="h-5 w-5 text-green-400" />
              ) : (
                <ToggleLeft className="h-5 w-5 text-neutral-400" />
              )}
              <span className="font-medium">
                {formData.is_active ? 'Activo' : 'Inactivo'}
              </span>
            </Button>
          </div>

          {/* Buttons */}
          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              onClick={onClose}
              variant="outline"
              className="flex-1 border-neutral-600 text-neutral-300 hover:bg-neutral-700"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isLoading}
              className="flex-1 bg-gradient-to-r from-neutral-500 to-neutral-600 text-white hover:from-neutral-400 hover:to-neutral-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isLoading ? 'Guardando...' : (isEditing ? 'Guardar' : 'Crear')}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
