# BUG: Arquitectura del "Código del Evento"

**Fecha:** 2026-02-08  
**Severidad:** MEDIA-ALTA  
**Impacto:** Puede crear códigos duplicados y generar confusión en base de datos

## Problema detectado

El "código del evento" NO es una columna de la tabla `events`, sino un registro en la tabla `codes` con `type='general'`. 

### Síntoma
Cuando editas el código de un evento en el backoffice:
- El form muestra el código general actual
- Si lo editas, se crea un NUEVO código en vez de actualizar el existente
- Pueden quedar múltiples códigos `type='general'` activos para el mismo evento

### Causa raíz
1. El form trata el `code` como si fuera un campo directo del evento
2. La página de edición (`apps/backoffice/app/admin/events/[id]/edit/page.tsx`) trae el código de la tabla `codes`:
   ```typescript
   const codeQuery = applyNotDeleted(
     supabase.from("codes").select("id,code")
       .eq("event_id", id)
       .eq("type", "general")
       .eq("is_active", true)
   );
   const { data: codes } = await codeQuery.maybeSingle();
   const code = codes?.code || "";
   ```
3. El endpoint `/api/events/update` llama a `set_event_general_code()` que hace UPSERT:
   ```typescript
   await supabase.rpc("set_event_general_code", {
     p_event_id: eventId,
     p_code: codeToUse,
     p_capacity: capacity,
   });
   ```

### Comportamiento esperado de `set_event_general_code`
Según la migración `2025-02-10-consolidate-general-codes.sql`, la función debería:
- Asegurar UN SOLO código general activo por evento
- Hacer UPSERT con `on conflict (event_id) where type='general' AND is_active=true`

**PERO** puede haber un problema si el índice parcial no está funcionando correctamente o si hay códigos soft-deleted activos.

## Impacto
- **Duplicidad de códigos:** Múltiples códigos generales para un evento
- **Confusión operativa:** No queda claro cuál es el código "oficial"
- **Validación en puerta:** Puede aceptar múltiples códigos cuando solo debería haber uno
- **Reportes incorrectos:** Conteos y estadísticas de uso duplicadas

## Soluciones propuestas

### Opción A: Normalizar la tabla `events` (recomendada)
**Agregar columna `code` a tabla `events`**
- Simplicidad conceptual: el código del evento está EN el evento
- Evita joins innecesarios
- Elimina riesgo de duplicidad
- La tabla `codes` se usa SOLO para códigos promocionales

**Migración sugerida:**
```sql
-- 1. Agregar columna
ALTER TABLE public.events ADD COLUMN code text;

-- 2. Migrar códigos generales activos
UPDATE public.events e
SET code = (
  SELECT c.code 
  FROM public.codes c 
  WHERE c.event_id = e.id 
    AND c.type = 'general' 
    AND c.is_active = true
    AND c.deleted_at IS NULL
  LIMIT 1
);

-- 3. Constraint unique
ALTER TABLE public.events ADD CONSTRAINT events_code_unique UNIQUE (code);

-- 4. Deprecar códigos type='general'
-- (mantener por compatibilidad pero marcar como legacy)
```

### Opción B: Reforzar unicidad en `codes` (parche)
**Mejorar función `set_event_general_code`**
- Desactivar TODOS los códigos generales anteriores del evento antes de insertar
- Agregar verificación de duplicidad cross-eventos

**Ajuste sugerido:**
```sql
CREATE OR REPLACE FUNCTION public.set_event_general_code(
  p_event_id uuid, 
  p_code text, 
  p_capacity integer DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
AS $$
BEGIN
  -- 1. Validar entrada
  IF p_event_id IS NULL OR p_code IS NULL THEN
    RAISE EXCEPTION 'event_id and code are required';
  END IF;

  -- 2. Desactivar todos los códigos generales activos del evento
  UPDATE public.codes
  SET is_active = false
  WHERE event_id = p_event_id 
    AND type = 'general' 
    AND is_active = true;

  -- 3. Insertar nuevo código general
  INSERT INTO public.codes (code, event_id, type, is_active, max_uses)
  VALUES (TRIM(p_code), p_event_id, 'general', true, p_capacity)
  ON CONFLICT (code) DO NOTHING;

  RETURN TRUE;
END;
$$;
```

## Recomendación

**Opción A (normalizar)** es la solución correcta a largo plazo:
- Código del evento pertenece a la entidad evento
- Códigos promocionales/promotores quedan en tabla `codes`
- Elimina complejidad innecesaria
- Mejora rendimiento (no joins)

**Opción B (parche)** es aceptable si:
- No se puede hacer migración de datos ahora
- Hay eventos en producción
- Se necesita solución rápida

## Pasos inmediatos

1. **Auditar duplicidad actual:**
   ```sql
   -- Verificar códigos generales duplicados por evento
   SELECT 
     e.name as event_name,
     c.event_id,
     COUNT(*) as cantidad_codigos,
     STRING_AGG(c.code, ', ') as codigos
   FROM public.codes c
   JOIN public.events e ON e.id = c.event_id
   WHERE c.type = 'general' 
     AND c.is_active = true
     AND c.deleted_at IS NULL
     AND e.deleted_at IS NULL
   GROUP BY c.event_id, e.name
   HAVING COUNT(*) > 1
   ORDER BY e.name;
   ```
   
   Esta query está guardada en: `/tmp/check_duplicate_codes.sql`

2. **Decidir estrategia:** Normalizar vs. Parche

3. **Implementar solución elegida**

4. **Actualizar documentación de arquitectura**

## Contacto
Reportado por: Usuario en sesión de homologación UI  
Asignado a: Tech Lead / Arquitecto
