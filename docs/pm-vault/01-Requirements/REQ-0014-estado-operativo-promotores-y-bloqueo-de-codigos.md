---
id: REQ-0014
type: requirement
title: Estado operativo de promotores y bloqueo de códigos nuevos
status: done
owner: Vulcan
work_type: feature
created: 2026-05-28
updated: 2026-05-28
priority: P1
domain: promoters
impacted_apps:
  - apps/backoffice
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
  - apps/backoffice/app/admin/promoters/PromotersClient.tsx
  - apps/backoffice/app/admin/promoters/components/PromoterActions.tsx
  - apps/backoffice/app/admin/promoters/[id]/codes/PromoterCodesClient.tsx
  - apps/backoffice/app/api/promoters/set-status/route.ts
  - apps/backoffice/app/api/promoters/generate-codes/route.ts
  - apps/backoffice/app/api/promoters/create-link/route.ts
test_refs:
  - pnpm exec vitest run apps/backoffice/app/api/promoters/set-status/route.test.ts apps/backoffice/app/api/promoters/generate-codes/route.test.ts apps/backoffice/app/api/promoters/create-link/route.test.ts
  - pnpm typecheck:backoffice
  - git diff --check
release_target: next
tags:
  - req
  - promoters
  - backoffice
  - operations
---

# REQ-0014 - Estado operativo de promotores y bloqueo de códigos nuevos

## Problema

El backoffice ya permitía editar promotores y hasta marcar `is_active`, pero el flujo operativo seguía mostrando una acción de `Eliminar` que en realidad archivaba el registro. Además, aunque un promotor quedara inactivo, todavía podía generar códigos y links nuevos.

## Objetivo

Separar claramente `inactivo visible` de `archivado` y hacer que el estado operativo del promotor tenga efecto real sobre la generación de códigos y links.

## Resultado esperado

- El listado usa acciones rápidas de `Desactivar` y `Reactivar`, no `Eliminar`.
- El promotor inactivo sigue visible en `/admin/promoters`.
- Un promotor inactivo no puede generar códigos ni links nuevos.
- La pantalla histórica de códigos sigue consultable para promotores inactivos.

## Scope in

- Cambio rápido de estado operativo desde el listado.
- Ruta dedicada para `set-status`.
- Bloqueo server-side y visual en la gestión de códigos/links del promotor.

## Scope out

- Eliminar físicamente promotores.
- Cambiar liquidaciones, tickets históricos o atribución pasada.
- Resolver todo el frente F2 completo de links/códigos/cortesías.

## Reproducción actual

- Abrir `/admin/promoters`.
- Resultado observado antes del fix: la acción rápida decía `Eliminar` y usaba soft delete, sacando al promotor del listado.
- Abrir `/admin/promoters/[id]/codes` con un promotor inactivo.
- Resultado observado antes del fix: el backoffice seguía permitiendo generar cortesías y links directos nuevos.

## Reglas de negocio

- `Desactivar` solo cambia `is_active=false`; no archiva ni elimina.
- El promotor inactivo sigue visible para reactivación operativa.
- `generate-codes` y `create-link` deben rechazar nuevos artefactos si el promotor está inactivo.
- El historial existente de lotes y links sigue visible.

## Impacto en el repo

- Apps o paquetes: `apps/backoffice`
- APIs o contratos: nueva ruta `POST /api/promoters/set-status`; `generate-codes` y `create-link` ahora validan `promoters.is_active`
- Datos o migraciones: sin cambio
- Seguridad o permisos: sigue bajo `requireStaffRole`
- Observabilidad o trazabilidad: tests nuevos para rutas de estado/bloqueo

## Gate de arquitectura

- ADR relacionado: no aplica.
- Justificación: es una mejora operativa sobre un modelo existente (`is_active`) sin alterar límites arquitectónicos.

## Criterios de aceptación

- [x] La acción rápida del listado permite desactivar/reactivar sin archivar.
- [x] El promotor inactivo sigue visible como `Inactivo`.
- [x] `POST /api/promoters/generate-codes` bloquea promotores inactivos.
- [x] `POST /api/promoters/create-link` bloquea promotores inactivos.
- [x] La UI de `/admin/promoters/[id]/codes` deja claro que un promotor inactivo solo puede revisar historial.

## Evidencia esperada

- Código: ruta `set-status`, acciones del listado y bloqueo en códigos/links.
- Tests / checks: suite focalizada de rutas + `pnpm typecheck:backoffice`.
- Docs / changelog: `REQ-0003`, `status.md`, `traceability.md`.

## Riesgos abiertos

- La ruta legacy de archivo (`/api/promoters/delete`) sigue existiendo pero ya no es la vía operativa del listado; si luego se quiere soportar archivo real como concepto separado, habrá que explicitarlo en otro REQ.
- No se hizo smoke visual autenticado del backoffice porque este worktree no abrió una sesión admin real; el cierre queda soportado por rutas, typecheck y revisión del cliente.
