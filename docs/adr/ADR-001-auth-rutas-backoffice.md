# ADR-001 — Todas las rutas backoffice requieren requireStaff

**Fecha:** 2026-03-15
**Estado:** Aprobado
**Decisores:** Rapha (propietario del proyecto)

## Contexto

Durante la auditoría de seguridad del 2026-03-15 se encontró que 7 rutas de `apps/backoffice/app/api/` no llamaban a `requireStaff()` al inicio del handler. Esto dejaba expuestos datos sensibles (DNI, emails, tokens QR, layouts de mesas) a cualquiera que conociera las URLs.

También se encontró un endpoint `admin/migrate` que ejecutaba SQL arbitrario contra la base de datos de producción sin ninguna verificación de identidad.

## Decisión

**Regla absoluta:** Toda ruta en `apps/backoffice/app/api/` debe llamar a `requireStaffRole(req)` como primera operación del handler, antes de leer el body, params o tocar la DB.

**Única excepción documentada:** `app/api/branding/` GET — devuelve solo la URL pública del logo del organizador. Se mantiene pública porque el scanner (`app/admin/scan/ScanClient.tsx`) y el sidebar la consumen antes de que la sesión esté validada, y el dato no es sensible.

**Endpoints de migración/mantenimiento:** No deben existir como rutas API. Las migraciones van en `supabase/migrations/` y se aplican via Supabase CLI o dashboard.

## Opciones evaluadas

### Opción 1: Middleware de Next.js a nivel de ruta
Proteger todas las rutas `/api/` del backoffice con middleware.

**Pros:** Un solo punto de control.
**Contras:** El middleware de Next.js no tiene acceso fácil al contexto del staff (rol, staffId). Rompería la flexibilidad de tener rutas públicas intencionales.

### Opción 2: requireStaff al inicio de cada handler (elegida)
Cada handler llama `requireStaffRole(req)` explícitamente.

**Pros:** Explícito, auditable, permite variantes (`requireStaffRole(req, ["admin"])`), consistent con el patrón ya establecido en el proyecto.
**Contras:** Requiere disciplina — un handler nuevo puede olvidarlo.

## Consecuencias

**Positivas:**
- Todas las rutas sensibles protegidas explícitamente
- El rol del staff está disponible en `guard.context` para lógica de autorización granular
- Auditable: grep de `requireStaff` muestra inmediatamente el coverage

**Negativas / Deuda aceptada:**
- No hay enforcement automático — un handler nuevo puede olvidar el guard
- Recomendación futura: agregar un test de smoke que verifique que todas las rutas de backoffice (excepto las explícitamente listadas como públicas) retornan 401 sin token

## Archivos afectados

```
packages/shared/auth/requireStaff.ts          — implementación del guard
apps/backoffice/app/api/tickets/[id]/route.ts
apps/backoffice/app/api/persons/search/route.ts
apps/backoffice/app/api/events/[id]/tables/route.ts
apps/backoffice/app/api/organizers/[id]/layout/route.ts
apps/backoffice/app/api/reniec/dni/[dni]/route.ts
apps/backoffice/app/api/events/previous-layouts/route.ts
apps/backoffice/app/api/admin/migrate/route.ts  — eliminado
```
