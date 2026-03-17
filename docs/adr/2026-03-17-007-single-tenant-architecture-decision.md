## ADR-007 — Arquitectura Single-Tenant por Deployment

**Fecha:** 2026-03-17
**Estado:** Aprobado

## Contexto

La documentación histórica describía el proyecto como "multi-tenant" o capaz de servir múltiples organizadores independientes desde un mismo deployment. En la práctica, el sistema usa un único `NEXT_PUBLIC_ORGANIZER_ID` hardcodeado por deployment y no implementa aislamiento de tenant a nivel de auth ni de datos.

Específicamente:
- No existe tabla `organizer_memberships` que acote el alcance de un staff a un tenant.
- `requireStaff()` valida identidad y rol, pero no valida membresía por organizer.
- `organizer_id` en queries es un filtro de consistencia que usa el valor de `NEXT_PUBLIC_ORGANIZER_ID`, no un mecanismo de aislamiento dinámico entre tenants.
- Cambiar el organizer activo requiere un redesploy completo.

## Decisión

El proyecto es y continuará siendo **single-tenant, single-organizer por deployment**.

- Un deployment = un organizer (actualmente BabyClub).
- El mismo codebase puede desplegarse independientemente para otro organizer, pero no comparten deployment ni base de datos.
- `organizer_id` en queries se mantiene como filtro de consistencia, no se elimina — es útil para datos históricos y migraciones futuras.

## Consecuencias

- No se implementará multi-tenancy en este ciclo.
- La documentación se actualiza para reflejar esta realidad (CLAUDE.md, docs/MULTI-EVENT-SYSTEM.md, docs/SAAS-READINESS-2026-03.md).
- Los documentos que usan lenguaje "multi-organizer" se marcan con nota histórica.
- Si en el futuro se necesita multi-tenant verdadero, se requerirá:
  - Tabla `organizer_memberships` (staff ↔ organizer scoping)
  - Auth con alcance por tenant desde el token, no desde query param
  - RLS policies por organizer_id en Supabase
  - Resolución de tenant desde host/slug en middleware
  - Branding por tenant (eliminar `brand_settings id=1`)

## Archivos afectados

- `CLAUDE.md`
- `docs/MULTI-EVENT-SYSTEM.md`
- `docs/SAAS-READINESS-2026-03.md`
- `docs/MULTI-ORGANIZER-LAYOUT-2026-02-08.md` (nota histórica)
- `docs/adr/2026-02-08-006-multi-organizer-layout.md` (nota histórica)
- `docs/adr/2026-02-07-004-multi-organizer-close-reports.md` (nota histórica)
- `docs/adr/2026-02-07-003-event-scoping-strict.md` (nota histórica)
