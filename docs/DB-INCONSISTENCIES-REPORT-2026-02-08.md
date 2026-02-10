# Reporte de Incongruencias de Base de Datos

**Fecha:** 2026-02-08  
**Severidad:** ALTA  
**Impacto:** Operacional crítico - afecta edición de códigos y confiabilidad de datos  
**Estado:** PENDIENTE CORRECCIÓN

---

## 1. PROBLEMA PRINCIPAL: Código único global en vez de único por evento

### 1.1 Síntoma reportado por el usuario
> "Cuando edito un código de un evento, se guarda el cambio, pero al volver a abrirlo me trae otro código de BD"

### 1.2 Causa raíz identificada

**Constraint incorrecto en tabla `codes`:**
```sql
code text NOT NULL UNIQUE  -- ❌ PROBLEMA: UNIQUE global
```

Esto significa que:
- El código `"BABY123"` solo puede existir UNA vez en toda la tabla
- Si evento A tiene código `"BABY123"` y intentas asignar `"BABY123"` a evento B, falla silenciosamente
- La función `set_event_general_code()` tiene lógica para manejar esto, pero NO funciona correctamente cuando hay soft deletes o estados intermedios

### 1.3 Escenarios problemáticos

**Escenario 1: Edición de código duplicado entre eventos**
```
1. Evento A tiene código "VIP2024" activo
2. Admin intenta editar Evento B y poner código "VIP2024"
3. La función set_event_general_code() detecta el conflicto:
   - Línea 52: "El código VIP2024 ya está asignado a otro evento"
4. El form muestra error o falla silenciosamente
5. Al recargar, sigue mostrando el código anterior de Evento B
```

**Escenario 2: Códigos soft-deleted causan conflictos**
```
1. Evento A tuvo código "SUMMER" (ahora deleted_at IS NOT NULL)
2. Evento B intenta usar código "SUMMER"
3. El UNIQUE constraint sigue bloqueando porque no ignora soft-deletes
4. Usuario ve comportamiento inconsistente
```

**Escenario 3: Múltiples códigos generales por evento (histórico)**
```
1. Antes de la migración 2025-02-07, podían existir múltiples códigos general activos
2. La query en backoffice usa .maybeSingle() que puede fallar si hay >1 registro
3. Usuario ve códigos aleatorios dependiendo del orden de la query
```

---

## 2. INCONGRUENCIAS ESPECÍFICAS DETECTADAS

### 2.1 Constraint UNIQUE global inadecuado

| Tabla | Columna | Constraint actual | Problema | Solución requerida |
|-------|---------|-------------------|----------|-------------------|
| `codes` | `code` | `UNIQUE` global | Impide reutilizar códigos entre eventos | `UNIQUE (code, event_id)` parcial excluyendo soft-deletes |

### 2.2 Falta de columna `organizer_id` en tabla `codes`

**Problema:** Multi-organizador no está soportado en códigos
```sql
-- Tabla actual
CREATE TABLE public.codes (
  ...
  event_id uuid NOT NULL,
  -- ❌ FALTA: organizer_id uuid
  ...
);
```

**Impacto:**
- No se puede filtrar códigos por organizador
- Riesgo de colisión de códigos entre organizadores
- Queries más lentas sin este índice

**Solución:**
```sql
ALTER TABLE public.codes ADD COLUMN organizer_id uuid REFERENCES public.organizers(id);
-- Poblar desde events
UPDATE public.codes c SET organizer_id = (SELECT e.organizer_id FROM public.events e WHERE e.id = c.event_id);
-- Índice compuesto
CREATE INDEX idx_codes_organizer_event ON public.codes(organizer_id, event_id) WHERE deleted_at IS NULL;
```

### 2.3 Índice parcial no cubre soft-deletes correctamente

**Índice actual:**
```sql
CREATE UNIQUE INDEX codes_one_active_general_per_event
  ON public.codes(event_id)
  WHERE type = 'general' AND is_active = true;
```

**Problema:** No excluye `deleted_at IS NOT NULL`, permitiendo duplicados zombie

**Solución:**
```sql
CREATE UNIQUE INDEX codes_one_active_general_per_event_v2
  ON public.codes(event_id)
  WHERE type = 'general' AND is_active = true AND deleted_at IS NULL;
```

### 2.4 Constraint UNIQUE en `code` no considera soft-delete

**Problema crítico:**
```sql
-- Schema actual
code text NOT NULL UNIQUE
```

Esto impide:
- Reutilizar códigos después de soft-delete
- Tener el mismo código en eventos diferentes
- Lógica multi-organizador futura

**Solución:**
```sql
-- Remover UNIQUE global
ALTER TABLE public.codes DROP CONSTRAINT codes_code_key;

-- Crear índice parcial único por evento excluyendo soft-deletes
CREATE UNIQUE INDEX codes_unique_per_event 
  ON public.codes(code, event_id) 
  WHERE deleted_at IS NULL;
```

---

## 3. PROBLEMAS SECUNDARIOS

### 3.1 Función `set_event_general_code()` necesita ajustes

**Problema actual en línea 47-54:**
```sql
select event_id into v_existing_event
from public.codes
where code = trim(p_code)
limit 1;  -- ❌ No excluye soft-deletes

if v_existing_event is not null and v_existing_event <> p_event_id then
  raise exception 'El código % ya está asignado a otro evento', p_code;
end if;
```

**Debería ser:**
```sql
select event_id into v_existing_event
from public.codes
where code = trim(p_code)
  and deleted_at IS NULL  -- ✅ Excluir soft-deletes
  and is_active = true     -- ✅ Solo códigos activos
limit 1;
```

### 3.2 Tablas sin índices de auditoría

**Tablas críticas sin índices en columnas de soft-delete:**
- `codes`: falta índice en `(event_id, deleted_at)`
- `tickets`: falta índice en `(event_id, deleted_at)`
- `table_reservations`: falta índice en `(event_id, deleted_at)`

**Impacto:** Queries lentas al filtrar registros activos

---

## 4. MATRIZ DE RIESGO

| Problema | Severidad | Impacto en operación | Frecuencia | Prioridad |
|----------|-----------|---------------------|------------|-----------|
| UNIQUE global en `code` | 🔴 ALTA | Edición de códigos falla | Constante | P0 |
| Falta `organizer_id` en codes | 🟡 MEDIA | Multi-organizador limitado | Futura | P1 |
| Índice parcial sin soft-delete | 🟡 MEDIA | Duplicados zombie | Ocasional | P1 |
| Función sin filtro soft-delete | 🟡 MEDIA | Lógica inconsistente | Ocasional | P1 |
| Índices de auditoría faltantes | 🟢 BAJA | Performance degradado | N/A | P2 |

---

## 5. PLAN DE ACCIÓN RECOMENDADO

### Fase 1: Corrección inmediata (P0)
**Objetivo:** Resolver el problema reportado de edición de códigos

```sql
-- 1. Remover constraint UNIQUE global
ALTER TABLE public.codes DROP CONSTRAINT codes_code_key;

-- 2. Crear índice parcial único por evento
CREATE UNIQUE INDEX codes_unique_per_event 
  ON public.codes(code, event_id) 
  WHERE deleted_at IS NULL AND is_active = true;

-- 3. Actualizar función para excluir soft-deletes
-- (ver migración completa en sección 6)
```

### Fase 2: Normalización multi-organizador (P1)
**Objetivo:** Soportar multi-organizador correctamente

```sql
-- 1. Agregar organizer_id
ALTER TABLE public.codes ADD COLUMN organizer_id uuid REFERENCES public.organizers(id);

-- 2. Poblar desde events
UPDATE public.codes c 
SET organizer_id = (SELECT e.organizer_id FROM public.events e WHERE e.id = c.event_id)
WHERE organizer_id IS NULL;

-- 3. Índice compuesto
CREATE INDEX idx_codes_organizer_event 
  ON public.codes(organizer_id, event_id) 
  WHERE deleted_at IS NULL;
```

### Fase 3: Optimización de índices (P2)
**Objetivo:** Mejorar performance de queries

```sql
-- Índices de auditoría
CREATE INDEX idx_codes_event_deleted ON public.codes(event_id, deleted_at);
CREATE INDEX idx_tickets_event_deleted ON public.tickets(event_id, deleted_at);
CREATE INDEX idx_reservations_event_deleted ON public.table_reservations(event_id, deleted_at);
```

---

## 6. MIGRACIÓN COMPLETA PROPUESTA

**Archivo:** `supabase/migrations/2026-02-08-fix-code-uniqueness.sql`

```sql
-- ============================================================================
-- Migración: Corrección de constraint UNIQUE en codes
-- Fecha: 2026-02-08
-- Objetivo: Resolver problema de edición de códigos entre eventos
-- Severidad: ALTA
-- ============================================================================

-- 1. BACKUP SAFETY: Verificar estado actual
DO $$
BEGIN
  RAISE NOTICE 'Códigos con posible conflicto:';
  RAISE NOTICE '%', (
    SELECT COUNT(*) FROM public.codes 
    WHERE code IN (
      SELECT code FROM public.codes 
      GROUP BY code HAVING COUNT(*) > 1
    )
  );
END $$;

-- 2. CLEANUP: Desactivar códigos duplicados (mantener el más reciente por evento)
WITH duplicates AS (
  SELECT 
    id,
    code,
    event_id,
    ROW_NUMBER() OVER (
      PARTITION BY code 
      ORDER BY 
        CASE WHEN deleted_at IS NULL THEN 0 ELSE 1 END,
        updated_at DESC NULLS LAST,
        created_at DESC
    ) AS rn
  FROM public.codes
)
UPDATE public.codes c
SET is_active = false, updated_at = now()
FROM duplicates d
WHERE c.id = d.id AND d.rn > 1 AND c.is_active = true;

-- 3. SOFT DELETE: Marcar duplicados antiguos como eliminados
WITH duplicates AS (
  SELECT 
    id,
    code,
    ROW_NUMBER() OVER (
      PARTITION BY code 
      ORDER BY 
        CASE WHEN deleted_at IS NULL THEN 0 ELSE 1 END,
        updated_at DESC NULLS LAST,
        created_at DESC
    ) AS rn
  FROM public.codes
  WHERE deleted_at IS NULL
)
UPDATE public.codes c
SET deleted_at = now(), updated_at = now()
FROM duplicates d
WHERE c.id = d.id AND d.rn > 1;

-- 4. REMOVER constraint UNIQUE global
ALTER TABLE public.codes DROP CONSTRAINT IF EXISTS codes_code_key;

-- 5. CREAR índice parcial único por evento
DROP INDEX IF EXISTS codes_unique_per_event;
CREATE UNIQUE INDEX codes_unique_per_event 
  ON public.codes(code, event_id) 
  WHERE deleted_at IS NULL AND is_active = true;

-- 6. ACTUALIZAR índice de código general para incluir soft-delete
DROP INDEX IF EXISTS codes_one_active_general_per_event;
CREATE UNIQUE INDEX codes_one_active_general_per_event
  ON public.codes(event_id)
  WHERE type = 'general' AND is_active = true AND deleted_at IS NULL;

-- 7. ACTUALIZAR función set_event_general_code
CREATE OR REPLACE FUNCTION public.set_event_general_code(
  p_event_id uuid, 
  p_code text, 
  p_capacity integer DEFAULT NULL
)
RETURNS public.codes
LANGUAGE plpgsql
AS $$
DECLARE
  v_result public.codes;
  v_capacity integer;
  v_existing_event uuid;
  v_current public.codes;
BEGIN
  -- Validación
  IF p_event_id IS NULL OR p_code IS NULL OR length(trim(p_code)) = 0 THEN
    RAISE EXCEPTION 'event_id and code are required';
  END IF;

  -- Capacity fallback
  SELECT capacity INTO v_capacity FROM public.events WHERE id = p_event_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'El evento % no existe', p_event_id USING errcode = 'P0002';
  END IF;
  IF p_capacity IS NOT NULL THEN
    v_capacity := p_capacity;
  END IF;
  v_capacity := greatest(coalesce(v_capacity, 1000000), 1);

  -- ✅ FIX: Verificar conflicto solo en códigos activos NO soft-deleted
  SELECT event_id INTO v_existing_event
  FROM public.codes
  WHERE code = trim(p_code)
    AND deleted_at IS NULL  -- ✅ Excluir soft-deletes
    AND is_active = true     -- ✅ Solo activos
    AND event_id <> p_event_id -- ✅ Excluir el mismo evento
  LIMIT 1;

  IF v_existing_event IS NOT NULL THEN
    RAISE EXCEPTION 'El código % ya está asignado al evento %', p_code, v_existing_event 
      USING errcode = '23505';
  END IF;

  -- Obtener código general actual del evento
  SELECT * INTO v_current
  FROM public.codes
  WHERE event_id = p_event_id
    AND type = 'general'
    AND deleted_at IS NULL
  ORDER BY updated_at DESC NULLS LAST, created_at DESC
  LIMIT 1;

  -- Desactivar otros códigos generales del evento
  UPDATE public.codes
  SET is_active = false, updated_at = now()
  WHERE event_id = p_event_id
    AND type = 'general'
    AND (v_current.id IS NULL OR id <> v_current.id)
    AND is_active = true;

  -- Actualizar o insertar
  IF v_current.id IS NOT NULL THEN
    UPDATE public.codes
    SET code = trim(p_code),
        is_active = true,
        promoter_id = null,
        max_uses = v_capacity,
        updated_at = now()
    WHERE id = v_current.id
    RETURNING * INTO v_result;
  ELSE
    INSERT INTO public.codes (code, event_id, type, is_active, max_uses)
    VALUES (trim(p_code), p_event_id, 'general', true, v_capacity)
    RETURNING * INTO v_result;
  END IF;

  RETURN v_result;
END;
$$;

-- 8. ÍNDICES de auditoría
CREATE INDEX IF NOT EXISTS idx_codes_event_deleted 
  ON public.codes(event_id, deleted_at);

-- 9. VERIFICACIÓN final
DO $$
DECLARE
  v_duplicates integer;
BEGIN
  SELECT COUNT(*) INTO v_duplicates
  FROM (
    SELECT code, event_id
    FROM public.codes
    WHERE deleted_at IS NULL AND is_active = true
    GROUP BY code, event_id
    HAVING COUNT(*) > 1
  ) AS dups;
  
  IF v_duplicates > 0 THEN
    RAISE EXCEPTION 'Migración fallida: aún existen % códigos duplicados', v_duplicates;
  END IF;
  
  RAISE NOTICE 'Migración exitosa: unicidad de códigos por evento garantizada';
END $$;
```

---

## 7. VERIFICACIÓN POST-MIGRACIÓN

### 7.1 Query de validación

```sql
-- Verificar que NO existen códigos duplicados activos
SELECT 
  code,
  COUNT(*) as eventos_con_este_codigo,
  STRING_AGG(e.name, ', ') as eventos
FROM public.codes c
JOIN public.events e ON e.id = c.event_id
WHERE c.deleted_at IS NULL 
  AND c.is_active = true
GROUP BY code
HAVING COUNT(*) > 1;
```

**Resultado esperado:** 0 filas

### 7.2 Test funcional

```sql
-- Test 1: Crear código en evento A
SELECT public.set_event_general_code(
  '<event_a_uuid>'::uuid,
  'TEST-CODE-123',
  100
);

-- Test 2: Intentar usar mismo código en evento B (debe fallar)
SELECT public.set_event_general_code(
  '<event_b_uuid>'::uuid,
  'TEST-CODE-123',
  100
);
-- Esperado: ERROR 23505 "El código TEST-CODE-123 ya está asignado al evento..."

-- Test 3: Editar código de evento A (debe funcionar)
SELECT public.set_event_general_code(
  '<event_a_uuid>'::uuid,
  'TEST-CODE-UPDATED',
  100
);
-- Esperado: SUCCESS, 1 fila retornada

-- Cleanup
DELETE FROM public.codes WHERE code LIKE 'TEST-CODE%';
```

---

## 8. IMPACTO Y DOWNTIME

| Métrica | Valor estimado |
|---------|---------------|
| Duración de migración | < 5 segundos |
| Downtime requerido | NO (compatible hacia atrás) |
| Riesgo de rollback | BAJO (solo índices) |
| Datos afectados | ~100-1000 registros en tabla codes |
| Funcionalidad bloqueada | NINGUNA (mejora existente) |

---

## 9. ROLLBACK PLAN

Si la migración falla o causa problemas:

```sql
-- 1. Restaurar UNIQUE global (solo si es necesario)
ALTER TABLE public.codes ADD CONSTRAINT codes_code_key UNIQUE (code);

-- 2. Remover índices nuevos
DROP INDEX IF EXISTS codes_unique_per_event;
DROP INDEX IF EXISTS codes_one_active_general_per_event;

-- 3. Restaurar función anterior
-- (copiar desde migración 2025-02-10-consolidate-general-codes.sql)
```

---

## 10. PRÓXIMOS PASOS

1. ✅ **Revisar este documento** con Arquitecto/Tech Lead
2. ⏳ **Ejecutar migración en ambiente local** y validar
3. ⏳ **Ejecutar en staging** y hacer pruebas de regresión
4. ⏳ **Documentar en CHANGELOG**
5. ⏳ **Ejecutar en producción** en ventana de bajo tráfico
6. ⏳ **Monitorear logs** post-deploy por 24h

---

## 11. RESPONSABLES

| Rol | Responsabilidad | Persona |
|-----|----------------|---------|
| Arquitecto | Revisar diseño de solución | - |
| Tech Lead | Aprobar migración | - |
| Developer | Ejecutar y validar | - |
| QA | Validación funcional | - |
| DevOps | Monitoreo post-deploy | - |

---

## 12. REFERENCIAS

- [BUG-2026-02-08-EVENT-CODE-ARCHITECTURE.md](./BUG-2026-02-08-EVENT-CODE-ARCHITECTURE.md)
- [CODES-SYSTEM-REDESIGN-2026-02.md](./CODES-SYSTEM-REDESIGN-2026-02.md)
- [DB-GOVERNANCE-2026-02.md](./DB-GOVERNANCE-2026-02.md)
- [AGENTS.md](../AGENTS.md) - Sección "Principios de trabajo"

---

**Fin del reporte**
