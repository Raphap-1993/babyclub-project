# CHANGELOG: Hotfix productivo de nominacion de mesas y bandeja de tickets (2026-06-26)

## Objetivo

Cerrar dos incidentes productivos relacionados pero distintos:

- reservas de mesa aprobadas que enviaban correo, pero no dejaban un flujo real
  de nominacion ni QR inicial del comprador;
- bandeja y export de tickets del backoffice que parecian listar solo tickets
  comprados porque truncaban la lectura al primer bloque de filas devuelto por
  Supabase/PostgREST.

## Resultado final

- `master` queda como rama de deploy operativa con ambos hotfixes publicados.
- Las reservas `table` aprobadas sin `attendees` ya preparan
  `ticket_reservation_units`, emiten el QR del comprador y mandan el correo con
  CTA de nominacion.
- La API publica de nominacion ya acepta reservas `table`.
- La emision publica de tickets ya soporta mesas y reutiliza el codigo
  reservado por unidad; si el nominado no tiene correo valido, usa fallback al
  correo del comprador.
- La bandeja y el export de tickets del backoffice ya recorren todos los
  tickets visibles por lotes y no dependen del primer bloque de `1000` filas.

## 1. Incidente: mesas aprobadas sin flujo real de nominacion

### Sintoma

En produccion existian reservas de mesa aprobadas donde el cliente recibia
`Reserva aprobada - códigos y QR`, pero:

- no existian filas en `ticket_reservation_units`;
- no existia ticket emitido para el comprador;
- el modulo de tickets y el workspace de nominacion no tenian unidades reales
  para mostrar.

Caso gatillo auditado:

- reserva `83f5f810-8de3-4ca9-9c17-4b617653e10a`
- evento `BABY PRIDE 2026`
- mesa `17`
- comprador `dreydoxkev@gmail.com`

### Causa raiz

El flujo legacy de aprobacion en
`apps/backoffice/app/api/reservations/update/route.ts` trataba la combinacion:

- `sale_origin='table'`
- reserva aprobada
- `attendees=[]`

como "correo de aprobacion + codigos reservados", pero no como
"buyer-first nomination". El sistema enviaba el correo sin preparar
`ticket_reservation_units` ni emitir el QR base del comprador.

### Cambios aplicados

- `apps/backoffice/app/api/reservations/ticketOnlyFlow.ts`
- `apps/backoffice/app/api/reservations/update/route.ts`
- `apps/landing/app/api/ticket-reservations/[id]/units/route.ts`
- `apps/landing/app/api/ticket-reservations/[id]/issue/route.ts`
- tests:
  - `apps/backoffice/app/api/reservations/update/route.test.ts`
  - `apps/landing/app/api/ticket-reservations/[id]/units/route.test.ts`
  - `apps/landing/app/api/ticket-reservations/[id]/issue/route.test.ts`

### Regla canónica resultante

Si una reserva `table` queda `approved` y no trae `attendees`, el sistema debe:

1. preparar `ticket_reservation_units` para toda la reserva;
2. emitir el QR de `unit_index=1` con identidad del comprador;
3. reutilizar el primer codigo reservado de la mesa;
4. enviar el correo de aprobacion con CTA `Completar asistentes`.

### Remediacion productiva ejecutada

Se repararon en produccion las dos reservas historicas afectadas:

- `83f5f810-8de3-4ca9-9c17-4b617653e10a`
- `2ef8ecd4-2243-42cb-97e5-a53bd64b9433`

Resultado verificado para ambas:

- `15` unidades preparadas;
- `1` ticket emitido para el comprador;
- nuevo log `reservation_approved:success`;
- rerun idempotente sin emitir tickets ni correos extra.

## 2. Incidente: bandeja de tickets aparentemente solo mostraba comprados

### Sintoma

En el backoffice se reporto que en la seccion de tickets:

- se veian tickets comprados;
- no se veian todos los QR emitidos por cortesia o flujos free;
- el export podia sufrir el mismo recorte de data.

### Causa raiz

El problema no era un filtro funcional por `code_type`. La pagina
`apps/backoffice/app/admin/tickets/page.tsx` y el export
`apps/backoffice/app/api/admin/tickets/export/route.ts` consultaban `tickets`
sin paginacion real a nivel DB y luego paginaban en memoria.

En produccion, el 2026-06-26:

- `tickets` activos reales: `1901`
- primera ventana cargada por el listado viejo: `1000`
- corte temporal entre bloques: alrededor de `2026-04-25T01:34:39Z`

Distribucion real auditada:

- `general`: `973`
- `courtesy`: `646`
- `table`: `282`

Distribucion visible en la primera ventana vieja:

- `general`: `504`
- `courtesy`: `297`
- `table`: `199`

Es decir: cientos de tickets validos quedaban fuera del listado solo por caer
despues del primer bloque que devolvia PostgREST.

### Cambios aplicados

- `apps/backoffice/app/admin/tickets/ticketListModel.ts`
- `apps/backoffice/app/admin/tickets/page.tsx`
- `apps/backoffice/app/api/admin/tickets/export/route.ts`
- test:
  - `apps/backoffice/app/admin/tickets/ticketListModel.test.ts`

### Regla canónica resultante

- La visibilidad funcional sigue pasando por
  `filterVisibleAdminTicketRows(...)`.
- La carga de tickets para bandeja o export debe recorrer lotes DB (`range`)
  hasta agotar resultados visibles.
- Nunca se debe paginar en memoria sobre una lectura ya truncada por el limite
  por defecto del proveedor.

## 3. Verificacion consolidada

### Tests y typechecks

```bash
pnpm exec vitest run \
  apps/backoffice/app/api/reservations/update/route.test.ts \
  apps/backoffice/app/api/reservations/resend/route.test.ts \
  'apps/backoffice/app/api/admin/reservations/[id]/resend/route.test.ts' \
  apps/backoffice/app/api/reservations/email.test.ts \
  'apps/landing/app/api/ticket-reservations/[id]/units/route.test.ts' \
  'apps/landing/app/api/ticket-reservations/[id]/issue/route.test.ts'

pnpm exec vitest run apps/backoffice/app/admin/tickets/ticketListModel.test.ts

pnpm exec tsc -p apps/backoffice/tsconfig.json --noEmit
pnpm exec tsc -p apps/landing/tsconfig.json --noEmit
```

### Smokes y evidencia de produccion

- Endpoint publico validado:
  `https://babyclubaccess.com/api/ticket-reservations/83f5f810-8de3-4ca9-9c17-4b617653e10a/units`
  responde `success: true` y devuelve `unit_index=1` en `issued`.
- Consulta productiva posterior al backfill:
  no quedan reservas `table` aprobadas desde `2026-06-01` con codigos pero sin
  unidades preparadas.
- Consulta productiva de tickets:
  el sistema tiene `1901` tickets activos; la bandeja vieja solo alcanzaba a
  ver `1000`.

## 4. Commits y normalizacion

### Canon publicados en `master`

- `8815071` `fix restore nomination flow for table reservations`
- `d7e6752` `fix paginate admin tickets beyond supabase limit`

### Equivalentes locales en branch de trabajo

En el workspace principal quedaron commits locales equivalentes:

- `47e4ec8` equivalente local del hotfix de nominacion de mesas
- `69d6617` equivalente local del hotfix de paginacion de tickets

Esto significa:

- la rama canonica para cualquier alcance nuevo es `master` en `d7e6752` o
  posterior;
- el branch local actual no debe ser "normalizado" con reset ciego porque
  tambien contiene cambios no relacionados sin publicar.

## 5. Estado recomendado para el siguiente alcance

1. Tomar `master` como base canonica.
2. No reabrir el worktree temporal de hotfix salvo para auditoria historica.
3. Si se necesita nuevo alcance, abrir branch limpio desde `master`.
4. Mantener esta documentacion junto con `AI_CONTEXT.md`,
   `docs/pm-vault/decisions.md` y ADR-009 como entrada minima.

## Riesgos residuales

- Falta smoke manual autenticado del backoffice `/admin/tickets` despues del
  deploy para verificar UX final con sesion staff real.
- Si se agregan nuevos tipos comerciales de QR, la presentacion en bandeja,
  export y scanner debe revisarse como slice unico.
- El branch local del workspace principal sigue con cambios ajenos a este
  incidente y debe tratarse con cuidado antes de cualquier rebase o limpieza
  agresiva.
