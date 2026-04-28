---
id: REQ-0002
type: requirement
title: Topologia local e intake alineados con la vault
status: done
owner: Raphael
work_type: operational
created: 2026-04-24
updated: 2026-04-24
priority: P1
domain: delivery-process
impacted_apps:
  - apps/landing
  - apps/backoffice
  - apps/api
  - docs
stakeholders:
  - producto
  - arquitectura
  - desarrollo
source_links:
  - package.json
depends_on:
  - REQ-0001
related_adrs: []
adr_not_required: true
related_arch_docs:
  - docs/ARCHITECTURE_V2.md
code_refs:
  - package.json
  - apps/landing/package.json
  - apps/backoffice/package.json
  - README.md
  - docs/LOCAL-SETUP-2026-02.md
test_refs:
  - curl -I http://localhost:3000/auth/login
  - curl -I http://localhost:3001/registro
  - pnpm smoke:local
release_target: n/a
tags:
  - req
  - local-dev
  - obsidian
---

# REQ-0002 - Topologia local e intake alineados con la vault

## Problema

La topologia local no estaba formalizada de manera consistente entre scripts, smoke, docs y trabajo operativo. Eso hacia mas dificil empezar requerimientos nuevos o correcciones con un entorno predecible.

## Objetivo

Dejar fijo el arranque local del repo y conectarlo con el flujo de intake en Obsidian para que el siguiente lote entre ya ordenado.

## Resultado esperado

- Scripts root claros para `landing`, `backoffice` y `api`
- Topologia local establecida en docs
- Intake preparado para distinguir `feature` y `bugfix`

## Scope in

- Agregar script root para `api`
- Alinear docs y smoke local con la topologia real
- Crear decisiones operativas en la vault
- Abrir el intake del primer lote

## Scope out

- Resolver deuda de schema en `layout`
- Resolver el warning por lockfile externo
- Definir el contenido funcional del siguiente lote

## Reproduccion actual

- Solo si `work_type: bugfix`
- No aplica

## Reglas de negocio

- `backoffice` corre en `3000`
- `landing` corre en `3001`
- `api` legacy corre en `4000`
- `pnpm smoke:local` debe validar la `landing`, no el `backoffice`

## Impacto en el repo

- Apps o paquetes: `apps/landing`, `apps/backoffice`, `apps/api`, root scripts
- APIs o contratos: sin cambio funcional
- Datos o migraciones: sin cambio
- Seguridad o permisos: sin cambio
- Observabilidad o trazabilidad: mejora la consistencia operativa del flujo local

## Gate de arquitectura

- ADR relacionado: no aplica
- Si no aplica ADR, justificar `adr_not_required: true`

## Criterios de aceptacion

- [x] Existe `pnpm dev:api` en root
- [x] Las docs locales reflejan puertos y topologia reales
- [x] El intake ya soporta clasificar `feature` vs `bugfix`
- [x] El primer lote tiene una nota de entrada en la vault

## Evidencia esperada

- Codigo: scripts y docs alineados
- Tests / checks: `curl` a rutas reales y `pnpm smoke:local`
- Docs / changelog: actualizacion en `README`, `LOCAL-SETUP` y `docs/pm-vault`

## Riesgos abiertos

- El warning de lockfile externo sigue apareciendo al arrancar Next.
- `layout` sigue registrando warning por schema legacy.
