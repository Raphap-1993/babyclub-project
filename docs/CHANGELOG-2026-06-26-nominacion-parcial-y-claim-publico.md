# CHANGELOG: nominacion parcial y claim publico por codigo (2026-06-26)

## Objetivo

Cerrar el bloqueo operativo donde una compra con multiples entradas exigia
nominar a todos los participantes antes de generar QRs, y abrir un camino
publico para que cada invitado pueda reclamar su QR con un codigo individual.

## Resultado

- La emision ya no depende de completar toda la reserva.
- El comprador puede emitir primero su propia unidad y luego avanzar unidad por
  unidad.
- Cada unidad individual expone un `claim_code` y un `claim_url`.
- La web publica agrega una entrada amigable por codigo en `/codigo`.
- El claim por codigo reutiliza el codigo reservado de esa unidad y sincroniza
  `ticket_reservation_units`.

## Cambios funcionales

### 1. Emision parcial por unidad

- `POST /api/ticket-reservations/[id]/issue`
  - emite la unidad 1 del comprador aunque existan otras unidades aun en
    `pending_nomination`;
  - tambien emite las unidades ya nominadas, sin forzar completar toda la
    compra;
  - mantiene validacion de identidad por evento y bloqueo de duplicados.
- `POST /api/ticket-reservations/[id]/units/[unitId]/issue`
  - nuevo endpoint para emitir una sola unidad bajo demanda;
  - reutiliza el codigo reservado de la unidad;
  - mantiene fallback al correo del comprador cuando el invitado no tiene uno
    valido.

### 2. Codigos individuales y claim publico

- `GET /api/ticket-reservations/[id]/units`
  - ahora retorna `claim_code` y `claim_url` por unidad;
  - garantiza codigos por unidad de forma idempotente.
- `POST /api/ticket-reservations`
  - las reservas `ticket` siembran codigos por unidad desde su creacion;
  - `table_reservations.codes` queda alineado con todas las unidades reales.
- `GET /api/codes/info`
  - aplica rate limit;
  - reduce la exposicion publica de `registered_person`;
  - resuelve si el codigo ya pertenece a una unidad emitida.
- `POST /api/tickets`
  - si el codigo pertenece a una unidad de reserva, crea o reutiliza el ticket
    correcto y sincroniza `ticket_reservation_units.status/ticket_id`.

### 3. UX publica

- `apps/landing/app/compra/reserva/[id]/NominationClient.tsx`
  - muestra links/codigos por unidad y permite avanzar por partes.
- `apps/landing/app/codigo/page.tsx`
  - nueva pantalla publica para ingresar el codigo y continuar el registro.
- `apps/landing/app/ticket/[id]/page.tsx`
  - conserva el flujo ticket-only alineado con la emision por unidad.

## Archivos clave

- `apps/landing/app/api/ticket-reservations/lib/issueReservationUnits.ts`
- `apps/landing/app/api/ticket-reservations/lib/reservationUnitCodes.ts`
- `apps/landing/app/api/ticket-reservations/[id]/issue/route.ts`
- `apps/landing/app/api/ticket-reservations/[id]/units/[unitId]/issue/route.ts`
- `apps/landing/app/api/ticket-reservations/[id]/units/route.ts`
- `apps/landing/app/api/ticket-reservations/route.ts`
- `apps/landing/app/api/codes/info/route.ts`
- `apps/landing/app/api/tickets/route.ts`
- `apps/backoffice/app/api/reservations/utils.ts`

## Validacion ejecutada

```bash
./node_modules/.bin/vitest run \
  apps/backoffice/app/api/reservations/utils.test.ts \
  apps/landing/app/api/ticket-reservations/route.test.ts \
  'apps/landing/app/api/ticket-reservations/[id]/units/route.test.ts' \
  'apps/landing/app/api/ticket-reservations/[id]/issue/route.test.ts' \
  'apps/landing/app/api/ticket-reservations/[id]/units/[unitId]/issue/route.test.ts' \
  apps/landing/app/api/codes/info/route.test.ts \
  apps/landing/app/api/tickets/route.test.ts \
  apps/landing/app/compra/ticketPurchaseConfirmation.test.ts \
  'apps/landing/app/ticket/[id]/page.ticket-only.test.tsx'

./node_modules/.bin/tsc -p apps/landing/tsconfig.json --noEmit
./node_modules/.bin/tsc -p apps/backoffice/tsconfig.json --noEmit
```

## Nota de continuidad

Este cambio complementa el hotfix previo documentado en
`docs/CHANGELOG-2026-06-26-hotfix-nominacion-mesas-y-bandeja-tickets.md` y
aterriza el siguiente paso canonico de ADR-009: buyer-first issuance con claim
publico por unidad, sin volver a depender de la nominacion total de la compra.
