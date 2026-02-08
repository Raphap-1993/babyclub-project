# 📚 Documentación: Sistema Multi-Evento + Mesas Personalizadas

**Propósito**: Guía completa para entender, discutir y implementar soporte multi-evento con croquis personalizados por evento.

**Estado**: Recomendación técnica para discusión con PM + Arquitecto.

---

## 🚀 Empezar Aquí

**Si tienes 5 minutos**:
- Lee: [`QUICK_START_MULTI_EVENT.md`](./QUICK_START_MULTI_EVENT.md)
- Resultado: Entiendes el problema y las opciones

**Si tienes 15 minutos**:
- Lee: `QUICK_START_MULTI_EVENT.md` + `MESAS_LAYOUT_REFERENCE.md`
- Resultado: Sabes cómo funciona hoy + qué cambiaría

**Si tienes 1 hora** (prepararse para reunión):
- Lee: Todos los .md excepto CODE_CHANGES_PREVIEW
- Completa: `MULTI_EVENT_DECISION_CHECKLIST.md`
- Resultado: Listo para decidir en reunión

**Si vas a implementar**:
- Lee: `CODE_CHANGES_PREVIEW.md`
- Implementa: Paso a paso en el checklist
- Prueba: Con los casos de test descriptos

---

## 📖 Documentos Disponibles

### 1. [`QUICK_START_MULTI_EVENT.md`](./QUICK_START_MULTI_EVENT.md) ⭐
**Para**: PM, Arquitecto, cualquiera que quiera overview en 5 min.

**Contiene**:
- El problema en 1 frase
- Solución visual propuesta
- 3 preguntas clave para PM
- 3 preguntas clave para Arquitecto
- Línea de tiempo
- Próximos pasos

**Tiempo**: ~5 minutos

---

### 2. [`MESAS_LAYOUT_REFERENCE.md`](./MESAS_LAYOUT_REFERENCE.md)
**Para**: Cualquiera que quiera entender cómo funciona **hoy**.

**Contiene**:
- Estructura actual de datos (layout_settings, tables)
- Flujos de trabajo (admin, cliente, puerta)
- Rutas API clave
- Cómo funciona el drag & drop técnicamente
- Problemas/casos borde actuales
- Cómo probar localmente

**Tiempo**: ~10 minutos

---

### 3. [`MULTI_EVENT_LAYOUT_DESIGN.md`](./MULTI_EVENT_LAYOUT_DESIGN.md)
**Para**: PM, Arquitecto, Tech Lead (decisión arquitectónica).

**Contiene**:
- Análisis completo del estado actual
- Problema a resolver (casos reales)
- 3 opciones arquitectónicas evaluadas:
  - Opción A: Layouts por Evento (RECOMENDADA)
  - Opción B: Mesas Templadas
  - Opción C: Layouts por Organizador
- Matriz de decisión (complejidad, flexibilidad, costo)
- Flujo de implementación de Opción A
- Impacto en módulos existentes
- Preguntas críticas para PM y Arquitecto

**Tiempo**: ~20 minutos

---

### 4. [`MULTI_EVENT_DECISION_CHECKLIST.md`](./MULTI_EVENT_DECISION_CHECKLIST.md)
**Para**: Llenar en reunión con todo el equipo.

**Contiene**:
- Sección 1: Preguntas de negocio (PM)
- Sección 2: Decisión de arquitectura (Arquitecto)
- Sección 3: Definir permisos
- Sección 4: Impacto por módulo
- Sección 5: Estrategia de migración
- Sección 6: Plan de tests
- Sección 7: Documentación
- Sección 8: Firmas de aprobación

**Uso**: Imprimir o llenar en documento colaborativo.

**Tiempo**: ~30 minutos en reunión

---

### 5. [`CODE_CHANGES_PREVIEW.md`](./CODE_CHANGES_PREVIEW.md)
**Para**: Tech Lead, developers que van a implementar.

**Contiene**:
- Código actual vs. propuesto (10 ejemplos)
- Cambios en API de layout
- Cambios en LayoutEditor
- Migration SQL
- Cambios en upload
- Cambios en validaciones
- Resumen de archivos afectados
- Orden de implementación

**Tiempo**: ~15 minutos

---

## 🎯 Flujo de Decisión Recomendado

```
DÍA 1: EXPLORACIÓN (Esta semana)
├─ PM lee: QUICK_START + secciones 8 de DESIGN
├─ Arquitecto lee: QUICK_START + DESIGN completo
├─ Tech Lead lee: QUICK_START + REFERENCE + CODE_PREVIEW
└─ Resultado: Todos entienden qué se necesita

DÍA 2: REUNIÓN DE DECISIÓN
├─ Lider facilita DECISION_CHECKLIST.md
├─ PM responde sección 1 (negocio)
├─ Arquitecto responde sección 2 (diseño)
├─ Tech Lead responde sección 4 (impacto)
└─ Resultado: Decisión + firma de todos

DÍA 3-4: IMPLEMENTACIÓN (Próximo sprint)
├─ Tech Lead crea PR con migration
├─ Dev implementa API changes
├─ Frontend implementa LayoutEditor changes
├─ QA ejecuta plan de tests
└─ Resultado: Feature en staging

DÍA 5: DEPLOY
├─ Code review + approval
├─ Deploy a production
├─ Monitoreo activo
└─ Resultado: Multi-evento operativo
```

---

## 🤔 Preguntas Frecuentes

### ¿Cuándo necesitamos esto?
**Respuesta**: Cuando tengamos eventos simultáneos o eventos con croquis diferentes. Ver sección 8 de `MULTI_EVENT_LAYOUT_DESIGN.md`.

### ¿Cuál es el costo?
**Respuesta**: 
- Análisis: 1 hora
- Implementación: 2-3 días
- QA: 1 día
- Deploy: 0.5 día
- **Total**: ~4-5 días

### ¿Es breaking change?
**Respuesta**: No si implementamos con fallback. Ver `CODE_CHANGES_PREVIEW.md` sección 2 (landing API tiene fallback).

### ¿Qué opciones tengo?
**Respuesta**: Ver matriz en `MULTI_EVENT_LAYOUT_DESIGN.md` sección 3:
- Opción A (recomendada): simple, flexible
- Opción B: reutilizable pero más compleja
- Opción C: por organizador, muy compleja

### ¿Cuál escojo?
**Respuesta**: Opción A a menos que necesites reutilizar plantillas (Opción B) o separar por organizador (Opción C).

---

## 🔗 Relación Entre Documentos

```
QUICK_START (entry point)
    ↓
    ├→ MESAS_LAYOUT_REFERENCE (cómo funciona hoy)
    │   └→ CODE_CHANGES_PREVIEW (qué cambia)
    │
    ├→ MULTI_EVENT_LAYOUT_DESIGN (análisis profundo)
    │   └→ DECISION_CHECKLIST (llenar con equipo)
    │       └→ Implementar según decisión
    │
    └→ README_MULTI_EVENT (este archivo)
```

---

## ✅ Checklist Pre-Reunión

Antes de la reunión de decisión:

- [ ] **PM**:
  - Leer `QUICK_START_MULTI_EVENT.md`
  - Leer sección "Problema a Resolver" de `MULTI_EVENT_LAYOUT_DESIGN.md`
  - Responder mentalmente las 3 preguntas de sección 8 de DESIGN

- [ ] **Arquitecto**:
  - Leer `MULTI_EVENT_LAYOUT_DESIGN.md` completo
  - Leer `CODE_CHANGES_PREVIEW.md`
  - Elegir opción A, B o C

- [ ] **Tech Lead**:
  - Leer `MESAS_LAYOUT_REFERENCE.md`
  - Leer `CODE_CHANGES_PREVIEW.md`
  - Estimar horas para opción elegida

- [ ] **DevOps** (si participa):
  - Leer sección 5 de `DECISION_CHECKLIST.md`
  - Preparar plan de migration

---

## 🛠️ Implementación Rápida (Una Vez Decidido)

Si ya decidieron Opción A:

1. **Día 1**: Leer `CODE_CHANGES_PREVIEW.md` sección 8-10
2. **Día 2-3**: Implementar cambios según checklist
3. **Día 4**: QA
4. **Día 5**: Deploy

Archivos a modificar (en orden):
```
1. supabase/migrations/2026-02-08-event-layouts-per-event.sql (crear)
2. apps/backoffice/app/api/layout/route.ts
3. apps/landing/app/api/layout/route.ts
4. apps/backoffice/app/api/uploads/layout/route.ts
5. apps/backoffice/app/admin/tables/layout/LayoutEditor.tsx
6. tests (crear/actualizar)
```

---

## 📊 Resumen de Opciones

| Aspecto | Opción A | Opción B | Opción C |
|---------|----------|----------|----------|
| **Implementación** | Layout por evento | Mesas templadas | Layout por org |
| **Complejidad** | 🟢 Baja | 🟡 Media | 🔴 Alta |
| **Flexibilidad** | 🟢 Total | 🟡 Limitada | 🟡 Limitada |
| **Costo** | 2-3 días | 4-5 días | 6-8 días |
| **RLS** | Simple (event_id) | Complejo (joins) | Complejo (joins) |
| **Recomendado** | ✅ SÍ | ❌ Si necesitas reutilización | ❌ Si separas por org |

---

## 🚨 Decisiones Críticas

Estas 3 decisiones definen todo:

1. **¿Layouts por evento o por organizador?**
   - Por evento → Opción A (recomendado)
   - Por org → Opción C

2. **¿Necesitan reutilizar layouts?**
   - No → Opción A simple
   - Sí → Opción B (o A + feature futura)

3. **¿Cuándo lo necesitan?**
   - Este sprint → empezar hoy
   - Próximo sprint → preparar ahora, implementar luego
   - Futuro → documentar y esperar

---

## 📋 Siguiente Paso

**Hoy**: Leer `QUICK_START_MULTI_EVENT.md` (5 min)  
**Mañana**: Leer documentos según rol  
**Esta semana**: Reunión de decisión con checklist  
**Próxima semana**: Implementación si se decide

---

## 📞 Soporte

- **Preguntas técnicas**: Abre issue con `[multi-evento]` en título
- **Clarificaciones de design**: Comenta en el PR donde se implemente
- **Feedback general**: #tech-channel en Slack

---

## 📝 Control de Versiones de Docs

| Versión | Fecha | Cambios |
|---------|-------|---------|
| v1.0 | 2026-02-08 | Análisis inicial + 3 opciones |
| - | - | - |

---

## 🔗 Referencias

- **Código**: `AGENTS.md` (framework de trabajo)
- **Arquitectura actual**: `docs/ARCHITECTURE_V2.md`
- **Plan de migración**: `docs/STRANGLER_PLAN.md`
- **Migraciones BD**: `supabase/migrations/`

---

**Última actualización**: 2026-02-08  
**Autor**: Análisis Técnico (GitHub Copilot CLI + Equipo)  
**Estado**: Listo para revisión con PM + Arquitecto

