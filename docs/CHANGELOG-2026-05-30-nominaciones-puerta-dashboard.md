# CHANGELOG: Nominaciones, Puerta, Dashboard y Lotes (2026-05-30)

## Objetivo

Cerrar el paquete operativo del evento dejando estables cuatro frentes:

- links y UX del flujo publico de nominaciones;
- emision y reemision de QRs sobre esquema legacy;
- scanner de puerta para evitar invalidaciones o dobles consumos evitables;
- dashboard comercial y generacion de lotes con semantica real de negocio.

## Resultado final

- `master` queda como rama de deploy con el paquete consolidado.
- El flujo publico de nominaciones ya es usable desde celular y abre tickets/reenvio desde la misma vista.
- Puerta valida mejor tickets y unidades sin depender de labels visuales.
- El dashboard ya no confunde `QR emitidos` con `Entradas` vendidas.
- El modal de lotes ya genera segun el `Tipo` seleccionado y no queda amarrado siempre a `Promotor`.

## 1. Nominaciones publicas

### Problemas corregidos

- Los correos podian construir links hacia previews de `backoffice` en Vercel.
- La pantalla publica tenia ruido visual y no era amable en celular.
- No existia lookup explicito por DNI.
- El usuario no podia abrir `Ver ticket` ni reenviar facilmente desde el mismo workspace.
- El exito/error quedaba en banners arriba, no en popup.

### Cambios

- `packages/shared/publicUrl.ts`
- `apps/landing/app/compra/reserva/[id]/NominationClient.tsx`
- `apps/landing/app/compra/reserva/[id]/nominationLookup.ts`
- `apps/landing/app/compra/reserva/[id]/nominationLookup.test.ts`

- Los links publicos ya usan el dominio correcto y no previews de `backoffice`.
- La UI quedo reducida a cabecera, comprador en solo lectura, nominados editables y CTA directo.
- Se agrego `Buscar DNI` con prioridad a base propia y fallback API Peru/RENIEC.
- Se agrego `Ver ticket` para comprador y nominados emitidos.
- Exito y error pasan a modal popup.

## 2. Emision y reemision sobre esquema legacy

### Problemas corregidos

- Reemision de nominados emitidos intentaba escribir `tickets.issued_at` y `tickets.updated_at`, columnas inexistentes en el esquema legacy.
- Guardar nominaciones podia fallar al emitir QR porque el issue de `unidad 1` no traia `doc_type/document` del comprador.

### Cambios

- `apps/landing/app/api/ticket-reservations/[id]/units/route.ts`
- `apps/landing/app/api/ticket-reservations/[id]/units/route.test.ts`
- `apps/landing/app/api/ticket-reservations/[id]/issue/route.ts`
- `apps/landing/app/api/ticket-reservations/[id]/issue/route.test.ts`

- La reemision ya no escribe columnas inexistentes en `tickets`.
- La emision del QR del comprador ya consulta el documento completo de `unidad 1`.
- La regla funcional actual se mantiene: editar un nominado emitido reutiliza el mismo `ticket_id`, reemplaza datos visibles y rota `qr_token`.

## 3. Scanner de puerta

### Problemas corregidos

- Confirmacion vulnerable a doble consumo del mismo ticket por doble accion.
- Faltaba endurecer el bloqueo de tickets inactivos o `pending`.
- Hacia falta dejar mas consistente la validacion por evento y el consumo de unidades.

### Cambios

- `apps/backoffice/app/api/scan/route.ts`
- `apps/backoffice/app/api/scan/confirm/route.ts`
- `apps/backoffice/app/api/scan/route.test.ts`
- `apps/backoffice/app/api/scan/confirm/route.test.ts`

- `scan` y `confirm` ya bloquean mismatch de evento y tickets inactivos o pendientes.
- El mismo ticket no se confirma dos veces con facilidad.
- Al confirmar ingreso, tambien se marca la `ticket_reservation_unit` como `used`.
- Puerta sigue operando por tipos canonicos (`courtesy`, `promoter`, `table`, `general`, `free`) y por `qr_token`; cambios de label visual no alteran el scan.

## 4. Dashboard comercial

### Problema corregido

El home mezclaba contadores tecnicos de QR con ventas reales. En produccion esto generaba lecturas falsas, por ejemplo:

- `QR emitidos`: `196`
- `Entradas` vendidas reales (`sale_origin='ticket'`): `59`

### Cambios

- `packages/api-logic/qr-summary.ts`
- `packages/api-logic/qr-summary.test.ts`
- `packages/api-logic/qr-summary.rpc.test.ts`
- `apps/backoffice/app/admin/dashboardModel.ts`
- `apps/backoffice/app/admin/dashboardModel.test.ts`
- `apps/backoffice/app/admin/AdminDashboardClient.tsx`

- `Entradas` ahora usa unidades vendidas reales desde `table_reservations`.
- `Mesas`, `Cortesias` y `Free` quedan alineados con buckets comerciales.
- El dashboard ya no deja `Entradas` en `0` cuando si hubo ventas reales.

## 5. Lotes por tipo

### Problemas corregidos

- El modal de generacion creaba siempre lotes `Promotor` sin importar el filtro o tipo visible.
- La politica de expiracion no se aplicaba al tipo real.
- La opcion visible de cortesia cargaba el label `Cortesia (promotores)`.

### Cambios

- `apps/backoffice/app/admin/codes/CodesClient.tsx`
- `packages/shared/codeBatchPolicy.ts`
- `packages/shared/codeBatchPolicy.test.ts`
- `apps/backoffice/app/api/codes/batches/generate/route.ts`
- `apps/backoffice/app/api/codes/batches/generate/route.test.ts`

- El modal ahora respeta el `Tipo` seleccionado.
- `Promotor` solo se exige cuando el tipo realmente lo necesita.
- La politica `Expiracion obligatoria por codigo` se evalua contra el tipo real del lote.
- La opcion visible queda como `Cortesia`.

## 6. Reenvio selectivo de nominaciones

### Contexto

Despues de estabilizar el flujo publico, hacia falta decidir si debia reenviarse el correo a compradores del evento actual.

La regla final fue:

- no reenviar a todos;
- reenviar solo a reservas `ticket-only` aprobadas con asistentes pendientes;
- si la `unidad 1` del comprador seguia sin `ticket_id`, emitir primero su QR y luego mandar el correo.

### Resultado

- `33` reservas `ticket-only` aprobadas revisadas
- `26` reservas con `pending_nomination`
- `25` correos enviados correctamente
- `0` fallas de proveedor
- `1` caso con email invalido corregido y reenviado aparte
- `23` reservas emitieron primero el QR del comprador porque la `unidad 1` seguia `pending_nomination`

### Caso corregido manualmente

- Reserva: `55f9e5c7-f72d-4e5f-b0b5-70752693067b`
- Email original: `celinagaray23@gmail`
- Email persistido corregido: `celinagaray23@gmail.com`
- Reenvio ejecutado luego de la correccion con `issuedTicketIdsCount = 1`

### Decision operativa

No hace falta un segundo blast masivo:

- las reservas reenviadas ya recibieron un correo nuevo con el QR del comprador emitido;
- el correo ya incluye `Ver QR completo` y `Completar asistentes`;
- desde este punto solo se deben atender incidencias individuales.

## Verificacion consolidada

```bash
pnpm exec vitest run \
  packages/shared/publicUrl.test.ts \
  'apps/backoffice/app/api/admin/reservations/[id]/resend/route.test.ts' \
  apps/backoffice/app/api/reservations/update/route.test.ts \
  apps/backoffice/app/api/reservations/resend/route.test.ts \
  'apps/landing/app/api/ticket-reservations/[id]/issue/route.test.ts' \
  'apps/landing/app/api/ticket-reservations/[id]/units/route.test.ts' \
  'apps/landing/app/compra/reserva/[id]/nominationLookup.test.ts' \
  'apps/landing/app/ticket/[id]/page.ticket-only.test.tsx' \
  'apps/landing/app/ticket/[id]/page.presentation.test.tsx' \
  'apps/backoffice/app/api/scan/confirm/route.test.ts' \
  'apps/backoffice/app/api/scan/route.test.ts' \
  packages/api-logic/qr-summary.test.ts \
  packages/api-logic/qr-summary.rpc.test.ts \
  apps/backoffice/app/admin/dashboardModel.test.ts \
  apps/backoffice/app/admin/events/__tests__/QRStatsTable.test.tsx \
  packages/shared/codeBatchPolicy.test.ts \
  apps/backoffice/app/api/codes/batches/generate/route.test.ts

pnpm exec tsc -p apps/landing/tsconfig.json --noEmit
pnpm exec tsc -p apps/backoffice/tsconfig.json --noEmit
```

## Commits de referencia

- `bbb6c3a` `Fix public URLs for Vercel previews`
- `a55a411` `Fix public URL fallback in production`
- `a7061f7` `Simplify nomination workspace and add DNI lookup`
- `1b3e124` `Add ticket shortcuts to nomination workspace`
- `df7e0a8` `Show nomination save confirmation in modal`
- `db2aa16` `Fix issued ticket updates and show errors in modal`
- `d202522` `Fix issued nomination reissue against legacy tickets schema`
- `d68eda5` `Fix buyer document lookup during QR issue`
- `d0baa17` `Harden door scan confirmation flow`
- `1b661ea` `Block inactive tickets in door scan`
- `80b33a9` `Fix dashboard QR ticket classification`
- `ef38b5c` `Align dashboard QR buckets with commercial rules`
- `ffab16e` `Fix dashboard sold entry totals and batch type modal`
- `6713ace` `Simplify courtesy label in batch type selector`

## Riesgos residuales

- Reemplazar un nominado emitido no guarda historial separado; reemplaza el mismo `ticket_id`.
- Si se agrega un `code.type` nuevo fuera de los canonicos actuales, hay que actualizar scanner y presentacion antes de usarlo en puerta.
- En operacion de evento sigue siendo mas seguro usar QR escaneado que ingreso manual por codigo.

## Hotfix adicional 2026-05-30 17:25 America/Lima - Unicidad por evento

### Problema visto en producción

La misma persona pudo terminar con dos QRs activos del mismo evento:

- uno emitido por el codigo `general`;
- otro emitido despues por `courtesy`.

La causa no fue puerta sino emision: el primer registro quedo con un DNI errado, asi que la validacion exacta por documento no alcanzo a detectar que seguia siendo la misma persona.

### Cambio aplicado

- Se agrego `packages/shared/eventTicketIdentity.ts` para detectar conflictos por `event_id` usando:
  - `person_id`
  - `documento`
  - `nombre + email`
  - `nombre + telefono`
- `apps/landing/app/api/tickets/route.ts` ya no emite un segundo QR del mismo evento cuando detecta identidad coincidente.
- `apps/backoffice/app/api/reservations/utils.ts` centraliza la misma validacion para emision desde backoffice.
- `apps/backoffice/app/api/reservations/update/route.ts` y `apps/landing/app/api/ticket-reservations/[id]/issue/route.ts` prevalidan lotes completos para frenar emision parcial si la misma identidad aparece repetida.
- `apps/backoffice/app/api/scan/route.ts` ya trata cualquier QR duplicado por persona como `duplicate`, incluyendo `table`.
- `apps/landing/app/registro/page.tsx` limpia nombre/correo/telefono/ticket cache cuando cambia o se borra el documento.

### Saneamiento productivo ejecutado

- Se archivo el ticket general incorrecto del caso reportado.
- Se dejo activo solo el ticket correcto del mismo evento.

### Verificación

```bash
pnpm exec vitest run \
  packages/shared/eventTicketIdentity.test.ts \
  apps/landing/app/api/tickets/route.test.ts \
  apps/backoffice/app/api/scan/route.test.ts \
  apps/backoffice/app/api/reservations/utils.test.ts \
  apps/backoffice/app/api/reservations/update/route.test.ts \
  'apps/landing/app/api/ticket-reservations/[id]/issue/route.test.ts'

pnpm exec tsc -p apps/landing/tsconfig.json --noEmit
pnpm exec tsc -p apps/backoffice/tsconfig.json --noEmit
```

### Commit

- `23f2efb` `Enforce one QR per person per event`
