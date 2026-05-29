---
id: REQ-0015
type: requirement
title: Cortesias por lote con cupos y expiracion configurable
status: draft
owner: Vulcan
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
  - docs/pm-vault/01-Requirements/REQ-0009-liberacion-qr-free-por-lotes-y-reglas-horarias.md
  - docs/pm-vault/01-Requirements/REQ-0014-estado-operativo-promotores-y-bloqueo-de-codigos.md
depends_on:
  - REQ-0003
related_adrs: []
adr_not_required: true
related_arch_docs:
  - docs/ARCHITECTURE_V2.md
code_refs:
  - apps/backoffice/app/api/codes/batches/generate/route.ts
  - apps/backoffice/app/api/codes/batches/deactivate/route.ts
  - apps/backoffice/app/api/codes/list/route.ts
  - apps/backoffice/app/admin/codes/CodesClient.tsx
  - apps/backoffice/app/api/scan/route.ts
  - apps/backoffice/app/api/scan/confirm/route.ts
  - packages/shared/eventSales.ts
  - supabase/migrations/2025-02-11-add-code-batches.sql
  - supabase/migrations/2026-01-31-add-soft-delete.sql
test_refs:
  - pnpm exec vitest run apps/backoffice/app/api/codes/batches/generate/route.test.ts apps/backoffice/app/api/codes/batches/deactivate/route.test.ts apps/backoffice/app/api/codes/list/route.test.ts apps/backoffice/app/api/scan/route.test.ts apps/backoffice/app/api/scan/confirm/route.test.ts
  - pnpm typecheck:backoffice
  - pnpm typecheck:landing
release_target: next
tags:
  - req
  - feature
  - qr
  - courtesy
  - promoters
  - backoffice
  - scheduler
---

# REQ-0015 - Cortesias por lote con cupos y expiracion configurable

## Problema

El modulo de `codes` ya permite generar lotes con `quantity`, `max_uses` y `expires_at`, pero el repo no tiene una regla formal para cerrar esos lotes automaticamente ni una politica clara por tipo para decidir cuando la ventana horaria es obligatoria. En la practica, el equipo termina gestionando manualmente un estado que deberia cerrarse solo.

Hoy eso deja tres huecos:

- un lote puede seguir apareciendo operativo aunque ya no tenga cupos utiles;
- la expiracion existe como campo, pero no hay un ciclo de cierre automatico que la haga valer de forma consistente;
- la UI y la API no distinguen bien entre una configuracion de lote, una politica por tipo y el estado final `closed`.

## Objetivo

Definir un ciclo de vida unico para los lotes de cortesias/promotores/mesas donde el admin configure cupos y, cuando aplique, ventana horaria; el sistema cierre automaticamente el lote cada 5 minutos cuando se agote cualquiera de las dos reglas.

## Resultado esperado

- Los lotes tienen un estado operacional claro: `active` mientras pueden generar/servir codigos y `closed` cuando ya no deben usarse.
- El admin puede configurar si un tipo requiere ventana horaria o no.
- Si el tipo requiere ventana, el lote no se crea ni se mantiene abierto sin `expires_at` valido.
- Si el lote agota cupos o vence el horario, el sistema lo marca `closed` automaticamente.
- La UI muestra por que quedo cerrado y deja el lote visible solo como historial.

## Scope in

- Politica por tipo de codigo para decidir si la ventana horaria es obligatoria u opcional.
- Persistencia de metadata de cierre en `code_batches`.
- Job programado cada 5 minutos para cerrar lotes expirados o sin cupos.
- Bloqueo server-side para evitar nueva generacion o reenvio sobre lotes cerrados.
- Ajustes en backoffice para ver estado, motivo y regla aplicada.

## Scope out

- Rehacer el modelo completo de `codes`.
- Cambiar la semantica de `max_uses` por codigo.
- Introducir un nuevo tipo de pago o cambiar el checkout de tickets.
- Resolver `QR free` como feature independiente; ese sigue siendo otro flujo.
- Convertir `events.entry_limit` en la fuente de verdad de este requerimiento.

## Reglas de negocio

- `quantity` sigue siendo la cantidad de codigos generados dentro de un lote.
- `max_uses` sigue siendo un limite por codigo, no por lote.
- Un lote puede tener una politica de expiracion obligatoria, opcional o deshabilitada segun su tipo.
- La politica de tipo la administra solo staff desde backoffice; no existe edicion por promotor.
- Un lote se marca `closed` cuando:
  - todos sus codigos activos ya no tienen cupos de uso utiles, o
  - `now()` alcanza o supera `expires_at`, si ese campo aplica.
- El cierre automatico corre cada 5 minutos.
- Cuando un lote pasa a `closed`, deja de aceptar nuevas operaciones de generacion, reenvio o reactivacion automatica.
- Un cierre manual de admin tambien deja el lote en `closed` y debe registrar la misma metadata de cierre para no crear un estado paralelo.
- El cierre del lote no modifica la semantica de `events.entry_limit`, que sigue siendo un guardrail de acceso al evento y no de lote.

## Impacto en el repo

- Apps o paquetes: `apps/backoffice`, `apps/landing`, `packages/shared`.
- APIs o contratos: `POST /api/codes/batches/generate`, `POST /api/codes/batches/deactivate`, `GET /api/codes/list`, validaciones de scan/confirmacion y cualquier ruta que reemita codigos desde un lote cerrado.
- Datos o migraciones: extender `code_batches` con metadata de cierre; persistir politica por tipo; conservar compatibilidad con lotes historicos.
- Seguridad o permisos: solo staff puede definir la politica y ejecutar cierres manuales; el scheduler corre con privilegios de servicio.
- Observabilidad o trazabilidad: registrar `closed_at`, `closed_reason` y el motivo de bloqueo para que backoffice y soporte entiendan por que el lote dejo de operar.

## Gate de arquitectura

- ADR relacionado: no aplica.
- Justificacion: el cambio se mantiene dentro del modulo existente de codigos/lotes, sin alterar tenancy, limites de servicio ni la arquitectura base.

## Criterios de aceptacion

- [ ] Existe una politica por tipo que define si la expiracion es obligatoria u opcional.
- [ ] Un lote con ventana horaria vencida se marca `closed` automaticamente.
- [ ] Un lote sin cupos utiles se marca `closed` automaticamente.
- [ ] El cierre automatico corre cada 5 minutos.
- [ ] La UI de backoffice muestra estado y motivo de cierre sin confundirlo con eliminacion.
- [ ] Las rutas de generacion, reenvio y listado respetan el estado `closed`.

## Evidencia esperada

- Codigo: ajustes en batch generation, listado, cierre y metadata de lote.
- Tests / checks: cobertura de generacion, cierre por quota, cierre por expiracion, tipo con ventana obligatoria, `pnpm typecheck:backoffice`, `pnpm typecheck:landing`.
- Docs / changelog: actualizacion de `docs/pm-vault/status.md`, `docs/pm-vault/traceability.md` y bitacora en Obsidian.

## Riesgos abiertos

- Si la politica por tipo no queda claramente separada de la configuracion por lote, la UI puede volver a mezclar reglas globales con overrides puntuales.
- El cierre automatico depende de que el scheduler corra a tiempo; si el job se retrasa, el lote puede permanecer `active` unos minutos mas, pero no debe aceptar nuevas operaciones una vez evaluado.
- `events.entry_limit` ya existe y podria confundirse con este flujo si el copy no distingue bien acceso al evento vs cierre de lote.
