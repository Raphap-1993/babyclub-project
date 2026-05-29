---
id: REQ-0008
type: requirement
title: Diferenciar visualmente QR comprado, free y cortesia
status: done
owner: Neon
work_type: bugfix
created: 2026-05-28
updated: 2026-05-28
priority: P0
domain: tickets
impacted_apps:
  - apps/landing
  - apps/backoffice
  - packages/shared
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
  - apps/landing/app/ticket/[id]/page.tsx
  - apps/backoffice/app/admin/scan/scanPresentation.ts
  - apps/backoffice/app/admin/tickets/page.tsx
  - apps/backoffice/app/admin/tickets/ModernTicketsClient.tsx
  - apps/backoffice/app/admin/tickets/[id]/page.tsx
  - apps/backoffice/app/admin/tickets/components/TicketDetailModal.tsx
  - apps/backoffice/app/admin/tickets/components/TicketKindBadge.tsx
  - packages/shared/ticketKindPresentation.ts
test_refs:
  - pnpm exec vitest run apps/landing/app/ticket/[id]/page.presentation.test.tsx apps/landing/app/ticket/[id]/page.ticket-only.test.tsx apps/backoffice/app/admin/scan/scanPresentation.test.ts apps/backoffice/app/admin/tickets/components/TicketKindBadge.test.tsx packages/shared/ticketKindPresentation.test.ts
  - pnpm typecheck:landing
  - pnpm typecheck:backoffice
  - git diff --check
release_target: next
tags:
  - req
  - bugfix
  - tickets
  - backoffice
---

# REQ-0008 - Diferenciar visualmente QR comprado, free y cortesia

## Problema

Operaciones necesitaba distinguir rapido si un QR corresponde a entrada comprada, QR free, cortesia, promotor o mesa. El ticket publico y el scanner ya tenian parte del trabajo resuelto, pero el backoffice de tickets todavia mostraba solo evento, codigo y promotor, sin una etiqueta operativa clara del tipo comercial.

## Objetivo

Hacer evidente el tipo comercial del QR en ticket publico, scanner y vistas de tickets del backoffice.

## Resultado esperado

- El ticket publico deja de mezclar `mesa/promotor` y muestra copy propio por tipo.
- El scanner muestra paneles y labels claramente diferenciados por tipo comercial.
- La lista y detalle de tickets en backoffice muestran una etiqueta visual explicita para `entrada comprada`, `QR libre`, `QR cortesia`, `QR promotor` y `Mesa / Box`.

## Scope in

- Presentacion visual del tipo de QR en superficies operativas.
- Normalizacion minima de clasificacion para backoffice.
- Tests del helper de clasificacion y de las superficies clave.

## Scope out

- Cambiar reglas de negocio de emision, cobro o liquidacion.
- Reescribir el modelo legacy de `codes.type`.
- Resolver DNS o entregabilidad de correo.

## Reproduccion actual

- Abrir un ticket en backoffice.
- Resultado observado antes del fix: la UI no mostraba una etiqueta operativa del tipo de QR; en algunos casos el contexto quedaba ambiguo entre comprado, cortesia o promotor.

## Reglas de negocio

- Si `sale_origin='ticket'`, el QR debe leerse como entrada comprada aunque el schema legacy conserve `codes.type='courtesy'`.
- Si hay contexto de mesa, debe primar `Mesa / Box`.
- `QR libre`, `QR cortesia` y `QR promotor` deben conservar identidad visual separada.

## Impacto en el repo

- Apps o paquetes: `apps/landing`, `apps/backoffice`, `packages/shared`
- APIs o contratos: backoffice tickets ahora expone `code_type`, `sale_origin` y `ticket_type_label` para render operativo
- Datos o migraciones: sin cambio
- Seguridad o permisos: sin cambio
- Observabilidad o trazabilidad: deja tests puros para la clasificacion visual

## Gate de arquitectura

- ADR relacionado: no aplica.
- Justificacion: es una correccion de presentacion y clasificacion operativa sobre contratos existentes.

## Criterios de aceptacion

- [x] Ticket publico distingue `mesa`, `promotor`, `cortesia`, `free`, `general` y `ticket-only`.
- [x] Scanner muestra labels/paneles claramente diferenciados.
- [x] Backoffice tickets muestra un badge visual por tipo en lista y detalle.
- [x] La clasificacion trata `sale_origin='ticket'` como comprada aunque el tipo legacy sea `courtesy`.

## Evidencia esperada

- Codigo: helper compartido de clasificacion y badges en tickets backoffice.
- Tests / checks: tests de presentacion y typecheck landing/backoffice.
- Docs / changelog: `status.md`, `traceability.md`, `REQ-0003`.

## Riesgos abiertos

- El smoke visual autenticado del backoffice no se hizo contra una sesion real porque la `.env.local` del worktree apunta al proyecto remoto con data operativa; se valido por tests, typecheck y arranque seguro hasta pantalla de login.
