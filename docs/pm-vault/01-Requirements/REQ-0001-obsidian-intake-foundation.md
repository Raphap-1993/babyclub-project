---
id: REQ-0001
type: requirement
title: Base Obsidian para aterrizar requerimientos
status: done
owner: Raphael
created: 2026-04-24
updated: 2026-04-24
priority: P1
domain: delivery-process
impacted_apps:
  - docs
  - repo-root
stakeholders:
  - producto
  - arquitectura
source_links:
  - README.md
depends_on: []
related_adrs: []
adr_not_required: true
related_arch_docs:
  - docs/ARCHITECTURE_V2.md
  - docs/MULTI-EVENT-SYSTEM.md
  - docs/adr/2026-03-17-007-single-tenant-architecture-decision.md
code_refs:
  - .gitignore
  - README.md
  - docs/pm-vault/README.md
  - docs/adr/ADR-template.md
test_refs:
  - git diff --check
  - pnpm exec prettier --check "README.md" "docs/adr/ADR-template.md" "docs/pm-vault/**/*.md"
release_target: n/a
tags:
  - req
  - obsidian
---

# REQ-0001 - Base Obsidian para aterrizar requerimientos

## Problema

El repo tiene mucha documentacion tecnica, pero no tenia una capa minima y consistente para capturar requerimientos nuevos, decisiones de trabajo y trazabilidad antes de implementar.

## Objetivo

Dejar listo el repo para usar Obsidian como superficie de trabajo, manteniendo a `docs/adr/` como fuente formal de decisiones aprobadas.

## Scope in

- Crear estructura base `docs/pm-vault/`
- Crear notas `status`, `decisions` y `traceability`
- Crear template de requirement y template de ADR
- Conectar el flujo desde el README del repo
- Ignorar `.obsidian/` en git para permitir configuracion local del vault

## Scope out

- Migrar documentacion historica existente
- Reescribir ADRs previos
- Implementar plugins o configuraciones de UI de Obsidian
- Resolver debt tecnico fuera del flujo documental

## Criterios de aceptacion

- Existe un home navegable para la vault operativa
- Existe un template reutilizable para nuevos requerimientos
- Existe una regla explicita para decidir si un cambio requiere ADR
- Existe una matriz de trazabilidad inicial con este requerimiento como ejemplo
- El README del repo apunta al flujo nuevo

## Impacto de arquitectura

- No cambia el runtime del producto
- Si cambia la gobernanza documental del repo
- Refuerza el uso del canon vigente y reduce el riesgo de reabrir decisiones historicas por error

## Notas de analisis y arquitectura

- Patroclo recomendo separar la vault operativa de los artefactos canonicos.
- Raphael recomendo enlazar requerimientos con canon de arquitectura y usar ADR solo para decisiones aprobadas de alto impacto.

## Resultado

- Implementado y listo para usar en el siguiente requerimiento.

## Validacion

- `git diff --check`
- `pnpm exec prettier --check "README.md" "docs/adr/ADR-template.md" "docs/pm-vault/**/*.md"`
