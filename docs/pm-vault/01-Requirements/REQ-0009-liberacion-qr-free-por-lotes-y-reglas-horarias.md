---
id: REQ-0009
type: requirement
title: Liberacion QR free por lotes y reglas horarias
status: refining
owner: Patroclo
work_type: feature
created: 2026-05-28
updated: 2026-05-28
priority: P0
domain: access-codes
impacted_apps:
  - apps/backoffice
  - apps/landing
  - packages/shared
  - supabase
stakeholders:
  - producto
  - operaciones
  - desarrollo
source_links:
  - docs/pm-vault/01-Requirements/REQ-0003-primer-lote-requerimientos-y-correcciones.md
depends_on:
  - REQ-0003
related_adrs: []
adr_not_required: true
related_arch_docs:
  - docs/ARCHITECTURE_V2.md
code_refs:
  - apps/backoffice/app/api/codes/batches/generate/route.ts
  - apps/backoffice/app/admin/codes/CodesClient.tsx
  - apps/landing/app/api/codes/info/route.ts
  - apps/landing/app/api/tickets/route.ts
  - packages/shared/freeQrGate.ts
test_refs:
  - pnpm exec vitest run packages/shared/freeQrGate.test.ts apps/landing/app/api/codes/info/route.test.ts apps/landing/app/api/tickets/route.test.ts
  - pnpm typecheck:landing
release_target: pending
tags:
  - req
  - feature
  - qr
  - free
---

# REQ-0009 - Liberacion QR free por lotes y reglas horarias

## Problema

El backlog pide `QR free manual por lotes` con regla formal de horario, pero el repositorio actual no tiene una ruta operativa completa para eso. El sistema sabe leer `codes.type='free'` en algunos flujos, pero el backoffice no puede generarlos ni existe una regla de negocio cerrada para su liberacion comercial.

## Hallazgos validados 2026-05-28

- El generador `POST /api/codes/batches/generate` solo acepta `courtesy`, `promoter` y `table`.
- El UI `CodesClient` solo ofrece `courtesy` y `promoter`.
- En la data local clonada no existe ningun `codes.type='free'`.
- La landing si sabia consultar/emitir `free` si alguien insertaba un codigo manualmente.

## Decision operativa actual

Antes de liberar la feature, `QR free` queda bloqueado por defecto en la landing mediante `ENABLE_FREE_QR_CODES`.

- `GET /api/codes/info` devuelve `409 free_qr_disabled` para codigos `free` si el flag no esta activo.
- `POST /api/tickets` devuelve `409 free_qr_disabled` para codigos `free` si el flag no esta activo.
- Esto evita prometer salida comercial de una feature que todavia no tiene backoffice ni regla horaria homologada.

## Resultado esperado para la feature final

- Generacion manual por lotes desde modulo interno.
- Regla clara de expiracion/horario para `QR free`.
- Copy operativo y reportes consistentes con la regla final.
- Gate de release explicitamente documentado para pasar de `disabled` a `enabled`.

## Scope in

- Definir contrato funcional de `QR free`.
- Habilitar generacion de lotes en backoffice.
- Definir y aplicar regla horaria.
- Alinear landing, scanner y reportes.

## Scope out

- Reescribir el modelo completo de codigos.
- Mezclar esta liberacion con reglas de cortesia pagada o promoter link sin decision formal.

## Riesgos abiertos

- Mientras no exista la regla final, `courtesy` y `free` pueden mezclarse semanticamente en conversaciones operativas.
- El scanner y los reportes ya conocen `free`, pero la emision comercial sigue deliberadamente bloqueada.
