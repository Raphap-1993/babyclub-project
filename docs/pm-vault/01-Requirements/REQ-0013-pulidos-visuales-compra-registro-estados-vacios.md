---
id: REQ-0013
type: requirement
title: Pulidos visuales en compra, registro y estados vacios
status: done
owner: Neon
work_type: bugfix
created: 2026-05-28
updated: 2026-05-28
priority: P2
domain: landing
impacted_apps:
  - apps/landing
stakeholders:
  - producto
  - operaciones
  - desarrollo
source_links:
  - docs/pm-vault/01-Requirements/REQ-0003-primer-lote-requerimientos-y-correcciones.md
depends_on:
  - REQ-0003
  - REQ-0012
related_adrs: []
adr_not_required: true
related_arch_docs:
  - docs/ARCHITECTURE_V2.md
code_refs:
  - apps/landing/app/compra/page.tsx
  - apps/landing/app/compra/PurchaseModeControls.tsx
  - apps/landing/app/compra/purchaseState.ts
  - apps/landing/app/compra/LegalTrustStrip.tsx
  - apps/landing/app/registro/page.tsx
  - apps/landing/app/registro/RegistroHero.tsx
test_refs:
  - pnpm exec vitest run apps/landing/app/compra/purchaseState.test.ts apps/landing/app/compra/page.layout.test.tsx apps/landing/app/compra/LegalTrustStrip.test.tsx apps/landing/app/registro/RegistroHero.test.tsx
  - pnpm typecheck:landing
  - git diff --check
release_target: next
tags:
  - req
  - bugfix
  - landing
  - ux
---

# REQ-0013 - Pulidos visuales en compra, registro y estados vacios

## Problema

El checkout publico y el registro seguian arrastrando detalles de presentacion que confundian operacion y usuario final: estados vacios con copy ambiguo en `/compra`, bloque legal demasiado pesado en mobile y encabezado de `/registro` sin branding consistente aunque ya existia `logoUrl` en runtime.

## Objetivo

Corregir copy, etiquetas y jerarquia visual en `compra` y `registro` sin abrir un rediseño completo.

## Resultado esperado

- `/compra` deja de decir `Sin entradas disponibles` cuando el problema real es que no hay eventos o falta contexto.
- El trust/legal strip final queda mas compacto y legible en mobile.
- `/registro` vuelve a mostrar branding BABY coherente con el flujo publico.

## Scope in

- Estados vacios y CTA del checkout de tickets.
- Strip legal final del checkout.
- Hero superior de `/registro`.

## Scope out

- Rediseñar formularios completos.
- Cambiar reglas de negocio de disponibilidad o pagos.
- Reescribir el layout de mesa/box o scanner.

## Reproduccion actual

- Abrir `/compra` sin eventos ticket activos.
- Resultado observado antes del fix: el selector podia desaparecer, el checkout repetia mensajes vacios y el CTA caia a `Sin entradas disponibles`.
- Abrir `/registro`.
- Resultado observado antes del fix: el encabezado mostraba solo `Registro`, sin reutilizar `logoUrl` ni mantener el lenguaje visual de BABY.

## Reglas de negocio

- Si no hay eventos ticket activos, la UI debe decirlo explicitamente y no sugerir que el problema es stock por tipo.
- El bloque legal no debe competir visualmente con el CTA final en mobile.
- El branding BABY debe mantenerse entre `compra` y `registro` cuando exista `logoUrl`.

## Impacto en el repo

- Apps o paquetes: `apps/landing`
- APIs o contratos: sin cambio
- Datos o migraciones: sin cambio
- Seguridad o permisos: sin cambio
- Observabilidad o trazabilidad: tests puros para copy/estructura y smoke DOM local

## Gate de arquitectura

- ADR relacionado: no aplica.
- Justificacion: son ajustes de UX/presentacion dentro de flujos ya aprobados.

## Criterios de aceptacion

- [x] `PurchaseModeControls` mantiene visible la seccion `Evento` aun sin opciones.
- [x] El CTA de compra usa copy contextual para `sin eventos`, `selecciona evento` y `sin entradas`.
- [x] El strip legal se separa en copy + nav legal compacto.
- [x] `/registro` muestra branding BABY con soporte para `logoUrl`.

## Evidencia esperada

- Codigo: helper de estados vacios, `LegalTrustStrip` y `RegistroHero`.
- Tests / checks: suite focalizada de landing + typecheck.
- Docs / changelog: `REQ-0003`, `status.md`, `traceability.md`.

## Riesgos abiertos

- El smoke visual final por screenshot en Puppeteer se colgo en el tool; la verificacion se cerro por DOM real (`count=1` del mensaje vacio, CTA `Sin eventos disponibles`, hero `BABY/Registro`) y typecheck/test suite.
