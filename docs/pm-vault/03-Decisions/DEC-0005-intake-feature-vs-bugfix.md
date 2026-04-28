---
id: DEC-0005
type: decision
project: babyclub-monorepo
title: Intake separado para feature y bugfix
status: accepted
owner: Raphael
created: 2026-04-24
updated: 2026-04-24
related_req: REQ-0002
adr_ref: ""
tags:
  - decision
  - intake
---

# DEC-0005 - Intake separado para feature y bugfix

## Contexto

El siguiente lote de trabajo mezclara requerimientos nuevos con correcciones. Si ambos entran al mismo carril sin clasificacion, se pierde claridad sobre reproduccion, alcance, criterios de aceptacion y gate de arquitectura.

## Opciones

1. Usar un template unico sin clasificacion.
2. Clasificar cada item como `feature`, `bugfix`, `operational` o `documentation` desde el intake.

## Decision tomada

Cada item nuevo entra clasificado por `work_type` antes de pasar a `ready`.

- `feature`: problema, objetivo, alcance y reglas de negocio
- `bugfix`: reproduccion actual, resultado esperado e impacto real
- `operational`: cambios de entorno, tooling, release o soporte
- `documentation`: cambios de docs o canon de trabajo

## Rationale

Esta clasificacion permite que Patroclo y Raphael hagan mejor el filtro inicial sin forzar ADRs innecesarios ni mezclar fixes chicos con cambios de arquitectura.

## Impacto

- Codigo: sin impacto directo
- Datos: sin impacto directo
- Seguridad: ayuda a identificar fixes sensibles
- Operacion: hace mas legible el backlog operativo en Obsidian

## Promocion a ADR

- [x] No aplica
- [ ] Crear o actualizar ADR
