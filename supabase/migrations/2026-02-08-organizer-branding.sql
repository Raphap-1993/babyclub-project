-- Agregar columnas de branding y layout a organizers
-- Fecha: 2026-02-08

ALTER TABLE public.organizers
ADD COLUMN IF NOT EXISTS logo_url text,
ADD COLUMN IF NOT EXISTS layout_url text;

COMMENT ON COLUMN public.organizers.logo_url IS 'URL del logo del organizador (opcional)';
COMMENT ON COLUMN public.organizers.layout_url IS 'URL de la imagen de fondo del croquis (opcional)';
