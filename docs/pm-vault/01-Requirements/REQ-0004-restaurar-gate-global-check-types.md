---
id: REQ-0004
type: requirement
title: Restaurar gate global de check-types
status: done
owner: Vulcan
work_type: bugfix
created: 2026-04-24
updated: 2026-04-24
priority: P1
domain: tooling
impacted_apps:
  - apps/landing
  - apps/backoffice
  - packages/ui
stakeholders:
  - desarrollo
  - arquitectura
source_links:
  - docs/pm-vault/status.md
  - docs/pm-vault/01-Requirements/REQ-0003-primer-lote-requerimientos-y-correcciones.md
depends_on:
  - REQ-0003
related_adrs: []
adr_not_required: true
related_arch_docs:
  - docs/pm-vault/05-Architecture/architecture-canon.md
code_refs:
  - package.json
  - turbo.json
  - apps/landing/package.json
  - apps/backoffice/package.json
  - vitest.config.ts
  - apps/backoffice/app/admin/events/__tests__/QRStatsTable.test.tsx
  - packages/ui/src/components/data-table.tsx
test_refs:
  - pnpm check-types
  - pnpm exec vitest run apps/backoffice/app/admin/events/__tests__/QRStatsTable.test.tsx
release_target: n/a
tags:
  - req
  - bugfix
  - tooling
---

# REQ-0004 - Restaurar gate global de check-types

## Problema

`pnpm check-types` estaba roto porque el script raiz apuntaba a una task inexistente en Turbo. Ademas, el `typecheck` del backoffice arrastraba un test fuera del setup real de Vitest y `@repo/ui` tenia un error puntual de nulabilidad.

## Objetivo

Volver a dejar operativo el gate global de tipos para que el repo tenga una validacion minima ejecutable y honesta.

## Resultado esperado

- `pnpm check-types` corre desde la raiz sin fallar por wiring roto
- `landing`, `backoffice` y `@repo/ui` quedan cubiertos por el gate
- El test `QRStatsTable` usa el runner configurado en el repo

## Scope in

- Cablear la task `check-types` en Turbo
- Exponer `check-types` en las apps TypeScript activas
- Corregir el test desalineado del backoffice
- Corregir el type error de `@repo/ui`

## Scope out

- Resolver warnings de schema en `layout`
- Corregir fallas funcionales ajenas al gate de tipos

## Reproduccion actual

- Ejecutar `pnpm check-types`
- Resultado observado: Turbo falla con `Could not find task check-types in project`

## Reglas de negocio

- Un gate global no puede depender de scripts huerfanos
- Si un test entra al typecheck, debe usar dependencias y runner realmente soportados por el repo

## Impacto en el repo

- Apps o paquetes: `apps/landing`, `apps/backoffice`, `packages/ui`
- APIs o contratos: sin impacto
- Datos o migraciones: sin impacto
- Seguridad o permisos: sin impacto
- Observabilidad o trazabilidad: mejora la confiabilidad del gate tecnico reportado en Obsidian

## Gate de arquitectura

- ADR relacionado: no aplica
- Si no aplica ADR, justificar `adr_not_required: true`

## Criterios de aceptacion

- [x] `turbo.json` define la task `check-types`
- [x] Las apps TypeScript activas exponen `check-types`
- [x] `pnpm check-types` pasa desde la raiz
- [x] El test `QRStatsTable` deja de depender de librerias no instaladas

## Evidencia esperada

- Codigo: scripts de `check-types`, task de Turbo, test `QRStatsTable`, guard en `@repo/ui`
- Tests / checks: `pnpm check-types`, `pnpm exec vitest run apps/backoffice/app/admin/events/__tests__/QRStatsTable.test.tsx`
- Docs / changelog: `docs/pm-vault/status.md`, `docs/pm-vault/traceability.md`

## Riesgos abiertos

- El siguiente riesgo tecnico del status sigue siendo el warning de schema en `layout`.
