# 🎯 Solución: Mesas por Organizador (No por Evento)

**Fecha:** 2026-02-08  
**Problema:** Crear 10 mesas por cada evento nuevo es ineficiente  
**Solución:** Mesas pertenecen al ORGANIZADOR (local físico), no al evento

---

## 📋 Problema Actual

```
❌ FLUJO ACTUAL (MALO):
Evento A (2026-02-10) → Crear 10 mesas + plano
Evento B (2026-02-15) → Crear 10 mesas + plano (otra vez!)
Evento C (2026-02-20) → Crear 10 mesas + plano (otra vez!!)

❌ Resultado: Mucho trabajo repetitivo
```

## ✅ Solución Correcta

```
✅ FLUJO OPTIMIZADO (BUENO):
Organizador "BabyClub" → Crear 10 mesas + plano UNA VEZ
  ├─ Evento A (2026-02-10) → Usar mesas del organizador
  ├─ Evento B (2026-02-15) → Usar mesas del organizador
  └─ Evento C (2026-02-20) → Usar mesas del organizador

✅ Resultado: Configuración única, reutilización total
```

---

## 🏗️ Arquitectura Propuesta

### Concepto Clave

```
ORGANIZADOR (Local Físico)
  ├─ Mesas fijas (M1, M2, M3... M10)  ← Creadas UNA VEZ
  ├─ Croquis/plano del local          ← Subido UNA VEZ
  └─ Eventos múltiples
      ├─ Evento A → Mesas disponibles + reservas
      ├─ Evento B → Mesas disponibles + reservas
      └─ Evento C → Mesas disponibles + reservas
```

### Modelo de Datos (Cambio Conceptual)

**ANTES (Incorrecto):**
```sql
-- Mesas duplicadas por evento ❌
tables:
  - id, event_id, organizer_id, name, pos_x, pos_y
  - Mesa 1 del Evento A
  - Mesa 1 del Evento B (duplicado!)
  - Mesa 1 del Evento C (duplicado!)
```

**DESPUÉS (Correcto):**
```sql
-- Mesas únicas del organizador ✅
tables:
  - id, organizer_id, name, pos_x, pos_y
  - Mesa 1 (única, del organizador)
  - Mesa 2 (única, del organizador)

-- Disponibilidad por evento ✅
table_availability:
  - table_id, event_id, is_available
  - Mesa 1 disponible en Evento A
  - Mesa 1 disponible en Evento B
  
-- Reservas siguen igual ✅
table_reservations:
  - table_id, event_id, person_id, status
```

---

## 🔧 Cambios Necesarios

### 1. Migración de Base de Datos

```sql
-- Nueva tabla: Disponibilidad de mesas por evento
CREATE TABLE public.table_availability (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_id uuid NOT NULL REFERENCES public.tables(id),
  event_id uuid NOT NULL REFERENCES public.events(id),
  is_available boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  
  UNIQUE(table_id, event_id) -- Una mesa solo puede tener un estado por evento
);

-- Índices
CREATE INDEX idx_table_availability_event ON table_availability(event_id);
CREATE INDEX idx_table_availability_table ON table_availability(table_id);

-- Modificar tabla tables: quitar event_id
ALTER TABLE public.tables DROP COLUMN IF EXISTS event_id;

-- Las mesas ahora solo pertenecen al organizador
-- Ya tienen organizer_id desde migración anterior
```

### 2. Flujo de Trabajo Optimizado

#### **Configuración Inicial (Una sola vez por organizador)**

```
/admin/organizers/[org_id]/settings/tables
  ├─ Crear mesas del local (M1, M2, M3... M10)
  ├─ Configurar plano/croquis
  └─ Definir precios base por mesa
```

#### **Por Cada Evento Nuevo**

```
/admin/organizers/[org_id]/events/[event_id]/settings
  ├─ Seleccionar qué mesas están disponibles
  │   ☑ Mesa 1 (disponible)
  │   ☑ Mesa 2 (disponible)
  │   ☐ Mesa 3 (en mantenimiento)
  ├─ Ajustar precios si es necesario (override)
  └─ Listo! (menos de 1 minuto)
```

---

## 🎨 UI Propuesta

### Pantalla: Configuración de Mesas del Organizador

```
┌─────────────────────────────────────────────────────────┐
│ Mesas de BabyClub                                       │
│ Estas mesas se reutilizan en todos los eventos         │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  📋 Mesas del Local (10)                                │
│  ┌───────────────────────────────────────────────┐     │
│  │ Mesa 1    5 tickets   S/ 80   [Editar] [❌]  │     │
│  │ Mesa 2    6 tickets   S/ 160  [Editar] [❌]  │     │
│  │ Mesa 3    6 tickets   S/ 160  [Editar] [❌]  │     │
│  │ ...                                           │     │
│  └───────────────────────────────────────────────┘     │
│                                                         │
│  [+ Agregar Mesa]  [📐 Editar Plano]                   │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Pantalla: Configuración de Evento (Rápida)

```
┌─────────────────────────────────────────────────────────┐
│ Configurar Mesas para "Cumple 10 Feb 2026"             │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Selecciona qué mesas estarán disponibles:             │
│                                                         │
│  ☑ Mesa 1  (5 tickets, S/ 80)   ✏️ Ajustar precio     │
│  ☑ Mesa 2  (6 tickets, S/ 160)  ✏️ Ajustar precio     │
│  ☐ Mesa 3  (en mantenimiento)                          │
│  ☑ Mesa 4  (6 tickets, S/ 160)  ✏️ Ajustar precio     │
│  ...                                                    │
│                                                         │
│  [Todas] [Ninguna]         [Guardar Configuración]     │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## 📊 Comparación de Flujos

### Escenario: Organizador crea 12 eventos al año

| Métrica | ANTES (Por Evento) | DESPUÉS (Optimizado) | Ahorro |
|---------|-------------------|---------------------|---------|
| Veces que crea mesas | 12 veces × 10 mesas = **120** | **1 vez × 10 mesas** | **91% menos** |
| Tiempo configuración | 12 × 15 min = **180 min** | 15 min + (12 × 2 min) = **39 min** | **78% menos** |
| Croquis a subir | **12 archivos** | **1 archivo** | **91% menos** |
| Posiciones a ajustar | **120 posiciones** | **10 posiciones** | **91% menos** |

---

## 🔄 Plan de Migración

### Fase 1: Preparación (1-2 horas)
- [ ] Crear migración de BD (`table_availability`)
- [ ] Migrar datos existentes
- [ ] Crear índices necesarios

### Fase 2: Backend (2-3 horas)
- [ ] API para gestionar mesas del organizador
- [ ] API para configurar disponibilidad por evento
- [ ] Actualizar queries de reservas

### Fase 3: Frontend (3-4 horas)
- [ ] Pantalla de mesas del organizador
- [ ] Selector de disponibilidad en configuración de evento
- [ ] Actualizar flujo de reservas

### Fase 4: Testing & Deploy (1-2 horas)
- [ ] Testing de migración de datos
- [ ] Testing de flujo completo
- [ ] Deploy a staging → producción

**Total estimado: 1-1.5 días**

---

## ✅ Beneficios Inmediatos

1. **Para el Negocio:**
   - ⚡ 10x más rápido crear eventos nuevos
   - 📉 Menos errores (menos duplicación)
   - 🎯 Configuración consistente entre eventos

2. **Para el Admin:**
   - 🚀 Setup de evento: de 15 min → 2 min
   - 🔄 Reutilización total de configuración
   - 📋 Vista clara de todas las mesas del local

3. **Para el Sistema:**
   - 🗄️ Menos datos duplicados
   - 🔍 Queries más eficientes
   - 🛡️ Mejor integridad de datos

---

## 🚦 Decisión Requerida

**Opción A: Migración Completa (Recomendada)**
- ✅ Soluciona el problema de raíz
- ✅ Escalable a largo plazo
- ❌ Requiere 1-1.5 días de desarrollo

**Opción B: Solución Temporal (Copy Layout)**
- ✅ Ya existe (feature de copiar layout)
- ❌ Sigue duplicando mesas
- ❌ No resuelve el problema real

**Recomendación:** Opción A - Vale la pena hacerlo bien

---

## 📝 Próximos Pasos

Si apruebas la Opción A:

1. **Validar con PM/Negocio:**
   - ¿Cuántos organizadores hay actualmente?
   - ¿Cuántos eventos por mes?
   - ¿Es crítico hacerlo ahora o puede esperar?

2. **Planificar Migración:**
   - Crear ADR (Architecture Decision Record)
   - Definir estrategia de rollback
   - Coordinar con QA para testing

3. **Ejecutar:**
   - Sprint dedicado (1-1.5 días)
   - Testing exhaustivo en staging
   - Deploy controlado a producción

---

**Autor:** AI Assistant  
**Status:** 💡 PROPUESTA - Pendiente de aprobación  
**Impacto:** 🔴 ALTO (Mejora significativa de UX y eficiencia)
