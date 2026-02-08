# Diseño de Mesas por Evento (Multi-Evento)

**Documento de Análisis y Propuesta**  
**Fecha:** 2026-02-08  
**Estado:** Recomendación Técnica para Discusión PM + Arquitecto

---

## 1. Situación Actual (Estado Base)

### Realidad Operativa
- **Módulo de Crear Mesas**: Permite crear una mesa con posiciones dinámicas (drag & drop) en un croquis.
- **Almacenamiento de Layout**: 
  - Croquis único global: `layout_settings.layout_url` (1 solo croquis para toda la plataforma)
  - Posiciones de mesas: Guardadas en columnas de la tabla `tables`:
    - `pos_x`, `pos_y`, `pos_w`, `pos_h` (posición y dimensión en porcentaje 0-100)
- **Restricción Actual**: Una mesa puede estar asignada a 1 evento (`tables.event_id`), pero el croquis es **global/único**.

### Datos Clave (en BD)
```sql
-- Tablas relevantes (simplificado)
tables:
  id, name, event_id, pos_x, pos_y, pos_w, pos_h, ...

events:
  id, name, organizer_id, ...

organizers:
  id, slug, name, ...

layout_settings:
  id=1 (global), layout_url (1 solo croquis)
```

### Flujo Actual en LayoutEditor
1. Carga el croquis único de `layout_settings`
2. Carga todas las mesas (sin filtro por evento)
3. Admin arrastra mesas sobre el croquis
4. Guarda posiciones con `POST /api/tables/update`

**Problema evidente**: Sin filtro de evento, no se distingue qué mesas son para cuál evento, especialmente con multiorganizador + multievento.

---

## 2. Problema a Resolver

### Escenario Multi-Evento Real

**Caso 1: Mismo Organizador, Múltiples Eventos**
- Organizador "Baby Club" realiza 5 eventos (Cumpleaños, Bautizos, etc.)
- Cada evento puede tener:
  - Diferente distribución de mesas
  - Diferentes croquis/planos (ej: Salón A vs Salón B)
  - Diferentes combos/productos disponibles

**Caso 2: Alianza entre Organizadores**
- Organizador A y B acuerdan vender juntos
- Comparten el mismo evento o crean sub-eventos
- ¿Mesas compartidas o independientes por organizador?

**Caso 3: Mesas Reutilizables**
- Mesa "M1" ¿se usa en 5 eventos diferentes con posiciones distintas?
- ¿O se crean 5 mesas diferentes?

### Preguntas Críticas para PM + Arquitecto

1. **Modelo de Datos**:
   - ¿Una mesa es "plantilla" reutilizable entre eventos, o es instancia de evento?
   - Si es reutilizable: ¿Cómo almacenar posiciones diferentes por evento?

2. **Croquis / Layout**:
   - ¿Un croquis = un evento, o un croquis = un salón reutilizable?
   - ¿Quién controla el croquis? (admin global, organizador, o ambos)

3. **Permisos**:
   - ¿Un promotor de Org A ve mesas/layout de Org A solamente?
   - ¿Un admin global ve TODO?

4. **Operación en Puerta (Scan)**:
   - ¿El escaneo filtra mesas por evento?
   - ¿O es agnóstico al layout?

---

## 3. Análisis de Arquitecturas Posibles

### **Opción A: Layouts por Evento (Recomendado)**

**Concepto**: Cada evento tiene su propio croquis y mesas.

```
layout_settings:
  id, event_id, layout_url, ...  -- 1 croquis por evento

tables:
  id, event_id, name, pos_x, pos_y, ...  -- mesas instancia de evento
```

**Ventajas**:
- ✅ Total flexibilidad: cada evento puede rearranjar libremente
- ✅ Escalable: N eventos = N layouts
- ✅ Seguridad clara: filtro por `event_id` en todas partes
- ✅ Operación limpia: en puerta, carga mesas del evento en curso

**Desventajas**:
- ❌ Duplicación de datos si eventos reiteran distribuciones similares
- ❌ Requiere migración de `layout_settings` (1 → N registros)

**Costo Técnico**: BAJO (cambio directo en schema y rutas)

---

### **Opción B: Mesas Templadas + Layout Global**

**Concepto**: Mesas son "plantillas", tabla nueva almacena posiciones por evento.

```
table_templates:
  id, name, type, default_capacity, ...  (reutilizable)

table_event_layouts:
  id, event_id, template_id, layout_url, pos_x, pos_y, ...

layout_settings:
  id=1 (global), backup_layout_url
```

**Ventajas**:
- ✅ Reutiliza plantillas entre eventos
- ✅ Reduce duplicación si eventos similares

**Desventajas**:
- ❌ Complejidad: 3 niveles (templates, layouts, eventos)
- ❌ Queries más complejas (joins adicionales)
- ❌ RLS más difícil de gobernar

**Costo Técnico**: MEDIO (nueva tabla, migraciones complejas)

---

### **Opción C: Layouts por Organizador**

**Concepto**: Cada organizador define 1-N layouts que reutiliza en sus eventos.

```
organizer_layouts:
  id, organizer_id, name, layout_url, is_default, ...

organizer_layout_mesas:
  id, organizer_layout_id, name, pos_x, pos_y, ...

tables:
  id, event_id, organizer_layout_mesa_id, ...
```

**Ventajas**:
- ✅ Organizador controla su identidad visual
- ✅ Eficiente si org reutiliza layouts

**Desventajas**:
- ❌ Rigid para eventos únicos
- ❌ Alianzas requieren lógica especial

**Costo Técnico**: ALTO (múltiples nuevas tablas)

---

## 4. Recomendación Técnica

### **Opción A + Versión Mejorada**

Implementar **Layouts por Evento** con capacidad futura de copiar/clonar.

### Schema Propuesto

```sql
-- 1. Cada evento tiene su croquis
alter table public.layout_settings
  drop constraint layout_settings_pkey,
  add column if not exists event_id uuid references public.events(id),
  add primary key (event_id);

-- 2. Alternativa: tabla separada para más claridad
create table if not exists public.event_layouts (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null unique references public.events(id) on delete cascade,
  layout_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null,
  deleted_by uuid null
);

-- 3. Las mesas ya tienen event_id, validar constraint
-- Constraint: si mesa tiene event_id, debe tener posición si es layout-based
```

### Cambios en Código

**En LayoutEditor.tsx**:
```typescript
// ANTES: carga croquis único
const layoutRes = await authedFetch("/api/layout");

// DESPUÉS: carga croquis del evento
const layoutRes = await authedFetch(`/api/layout?event_id=${eventId}`);
```

**En rutas API**:
```typescript
// GET /api/layout
// ANTES: SELECT * FROM layout_settings WHERE id = 1
// DESPUÉS: SELECT * FROM event_layouts WHERE event_id = ${eventId}

// POST /api/layout/upload
// ANTES: UPDATE layout_settings SET layout_url = ... WHERE id = 1
// DESPUÉS: UPDATE event_layouts SET layout_url = ... WHERE event_id = ${eventId}
```

**En rutas de mesas**:
```typescript
// GET /api/tables
// ANTES: carga sin filtro (o con event_id si pasaba)
// DESPUÉS: siempre filtra por event_id (requerido)

// POST /api/tables/update
// DESPUÉS: valida que mesa.event_id = session.event_id (si admin parcial)
```

---

## 5. Matriz de Decisiones para Discutir

| Aspecto | Opción A (Recomendada) | Opción B | Opción C |
|--------|------------------------|----------|----------|
| Complejidad | 🟢 Baja | 🟡 Media | 🔴 Alta |
| Flexibilidad | 🟢 Total | 🟡 Limitada | 🟡 Limitada |
| Reutilización | 🟡 Manual (copy) | 🟢 Automática | 🟢 Automática |
| Migración | 🟢 Simple | 🟡 Media | 🔴 Complicada |
| Seguridad (RLS) | 🟢 Clara | 🟡 Compleja | 🟡 Compleja |
| Multi-org | 🟢 Soporta bien | 🟡 Requiere ajuste | 🟢 Soporta bien |
| Costo Estimado | ~2-3 días | ~4-5 días | ~6-8 días |

---

## 6. Flujo de Implementación (Opción A)

### Fase 1: Preparación (sin breaking changes)
1. Añadir `event_id` a `layout_settings` (nullable inicialmente)
2. Crear tabla `event_layouts` (paralela, opcional)
3. Deploying con ambas tablas coexistiendo

### Fase 2: Migración Segura
1. **Copiar datos**: para cada evento, crear registro en `event_layouts`
2. **Dual-write**: mientras `layout_settings` y `event_layouts` se sincronizan
3. **Validar**: que el 100% de eventos tengan layout

### Fase 3: Cutover
1. Cambiar rutas API a leer/escribir en `event_layouts` principalmente
2. Mantener fallback a `layout_settings` por 1 sprint
3. Deprecar `layout_settings` (registrar en ADR)

### Fase 4: Cleanup
1. Remover `layout_settings` (después 2 sprints)
2. Actualizar tests y documentación

---

## 7. Impacto en Módulos Existentes

| Módulo | Cambio Requerido | Riesgo |
|--------|------------------|--------|
| LayoutEditor | Añadir filtro `event_id` a cargas | 🟡 Bajo (UI-only) |
| /api/layout | Cambiar query a `event_layouts` | 🟡 Bajo (ruta existente) |
| /api/tables | Validar `event_id` en todas partes | 🟢 Bajo (ya filtra) |
| /api/tables/update | Guardar con `event_id` del contexto | 🟢 Bajo (ya tiene) |
| Scan (puerta) | Cargar mesas del evento en curso | 🟢 Muy bajo (agnóstico) |
| Reservas | Filtro por evento ya existe | 🟢 Cero cambio |
| Tickets | Filtro por evento ya existe | 🟢 Cero cambio |

---

## 8. Preguntas para el PM

**Prioridad Negocial**:
1. ¿Cuándo necesitamos multi-evento operativo? (timeline)
2. ¿Es crítico clonar/reutilizar layouts o es aceptable crear nuevos?
3. ¿Los eventos pueden compartir mesas o son instancias independientes?

**Restricciones Operacionales**:
1. ¿Hay eventos simultáneos que compartan salón? (afecta diseño)
2. ¿El admin puede ver/editar mesas de Org A siendo admin global?
3. ¿Alianzas implican compartir croquis o layouts independientes?

---

## 9. Preguntas para el Arquitecto

**Sobre Boundaries**:
1. ¿`layout_settings` es global (branding) o por evento (operación)?
2. ¿Mesas pertenecen a `dominio.event` o `dominio.layout`?
3. ¿RLS debería filtrar por `event_id` o también por `organizer_id`?

**Sobre Versioning**:
1. ¿Necesitamos versionado de layouts (ej: "Layout v1, v2")?
2. ¿Auditoría de cambios en croquis? (quién movió qué mesa)

**Sobre Contrato**:
1. ¿`GET /api/tables?event_id=X` debería ser requerido u opcional?
2. ¿Errores si se intenta acceder a tabla de otro evento?

---

## 10. Siguientes Pasos

### Inmediato (esta semana)
- [ ] **PM** valida preguntas de negocio (sección 8)
- [ ] **Arquitecto** decide modelo final (Opción A, B o variante)
- [ ] **Team** estima basado en decisión

### Corto Plazo (próximo sprint)
- [ ] Crear ADR con decisión
- [ ] Implementar migrations
- [ ] Actualizar LayoutEditor
- [ ] Tests de regresión

### Validación
- [ ] Deploy a staging con multi-evento
- [ ] QA crea y maneja 3+ eventos
- [ ] Smoke test: puerta, reservas, tickets

---

## Anexo: Código de Referencia Actual

### LayoutEditor (líneas clave)
```typescript
// Línea 44-46: carga sin filtro de evento
const layoutRes = await authedFetch("/api/layout");
const tablesRes = await authedFetch("/api/tables");
// ← Aquí debería pasar ?event_id=${selectedEventId}
```

### API /api/layout (backoffice y landing)
- `apps/backoffice/app/api/layout/route.ts` - carga `layout_settings.id = 1`
- `apps/landing/app/api/layout/route.ts` - ídem

### API /api/tables
- Ambas apps tienen `/api/tables/route.ts`
- Landing ya filtra por `event_id` si viene en query
- Backoffice también soporta el filtro

**Conclusión**: 80% del código ya soporta multi-evento en tablas, solo falta aplicar a layouts.

