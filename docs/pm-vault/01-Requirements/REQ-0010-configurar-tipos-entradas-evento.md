---
id: REQ-0010
type: requirement
title: Configurar tipos y lotes de entrada por evento
status: done
owner: Patroclo
work_type: feature
created: 2026-04-25
updated: 2026-04-25
priority: P1
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
  - desarrollo
source_links:
  - docs/pm-vault/01-Requirements/REQ-0003-primer-lote-requerimientos-y-correcciones.md
depends_on:
  - REQ-0003
related_adrs:
  - ADR-008
adr_not_required: false
related_arch_docs:
  - docs/pm-vault/05-Architecture/architecture-canon.md
code_refs:
  - supabase/migrations/2026-04-25-event-ticket-types.sql
  - packages/shared/ticketTypes.ts
  - apps/landing/app/api/events/route.ts
  - apps/landing/app/api/ticket-reservations/route.ts
  - apps/landing/app/compra/page.tsx
  - packages/shared/payments/service.ts
  - apps/backoffice/app/api/events/create/route.ts
  - apps/backoffice/app/api/events/update/route.ts
  - apps/backoffice/app/api/scan/route.ts
test_refs:
  - pnpm exec vitest run packages/shared/ticketTypes.test.ts apps/landing/app/api/ticket-reservations/route.test.ts packages/shared/payments/service.test.ts apps/backoffice/app/api/scan/route.test.ts
release_target: next
tags:
  - req
  - feature
  - tickets
  - payments
  - culqi
---

# REQ-0010 - Configurar tipos y lotes de entrada por evento

## Problema

Kevin necesita que las entradas publicas de BabyClub dejen de depender de precios hardcodeados. Early Baby y All Night, en variantes de 1 QR y 2 QR, deben quedar configurables por evento y persistir en BD para que landing, reserva, pago y puerta usen la misma verdad.

## Objetivo

Persistir el catalogo vendible de entradas por evento y usarlo de punta a punta: eventos publicos, compra de entrada, snapshot de reserva, orden Culqi/Yape y scanner de puerta.

## Resultado esperado

- El backoffice sincroniza 4 tipos base por evento: `early_bird_1`, `early_bird_2`, `all_night_1`, `all_night_2`.
- La landing consume `event_ticket_types` y solo cae a columnas legacy si la migracion aun no existe.
- La reserva ticket-only persiste `ticket_type_code`, `ticket_type_label`, precio unitario y monto total.
- Culqi crea la orden con el monto snapshot de la reserva, no con un monto confiado desde cliente.
- Puerta muestra la etiqueta real de la entrada comprada cuando existe snapshot.

## Scope in

- Migracion `event_ticket_types` y columnas snapshot en `table_reservations`.
- Helper compartido para normalizar tipos persistidos y fallback legacy.
- API publica de eventos y API de reservas de entrada.
- Compra publica dinamica por tipos disponibles.
- Servicio de pagos usando monto snapshot para reservas ticket-only.
- Scanner backoffice con etiqueta de tipo de entrada persistida.

## Scope out

- Editor avanzado de etiquetas custom en UI.
- Reglas de cupo por lote.
- Certificacion real de Culqi contra credenciales productivas.
- Cambio de modelo single-tenant definido por ADR-007.

## Reglas de negocio

- El backend resuelve el precio final desde BD por `ticket_type_code`.
- Si no llega `ticket_type_code`, se mantiene compatibilidad por `pricing_phase` + `ticket_quantity`.
- Un tipo inactivo no puede comprarse.
- La reserva guarda snapshot para auditoria y para no cambiar montos historicos si luego se edita el evento.
- Culqi puede quedar listo localmente, pero "tarjeta funcionando" requiere credenciales y certificacion real.

## Impacto en el repo

- Apps o paquetes: landing, backoffice, shared.
- APIs o contratos: `/api/events`, `/api/ticket-reservations`, `/api/payments/culqi/create-order`, `/api/scan`.
- Datos o migraciones: nueva tabla `event_ticket_types` y columnas snapshot en `table_reservations`.
- Seguridad o permisos: sin cambios de auth; se mantiene staff guard existente en backoffice.
- Observabilidad o trazabilidad: QR de puerta expone `ticket_type_label`.

## Gate de arquitectura

- ADR relacionado: [ADR-008](../../adr/2026-04-25-008-event-ticket-types-per-event.md).
- Motivo: cambio de modelo de datos y contrato de pago/reserva.

## Criterios de aceptacion

- [x] Los tipos de entrada viven en BD por evento.
- [x] El flujo publico lista tipos disponibles desde API.
- [x] La reserva persiste snapshot de tipo y monto.
- [x] Culqi usa el monto snapshot cuando la reserva es ticket-only.
- [x] Scanner mantiene Early/All Night y muestra etiqueta real si existe.
- [x] Hay fallback legacy para entornos sin migracion aplicada.

## Evidencia esperada

- Codigo: archivos listados en `code_refs`.
- Tests / checks: `test_refs` y build de landing.
- Docs / changelog: `docs/pm-vault/status.md`, `docs/pm-vault/traceability.md`, `docs/adr/2026-04-25-008-event-ticket-types-per-event.md`.

## Riesgos abiertos

- Falta aplicar la migracion en Supabase local/remoto antes de probar con datos reales.
- Falta certificacion Culqi real con credenciales finales.
- El editor UI avanzado para textos/precios por lote queda como siguiente iteracion; por ahora se sincroniza desde los campos existentes del evento.
