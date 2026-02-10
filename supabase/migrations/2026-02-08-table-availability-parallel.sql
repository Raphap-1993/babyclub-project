-- =====================================================
-- Migración: Agregar table_availability (implementación gradual)
-- Fecha: 2026-02-08
-- Estrategia: Opción B - Sistema dual sin romper funcionalidad existente
-- =====================================================

-- PASO 1: Crear tabla de disponibilidad (junction table)
-- Esta tabla permitirá gestionar qué mesas están disponibles por evento
-- SIN eliminar event_id de la tabla tables
CREATE TABLE IF NOT EXISTS table_availability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_id UUID NOT NULL REFERENCES tables(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  is_available BOOLEAN NOT NULL DEFAULT true,
  custom_price NUMERIC(10,2), -- Precio personalizado para este evento (null = usar precio de mesa)
  custom_min_consumption NUMERIC(10,2), -- Consumo mínimo personalizado (null = usar de mesa)
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT unique_table_event UNIQUE(table_id, event_id)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_table_availability_table_id ON table_availability(table_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_table_availability_event_id ON table_availability(event_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_table_availability_deleted ON table_availability(deleted_at);

-- PASO 2: Migrar datos existentes
-- Crear registros de disponibilidad para todas las mesas que tienen event_id
INSERT INTO table_availability (table_id, event_id, is_available, created_at, updated_at)
SELECT 
  id as table_id,
  event_id,
  true as is_available,
  created_at,
  now() as updated_at
FROM tables
WHERE event_id IS NOT NULL 
  AND deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM table_availability ta 
    WHERE ta.table_id = tables.id 
    AND ta.event_id = tables.event_id
  );

-- PASO 3: Trigger para auto-crear disponibilidad cuando se crea mesa con event_id
-- Esto mantiene compatibilidad con código actual
CREATE OR REPLACE FUNCTION auto_create_table_availability()
RETURNS TRIGGER AS $$
BEGIN
  -- Si la mesa se crea con event_id, crear registro de disponibilidad
  IF NEW.event_id IS NOT NULL THEN
    INSERT INTO table_availability (table_id, event_id, is_available, created_at, updated_at)
    VALUES (NEW.id, NEW.event_id, true, now(), now())
    ON CONFLICT (table_id, event_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_auto_table_availability ON tables;
CREATE TRIGGER trigger_auto_table_availability
  AFTER INSERT ON tables
  FOR EACH ROW
  EXECUTE FUNCTION auto_create_table_availability();

-- PASO 4: Trigger para sincronizar cuando se actualiza event_id en tabla existente
CREATE OR REPLACE FUNCTION sync_table_availability_on_update()
RETURNS TRIGGER AS $$
BEGIN
  -- Si cambia el event_id, actualizar disponibilidad
  IF NEW.event_id IS DISTINCT FROM OLD.event_id THEN
    -- Marcar antigua disponibilidad como eliminada
    IF OLD.event_id IS NOT NULL THEN
      UPDATE table_availability 
      SET deleted_at = now() 
      WHERE table_id = OLD.id AND event_id = OLD.event_id;
    END IF;
    
    -- Crear nueva disponibilidad
    IF NEW.event_id IS NOT NULL THEN
      INSERT INTO table_availability (table_id, event_id, is_available, created_at, updated_at)
      VALUES (NEW.id, NEW.event_id, true, now(), now())
      ON CONFLICT (table_id, event_id) DO UPDATE SET deleted_at = NULL, updated_at = now();
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_sync_table_availability ON tables;
CREATE TRIGGER trigger_sync_table_availability
  AFTER UPDATE ON tables
  FOR EACH ROW
  EXECUTE FUNCTION sync_table_availability_on_update();

-- PASO 5: Función helper para obtener mesas disponibles por evento
-- Usa COALESCE para precio/consumo personalizado
CREATE OR REPLACE FUNCTION get_available_tables_for_event(p_event_id UUID)
RETURNS TABLE (
  table_id UUID,
  table_name TEXT,
  ticket_count INT,
  final_price NUMERIC(10,2),
  final_min_consumption NUMERIC(10,2),
  is_active BOOLEAN,
  notes TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    t.id as table_id,
    t.name as table_name,
    t.ticket_count,
    COALESCE(ta.custom_price, t.price) as final_price,
    COALESCE(ta.custom_min_consumption, t.min_consumption) as final_min_consumption,
    t.is_active,
    COALESCE(ta.notes, t.notes) as notes
  FROM tables t
  INNER JOIN table_availability ta ON ta.table_id = t.id
  WHERE ta.event_id = p_event_id
    AND ta.is_available = true
    AND ta.deleted_at IS NULL
    AND t.deleted_at IS NULL
    AND t.is_active = true;
END;
$$ LANGUAGE plpgsql;

-- PASO 6: Trigger para auto-crear disponibilidad cuando se crea un nuevo evento
-- Esto permite que las mesas del organizador estén automáticamente disponibles
CREATE OR REPLACE FUNCTION auto_create_availability_for_new_event()
RETURNS TRIGGER AS $$
BEGIN
  -- Crear disponibilidad para todas las mesas activas del mismo organizador
  INSERT INTO table_availability (table_id, event_id, is_available, created_at, updated_at)
  SELECT 
    t.id as table_id,
    NEW.id as event_id,
    true as is_available,
    now() as created_at,
    now() as updated_at
  FROM tables t
  WHERE t.organizer_id = NEW.organizer_id
    AND t.deleted_at IS NULL
    AND t.is_active = true
  ON CONFLICT (table_id, event_id) DO NOTHING;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_auto_availability_new_event ON events;
CREATE TRIGGER trigger_auto_availability_new_event
  AFTER INSERT ON events
  FOR EACH ROW
  EXECUTE FUNCTION auto_create_availability_for_new_event();

-- =====================================================
-- VERIFICACIONES
-- =====================================================

-- Contar registros migrados
DO $$
DECLARE
  v_count INT;
BEGIN
  SELECT COUNT(*) INTO v_count FROM table_availability;
  RAISE NOTICE 'Registros en table_availability: %', v_count;
END $$;

-- Verificar integridad
DO $$
DECLARE
  v_orphans INT;
BEGIN
  SELECT COUNT(*) INTO v_orphans 
  FROM table_availability ta
  WHERE NOT EXISTS (SELECT 1 FROM tables t WHERE t.id = ta.table_id)
     OR NOT EXISTS (SELECT 1 FROM events e WHERE e.id = ta.event_id);
  
  IF v_orphans > 0 THEN
    RAISE WARNING 'Encontrados % registros huérfanos en table_availability', v_orphans;
  ELSE
    RAISE NOTICE 'Integridad verificada: sin huérfanos';
  END IF;
END $$;

-- =====================================================
-- COMENTARIOS PARA PRÓXIMA FASE
-- =====================================================
-- NOTA: Esta migración mantiene event_id en tabla tables.
-- En la siguiente fase (cuando todo el código use table_availability):
-- 1. Verificar que NO hay queries usando tables.event_id
-- 2. Ejecutar: ALTER TABLE tables DROP COLUMN event_id;
-- 3. Remover triggers de sincronización
-- =====================================================
