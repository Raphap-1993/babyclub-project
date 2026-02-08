# Preview: Cambios de Código (Antes y Después)

**Propósito**: Ver exactamente qué cambiaría si implementamos Opción A.

---

## 1. Cambio en API Backoffice: GET /api/layout

### Código Actual (Global)
```typescript
// apps/backoffice/app/api/layout/route.ts (línea 23)
export async function GET(req: NextRequest) {
  const guard = await requireStaffRole(req);
  if (!guard.ok) return error...;
  
  // ← Carga 1 solo croquis (id = 1)
  const { data, error } = await supabase
    .from("layout_settings")
    .select("layout_url")
    .eq("id", 1)
    .maybeSingle();
    
  return NextResponse.json({ layout_url: data?.layout_url || null });
}
```

### Código Propuesto (Por Evento)
```typescript
// apps/backoffice/app/api/layout/route.ts (NUEVO)
export async function GET(req: NextRequest) {
  const guard = await requireStaffRole(req);
  if (!guard.ok) return error...;
  
  // ← Obtener event_id del query
  const eventId = new URL(req.url).searchParams.get("event_id")?.trim() || "";
  if (!eventId) {
    return NextResponse.json(
      { layout_url: null, error: "event_id es requerido" },
      { status: 400 }
    );
  }
  
  // ← Buscar layout del evento específico
  const { data, error } = await supabase
    .from("event_layouts")  // ← Nueva tabla
    .select("layout_url")
    .eq("event_id", eventId)
    .maybeSingle();
    
  return NextResponse.json({ layout_url: data?.layout_url || null });
}
```

**Cambios mínimos**:
- 1 parámetro nuevo (event_id)
- 1 cambio de tabla (layout_settings → event_layouts)
- 1 filtro nuevo (.eq("event_id", eventId))

---

## 2. Cambio en API Landing: GET /api/layout

### Código Actual
```typescript
// apps/landing/app/api/layout/route.ts (línea 24)
export async function GET() {
  // ...
  const { data, error } = await supabase
    .from("layout_settings")
    .select("layout_url")
    .eq("id", 1)
    .maybeSingle();
    
  return NextResponse.json({ layout_url: data?.layout_url || fallbackLayoutUrl });
}
```

### Código Propuesto
```typescript
// apps/landing/app/api/layout/route.ts (NUEVO)
export async function GET(req: NextRequest) {
  // ...
  // ← Obtener event_id del contexto (pasado desde cliente)
  const eventId = new URL(req.url).searchParams.get("event_id")?.trim() || "";
  
  if (!eventId) {
    // Fallback: retornar layout default (compatibilidad backward)
    return NextResponse.json({ 
      layout_url: fallbackLayoutUrl,
      // ... sin error, solo compatibilidad
    });
  }
  
  const { data, error } = await supabase
    .from("event_layouts")  // ← Nueva tabla
    .select("layout_url")
    .eq("event_id", eventId)
    .maybeSingle();
    
  return NextResponse.json({ 
    layout_url: data?.layout_url || fallbackLayoutUrl 
  });
}
```

**Ventaja**: Fallback mantiene compatibilidad con eventos sin layout personalizado.

---

## 3. Cambio en LayoutEditor.tsx

### Código Actual (línea 44)
```typescript
useEffect(() => {
  setError(null);
  // ← Carga sin filtro
  Promise.all([
    authedFetch("/api/layout").then((r) => r.json()),
    authedFetch("/api/tables").then((r) => r.json())
  ])
    .then(([layoutRes, tablesRes]) => {
      const nextTables = Array.isArray(tablesRes?.tables) ? tablesRes.tables : [];
      const layout_url = layoutRes?.layout_url || data.layout_url || null;
      setData((prev) => ({
        layout_url,
        tables: nextTables.length > 0 ? nextTables : prev.tables,
      }));
      // ...
    })
}, [data.layout_url]);
```

### Código Propuesto
```typescript
// ← Asumir que eventId viene del contexto (router/session)
const eventId = "evt-001"; // o desde props/context

useEffect(() => {
  setError(null);
  // ← Pasar event_id en queries
  Promise.all([
    authedFetch(`/api/layout?event_id=${encodeURIComponent(eventId)}`).then((r) => r.json()),
    authedFetch(`/api/tables?event_id=${encodeURIComponent(eventId)}`).then((r) => r.json())
  ])
    .then(([layoutRes, tablesRes]) => {
      const nextTables = Array.isArray(tablesRes?.tables) ? tablesRes.tables : [];
      const layout_url = layoutRes?.layout_url || data.layout_url || null;
      setData((prev) => ({
        layout_url,
        tables: nextTables.length > 0 ? nextTables : prev.tables,
      }));
      // ... igual que antes
    })
}, [eventId, data.layout_url]);  // ← Dependencia en eventId
```

**Cambios mínimos**:
- 2 lineas: añadir `?event_id=...` en ambas llamadas
- 1 línea: añadir `eventId` a dependencias

---

## 4. Cambio en Schema (Migration)

### Migration a Crear

```sql
-- supabase/migrations/2026-02-08-event-layouts-per-event.sql

-- Opción A: Crear tabla nueva (más limpia)
create table if not exists public.event_layouts (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null unique references public.events(id) on delete cascade,
  layout_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null,
  deleted_by uuid null,
  is_active boolean not null default true
);

-- Crear índices
create index if not exists event_layouts_event_id_idx on public.event_layouts(event_id);
create index if not exists event_layouts_deleted_at_idx on public.event_layouts(deleted_at);

-- Migrar datos: 1 layout global → 1 por evento
insert into public.event_layouts (event_id, layout_url, created_at)
select e.id, ls.layout_url, now()
from public.events e
cross join (select layout_url from public.layout_settings where id = 1) ls
on conflict (event_id) do nothing;

-- Enable RLS
alter table public.event_layouts enable row level security;

-- Política para service_role (para admin global)
create policy event_layouts_service_role_all
  on public.event_layouts
  for all
  to service_role
  using (true)
  with check (true);

-- Política para usuarios: leer layout del evento que pueden ver
-- (Si implementas filtro por organizer_id, aquí va la lógica)
```

**Ventajas**:
- ✅ No toca `layout_settings` (mantiene compatibilidad)
- ✅ Migración segura (dual-write posible)
- ✅ Fácil de revertir (solo drop table)

---

## 5. Cambio en Tabla de Uploads

### Ruta Actual: /api/uploads/layout

```typescript
// apps/backoffice/app/api/uploads/layout/route.ts (presumiblemente)

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get("file") as File;
  // ... validar y subir a CDN
  const fileUrl = await uploadToCDN(file);
  
  // ← Actualiza layout_settings global
  await supabase
    .from("layout_settings")
    .update({ layout_url: fileUrl })
    .eq("id", 1);
    
  return NextResponse.json({ file_url: fileUrl });
}
```

### Propuesto
```typescript
// NUEVO: Aceptar event_id en body o query

export async function POST(req: NextRequest) {
  const eventId = new URL(req.url).searchParams.get("event_id")?.trim() || "";
  if (!eventId) {
    return NextResponse.json(
      { error: "event_id es requerido" },
      { status: 400 }
    );
  }
  
  const formData = await req.formData();
  const file = formData.get("file") as File;
  const fileUrl = await uploadToCDN(file);
  
  // ← Actualiza event_layouts para evento específico
  await supabase
    .from("event_layouts")
    .upsert(
      { event_id: eventId, layout_url: fileUrl },
      { onConflict: "event_id" }
    );
    
  return NextResponse.json({ file_url: fileUrl });
}
```

**Cambios**:
- 1 parámetro nuevo (event_id)
- 1 cambio de tabla (layout_settings → event_layouts)
- 1 cambio de método (update → upsert)

---

## 6. Cambio en Frontend: Componente de Upload

### Actual (presumible)
```typescript
// Algún componente que sube el croquis
const uploadLayout = async (file: File) => {
  const formData = new FormData();
  formData.append("file", file);
  
  const res = await fetch("/api/uploads/layout", {
    method: "POST",
    body: formData
  });
  
  return res.json();
};
```

### Propuesto
```typescript
// Pasar event_id junto al archivo
const uploadLayout = async (file: File, eventId: string) => {
  const formData = new FormData();
  formData.append("file", file);
  
  const res = await fetch(`/api/uploads/layout?event_id=${encodeURIComponent(eventId)}`, {
    method: "POST",
    body: formData
  });
  
  return res.json();
};
```

---

## 7. Cambio en Tablas Guardadas (Mesas)

### POST /api/tables/update

Código **no requiere cambios** porque ya tiene event_id, solo mejora validación:

```typescript
// ANTES: guarda sin validar
await supabase.from("tables").update({
  pos_x: body.pos_x,
  pos_y: body.pos_y,
  // ...
}).eq("id", body.id);

// DESPUÉS: valida que mesa pertenece al evento del usuario
const table = await supabase.from("tables").select("event_id").eq("id", body.id).single();

if (table.event_id && table.event_id !== contextEventId) {
  return error("Mesa pertenece a otro evento");
}

await supabase.from("tables").update({
  pos_x: body.pos_x,
  pos_y: body.pos_y,
  // ...
}).eq("id", body.id);
```

**Cambios mínimos**: 3 líneas de validación (opcional pero recomendado).

---

## 8. Resumen de Cambios

| Archivo | Tipo | Líneas | Complejidad |
|---------|------|--------|------------|
| apps/backoffice/app/api/layout/route.ts | Modificar | +5 | 🟢 Baja |
| apps/landing/app/api/layout/route.ts | Modificar | +5 | 🟢 Baja |
| apps/backoffice/app/admin/tables/layout/LayoutEditor.tsx | Modificar | +2 | 🟢 Baja |
| supabase/migrations/2026-02-08-*.sql | Crear | ~40 | 🟢 Baja |
| apps/backoffice/app/api/uploads/layout/route.ts | Modificar | +3 | 🟢 Baja |
| tests (para validar) | Crear | ~50 | 🟡 Media |

**Total estimado**: ~10-15 líneas de cambio real, ~50 líneas en tests.

---

## 9. Cambio "Cero-Impacto" en Otros Módulos

Estas APIs **no necesitan cambios** porque ya filtran por event_id:

```typescript
// ✅ /api/tables (en ambas apps)
// Ya tiene: .eq("event_id", eventId)

// ✅ /api/reservations
// Ya tiene: .eq("event_id", eventId)

// ✅ /api/tickets
// Ya tiene: .eq("event_id", eventId)

// ✅ /admin/scan
// Ya tiene: .eq("event_id", event_id)
```

**Conclusión**: 80% del código ya está preparado para multi-evento.

---

## 10. Orden de Implementación Recomendado

### Día 1: Setup
1. Crear migration (`event_layouts` tabla)
2. Deploy a staging
3. Migrar datos (global → 1 por evento)

### Día 2: APIs
1. Modificar `/api/layout` (backoffice GET/POST)
2. Modificar `/api/uploads/layout` (POST)
3. Tests de API

### Día 3: Frontend
1. Modificar LayoutEditor.tsx (pasar event_id)
2. Tests de UI
3. QA valida en staging

### Día 4: Cutover
1. Deploy a production
2. Monitoreo
3. Documentación

---

## Archivos Afectados (Checklist)

```
[ ] supabase/migrations/2026-02-08-event-layouts-per-event.sql (crear)
[ ] apps/backoffice/app/api/layout/route.ts (modificar ~5 líneas)
[ ] apps/landing/app/api/layout/route.ts (modificar ~5 líneas)
[ ] apps/backoffice/app/api/uploads/layout/route.ts (modificar ~3 líneas)
[ ] apps/backoffice/app/admin/tables/layout/LayoutEditor.tsx (modificar ~2 líneas)
[ ] tests (crear/actualizar ~50 líneas)
[ ] README/docs (actualizar)
```

