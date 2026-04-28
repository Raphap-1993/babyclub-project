---
id: REQ-0005
type: requirement
title: Normalizar runtime de layout contra schema real
status: done
owner: Vulcan
work_type: bugfix
created: 2026-04-24
updated: 2026-04-24
priority: P1
domain: layout
impacted_apps:
  - apps/landing
  - apps/backoffice
  - packages/shared
stakeholders:
  - producto
  - arquitectura
  - desarrollo
source_links:
  - docs/pm-vault/status.md
  - docs/pm-vault/01-Requirements/REQ-0003-primer-lote-requerimientos-y-correcciones.md
depends_on:
  - REQ-0003
related_adrs: []
adr_not_required: true
related_arch_docs:
  - docs/ARCHITECTURE_V2.md
  - docs/MULTI-EVENT-SYSTEM.md
code_refs:
  - packages/shared/layoutMetadata.ts
  - apps/landing/app/api/layout/route.ts
  - apps/backoffice/app/admin/organizers/[id]/layout/page.tsx
  - apps/backoffice/app/api/organizers/[id]/layout/route.ts
test_refs:
  - pnpm check-types
  - pnpm exec vitest run packages/shared/layoutMetadata.test.ts apps/landing/app/api/layout/route.test.ts apps/backoffice/app/api/organizers/[id]/layout/route.test.ts
release_target: n/a
tags:
  - req
  - bugfix
  - layout
  - schema
---

# REQ-0005 - Normalizar runtime de layout contra schema real

## Problema

El runtime de layout respondia `200`, pero primero consultaba columnas opcionales como `organizers.layout_canvas_width` y recien despues caia a fallback. Eso dejaba warnings de schema en entornos donde el contrato nuevo todavia no estaba completo.

## Objetivo

Hacer que las lecturas y escrituras de layout operen contra el schema realmente expuesto por cada entorno, sin consultar ni actualizar columnas opcionales a ciegas.

## Resultado esperado

- `landing` obtiene layout sin depender de `layout_canvas_*` para responder bien
- El diseñador de layout del backoffice lee mesas y organizer sin provocar warnings por columnas opcionales ausentes
- El guardado del organizer no intenta escribir `layout_canvas_*` si el schema no las expone

## Scope in

- Normalizar metadata de layout desde filas `select("*")`
- Reusar esa normalizacion en `landing`, page server del backoffice y `PUT /api/organizers/[id]/layout`
- Cubrir el comportamiento con tests

## Scope out

- Cambios de migracion en Supabase
- Resolver otros drifts historicos fuera de layout

## Reproduccion actual

- Abrir o consumir el runtime de layout en un entorno sin `organizers.layout_canvas_width/layout_canvas_height`
- Resultado observado: el endpoint o page pueden responder bien, pero antes disparan error de schema y luego hacen fallback

## Reglas de negocio

- El runtime no debe depender de fallar primero para descubrir una capacidad opcional
- Si una columna opcional no existe en el entorno, el sistema debe degradar usando datos realmente presentes

## Impacto en el repo

- Apps o paquetes: `apps/landing`, `apps/backoffice`, `packages/shared`
- APIs o contratos: normalizacion del contrato runtime de layout
- Datos o migraciones: sin migracion nueva
- Seguridad o permisos: sin impacto
- Observabilidad o trazabilidad: reduce warnings falsos por schema en layout

## Gate de arquitectura

- ADR relacionado: no aplica
- Si no aplica ADR, justificar `adr_not_required: true`

## Criterios de aceptacion

- [x] `landing` deja de consultar columnas opcionales de layout por nombre fijo
- [x] La page de layout del backoffice normaliza organizer y mesas desde el schema real
- [x] El `PUT` del organizer no escribe `layout_canvas_*` cuando la fila no expone esas columnas
- [x] El comportamiento queda cubierto por tests

## Evidencia esperada

- Codigo: helper `layoutMetadata`, runtime `layout`, page de organizer layout, ruta `PUT`
- Tests / checks: `pnpm check-types`, `pnpm exec vitest run packages/shared/layoutMetadata.test.ts apps/landing/app/api/layout/route.test.ts apps/backoffice/app/api/organizers/[id]/layout/route.test.ts`
- Docs / changelog: `docs/pm-vault/status.md`, `docs/pm-vault/traceability.md`, vault real de Obsidian

## Riesgos abiertos

- Falta validacion contra un entorno real que tuviera exactamente el warning historico, aunque el comportamiento ya queda cubierto a nivel de codigo y tests.
