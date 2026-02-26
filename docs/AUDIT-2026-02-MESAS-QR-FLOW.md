# AUDIT 2026-02 - Mesas, QR y Disponibilidad (Backoffice -> Landing)

Fecha: 2026-02-26
Scope: flujo E2E de reserva de mesas desde landing y backoffice, generación de QR/códigos, bloqueo de disponibilidad.

## Estado Semáforo

- Dominio y reglas de negocio: Amarillo
- API y contratos: Amarillo
- Datos y consistencia de reservas/códigos: Rojo
- Operación (disponibilidad en landing): Rojo
- UX Backoffice (disponibilidad en creación manual): Amarillo

## Hallazgos Clave

### 1) Reserva de mesa generaba N-1 códigos en landing
Severidad: Rojo

Evidencia:
- Código anterior en `apps/landing/app/api/reservations/route.ts` usaba `ticket_count - 1` para `codesToGenerate`.
- Caso real en BD (reserva de Claudia Meléndez Villegas):
  - `ticket_quantity = 6`
  - `table_ticket_count = 6`
  - `codes_linked_active_len = 5`

Impacto:
- Inconsistencia entre capacidad de mesa y cantidad de QR/códigos generados.
- Percepción de error operativo en backoffice (columna Entradas mostraba 5).

### 2) Landing liberaba mesas reservadas después de 72h
Severidad: Rojo

Evidencia:
- Código anterior en `apps/landing/app/api/tables/route.ts` liberaba mesa si `created_at` de reserva superaba 72h.
- Caso real en BD:
  - Mesa 6 tiene reserva `approved` para evento `LOVE IS A DRUG`.
  - Lógica actual la marcaba `available` por antigüedad, pero debería seguir reservada mientras estado esté activo.

Impacto:
- Mesas ya reservadas reaparecen disponibles en la landing.
- Riesgo de sobreventa o doble toma de mesa.

### 3) Backoffice de reservas manuales no persistía `ticket_quantity`
Severidad: Amarillo

Evidencia:
- En `apps/backoffice/app/api/admin/reservations/route.ts` al insertar reserva manual no se guardaba `ticket_quantity`.

Impacto:
- Flujos posteriores (aprobación/reenvío) podían inferir mal la cantidad objetivo de QR/tickets.

### 4) Backoffice listaba mesas ocupadas sin filtrar estados activos
Severidad: Amarillo

Evidencia:
- En `apps/backoffice/app/api/admin/tables/route.ts` se tomaban reservas por `event_id` sin filtrar `status` activo.

Impacto:
- Mesas con reservas rechazadas podían quedar bloqueadas como “ocupadas” en creación manual.

### 5) Mesas desalineadas en landing por mezcla de sistemas de coordenadas
Severidad: Amarillo

Evidencia:
- Algunas mesas se dibujaban con `layout_x/layout_y/layout_size` y otras con `pos_x/pos_y/pos_w/pos_h`.
- La lógica en `tableSlotUtils` priorizaba legacy cuando no había `canvas_width/canvas_height` del organizer.
- En BD se detectó inconsistencia real (ejemplo `Mesa 1`/`Mesa 2`/`Mesa 5` con `pos_*`; `Mesa 3`/`Mesa 4`/`Mesa 6` sin `pos_*`), lo que genera offsets visuales entre mesas del mismo plano.
- Además, la consulta a `organizers.layout_canvas_width/layout_canvas_height` devuelve `42703` (columnas no existentes), forzando fallback de canvas.

Impacto:
- El plano de landing mostraba mesas “movidas” o fuera de la retícula esperada.
- UX inconsistente contra el diseñador del backoffice.

### 6) Auditoría BD real: reservas activas con desajuste de QR/tickets esperados
Severidad: Amarillo

Evidencia (2026-02-26, query directa a Supabase):
- `reservation_total = 29`
- `active_reservation_total = 12`
- `active_mismatch_total = 2`
  - Caso 1: `Claudia Meléndez Villegas` (`Mesa 5`, `pending`) con `expected=6`, `activeCodes=5`, `activeTickets=0`.
  - Caso 2: reserva de tipo entrada (`table_id=null`) con `expected=1`, sin códigos/tickets activos.

Impacto:
- Existen reservas históricas activas que no cumplen el objetivo de cantidad esperada de QR/tickets.
- El mismatch de Claudia explica el síntoma reportado de “5 QR” en vez de 6.

### 7) El endpoint de eliminación no exigía confirmación fuerte ni limpiaba vinculados
Severidad: Amarillo

Evidencia:
- `apps/backoffice/app/api/admin/reservations/delete/route.ts` aceptaba solo `id`.
- No validaba confirmación por texto.
- No desactivaba tickets/códigos antes de archivar.

Impacto:
- Riesgo operativo de eliminación accidental.
- Riesgo de dejar artefactos activos (tickets/códigos) tras archivar reserva.

### 8) Drift de esquema entre código y BD en tablas de configuración
Severidad: Amarillo

Evidencia (`pnpm run db:check:landing` / `pnpm run db:check:backoffice`):
- `FAIL brand_settings -> missing_column (42703): column brand_settings.deleted_at does not exist`
- `FAIL layout_settings -> missing_column (42703): column layout_settings.deleted_at does not exist`

Impacto:
- Inconsistencias entre lo que espera el código (`applyNotDeleted`) y el esquema real.
- Riesgo de comportamiento distinto entre entornos al leer branding/layout.

## Cambios Aplicados

### Landing
- `apps/landing/app/api/reservations/route.ts`
  - Generación de códigos: ahora usa exactamente `ticketCount` (1 QR por persona).

- `apps/landing/app/api/tables/route.ts`
  - Eliminada liberación automática por 72h.
  - Reserva activa evaluada por estado (`pending|approved|confirmed|paid`).
  - Soporte de filtro por `event_id` sin depender solo de `tables.event_id`:
    - intenta usar `table_availability`
    - fallback legacy a `tables.event_id`.

- `apps/landing/app/registro/page.tsx`
  - Refetch de mesas cuando se resuelve `codeEventId`.
  - Envía `event_id` preferentemente desde el código activo al crear reserva.
  - No auto-selecciona mesas reservadas.
  - Valida bloqueo también antes de abrir/resumir y antes de enviar reserva.

- `apps/landing/app/registro/tableSlotUtils.ts`
  - Homologación con el sistema de coordenadas del backoffice:
    - Prioriza siempre `layout_x/layout_y/layout_size` si existen.
    - Infiere canvas desde datos legacy cuando faltan metadatos (`layout_canvas_width/height`) para evitar drift.
  - Elimina mezcla layout+legacy por mesa en el mismo render.

- `apps/landing/app/registro/TableMap.tsx`
  - Mesas reservadas con estado visual de bloqueo (tachado/disabled) en el plano.

- `apps/landing/app/api/reservations/route.ts`
  - Bloqueo server-side de doble reserva:
    - rechaza si ya existe reserva activa para la mesa/evento (`pending|approved|confirmed|paid`).
    - respeta `table_availability.is_available=false` cuando exista.

### Backoffice
- `apps/backoffice/app/api/admin/reservations/route.ts`
  - Persiste `ticket_quantity` al crear reservas manuales.
  - Homologa `requiredQrCount` desde `table.ticket_count`.

- `apps/backoffice/app/api/reservations/update/route.ts`
  - Fallback de cantidad de tickets/QR con `max(ticket_quantity, table.ticket_count, 1)`.

- `apps/backoffice/app/api/admin/reservations/[id]/resend/route.ts`
  - Fallback de cantidad de tickets/QR con `max(ticket_quantity, table.ticket_count, 1)`.
  - Si la reserva aprobada tiene menos tickets vinculados que el objetivo, ahora crea los faltantes (top-up) antes de reenviar correo.

- `apps/backoffice/app/api/admin/tables/route.ts`
  - Mesas reservadas se calculan solo con estados activos.

- `apps/backoffice/app/admin/reservations/ModernReservationsClient.tsx`
  - Columna Entradas muestra `max(codes.length, ticket_quantity)` para evitar sub-reporte visual.
  - Nueva acción de **Eliminar** con modal de confirmación fuerte: el usuario debe escribir `eliminar`.

- `apps/backoffice/app/api/admin/reservations/delete/route.ts`
  - Requiere confirmación textual obligatoria (`confirmation === "eliminar"`).
  - Desactiva códigos y tickets vinculados antes de archivar la reserva (soft delete).

- `apps/backoffice/app/admin/reservations/components/ReservationActions.tsx`
  - Homologado para enviar confirmación textual al endpoint de eliminación.

## Verificación

Tests ejecutados:
- `apps/landing/app/api/reservations/route.test.ts` ✅
- `apps/landing/app/api/tables/route.test.ts` ✅
- `apps/landing/app/registro/tableSlotUtils.test.ts` ✅
- `apps/backoffice/app/api/admin/tables/route.test.ts` ✅
- `apps/backoffice/app/api/admin/reservations/delete/route.test.ts` ✅

Smoke de API local:
- `GET /api/tables?event_id=ae023aee-5754-4d1b-a2f5-d5d3603bbfcc` devuelve 6 mesas y marca reservadas `Mesa 3, Mesa 4, Mesa 5, Mesa 6` (bloqueo activo correcto en landing).
- `POST /api/reservations` sobre una mesa reservada (`Mesa 3`) responde `409` con `La mesa ya tiene una reserva activa para este evento`.

Checks de esquema:
- `pnpm run db:check:landing` ❌ (`brand_settings.deleted_at`, `layout_settings.deleted_at` faltantes)
- `pnpm run db:check:backoffice` ❌ (mismas columnas faltantes)

Nota:
- `typecheck:backoffice` falla por dependencias de testing no instaladas en un test existente (`@testing-library/react`), no por estos cambios funcionales.

## Riesgos Residuales

- Reservas históricas ya creadas con 5 códigos no se corrigen automáticamente por este cambio de código.
- Recomendación operativa: ejecutar backfill controlado para reservas activas donde `ticket_quantity > codes_count`.
