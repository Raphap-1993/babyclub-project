# ⚡ Quick Start: Entender Multi-Evento + Mesas

**Leé esto primero en 5 minutos. Luego los documentos detallados.**

---

## El Problema en 1 Frase

Hoy todas los eventos usan **el mismo croquis**, pero si necesitamos eventos diferentes → cada uno necesita su propio croquis.

---

## Situación Actual (Dibujada)

```
┌─────────────────────────────────┐
│ LAYOUT GLOBAL (1 solo croquis)  │  ← Todos lo usan
├─────────────────────────────────┤
│  Evento A            Evento B    │
│  ┌─────────────┐    ┌─────────┐ │
│  │ Mesa M1     │    │ Mesa M2 │ │ ← Posiciones diferentes
│  │ pos_x=10%   │    │ pos_x=5%│ │   pero en el mismo croquis
│  └─────────────┘    └─────────┘ │
└─────────────────────────────────┘
```

**Problema**: Si Evento A necesita croquis Salón A y Evento B necesita Salón B → **no se puede**.

---

## Solución Propuesta (Opción A Recomendada)

```
┌──────────────────────┐    ┌──────────────────────┐
│ Evento A             │    │ Evento B             │
│ ┌────────────────┐   │    │ ┌────────────────┐   │
│ │ Croquis Salón A│   │    │ │ Croquis Salón B│   │
│ │ ┌──────────┐   │   │    │ │ ┌──────────┐   │   │
│ │ │ M1 M2 M3 │   │   │    │ │ │ M1 M2    │   │   │
│ │ └──────────┘   │   │    │ │ └──────────┘   │   │
│ └────────────────┘   │    │ └────────────────┘   │
└──────────────────────┘    └──────────────────────┘
  Cada evento → su croquis
  Cada croquis → sus posiciones
```

**Ventaja**: Cada evento personalizado, sin conflictos.

---

## Decisiones Rápidas para PM

**Pregunta 1**: ¿Necesitamos eventos que compartan salón simultáneamente?
- Sí → diseño especial
- No → Opción A alcanza

**Pregunta 2**: ¿Es crítico para este sprint?
- Sí → empezar ahora
- No → puede esperar 1-2 semanas

**Pregunta 3**: ¿Eventos pueden reutilizar croquis?
- Sí → feature futura (clone)
- No → cada evento nuevo del cero

---

## Decisiones Rápidas para Arquitecto

**Pregunta 1**: ¿Usar tabla nueva o modificar existente?
- Nueva tabla `event_layouts` → más limpio
- Modificar `layout_settings` → más simple

**Pregunta 2**: ¿Admin global ve todo o filtrado por org?
- Ver todo → RLS por evento_id
- Filtrado → RLS por event_id + organizer_id

**Pregunta 3**: ¿Versionado de croquis?
- Sí → auditoría + rollback
- No → último gana

---

## Línea de Tiempo Estimada

| Fase | Duración | Qué se Hace |
|------|----------|-----------|
| Decisión | 1 hora | Esta reunión + checklist |
| Desarrollo | 2-3 días | Código + tests |
| QA | 1 día | Validar multi-evento |
| Deploy | 0.5 día | Production |
| **Total** | **~4-5 días** | **Listo para usar** |

---

## Documentos para Leer (en Orden)

1. **Este archivo** ← Ya estás aquí (5 min)
2. `MESAS_LAYOUT_REFERENCE.md` ← Cómo funciona hoy (10 min)
3. `MULTI_EVENT_LAYOUT_DESIGN.md` ← Análisis + opciones (20 min)
4. `MULTI_EVENT_DECISION_CHECKLIST.md` ← Llenar con el equipo (30 min)

---

## Código Clave a Mirar

Si quieres ver dónde está todo:

```
UI del Layout Editor:
  apps/backoffice/app/admin/tables/layout/LayoutEditor.tsx

APIs de Layout:
  apps/backoffice/app/api/layout/route.ts (upload + GET)
  apps/landing/app/api/layout/route.ts (lectura)

APIs de Mesas:
  apps/backoffice/app/api/tables/route.ts
  apps/landing/app/api/tables/route.ts

Schema Actual:
  supabase/migrations/2026-02-07-create-brand-and-layout-settings.sql
  (mesas ya están en table "tables" con event_id)
```

---

## Próximo Paso

**Esta semana**:
- [ ] PM: responde las 3 preguntas rápidas
- [ ] Arquitecto: elige Opción A, B o C
- [ ] Tech Lead: abre PR con cambios si aplica

**Próxima semana**:
- [ ] Implementar decisión
- [ ] QA valida
- [ ] Deploy

---

## Contacto para Preguntas

Usar #tech-channel para:
- Dudas sobre arquitectura
- Clarificar casos de uso
- Compartir progreso

