---
id: DEC-0008
type: decision
title: Tarjeta solo se expone con Culqi habilitado en runtime
status: accepted
date: 2026-04-25
related_req: REQ-0006
adr_required: false
tags:
  - payments
  - culqi
  - landing
---

# DEC-0008 - Tarjeta solo se expone con Culqi habilitado en runtime

## Contexto

El backlog reconstruido desde el chat de Kevin marca pago con tarjeta como P0. Mientras el pago no este certificado end-to-end, la landing no debe prometer tarjeta por una bandera publica si el backend no puede iniciar una orden.

## Decision

La disponibilidad publica de Culqi se decide con un status runtime:

- `culqiGateway.isEnabled()` requiere `ENABLE_CULQI_PAYMENTS=true` y `CULQI_SECRET_KEY`.
- `GET /api/payments/status` solo devuelve Culqi habilitado si tambien existe public key.
- `/compra` y `/registro` ocultan "Tarjeta" cuando el status runtime no confirma disponibilidad.

## Consecuencias

- Yape/Plin queda como fallback por defecto.
- La public key solo se entrega al cliente cuando el proveedor esta habilitado.
- La correccion evita prometer tarjeta, pero no reemplaza la prueba real de pago Culqi.

## Verificacion

- `pnpm check-types`
- `pnpm exec vitest run packages/shared/payments/culqi.test.ts packages/shared/payments/service.test.ts apps/landing/app/api/payments/status/route.test.ts`
