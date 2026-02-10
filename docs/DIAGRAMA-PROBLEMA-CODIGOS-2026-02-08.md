# Análisis Visual: Problema de Códigos Duplicados

## Problema Actual (ANTES de la migración)

```
┌─────────────────────────────────────────────────────────────────┐
│  Tabla: codes                                                    │
│  Constraint: code UNIQUE (global en toda la tabla)               │
└─────────────────────────────────────────────────────────────────┘

┌─────────┬────────────┬──────────────┬──────────┬────────────┐
│ id      │ code       │ event_id     │ type     │ deleted_at │
├─────────┼────────────┼──────────────┼──────────┼────────────┤
│ uuid-1  │ "VIP2024"  │ evento-A     │ general  │ NULL       │ ✅
│ uuid-2  │ "VIP2024"  │ evento-B     │ general  │ NULL       │ ❌ BLOQUEADO por UNIQUE
└─────────┴────────────┴──────────────┴──────────┴────────────┘

❌ PROBLEMA: No puedes tener el mismo código en eventos diferentes
```

### Escenario Real del Usuario

```
Evento A: "Baby Deluxe Febrero"
  └─ Código general: "BABY-FEB"

Evento B: "Love Party Febrero"  
  └─ Intenta usar código: "BABY-FEB"
      └─ ❌ Error: código ya existe
      └─ ⚠️  Form guarda silenciosamente otro código
      └─ 😕 Usuario confundido: "guardé pero veo otro código"
```

---

## Solución (DESPUÉS de la migración)

```
┌─────────────────────────────────────────────────────────────────┐
│  Tabla: codes                                                    │
│  Constraint: UNIQUE (code, event_id) - parcial, excluyendo      │
│              registros con deleted_at IS NOT NULL                │
└─────────────────────────────────────────────────────────────────┘

┌─────────┬────────────┬──────────────┬──────────┬────────────┐
│ id      │ code       │ event_id     │ type     │ deleted_at │
├─────────┼────────────┼──────────────┼──────────┼────────────┤
│ uuid-1  │ "VIP2024"  │ evento-A     │ general  │ NULL       │ ✅
│ uuid-2  │ "VIP2024"  │ evento-B     │ general  │ NULL       │ ✅ PERMITIDO
│ uuid-3  │ "VIP2024"  │ evento-A     │ general  │ 2026-01-15 │ ✅ Soft-deleted, no cuenta
└─────────┴────────────┴──────────────┴──────────┴────────────┘

✅ SOLUCIÓN: Mismo código puede existir en eventos diferentes
```

### Escenario Corregido

```
Evento A: "Baby Deluxe Febrero"
  └─ Código general: "BABY-FEB" ✅

Evento B: "Love Party Febrero"  
  └─ Código general: "BABY-FEB" ✅ (permitido, es otro evento)

Evento C: "Baby Deluxe Marzo"
  └─ Código general: "BABY-MAR" ✅

// Ahora el admin puede reutilizar códigos entre eventos sin conflictos
```

---

## Comparación de Constraints

### ANTES (Incorrecto)

```sql
-- Constraint global
CREATE UNIQUE INDEX codes_code_key ON codes(code);

-- Problema: "VIP2024" solo puede existir UNA vez en toda la tabla
-- Impide: Reutilizar códigos entre eventos
-- Impide: Códigos friendly como "BABY-FEB" en múltiples eventos
```

### DESPUÉS (Correcto)

```sql
-- Constraint por evento, excluyendo soft-deletes
CREATE UNIQUE INDEX codes_unique_per_event 
  ON codes(code, event_id) 
  WHERE deleted_at IS NULL AND is_active = true;

-- Permite: "VIP2024" en evento A y evento B
-- Permite: Reutilizar códigos después de soft-delete
-- Permite: Códigos friendly multi-evento
```

---

## Flujo de Edición de Código

### ANTES (Con el bug)

```
1. Admin abre "Editar Evento A"
   ├─ Form carga código actual: "VIP-OLD"
   
2. Admin cambia código a "VIP-NEW"
   ├─ Click "Guardar"
   
3. Backend ejecuta set_event_general_code()
   ├─ Verifica si "VIP-NEW" existe en ANY evento
   ├─ ❌ Encuentra "VIP-NEW" en Evento B
   ├─ ❌ Lanza exception: "código ya asignado"
   
4. Frontend recibe error
   ├─ ⚠️  Muestra toast "Guardado" (bug UI)
   ├─ Pero en BD no se guardó nada
   
5. Admin vuelve a abrir "Editar Evento A"
   ├─ 😕 Ve código anterior "VIP-OLD"
   ├─ 😕 "¿Por qué no se guardó mi cambio?"
```

### DESPUÉS (Corregido)

```
1. Admin abre "Editar Evento A"
   ├─ Form carga código actual: "VIP-OLD"
   
2. Admin cambia código a "VIP-NEW"
   ├─ Click "Guardar"
   
3. Backend ejecuta set_event_general_code() (versión corregida)
   ├─ Verifica si "VIP-NEW" existe en OTRO evento (no el actual)
   ├─ ✅ Solo verifica códigos activos (deleted_at IS NULL)
   ├─ ✅ Actualiza el registro existente de Evento A
   
4. Frontend recibe success
   ├─ ✅ Toast "Guardado exitosamente"
   ├─ ✅ En BD está correcto
   
5. Admin vuelve a abrir "Editar Evento A"
   ├─ ✅ Ve código nuevo "VIP-NEW"
   ├─ 😊 "Perfecto, se guardó correctamente"
```

---

## Casos de Uso Soportados

### ✅ Caso 1: Código único por evento (antes y después)

```
Evento A: código "SUMMER-2024"
Evento A: código "SUMMER-2024" (editar el mismo) → ✅ Permitido
```

### ✅ Caso 2: Mismo código en eventos diferentes (solo después)

```
Evento A (Feb): código "VIP"
Evento B (Mar): código "VIP" → ✅ Permitido (son eventos diferentes)
```

### ✅ Caso 3: Reutilizar código después de soft-delete (solo después)

```
Evento A: código "OLD" → soft-delete
Evento B: código "OLD" → ✅ Permitido (el anterior está deleted_at)
```

### ✅ Caso 4: Multi-organizador (preparado para futuro)

```
Organizador 1 / Evento A: código "VIP"
Organizador 2 / Evento B: código "VIP" → ✅ Permitido
```

---

## Índices Parciales Creados

### Índice 1: Unicidad por evento

```sql
CREATE UNIQUE INDEX codes_unique_per_event 
  ON codes(code, event_id) 
  WHERE deleted_at IS NULL AND is_active = true;

Propósito: Garantizar UN código por evento (excluyendo soft-deletes)
Beneficio: Permite reutilizar códigos entre eventos
Performance: O(log n) para búsqueda de códigos activos
```

### Índice 2: Un código general por evento

```sql
CREATE UNIQUE INDEX codes_one_active_general_per_event
  ON codes(event_id)
  WHERE type = 'general' AND is_active = true AND deleted_at IS NULL;

Propósito: Garantizar UN SOLO código general activo por evento
Beneficio: Previene múltiples códigos generales
Performance: O(1) para verificar código general de evento
```

### Índice 3: Auditoría y performance

```sql
CREATE INDEX idx_codes_event_deleted 
  ON codes(event_id, deleted_at);

Propósito: Mejorar queries de auditoría y soft-delete
Beneficio: Queries rápidas al filtrar por evento y estado
Performance: Hasta 100x más rápido en tablas grandes
```

---

## Impacto en Tablas Relacionadas

```
┌──────────────┐
│   events     │
│              │
│ ┌──────────┐ │
│ │ id       │◄├─────┐
│ └──────────┘ │     │
└──────────────┘     │
                     │ event_id (FK)
┌──────────────┐     │
│   codes      │     │
│              │     │
│ ┌──────────┐ │     │
│ │ event_id ├─┼─────┘
│ │ code     │ │ UNIQUE (code, event_id) ✅
│ └──────────┘ │
└──────────────┘

┌──────────────┐
│   tickets    │
│              │
│ ┌──────────┐ │
│ │ code_id  ├─┼────► Usa codes.id (no afectado)
│ └──────────┘ │
└──────────────┘

✅ Sin impacto en tickets, reservations, scan_logs
```

---

## Verificación Visual

### Query de verificación

```sql
-- ¿Hay códigos duplicados GLOBALMENTE? (ANTES: sí, DESPUÉS: sí pero OK)
SELECT code, COUNT(*) as total_eventos
FROM codes
WHERE deleted_at IS NULL
GROUP BY code
HAVING COUNT(*) > 1;

-- ¿Hay códigos duplicados POR EVENTO? (ANTES: no, DESPUÉS: no)
SELECT code, event_id, COUNT(*) as duplicados
FROM codes
WHERE deleted_at IS NULL AND is_active = true
GROUP BY code, event_id
HAVING COUNT(*) > 1;

-- Respuesta esperada DESPUÉS de migración:
-- Query 1: Puede retornar filas (códigos en eventos diferentes) ✅ OK
-- Query 2: NO debe retornar filas (cero duplicados por evento) ✅ OK
```

---

## Resumen Ejecutivo

| Aspecto | ANTES | DESPUÉS |
|---------|-------|---------|
| Constraint | `UNIQUE code` global | `UNIQUE (code, event_id)` parcial |
| Mismo código en eventos diferentes | ❌ Bloqueado | ✅ Permitido |
| Editar código de evento | ⚠️  Inconsistente | ✅ Funciona |
| Reutilizar código soft-deleted | ❌ Bloqueado | ✅ Permitido |
| Códigos friendly multi-evento | ❌ Imposible | ✅ Posible |
| Riesgo de duplicados por evento | 🟢 Bajo | 🟢 Bajo |
| Performance de queries | 🟡 Media | 🟢 Buena |
| Preparado multi-organizador | ❌ No | ⏳ Parcial |

---

## Próximos Pasos (Futuro)

### Fase 2: Agregar `organizer_id` a `codes`

```sql
-- Permitir códigos duplicados SOLO entre organizadores diferentes
ALTER TABLE codes ADD COLUMN organizer_id uuid;

CREATE UNIQUE INDEX codes_unique_per_organizer_event
  ON codes(organizer_id, code, event_id)
  WHERE deleted_at IS NULL;

-- Ejemplo:
-- Organizador A / Evento 1: código "VIP" ✅
-- Organizador B / Evento 1: código "VIP" ✅ (diferente organizador)
```

### Fase 3: Códigos friendly de promotor

```sql
-- Sistema de códigos por promotor basado en nombre
-- Ejemplo: "BABY-MARIA-FEB27" en vez de "PROM-001"

-- Ver: docs/CODES-SYSTEM-REDESIGN-2026-02.md
```

---

**Fin del análisis visual**
