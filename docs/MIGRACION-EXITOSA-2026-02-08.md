# ✅ MIGRACIÓN EXITOSA: organizer_id en tables

**Fecha**: 8 de febrero de 2026  
**Estado**: ✅ Ejecutada correctamente en Supabase

## Resumen

Se agregó `organizer_id` a la tabla `tables` para implementar **multi-organizer scoping** (aislamiento de mesas por organizador).

### Datos de la BD antes de migrar

| Métrica | Valor |
|---------|-------|
| Total mesas | 6 |
| Mesas con `event_id` | 0 |
| Mesas sin `event_id` | 6 ✅ (todas de Baby Club) |
| Total eventos | 2 (LOVE IS A DRUG, LAST DANCE) |
| Eventos con `organizer_id` | 2/2 ✅ |
| Organizadores activos | 1 (Baby Club) |

### Datos después de migrar

| Métrica | Valor |
|---------|-------|
| Columna `organizer_id` agregada | ✅ |
| Mesas con `organizer_id` | 6/6 ✅ |
| Mesas sin `organizer_id` (NULL) | 0 ✅ |
| FK constraint creado | ✅ |
| Índice compuesto creado | ✅ |

## Script ejecutado

```sql
-- Migration: Add organizer_id to tables with Baby Club data
-- Date: 2026-02-08

BEGIN;

-- Step 1: Add organizer_id column (nullable first)
ALTER TABLE public.tables 
ADD COLUMN organizer_id uuid;

-- Step 2: Fill ALL tables with Baby Club organizer (04831d27-5b06-48f5-b553-fbb62e04af52)
UPDATE public.tables
SET organizer_id = '04831d27-5b06-48f5-b553-fbb62e04af52'
WHERE organizer_id IS NULL;

-- Step 3: For tables WITH event_id, backfill from their events (overwrite if needed)
UPDATE public.tables t
SET organizer_id = e.organizer_id
FROM public.events e
WHERE t.event_id = e.id 
  AND e.organizer_id IS NOT NULL;

-- Step 4: Now make it NOT NULL since we've backfilled everything
ALTER TABLE public.tables
ALTER COLUMN organizer_id SET NOT NULL;

-- Step 5: Add foreign key constraint
ALTER TABLE public.tables
ADD CONSTRAINT tables_organizer_id_fkey 
FOREIGN KEY (organizer_id) REFERENCES public.organizers(id) ON DELETE RESTRICT;

-- Step 6: Create index for fast filtering
CREATE INDEX IF NOT EXISTS idx_tables_organizer_event
ON public.tables(organizer_id, event_id)
WHERE deleted_at IS NULL;

-- Verification: 0 NULL values
-- Verification: All 6 mesas have Baby Club organizer

COMMIT;
```

## Código actualizado

### 1. `/apps/backoffice/app/admin/tables/page.tsx`

**Cambio**: Agregada lógica para:
1. Obtener el organizador activo (Baby Club)
2. Filtrar mesas por `organizer_id`

```tsx
// Get Baby Club organizer (only active organizer for now)
const { data: orgData } = await supabase
  .from("organizers")
  .select("id")
  .eq("is_active", true)
  .limit(1)
  .maybeSingle();

if (!orgData?.id) return { tables: [], total: 0, error: "No organizer found" };

const { data, error, count } = await applyNotDeleted(
  supabase
    .from("tables")
    .select("id,name,ticket_count,min_consumption,price,is_active,notes", { count: "exact" })
    .eq("organizer_id", orgData.id)  // ← NEW: Filter by organizer
    .order("created_at", { ascending: true })
    .range(start, end)
);
```

### 2. `/apps/backoffice/app/admin/tables/layout/page.tsx`

**Cambio**: Actualizada función `getInitialData()` para:
1. Obtener organizador activo
2. Obtener evento activo más reciente
3. Filtrar mesas Y layout_settings por organizer + event

```tsx
// Get Baby Club organizer
const { data: orgData } = await supabase
  .from("organizers")
  .select("id")
  .eq("is_active", true)
  .limit(1)
  .maybeSingle();

// Get latest active event for this organizer
const { data: eventData } = await supabase
  .from("events")
  .select("id")
  .eq("organizer_id", orgData.id)  // ← NEW: Filter by organizer
  .eq("is_active", true)
  .order("created_at", { ascending: false })
  .limit(1)
  .maybeSingle();

// Query layout_settings + tables by organizer + event
const [{ data: layoutData }, { data: tablesData }] = await Promise.all([
  supabase
    .from("layout_settings")
    .select("layout_url")
    .eq("organizer_id", orgData.id)  // ← NEW
    .eq("event_id", eventData.id)    // ← NEW
    .maybeSingle(),
  supabase
    .from("tables")
    .select("id,name,pos_x,pos_y,pos_w,pos_h,event_id")
    .eq("organizer_id", orgData.id)  // ← NEW
    .eq("event_id", eventData.id)    // ← NEW
    .order("created_at", { ascending: true }),
]);
```

## Próximos pasos

### ✅ Completado
- [x] Diagnóstico de BD (schema actual, datos existentes)
- [x] Migración SQL ejecutada exitosamente
- [x] Código backend actualizado (queries con organizer_id filtering)
- [x] Validación de integridad de datos

### 🟡 En progreso
- [ ] Verificar compilación TypeScript del backoffice
- [ ] Actualizar test que falla (`apps/landing/app/api/tables/route.test.ts`)

### ⬜ Por hacer
- [ ] Testing local de workflow completo (create event → add mesas → copy layout → close event)
- [ ] Validar que NO haya data leakage entre organizadores
- [ ] Documentar admin UX walkthrough
- [ ] Deploy a producción

## Testing local

### Script de datos de prueba (cuando esté listo)

```sql
-- Verificar que las 6 mesas tienen Baby Club
SELECT 
  t.id,
  t.name,
  t.event_id,
  o.slug as organizer
FROM public.tables t
LEFT JOIN public.organizers o ON t.organizer_id = o.id
WHERE t.deleted_at IS NULL;

-- Verificar que NO hay NULL organizer_ids
SELECT COUNT(*) as mesas_sin_organizer 
FROM public.tables 
WHERE organizer_id IS NULL AND deleted_at IS NULL;

-- Verificar FK consistency
SELECT 
  COUNT(*) as total_mesas,
  COUNT(CASE WHEN o.id IS NOT NULL THEN 1 END) as con_organizer_valido
FROM public.tables t
LEFT JOIN public.organizers o ON t.organizer_id = o.id
WHERE t.deleted_at IS NULL;
```

## Rollback (si fuera necesario)

```sql
-- Drop the index
DROP INDEX IF EXISTS public.idx_tables_organizer_event;

-- Drop the FK
ALTER TABLE public.tables DROP CONSTRAINT IF EXISTS tables_organizer_id_fkey;

-- Remove the column
ALTER TABLE public.tables DROP COLUMN IF EXISTS organizer_id;
```

## Referencias

- **ADR**: `docs/adr/2026-02-08-006-multi-organizer-layout.md`
- **Architecture**: `docs/ARCHITECTURE_V2.md`
- **AGENTS**: `AGENTS.md` (roles y responsabilidades)

---

**Completado por**: GitHub Copilot  
**Estado de validación**: ✅ Migración exitosa, código actualizado  
**Bloqueador**: Test fallido en `apps/landing/app/api/tables/route.test.ts`
