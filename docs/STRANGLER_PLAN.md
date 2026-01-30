# STRANGLER PLAN (V1 -> V2)

Objetivo: mantener V1 funcionando mientras construimos una V2 modular y segura. Migracion por modulos, sin downtime, sin perdida de data. Todas las migraciones y cambios de BD son aditivos.

## Modulos actuales (V1)

### Public (apps/landing)
- Acceso por codigo: `/` -> `/manifiesto` -> `/registro`
- Registro y generacion de ticket/QR: `/registro`, `/api/tickets`, `/ticket/[id]`, `/api/tickets/email`
- Reserva de mesa: `/registro` paso 2, `/api/reservations`, `/api/uploads/voucher`
- Compra directa (sin codigo): `/compra`, `/api/ticket-reservations`, `/api/reservations`
- Servicios auxiliares: `/api/branding`, `/api/layout`, `/api/promoters`, `/api/events`, `/api/aforo`, `/api/persons`, `/api/reniec`, `/api/codes/info`

### Backoffice (apps/backoffice)
- Eventos: `/api/events/*`
- Mesas y productos: `/api/tables/*`, `/api/table-products/*`, `/api/layout`, `/api/uploads/layout`
- Reservas: `/api/reservations/*`, `/api/admin/reservations/*`
- Tickets/QR: `/api/scan`, `/api/scan/confirm`, `/api/tickets/delete`, `/api/admin/tickets/*`
- Promotores y codigos: `/api/promoters/*`, `/api/codes/*`
- Usuarios: `/api/admin/users/*`
- Branding: `/api/uploads/logo`, `/api/branding/save`

### Otros
- apps/api: servicio HTTP simple para assets locales (no integrado al flujo principal)
- packages/shared: utilidades (documentos, fechas, entry_limit, email)
- supabase/: SQL + migrations (DB real con data)

## Modulos objetivo (V2)

V2 sera API-first, modular y con capa de dominio. Se comparte la misma BD Supabase. Se migrara por modulos.

- Identity/Auth (staff roles, session, permisos)
- Events & Branding
- Codes (general, courtesy, promoter, table)
- Tickets & QR
- Door Scanning
- Tables/Combos/Reservations
- Payments (OpenPay) - aun no implementado en V1
- Notifications (email)

## Orden de migracion (Strangler)

1) Door Scanning (mas critico, aislable)
   - Nuevo endpoint V2 `/v2/scan` con RPC transaccional en Supabase
   - Backoffice V1 cambia a consumir `/v2/scan` (UI sin cambios)

2) Tickets & QR
   - `/v2/tickets` con idempotencia y normalizacion
   - Landing V1 cambia a `/v2/tickets` sin cambiar pantallas

3) Reservations + Tables/Combos
   - `/v2/reservations` con estados consistentes y reglas de negocio claras
   - Landing/Backoffice V1 migran gradualmente

4) Payments (OpenPay)
   - Diseño robusto con idempotencia + webhook handler

5) Notifications (Email)
   - Cola/reintentos + plantillas consistentes

Cada modulo se migra con feature flag y rollback plan.

## Contratos API actuales que deben mantenerse compatibles

### Landing (public)
- GET `/api/branding`
- GET `/api/layout`
- GET `/api/events`
- GET `/api/promoters`
- GET `/api/aforo?code=...`
- GET `/api/codes/info?code=...`
- GET `/api/persons?document=...&doc_type=...`
- GET `/api/reniec?dni=...`
- GET `/api/manifiesto?code=...`
- POST `/api/tickets` (crea ticket/QR por codigo)
- POST `/api/tickets/email` (envia ticket por email)
- POST `/api/reservations` (reserva mesa + voucher)
- POST `/api/ticket-reservations` (reserva solo tickets con voucher)
- POST `/api/uploads/voucher` (sube voucher a Storage)
- GET `/api/tables` (mesas + productos + estado)

### Backoffice (admin)
- POST `/api/scan` (validar codigo/QR)
- POST `/api/scan/confirm` (confirmar ingreso)
- POST `/api/events/create|update|delete`
- POST `/api/tables/create|update|delete|release`
- POST `/api/table-products/create|update|delete`
- POST `/api/promoters/create|update|delete|generate-codes`
- POST `/api/codes/batches/generate|deactivate|delete`
- GET `/api/codes/list`
- POST `/api/tickets/delete`
- POST `/api/reservations/update|resend`
- GET `/api/reservations/detail`
- POST `/api/admin/reservations` (crear reserva)
- POST `/api/admin/reservations/delete`
- GET `/api/admin/reservations/options`
- POST `/api/admin/tickets/lookup`
- GET `/api/admin/tickets/export`
- GET `/api/admin/users/list`
- POST `/api/admin/users/create|update|delete`
- GET `/api/admin/users/roles`
- POST `/api/uploads/logo|layout|manifest`
- POST `/api/branding/save`

Nota: en V2 se agregaran endpoints equivalentes bajo `/v2/*`. V1 mantendra su contrato mientras se migra.

## Compatibilidad y reglas de data

- No se borra data. Todo delete se convierte en soft delete.
- Migraciones solo aditivas (ADD COLUMN/INDEX/CONSTRAINT + backfill por lotes).
- Cambios por modulo con rollback plan.
