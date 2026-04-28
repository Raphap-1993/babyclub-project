---
id: REQ-0006
type: requirement
title: Controlar exposicion de tarjeta Culqi por disponibilidad runtime
status: done
owner: Vulcan
work_type: bugfix
created: 2026-04-25
updated: 2026-04-25
priority: P0
domain: payments
impacted_apps:
  - apps/landing
  - packages/shared
stakeholders:
  - producto
  - desarrollo
  - operaciones
source_links:
  - /Users/rapha/Downloads/babyacces_recuento_chat_kevin_2026-04-25.md
  - docs/pm-vault/01-Requirements/REQ-0003-primer-lote-requerimientos-y-correcciones.md
depends_on:
  - REQ-0003
related_adrs: []
adr_not_required: true
related_arch_docs:
  - docs/ARCHITECTURE_V2.md
code_refs:
  - packages/shared/payments/culqi.ts
  - apps/landing/app/api/payments/status/route.ts
  - apps/landing/lib/useCulqiAvailability.ts
  - apps/landing/app/compra/page.tsx
  - apps/landing/app/registro/page.tsx
test_refs:
  - pnpm check-types
  - pnpm exec vitest run packages/shared/payments/culqi.test.ts packages/shared/payments/service.test.ts apps/landing/app/api/payments/status/route.test.ts
release_target: next
tags:
  - req
  - bugfix
  - payments
  - culqi
---

# REQ-0006 - Controlar exposicion de tarjeta Culqi por disponibilidad runtime

## Problema

El recuento de Kevin marca pago con tarjeta como P0: si no funciona de punta a punta, la landing no debe prometer tarjeta. El repo ya tenia integracion parcial de Culqi, pero la UI publica podia mostrar "Tarjeta" solo por `NEXT_PUBLIC_CULQI_ENABLED`, aunque el backend no estuviera realmente habilitado o faltara `CULQI_SECRET_KEY`.

## Objetivo

Evitar que la landing exponga pago con tarjeta cuando Culqi no esta operativo a nivel runtime.

## Resultado esperado

- `Culqi` solo se considera habilitado si `ENABLE_CULQI_PAYMENTS=true` y existe `CULQI_SECRET_KEY`.
- La landing consulta un endpoint runtime antes de mostrar la opcion "Tarjeta".
- Si el backend, la public key o el status runtime no estan listos, la compra cae a Yape/Plin con voucher.

## Scope in

- Endurecer `culqiGateway.isEnabled()`.
- Agregar `GET /api/payments/status` en landing.
- Usar un hook cliente para decidir disponibilidad real de Culqi.
- Aplicar el guard en `/compra` y `/registro`.
- Cubrir el contrato con tests.

## Scope out

- Certificar un pago real end-to-end contra Culqi.
- Cambiar contrato de webhooks, refunds o migraciones.
- Resolver reportes, no-show, QR free o mobile backoffice.

## Reproduccion actual

- Configurar `NEXT_PUBLIC_CULQI_ENABLED=true` sin backend Culqi completo.
- Abrir la landing de compra.
- Resultado observado: el usuario puede ver "Tarjeta" y recien falla al iniciar orden.

## Reglas de negocio

- No se debe prometer tarjeta si el sistema no puede iniciar orden en backend.
- Yape/Plin con comprobante queda como fallback seguro mientras Culqi no este listo.

## Impacto en el repo

- Apps o paquetes: `apps/landing`, `packages/shared`
- APIs o contratos: agrega status runtime publico de pagos
- Datos o migraciones: sin cambio
- Seguridad o permisos: no expone secret; solo public key cuando el proveedor esta habilitado
- Observabilidad o trazabilidad: deja testable el estado de habilitacion de pagos

## Gate de arquitectura

- ADR relacionado: no aplica.
- Justificacion: no cambia proveedor elegido ni contrato de pagos; solo endurece la condicion de exposicion publica.

## Criterios de aceptacion

- [x] Culqi no queda habilitado si falta `CULQI_SECRET_KEY`.
- [x] `/api/payments/status` reporta Culqi deshabilitado cuando falta backend o public key.
- [x] `/compra` no muestra ni usa "Tarjeta" si el status runtime esta deshabilitado.
- [x] `/registro` no muestra ni usa "Tarjeta" si el status runtime esta deshabilitado.
- [x] El fallback Yape/Plin sigue disponible.

## Evidencia esperada

- Codigo: gateway, endpoint de status, hook cliente y pantallas publicas.
- Tests / checks: `pnpm check-types`, tests de Culqi/service/status.
- Docs / changelog: `docs/pm-vault/status.md`, `docs/pm-vault/traceability.md`.

## Riesgos abiertos

- Esto evita prometer tarjeta cuando no esta habilitada, pero no certifica pagos reales. Falta prueba end-to-end con credenciales Culqi validas antes de declarar "pago con tarjeta funcionando".
