# 🚨 Problema Arquitectónico: Flujo de Mesas Multi-Organizador

**Fecha:** 2026-02-08  
**Severidad:** 🔴 ALTA (Afecta integridad multi-tenant)  
**Status:** ⚠️ IDENTIFICADO - Pendiente de solución

---

## 📋 Problema Identificado

### Situación Actual (INCORRECTA)

```
/admin/tables
  └─ Lista TODAS las mesas del "organizador activo" 🚨
  └─ Hardcoded: "Get Baby Club organizer (only active organizer for now)"
  └─ Sin filtro por evento
  └─ Sin contexto de a qué evento pertenecen
```

**Code Smell Encontrado:**
```typescript
// apps/backoffice/app/admin/tables/page.tsx línea 26-27
// Get Baby Club organizer (only active organizer for now)
const { data: orgData } = await supabase
  .from("organizers")
  .select("id")
  .eq("is_active", true)  // ❌ Solo trae 1 organizador
  .limit(1)
  .maybeSingle();
```

### Problemas Específicos

1. **❌ No hay filtro por evento**
   - Las mesas están vinculadas a `organizer_id` + `event_id`
   - La UI solo filtra por `organizer_id` (y solo el primero activo)
   - Un organizador puede tener mesas de múltiples eventos

2. **❌ Ambigüedad de contexto**
   - ¿Estoy viendo mesas de qué evento?
   - ¿Puedo crear mesas sin evento?
   - ¿Las mesas son del evento pasado o futuro?

3. **❌ Flujo de navegación roto**
   ```
   INCORRECTO:
   /admin/tables → ¿Mesas de qué?
   
   CORRECTO:
   /admin/organizers → Seleccionar Org
   /admin/organizers/[id]/events → Seleccionar Evento
   /admin/organizers/[id]/events/[event_id]/tables → Mesas del evento
   ```

4. **❌ Layout de mesas sin contexto**
   - El plano de mesas (`/admin/tables/layout`) también usa mismo hack
   - Coordenadas (pos_x, pos_y) sin referencia clara al evento

5. **❌ Creación de mesas ambigua**
   - `/admin/tables/create` no pregunta para qué evento
   - Se asume el organizador hardcodeado

---

## 🎯 Arquitectura Correcta (Recomendada)

### Jerarquía de Navegación

```
┌─────────────────────────────────────────────────┐
│ 1. ORGANIZADORES                                │
│ /admin/organizers                               │
│ - Lista de todos los organizadores              │
│ - Cada org tiene botón "Ver Eventos"           │
└─────────────────────────────────────────────────┘
                     ↓
┌─────────────────────────────────────────────────┐
│ 2. EVENTOS DEL ORGANIZADOR                      │
│ /admin/organizers/[org_id]/events               │
│ - Lista eventos del organizador seleccionado    │
│ - Estados: Activos, Cerrados, Futuros          │
│ - Cada evento tiene "Gestionar Mesas"          │
└─────────────────────────────────────────────────┘
                     ↓
┌─────────────────────────────────────────────────┐
│ 3. MESAS DEL EVENTO                             │
│ /admin/organizers/[org_id]/events/[evt]/tables  │
│ - Solo mesas de ESTE evento específico         │
│ - Contexto claro: "Mesas de [Nombre Evento]"   │
│ - Acciones: Crear, Editar, Plano               │
└─────────────────────────────────────────────────┘
```

### Modelo de Datos (YA EXISTE en BD)

```sql
-- ✅ Ya implementado correctamente
CREATE TABLE tables (
  id uuid PRIMARY KEY,
  organizer_id uuid REFERENCES organizers(id),  -- ✅ OK
  event_id uuid REFERENCES events(id),           -- ✅ OK
  name text,
  ticket_count integer,
  min_consumption numeric,
  price numeric,
  pos_x numeric,  -- Coordenadas del plano
  pos_y numeric,
  is_active boolean,
  deleted_at timestamptz  -- Soft delete
);

-- ✅ Índice correcto ya creado
CREATE INDEX idx_tables_organizer_event 
ON tables(organizer_id, event_id);
```

**Conclusión:** La BD está bien diseñada, pero la UI no la está usando correctamente.

---

## 🔧 Plan de Solución

### Fase 1: Ajuste Rápido (Temporal)

**Objetivo:** Hacer funcionar con 1 organizador y eventos múltiples

```
/admin/tables → /admin/events/[event_id]/tables
```

**Cambios mínimos:**
1. Agregar selector de evento en `/admin/tables`
2. Filtrar por `event_id` seleccionado
3. Mostrar badge con nombre del evento activo

**Tiempo:** ~2 horas  
**Riesgo:** Bajo (no rompe nada)  
**Limitación:** Sigue asumiendo 1 solo organizador

### Fase 2: Solución Completa (Recomendada)

**Objetivo:** Soportar multi-organizador real

#### 2.1 Reestructurar URLs

```
ANTES:
/admin/tables
/admin/tables/layout
/admin/tables/create
/admin/tables/[id]/edit

DESPUÉS:
/admin/organizers/[org_id]/events/[event_id]/tables
/admin/organizers/[org_id]/events/[event_id]/tables/layout
/admin/organizers/[org_id]/events/[event_id]/tables/create
/admin/organizers/[org_id]/events/[event_id]/tables/[table_id]/edit
```

#### 2.2 Componentes a Crear

```
apps/backoffice/app/admin/organizers/[org_id]/
├── page.tsx                          # Vista del organizador
├── events/
│   ├── page.tsx                      # Lista eventos del org
│   └── [event_id]/
│       ├── page.tsx                  # Dashboard del evento
│       ├── tables/
│       │   ├── page.tsx              # ✨ Lista de mesas
│       │   ├── TablesClient.tsx      # ✨ Componente cliente
│       │   ├── layout/
│       │   │   └── page.tsx          # ✨ Plano de mesas
│       │   ├── create/
│       │   │   └── page.tsx          # ✨ Crear mesa
│       │   └── [table_id]/
│       │       └── edit/
│       │           └── page.tsx      # ✨ Editar mesa
│       ├── codes/                    # Códigos del evento
│       ├── tickets/                  # Tickets del evento
│       └── reservations/             # Reservas del evento
└── settings/
    └── page.tsx                      # Config del organizador
```

#### 2.3 Contexto de Organizador/Evento

**Hook compartido:**
```typescript
// hooks/useEventContext.ts
export function useEventContext() {
  const params = useParams();
  const orgId = params.org_id as string;
  const eventId = params.event_id as string;
  
  const { data: organizer } = useOrganizer(orgId);
  const { data: event } = useEvent(eventId);
  
  return { organizer, event, orgId, eventId };
}
```

**Breadcrumb automático:**
```tsx
<Breadcrumb>
  <BreadcrumbItem href="/admin/organizers">Organizadores</BreadcrumbItem>
  <BreadcrumbItem href={`/admin/organizers/${orgId}`}>
    {organizer.name}
  </BreadcrumbItem>
  <BreadcrumbItem href={`/admin/organizers/${orgId}/events`}>
    Eventos
  </BreadcrumbItem>
  <BreadcrumbItem href={`/admin/organizers/${orgId}/events/${eventId}`}>
    {event.name}
  </BreadcrumbItem>
  <BreadcrumbItem>Mesas</BreadcrumbItem>
</Breadcrumb>
```

#### 2.4 Queries Corregidas

```typescript
// ❌ ANTES (INCORRECTO)
async function getTables() {
  const { data: orgData } = await supabase
    .from("organizers")
    .select("id")
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();
    
  return supabase
    .from("tables")
    .select("*")
    .eq("organizer_id", orgData.id);
}

// ✅ DESPUÉS (CORRECTO)
async function getTables(orgId: string, eventId: string) {
  return supabase
    .from("tables")
    .select(`
      *,
      event:events(name, starts_at, is_active),
      organizer:organizers(name, slug)
    `)
    .eq("organizer_id", orgId)
    .eq("event_id", eventId)
    .order("created_at", { ascending: true });
}
```

---

## 📊 Impacto y Dependencias

### Módulos Afectados

- ✅ **Organizadores** - Ya existe, funciona bien
- ✅ **Eventos** - Ya existe, funciona bien
- 🚨 **Mesas** - ROTO (este issue)
- ⚠️ **Reservas de mesa** - Puede estar afectado
- ⚠️ **Layout de mesas** - Depende de mesas
- ⚠️ **Productos de mesa** - Depende de mesas

### Pantallas a Migrar

1. `/admin/tables/page.tsx` → `/admin/organizers/[org]/events/[evt]/tables/page.tsx`
2. `/admin/tables/layout/page.tsx` → `/admin/organizers/[org]/events/[evt]/tables/layout/page.tsx`
3. `/admin/tables/create/page.tsx` → `/admin/organizers/[org]/events/[evt]/tables/create/page.tsx`
4. `/admin/tables/[id]/edit/page.tsx` → `/admin/organizers/[org]/events/[evt]/tables/[id]/edit/page.tsx`

### API Routes a Actualizar

```
/api/tables → Agregar validación org_id + event_id
/api/tables/create → Requiere event_id en body
/api/tables/update → Validar que table pertenece al event
/api/tables/delete → Validar permisos
/api/tables/release → Validar contexto
```

---

## 🎯 Decisión Requerida

### Opción A: Ajuste Rápido (2-4 horas)
✅ Pros:
- Mínimo cambio
- No rompe URLs existentes
- Funciona para 1 organizador + multi-evento

❌ Contras:
- No escala a multi-organizador real
- Deuda técnica sigue ahí
- URLs no son RESTful

### Opción B: Solución Completa (2-3 días)
✅ Pros:
- Arquitectura correcta
- Escala a multi-organizador
- URLs RESTful y claras
- Elimina ambigüedades

❌ Contras:
- Requiere refactor grande
- Rompe URLs existentes
- Testing extensivo necesario

---

## 🚦 Recomendación

**Opción B (Solución Completa)** por las siguientes razones:

1. **Ya existe multi-organizador en BD** - Solo falta en UI
2. **El negocio ya lo requiere** - Colorimetría, BabyClub, etc.
3. **Evita deuda técnica** - Mejor hacerlo bien ahora
4. **Mejor UX** - Contexto claro para admins
5. **Alineado con AGENTS.md** - "Multi-marca/multi-organizador en la misma plataforma"

### Plan de Ejecución (Strangler Pattern)

**Sprint 1: Fundación (Semana 1)**
- [ ] Crear estructura `/admin/organizers/[org]/events/[evt]`
- [ ] Implementar breadcrumbs y contexto
- [ ] Migrar vista de mesas (sin edición aún)

**Sprint 2: Features (Semana 2)**
- [ ] Migrar creación de mesas
- [ ] Migrar edición de mesas
- [ ] Migrar plano de mesas (layout)
- [ ] Actualizar API routes

**Sprint 3: Transición (Semana 3)**
- [ ] Redirects de URLs antiguas a nuevas
- [ ] Actualizar navegación y menús
- [ ] Testing completo
- [ ] Deploy a staging

**Sprint 4: Deprecación (Semana 4)**
- [ ] Monitorear errores
- [ ] Eliminar código antiguo
- [ ] Actualizar docs
- [ ] Deploy a producción

---

## 📝 Próximos Pasos Inmediatos

1. **Validar con PM/Negocio:**
   - ¿Cuántos organizadores activos hay ahora?
   - ¿Hay necesidad inmediata de multi-org?
   - ¿Podemos deprecar `/admin/tables` actual?

2. **Revisar con Arquitecto:**
   - Validar enfoque de reestructuración
   - Aprobar plan de migración
   - Definir ADR si necesario

3. **Coordinar con QA:**
   - Definir casos de prueba
   - Validar estrategia de regresión
   - Planear testing en staging

4. **Preparar Migraciones:**
   - No se requieren cambios en BD (ya está bien)
   - Solo se necesita refactor de UI/API

---

**Autor:** AI Assistant  
**Reviewer:** Pendiente  
**Status:** ⚠️ ANÁLISIS COMPLETO - Pendiente de decisión
