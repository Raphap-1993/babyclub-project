---
id: DEC-0006
type: decision
project: babyclub-monorepo
title: Gate de check-types ejecutable
status: accepted
owner: Raphael
created: 2026-04-24
updated: 2026-04-24
related_req: REQ-0004
adr_ref: ""
tags:
  - decision
  - tooling
  - quality-gate
---

# DEC-0006 - Gate de check-types ejecutable

## Contexto

El status operativo ya marcaba que `pnpm check-types` no era un gate real: el comando raiz apuntaba a una task inexistente en Turbo y el backoffice arrastraba un test fuera del runner configurado.

## Opciones

1. Mantener el script roto y documentar la excepcion.
2. Eliminar el comando global y depender de checks manuales por app.
3. Restaurar el gate global y alinear los artefactos que entran al typecheck.

## Decision tomada

Se adopta la opcion 3.

- `check-types` debe existir como task valida en Turbo.
- Las apps TypeScript activas deben publicar su script `check-types` o quedar cubiertas por el gate.
- Todo test incluido por typecheck debe usar el runner y dependencias realmente configuradas en el repo.

## Rationale

Mantener un gate declarado pero no ejecutable degrada la trazabilidad tecnica y hace que el status operativo reporte una capacidad inexistente.

## Impacto

- Codigo: scripts, task de Turbo y un test del backoffice
- Datos: sin impacto
- Seguridad: sin impacto
- Operacion: mejora la confiabilidad del gate tecnico del repo

## Promocion a ADR

- [x] No aplica
- [ ] Crear o actualizar ADR
