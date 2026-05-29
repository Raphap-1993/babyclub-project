---
id: REQ-0012
type: requirement
title: Catalogo flexible de entradas por evento con nominacion posterior obligatoria para uso
status: done
owner: Patroclo
work_type: feature
created: 2026-05-27
updated: 2026-05-28
priority: P0
domain: tickets
impacted_apps:
  - apps/landing
  - apps/backoffice
  - packages/shared
  - supabase
stakeholders:
  - Kevin
  - producto
  - operaciones
  - puerta
  - desarrollo
source_links:
  - docs/pm-vault/01-Requirements/REQ-0003-primer-lote-requerimientos-y-correcciones.md
  - docs/pm-vault/01-Requirements/REQ-0010-configurar-tipos-entradas-evento.md
depends_on:
  - REQ-0010
related_adrs:
  - ADR-008
  - ADR-009
adr_not_required: false
related_arch_docs:
  - docs/ARCHITECTURE_V2.md
  - docs/pm-vault/05-Architecture/architecture-canon.md
code_refs:
  - packages/shared/ticketTypes.ts
  - packages/shared/ticketReservationUnits.ts
  - apps/backoffice/lib/ticketTypesAdmin.ts
  - apps/landing/app/compra/page.tsx
  - apps/landing/app/api/ticket-reservations/route.ts
  - apps/landing/app/api/ticket-reservations/[id]/units/route.ts
  - apps/landing/app/api/ticket-reservations/[id]/issue/route.ts
  - apps/landing/app/compra/reserva/[id]/NominationClient.tsx
  - apps/backoffice/app/api/scan/route.ts
  - apps/backoffice/app/api/reservations/update/route.ts
  - apps/backoffice/app/api/admin/reservations/[id]/resend/route.ts
  - apps/backoffice/app/admin/ticket-types/TicketTypesClient.tsx
  - supabase/migrations/20260527213000_ticket_package_units_and_post_purchase_nomination.sql
  - supabase/migrations/20260528010000_relax_event_ticket_types_sale_phase.sql
test_refs:
  - pnpm exec vitest run packages/shared/ticketReservationUnits.test.ts packages/shared/ticketTypes.test.ts apps/landing/app/api/ticket-reservations/route.test.ts apps/landing/app/api/ticket-reservations/[id]/units/route.test.ts apps/landing/app/api/ticket-reservations/[id]/issue/route.test.ts apps/backoffice/app/api/events/[id]/ticket-types/route.test.ts apps/backoffice/app/api/scan/route.test.ts apps/backoffice/app/api/reservations/update/route.test.ts apps/backoffice/app/api/admin/reservations/[id]/resend/route.test.ts
  - pnpm typecheck:landing
  - pnpm typecheck:backoffice
release_target: next
tags:
  - req
  - feature
  - tickets
  - qr
  - scanner
  - email
---

# REQ-0012 - Catalogo flexible de entradas por evento con nominacion posterior obligatoria para uso

## Problema

BabyClub ya persistio `event_ticket_types`, pero el flujo publico y parte del admin siguen amarrados a cuatro variantes fijas (`early_bird_1`, `early_bird_2`, `all_night_1`, `all_night_2`) y a una compra pensada solo para `1` o `2` QR. Kevin necesita vender tipos realmente editables por evento, permitir comprar varios paquetes en una sola operacion y ganar control por asistente sin meter friccion antes del pago.

Hoy eso deja varios sintomas mezclados:

- no se pueden modelar facilmente `trio`, `preventa`, `box`, `mesa promo` o variantes comerciales equivalentes;
- la landing piensa en "fase + 1/2 QR" y no en un producto vendible por evento;
- la nominacion esta acoplada al momento de compra para el caso de 2 entradas y no escala a paquetes mayores;
- correo, QR y scanner no tienen una unidad canonica por asistente que permita bloquear el uso hasta que la persona este identificada.

## Objetivo

Convertir cada tipo de entrada en un SKU vendible por evento, permitir comprar cantidad de paquetes, registrar la compra sin nominacion inmediata y exigir nominacion posterior antes de emitir/usar cada QR individual.

## Resultado esperado

- Backoffice permite administrar tipos de entrada totalmente flexibles por evento.
- Cada tipo define como minimo `label`, `description`, `price`, `ticket_quantity`, `sort_order` e `is_active`.
- Landing compra por `evento -> tipo de entrada -> cantidad de paquetes`.
- La compra guarda snapshot comercial y cuantas unidades individuales resultan.
- Al aprobarse la compra se crean unidades individuales pendientes de nominacion.
- El comprador puede nominar despues cada unidad.
- Un QR individual solo queda usable en puerta cuando la unidad ya fue nominada.
- El correo individual de QR se alinea a la unidad nominada y deja de depender de adjuntar varios QRs a una sola persona por defecto.

## Scope in

- Evolucionar `event_ticket_types` desde tipos base fijos hacia catalogo flexible por evento.
- Reemplazar en landing el selector `pricing_phase + ticket_quantity` por seleccion explicita de `ticket_type_code`.
- Permitir `package_quantity` mayor a 1 en la compra publica.
- Persistir snapshot comercial ampliado en la compra/reserva.
- Introducir una entidad unitaria por asistente/QR derivada de la compra.
- Flujo de nominacion posterior para entradas compradas.
- Gate de scanner para bloquear unidades no nominadas.
- Ajustes minimos de backoffice para editar el catalogo flexible y visualizar el tipo/estado relevante.

## Scope out

- Reescribir todo BabyClub alrededor de un nuevo modulo de ordenes general.
- Rehacer por completo el flujo de mesas/boxes en la misma iteracion.
- Resolver reputacion SMTP o deliverability externa si la causa real es del proveedor.
- Abrir multi-tenant o cambios de tenancy; sigue vigente ADR-007.
- Cerrar en esta misma iteracion todos los items visuales o de correo fuera del slice principal.

## Reglas de negocio

- Un tipo de entrada es un producto vendible por evento.
- Cada tipo define cuantas unidades individuales/QR incluye un paquete (`ticket_quantity`).
- La compra selecciona un tipo y una `package_quantity`.
- `total_ticket_units = ticket_quantity * package_quantity`.
- La compra puede completarse sin nominacion completa al momento de pagar.
- Cada unidad individual nace en estado pendiente de nominacion.
- Una unidad individual no puede usarse en puerta mientras siga sin nominacion valida.
- La nominacion posterior debe capturar al menos identidad suficiente del asistente segun las reglas vigentes del evento.
- El correo individual de QR solo debe enviarse cuando la unidad objetivo ya este nominada o cuando el comprador la reasigne explicitamente.
- Se mantiene compatibilidad transitoria con el modelo legacy de `pricing_phase + ticket_quantity` solo donde sea necesario para no romper data historica ni entornos atrasados.

## Impacto en el repo

- Apps o paquetes: `apps/landing`, `apps/backoffice`, `packages/shared`.
- APIs o contratos: `/api/events`, `/api/ticket-reservations`, flujo de nominacion posterior, `/api/tickets`, `/api/scan`, reenvio de reservas/tickets.
- Datos o migraciones: extender `table_reservations` para `package_quantity` y `total_ticket_units`; crear tabla unitaria derivada de compra para nominacion/estado/QR por asistente; revisar compatibilidad con `attendees`.
- Seguridad o permisos: scanner y APIs internas deben rechazar uso de unidad no nominada; no cambia auth base.
- Observabilidad o trazabilidad: puerta y reportes deben poder distinguir tipo comercial, unidad individual y estado de nominacion.

## Gate de arquitectura

- ADR antecedente: [ADR-008](../../adr/2026-04-25-008-event-ticket-types-per-event.md).
- ADR complementario aprobado: [ADR-009](../../adr/2026-05-27-009-ticket-package-units-and-post-purchase-nomination.md).
- ADR-009 fijo el modelo incremental adoptado en esta entrega:
  - `table_reservations` sigue como cabecera comercial,
  - `ticket_reservation_units` pasa a ser la fuente canonica de lifecycle unitario,
  - `attendees` queda como compatibilidad transitoria,
  - nominacion valida es gate previo a emision/uso del QR.

## Criterios de aceptacion

- [x] Existe catalogo flexible de tipos de entrada por evento sin depender de los cuatro codigos base como limite funcional.
- [x] La compra publica selecciona `ticket_type_code` y `package_quantity`.
- [x] La compra persiste snapshot suficiente para reconstruir monto, tipo y cantidad de unidades historicas.
- [x] Cada compra aprobada genera unidades individuales pendientes de nominacion.
- [x] El comprador puede nominar despues cada unidad.
- [x] Una unidad no nominada no puede usarse en scanner/puerta.
- [x] El flujo de correo/QR puede operar por unidad individual en vez de concentrar varios QRs en una sola persona por defecto.
- [x] La compatibilidad transitoria con compras historicas queda explicitada y cubierta por tests.

## Evidencia esperada

- Codigo: archivos listados en `code_refs`, mas migraciones nuevas y pantallas/API de nominacion si se crean en esta iteracion.
- Tests / checks: `test_refs`, typecheck de landing/backoffice, smoke del flujo `compra -> aprobacion -> nominacion -> uso en puerta`.
- Docs / changelog: actualizacion de `docs/pm-vault/status.md`, `docs/pm-vault/traceability.md`, ADR complementario y bitacora en Obsidian.

## Resultado implementado

- Checkout publico migrado a `evento -> tipo -> cantidad de paquetes` con CTA al workspace de nominacion posterior.
- Admin de tipos reescrito como editor flexible por evento con add/remove/edit, `sale_phase` nullable y compatibilidad legacy para codigos conocidos.
- Compra ticket-only guarda snapshot comercial ampliado, `package_quantity`, `total_ticket_units` y crea `ticket_reservation_units`.
- Workspace publico `/compra/reserva/[id]` permite cargar nominaciones, emitir QR por unidad y ver tickets emitidos.
- Scanner invalida tickets cuyo `ticket_reservation_unit` aun no este `issued|used`.
- Aprobacion y reenvio de reservas ticket-only dejan de autoemitir en backoffice y operan sobre unidades ya emitidas.

## Riesgos abiertos

- El JSON `attendees` sigue coexistiendo como snapshot legacy; cualquier refactor futuro debe evitar volverlo a tratar como lifecycle canonico.
- Correo y deliverability hacia `icloud.com` / `outlook.com` pueden tener una parte ajena a aplicacion; este REQ habilita correo por unidad pero no certifica reputacion SMTP externa.
- Falta ejecutar smoke funcional completo con apps levantadas y migraciones aplicadas antes de mover este slice a entorno con data real.
