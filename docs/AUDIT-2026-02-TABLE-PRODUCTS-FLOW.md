# AUDIT 2026-02 - Table Products Flow (Backoffice -> Landing -> BD)

Fecha: 2026-02-26  
Scope: flujo E2E de packs/productos de mesa (`table_products`) y su uso en reservas de mesa.

## Estado Semáforo

- Contrato API productos: Amarillo
- Consistencia negocio (pack obligatorio): Rojo
- Integración backoffice -> API: Rojo
- Consumo landing -> API: Amarillo
- Calidad de datos BD: Amarillo

## Hallazgos

### 1) Backoffice no cargaba productos en creación manual de reserva
Severidad: Rojo

Evidencia:
- `CreateReservationModal` tenía `loadProducts()` desactivado con comentario TODO.
- Consumía `/api/admin/table-products`, pero ese endpoint no existía.

Impacto:
- Flujo manual permitía crear reserva de mesa sin seleccionar pack.
- Ruptura de la regla de negocio de combo obligatorio.

### 2) API de reservas permitía `product_id` nulo/inválido
Severidad: Rojo

Evidencia:
- `apps/landing/app/api/reservations/route.ts` no validaba `product_id`.
- `apps/backoffice/app/api/admin/reservations/route.ts` solo validaba producto si venía informado.

Impacto:
- Posibilidad de reservas de mesa sin pack o con pack inactivo/no perteneciente a mesa.

### 3) Landing exponía productos inactivos en payload de mesas
Severidad: Amarillo

Evidencia:
- `GET /api/tables` filtraba `deleted_at`, pero no `is_active`.
- El filtrado de activos quedaba delegado a frontend.

Impacto:
- Mayor riesgo de inconsistencias entre clientes.
- Contrato API no expresa claramente “solo packs vendibles”.

### 4) Validaciones débiles en CRUD de table_products
Severidad: Amarillo

Evidencia:
- `create/update/delete` sin validación robusta de mesa activa, payload numérico o not-deleted consistente.

Impacto:
- Riesgo de guardar datos inválidos y desalinear backoffice vs landing.

## Evidencia BD (Supabase, 2026-02-26)

- `table_total = 8`
- `product_total = 26`
- `active_product_total = 24`
- `tables_with_no_active_products_total = 2`
  - `Box 1` (`ticket_count=4`)
  - `mesa 2` (`ticket_count=2`)
- `active_reservations_without_product_total = 0`
- `active_reservations_with_invalid_product_total = 0`
- `duplicate_sort_order_by_table_total = 0`

Lectura:
- La data activa de reservas hoy está consistente respecto a producto.
- Existen mesas activas sin packs activos, que deben regularizarse antes de abrir ventas para esas mesas.

## Cambios Aplicados

### API y negocio

- `apps/landing/app/api/reservations/route.ts`
  - `product_id` ahora es obligatorio para reservar mesa.
  - valida que el producto exista, esté activo y pertenezca a la mesa.
  - rechaza mesas sin packs activos configurados.

- `apps/backoffice/app/api/admin/reservations/route.ts`
  - misma validación estricta que landing (pack obligatorio y activo).
  - evita vincular tickets con `product_id` nulo en reservas de mesa.

- `apps/landing/app/api/tables/route.ts`
  - devuelve solo productos activos y no borrados.
  - ordena por `sort_order` y `name` para consistencia visual.

### Backoffice UX

- `apps/backoffice/app/api/admin/table-products/route.ts` (nuevo)
  - endpoint para listar productos por mesa con auth de staff.
  - por defecto solo activos (`include_inactive=1` opcional).

- `apps/backoffice/app/admin/reservations/components/CreateReservationModal.tsx`
  - activa carga real de productos por mesa.
  - selección de pack ahora obligatoria en paso 2 y submit.
  - mensaje explícito cuando una mesa no tiene packs activos.

- `apps/backoffice/app/admin/table-products/ProductManager.tsx`
  - homologado a `authedFetch` para llamadas protegidas.
  - ordenado por flujo `organizador -> evento -> mesa`, evitando mezclar mesas de todos los organizadores en una sola vista.

- `apps/backoffice/app/admin/table-products/page.tsx`
  - ahora carga contexto por organizador y evento (query params `organizer_id` y `event_id`).
  - restringe catálogo de mesas al organizador seleccionado.

- Navegación backoffice (`Sidebar` + `Dashboard`)
  - acceso directo a `Productos Mesa` desde `OPERACIONES` y quick action del dashboard.

### Hardening CRUD productos

- `apps/backoffice/app/api/table-products/create/route.ts`
  - valida mesa existente/activa.
  - valida campos numéricos.
  - normaliza `items`.
  - default de `tickets_included` a `table.ticket_count` cuando no se envía.

- `apps/backoffice/app/api/table-products/update/route.ts`
  - valida producto existente no eliminado.
  - valida mesa destino, tipos, numéricos y no-op payload.

- `apps/backoffice/app/api/table-products/delete/route.ts`
  - aplica not-deleted en búsqueda y archivado.
  - responde 404 si producto no existe/no activo.

## Verificación

Tests ejecutados:
- `apps/landing/app/api/reservations/route.test.ts` ✅
- `apps/landing/app/api/tables/route.test.ts` ✅
- `apps/backoffice/app/api/admin/reservations/route.test.ts` ✅
- `apps/backoffice/app/api/admin/table-products/route.test.ts` ✅
- `apps/backoffice/app/api/admin/tables/route.test.ts` ✅
- `apps/backoffice/app/api/admin/reservations/delete/route.test.ts` ✅
- `apps/landing/app/registro/tableSlotUtils.test.ts` ✅

Typecheck:
- `pnpm run typecheck:landing` ✅
- `pnpm run typecheck:backoffice` ❌ (falla preexistente por dependencias de test en `QRStatsTable.test.tsx`, no por estos cambios).

## Riesgos Residuales

- Mesas activas sin packs activos (`Box 1`, `mesa 2`) seguirán bloqueando reserva por regla de pack obligatorio.
- Falta completar la migración pendiente de esquema en branding/layout (`deleted_at`) ya detectada en auditoría previa.
