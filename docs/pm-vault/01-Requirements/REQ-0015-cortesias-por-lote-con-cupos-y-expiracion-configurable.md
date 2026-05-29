---
id: REQ-0015
type: requirement
title: Cortesías por lote con cupos y expiración configurable
status: done
owner: Vulcan
work_type: feature
created: 2026-05-28
updated: 2026-05-28
priority: P1
domain: codes
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
  - packages/shared/codeBatchPolicy.ts
  - packages/shared/codeBatchPolicy.test.ts
  - apps/backoffice/app/api/codes/policies/route.ts
  - apps/backoffice/app/api/codes/policies/route.test.ts
  - apps/backoffice/app/api/codes/batches/generate/route.ts
  - apps/backoffice/app/api/codes/batches/generate/route.test.ts
  - apps/backoffice/app/api/codes/batches/close-due/route.ts
  - apps/backoffice/app/api/codes/batches/close-due/route.test.ts
  - apps/backoffice/app/api/codes/list/route.ts
  - apps/backoffice/app/api/codes/list/route.test.ts
  - apps/backoffice/app/admin/codes/CodesClient.tsx
  - supabase/migrations/20260528190000_code_batch_closure_and_type_policies.sql
  - supabase/migrations/20260528193000_close_due_code_batches.sql
test_refs:
  - pnpm exec vitest run packages/shared/codeBatchPolicy.test.ts apps/backoffice/app/api/codes/policies/route.test.ts apps/backoffice/app/api/codes/batches/generate/route.test.ts apps/backoffice/app/api/codes/batches/close-due/route.test.ts apps/backoffice/app/api/codes/list/route.test.ts apps/backoffice/app/admin/codes/CodeTypePoliciesPanel.test.tsx
  - pnpm typecheck:backoffice
  - pnpm typecheck:landing
  - git diff --check
release_target: next
tags:
  - req
  - codes
  - backoffice
  - operations
---

# REQ-0015 - Cortesías por lote con cupos y expiración configurable

## Problema

La gestión de códigos de cortesía y promotor funcionaba como una mezcla de lote operativo y reglas implícitas. No había una política administrable por tipo para decidir cuándo un lote requería expiración obligatoria, ni existía un cierre automático autoritativo por cuota o vencimiento.

## Objetivo

Hacer que las cortesías por lote sean configurables por tipo, que la generación valide la expiración cuando la política la exige y que los lotes se cierren automáticamente por cupos o por horario con un job repetible cada 5 minutos.

## Resultado implementado

- `code_type_policies` administra si cada tipo requiere expiración obligatoria u opcional.
- `code_batches` ahora registra `closed_at`, `closed_reason` y `closed_by_staff_id`.
- `close_due_code_batches` cierra los lotes vencidos o agotados y desactiva sus códigos.
- El generador de lotes rechaza `expires_at` faltante cuando el tipo seleccionado lo exige.
- El listado de códigos expone el estado autoritativo del lote para backoffice.

## Scope in

- Política por tipo administrable desde backoffice.
- Validación de expiración en la generación de lotes.
- Job de cierre autoritativo y repetible.
- Señal visual de lote cerrado en la UI operativa.

## Scope out

- Reescribir el modelo de pagos o tickets.
- Cambiar la lógica de cortesías históricas fuera de lotes.
- Agendar el cron real en infraestructura externa.

## Reglas de negocio

- Si el tipo exige expiración, `expires_at` es obligatorio.
- Un lote se cierra automáticamente si se agotan los cupos o vence la hora.
- El cierre debe ser visible y estable en UI y en la base de datos.
- El lote cerrado no se reabre silenciosamente.

## Impacto en el repo

- Apps o paquetes: `apps/backoffice`, `packages/shared`
- APIs o contratos: nuevas rutas `/api/codes/policies`, `/api/codes/batches/close-due`; `generate` valida expiración obligatoria
- Datos o migraciones: nuevas columnas de cierre en `code_batches`, tabla `code_type_policies`, RPC `close_due_code_batches`
- Seguridad o permisos: rutas protegidas por `requireStaffRole`
- Observabilidad o trazabilidad: trazabilidad de políticas, lote cerrado y estado del listado

## Gate de arquitectura

- ADR relacionado: no aplica.
- Justificación: es una extensión operativa del modelo de códigos existente, sin cambio de tenancy ni de límites de sistema.

## Criterios de aceptación

- [x] La política por tipo puede leerse y guardarse desde backoffice.
- [x] La generación rechaza `expires_at` faltante cuando el tipo lo exige.
- [x] El job `close_due_code_batches` cierra lotes por cuota o expiración.
- [x] El listado de códigos expone el estado autoritativo del lote.
- [x] La UI de backoffice muestra el estado cerrado/activo del lote.

## Evidencia esperada

- Código: helper compartido, rutas de políticas/generación/cierre, listado y UI.
- Tests / checks: suite focalizada, `pnpm typecheck:backoffice`, `pnpm typecheck:landing`, `git diff --check`.
- Docs / changelog: `status.md`, `traceability.md`.

## Riesgos abiertos

- El cron real de 5 minutos debe engancharse en infraestructura de release o en un job externo; el código ya quedó preparado para ser llamado de forma autoritativa.
- La migración nueva debe aplicarse en cualquier entorno remoto que quiera ejecutar el cierre automático.
