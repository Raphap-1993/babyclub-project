-- Migration: Mesas por Organizador (no por Evento)
-- Purpose: Las mesas pertenecen al local del organizador, no a eventos específicos
-- Benefit: Elimina duplicación, configuración única reutilizable
-- Date: 2026-02-08

BEGIN;

-- =====================================================
-- PASO 1: Crear tabla de disponibilidad de mesas
-- =====================================================

CREATE TABLE IF NOT EXISTS public.table_availability (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_id uuid NOT NULL REFERENCES public.tables(id) ON DELETE CASCADE,
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  is_available boolean NOT NULL DEFAULT true,
  
  -- Override de configuración por evento (opcional)
  custom_price numeric(10,2),
  custom_min_consumption numeric(10,2),
  notes text,
  
  -- Auditoría
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  
  -- Constraint: Una mesa solo puede tener un registro por evento
  UNIQUE(table_id, event_id)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_table_availability_event 
  ON public.table_availability(event_id) 
  WHERE is_available = true;

CREATE INDEX IF NOT EXISTS idx_table_availability_table 
  ON public.table_availability(table_id);

CREATE INDEX IF NOT EXISTS idx_table_availability_event_available
  ON public.table_availability(event_id, is_available);

-- =====================================================
-- PASO 2: Migrar datos existentes
-- =====================================================

-- Insertar registros de disponibilidad para todas las mesas existentes
-- que tienen event_id definido
INSERT INTO public.table_availability (table_id, event_id, is_available, custom_price, custom_min_consumption)
SELECT 
  t.id as table_id,
  t.event_id,
  t.is_active as is_available,
  t.price as custom_price,
  t.min_consumption as custom_min_consumption
FROM public.tables t
WHERE t.event_id IS NOT NULL
  AND t.deleted_at IS NULL
ON CONFLICT (table_id, event_id) DO NOTHING;

-- =====================================================
-- PASO 3: Eliminar event_id de tables (ya no es necesario)
-- =====================================================

-- Las mesas ahora solo pertenecen al organizador
ALTER TABLE public.tables DROP COLUMN IF EXISTS event_id;

-- =====================================================
-- PASO 4: Función helper para auto-crear disponibilidad
-- =====================================================

-- Cuando se crea un evento nuevo, auto-crear disponibilidad
-- para todas las mesas del organizador
CREATE OR REPLACE FUNCTION public.auto_create_table_availability()
RETURNS TRIGGER AS $$
BEGIN
  -- Solo para eventos nuevos con organizador definido
  IF NEW.organizer_id IS NOT NULL THEN
    -- Insertar disponibilidad para todas las mesas del organizador
    INSERT INTO public.table_availability (table_id, event_id, is_available)
    SELECT 
      t.id,
      NEW.id,
      true  -- Por defecto todas disponibles
    FROM public.tables t
    WHERE t.organizer_id = NEW.organizer_id
      AND t.deleted_at IS NULL
      AND t.is_active = true
    ON CONFLICT (table_id, event_id) DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para auto-crear disponibilidad en eventos nuevos
DROP TRIGGER IF EXISTS trigger_auto_create_table_availability ON public.events;
CREATE TRIGGER trigger_auto_create_table_availability
  AFTER INSERT ON public.events
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_create_table_availability();

-- =====================================================
-- PASO 5: Función para sincronizar nuevas mesas
-- =====================================================

-- Cuando se crea una mesa nueva, agregarla a todos los eventos
-- activos del organizador
CREATE OR REPLACE FUNCTION public.auto_add_table_to_events()
RETURNS TRIGGER AS $$
BEGIN
  -- Solo para mesas nuevas con organizador definido
  IF NEW.organizer_id IS NOT NULL AND NEW.is_active = true THEN
    -- Insertar disponibilidad en todos los eventos activos del organizador
    INSERT INTO public.table_availability (table_id, event_id, is_available)
    SELECT 
      NEW.id,
      e.id,
      true  -- Por defecto disponible
    FROM public.events e
    WHERE e.organizer_id = NEW.organizer_id
      AND e.is_active = true
      AND e.deleted_at IS NULL
    ON CONFLICT (table_id, event_id) DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para auto-agregar mesas a eventos existentes
DROP TRIGGER IF EXISTS trigger_auto_add_table_to_events ON public.tables;
CREATE TRIGGER trigger_auto_add_table_to_events
  AFTER INSERT ON public.tables
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_add_table_to_events();

-- =====================================================
-- PASO 6: Comentarios y documentación
-- =====================================================

COMMENT ON TABLE public.table_availability IS 
  'Define qué mesas están disponibles para cada evento. Las mesas pertenecen al organizador (local físico), no a eventos específicos.';

COMMENT ON COLUMN public.table_availability.is_available IS 
  'Si la mesa está disponible para reserva en este evento (ej: false si está en mantenimiento)';

COMMENT ON COLUMN public.table_availability.custom_price IS 
  'Precio override para este evento específico. Si NULL, usa el precio base de la mesa.';

COMMENT ON COLUMN public.table_availability.custom_min_consumption IS 
  'Consumo mínimo override para este evento. Si NULL, usa el consumo base de la mesa.';

COMMIT;

-- =====================================================
-- VERIFICACIÓN POST-MIGRACIÓN
-- =====================================================

-- Verificar que todas las mesas tienen al menos un evento
DO $$
DECLARE
  tables_sin_eventos INTEGER;
BEGIN
  SELECT COUNT(DISTINCT t.id)
  INTO tables_sin_eventos
  FROM public.tables t
  LEFT JOIN public.table_availability ta ON t.id = ta.table_id
  WHERE t.deleted_at IS NULL 
    AND ta.id IS NULL;
  
  IF tables_sin_eventos > 0 THEN
    RAISE NOTICE 'ADVERTENCIA: % mesas sin eventos asignados', tables_sin_eventos;
  ELSE
    RAISE NOTICE '✅ Migración exitosa: Todas las mesas tienen disponibilidad';
  END IF;
END $$;
