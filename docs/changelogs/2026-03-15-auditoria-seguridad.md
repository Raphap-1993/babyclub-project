# Auditoría de Seguridad y Consistencia — 2026-03-15

**Tipo:** Auditoría preventiva
**Alcance:** `apps/backoffice`, `apps/landing`, `packages/shared`
**Motivación:** Preparar el proyecto para crecimiento — revisar auth, multi-tenant, fechas, duplicación y boundaries RSC antes de agregar nuevas funcionalidades.

---

## Resumen ejecutivo

| Fase | Área | Hallazgos reales | Falsos positivos |
|------|------|-----------------|-----------------|
| A | Auth en rutas backoffice | 7 rutas sin protección | 8 (re-exportan desde rutas protegidas) |
| B | Multi-tenant `organizer_id` | 1 insert sin tenant | 253 |
| C | `new Date()` crudo | 3 | 27 |
| D | Duplicación en lib/ | 1 (`getBranding`) | 3 |
| E | `"use client"` + Supabase | 0 | 9 |

---

## Fase A — Auth en rutas backoffice

### Problema
16 rutas backoffice detectadas sin `requireStaff`. Tras revisión:
- 8 eran `archive/` re-exportando desde `delete/` que sí tienen auth → falsos positivos
- 7 rutas reales sin protección
- 1 endpoint de migración SQL ejecutable sin autenticación

### Rutas corregidas

| Ruta | Método(s) | Riesgo |
|------|-----------|--------|
| `app/api/tickets/[id]/route.ts` | GET | DNI, email, teléfono, QR token expuestos |
| `app/api/persons/search/route.ts` | GET | Búsqueda de datos personales por DNI |
| `app/api/events/[id]/tables/route.ts` | GET, PUT, DELETE | Mesas, precios, disponibilidad |
| `app/api/organizers/[id]/layout/route.ts` | PUT | Modificación de croquis |
| `app/api/reniec/dni/[dni]/route.ts` | GET | Proxy de RENIEC sin auth → consumo indebido del token |
| `app/api/events/previous-layouts/route.ts` | GET | Estructura de eventos anteriores |
| `app/api/admin/migrate/route.ts` | POST | **Crítico:** ejecutaba SQL arbitrario en prod |

### Fix aplicado
```typescript
// Agregado al inicio de cada handler
const guard = await requireStaffRole(req);
if (!guard.ok) {
  return NextResponse.json({ success: false, error: guard.error }, { status: guard.status });
}
```

### Ruta dejada pública (intencional)
`app/api/branding/` GET — devuelve el logo del organizador. Dato público usado en la pantalla de carga del scanner antes de que la sesión esté validada.

### Endpoint eliminado
`app/api/admin/migrate/route.ts` — script de migración temporal que quedó expuesto. Devuelve 404. Las migraciones van en `supabase/migrations/`.

---

## Fase B — Multi-tenant isolation

### Contexto
El proyecto usa `organizer_id` para aislar datos entre organizadores. No todas las tablas tienen la columna directamente:
- **Con `organizer_id` directo:** `events`, `promoters`, `payments`, `tables`
- **Sin `organizer_id` directo (scoping via `event_id`):** `tickets`, `codes`, `table_reservations`

Los 254 hits de `.from()` sin `organizer_id` en la misma línea se reducen a 1 problema real.

### Problema encontrado
`app/api/promoters/create/route.ts` insertaba promotores sin `organizer_id`:

```typescript
// ❌ Antes
.insert({ person_id, code, instagram, tiktok, notes, is_active })

// ✅ Después
.insert({ person_id, code, instagram, tiktok, notes, is_active, organizer_id: orgData.id })
```

El `organizer_id` se resuelve consultando la tabla `organizers` (patrón estándar del proyecto).

### Deuda técnica documentada
Operaciones de delete/update en tickets, promotores y reservas filtran solo por `id` sin verificar que el recurso pertenezca al organizer del staff autenticado. Riesgo bajo hoy (instancia single-tenant), a resolver antes de habilitar multi-tenant real.

---

## Fase C — Fechas y timezone

### Contexto
El proyecto opera en zona `America/Lima (UTC-5)`. La regla es: no usar `new Date()` crudo en lógica de negocio. Los 30 hits se reducen a 3 problemas.

### Problema 1: `buildReceiptNumber` con fecha UTC
`packages/shared/payments/culqi.ts` generaba el número de recibo con la fecha UTC. Después de las 7pm Lima (medianoche UTC), el recibo mostraba la fecha del día siguiente.

```typescript
// ❌ Antes
const date = now.toISOString().slice(0, 10).replace(/-/g, "");

// ✅ Después
const date = DateTime.fromJSDate(now).setZone("America/Lima").toFormat("yyyyLLdd");
```

### Problema 2 + 3: `isAdult()` duplicada con `new Date()` crudo
Misma función de validación de edad mayor de 18 existía en:
- `apps/landing/app/api/tickets/route.ts`
- `apps/landing/app/api/reniec/route.ts`

Ambas usaban `new Date()` UTC para calcular la edad, con riesgo de error de 1 día en el cumpleaños exacto (cuando Lima y UTC están en días distintos).

**Fix:** Se centralizó en `packages/shared/datetime.ts`:
```typescript
export function isAdult(birthdate: Date, minAge = 18): boolean {
  const now = DateTime.now().setZone(EVENT_TZ);
  const dob = DateTime.fromJSDate(birthdate).setZone(EVENT_TZ);
  return now.diff(dob, "years").years >= minAge;
}
```

Ambas rutas ahora importan `isAdult` desde `shared/datetime`. La función local fue eliminada.

---

## Fase D — Duplicación de código

### Problema: `getBranding()` en 4 lugares
La query `SELECT logo_url FROM brand_settings WHERE id = 1` estaba duplicada en:
- `apps/landing/lib/branding.ts` — función helper
- `apps/backoffice/app/api/branding/route.ts` — query directa
- `apps/backoffice/app/admin/branding/page.tsx` — función local `getBrand()`

**Fix:** Se creó `packages/shared/branding.ts`:
```typescript
export async function getBranding(): Promise<BrandingData> {
  // Crea cliente Supabase server-side y consulta brand_settings
}
```

- `landing/lib/branding.ts` ahora re-exporta desde shared
- `backoffice/app/api/branding/route.ts` reducido a 6 líneas
- `backoffice/app/admin/branding/page.tsx` elimina su `createClient` local
- `backoffice/app/auth/login/page.tsx` no modificado (componente client que usa singleton)

### Falso positivo: `utils.ts`
Ambas apps tienen `lib/utils.ts` que re-exportan desde `@repo/ui`. Paths distintos (`@repo/ui/utils` vs `@repo/ui`) pero mismo resultado. Deuda cosmética, no se toca.

---

## Fase E — RSC/Client boundary

### Resultado: 0 cambios necesarios

Los 9 componentes `"use client"` que referencian Supabase se dividen en dos grupos correctos:

**Grupo 1 — Auth browser APIs** (no pueden ser RSC):
`login/page.tsx`, `ClientAuthGate.tsx`, `AuthGuard.tsx`, `LogoutButton.tsx`, `admin/layout.tsx` — usan `onAuthStateChange` y `signOut`, APIs exclusivas de browser.

**Grupo 2 — Solo leen el token** para `authedFetch`:
`PromoterCodesClient.tsx`, `CodesClient.tsx`, `EventForm.tsx`, `CreateReservationButton.tsx` — son Client Components legítimos (formularios + estado). Usan Supabase solo para extraer el JWT, no para queries a DB.

---

## Archivos modificados

```
packages/shared/
  branding.ts                              [CREADO]
  datetime.ts                              [isAdult() agregada]
  payments/culqi.ts                        [buildReceiptNumber usa Lima TZ]

apps/landing/
  lib/branding.ts                          [re-exporta shared/branding]
  app/api/tickets/route.ts                 [usa shared isAdult, elimina local]
  app/api/reniec/route.ts                  [usa shared isAdult, elimina local]

apps/backoffice/
  app/api/tickets/[id]/route.ts            [requireStaff agregado]
  app/api/persons/search/route.ts          [requireStaff agregado]
  app/api/events/[id]/tables/route.ts      [requireStaff en GET/PUT/DELETE]
  app/api/organizers/[id]/layout/route.ts  [requireStaff agregado]
  app/api/reniec/dni/[dni]/route.ts        [requireStaff agregado]
  app/api/events/previous-layouts/route.ts [requireStaff agregado]
  app/api/admin/migrate/route.ts           [ELIMINADO — devuelve 404]
  app/api/branding/route.ts                [usa shared/branding]
  app/api/promoters/create/route.ts        [organizer_id en insert]
  app/admin/branding/page.tsx              [usa shared/branding]
```

---

## Deuda técnica pendiente

| Item | Descripción | Prioridad |
|------|-------------|-----------|
| Delete/update sin validar tenant | Operaciones sobre tickets, promotores y reservas filtran por `id` sin verificar `organizer_id` del organizador | 🟠 Media — resolver antes de multi-tenant real |
| `utils.ts` path inconsistency | landing usa `@repo/ui/utils`, backoffice usa `@repo/ui` | 🟢 Baja |
| `console.log` de debug en `persons/search/` | Logs de desarrollo en producción | 🟢 Baja |
