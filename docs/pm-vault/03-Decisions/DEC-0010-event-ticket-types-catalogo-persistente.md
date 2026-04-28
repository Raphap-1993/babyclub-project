---
id: DEC-0010
type: decision
title: Tipos de entrada se persisten como catalogo por evento
status: accepted
date: 2026-04-25
related_req: REQ-0010
adr_required: true
related_adr: ADR-008
tags:
  - tickets
  - payments
  - events
---

# DEC-0010 - Tipos de entrada se persisten como catalogo por evento

## Contexto

La compra publica tenia variantes Early Baby y All Night con cantidades 1/2 QR y precios derivados de constantes o columnas legacy del evento. Kevin pidio que el flujo E2E quede listo y que luego solo sea reemplazar/configurar Culqi con las credenciales definitivas.

## Decision

Las opciones vendibles de entrada viven en `event_ticket_types` por evento. Las columnas legacy de `events` quedan como fuente de compatibilidad y como origen para sincronizar los cuatro tipos base mientras no exista un editor avanzado.

La reserva ticket-only guarda snapshot de tipo y monto en `table_reservations`, y el servicio de pagos usa ese snapshot para crear la orden Culqi.

## Consecuencias

- Landing, reserva, pago y scanner comparten una fuente persistente.
- Cambios futuros de precio no reescriben el monto de reservas ya creadas.
- El flujo local queda preparado para Culqi; la salida real depende de credenciales y certificacion.
- El editor custom de labels/mensajes por lote queda como mejora posterior sobre la misma tabla.

## Verificacion

- `pnpm exec vitest run packages/shared/ticketTypes.test.ts apps/landing/app/api/ticket-reservations/route.test.ts packages/shared/payments/service.test.ts apps/backoffice/app/api/scan/route.test.ts`
- `pnpm --filter landing build`
