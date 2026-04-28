---
id: DEC-0007
type: decision
project: babyclub-monorepo
title: Runtime de layout lee el schema real
status: accepted
owner: Raphael
created: 2026-04-24
updated: 2026-04-24
related_req: REQ-0005
adr_ref: ""
tags:
  - decision
  - layout
  - schema
---

# DEC-0007 - Runtime de layout lee el schema real

## Contexto

El flujo de layout dependia de consultar columnas opcionales por nombre fijo y usar fallback solo despues del error. Eso mantenia el sistema funcional, pero dejaba warnings innecesarios en entornos con schema parcial o legacy.

## Opciones

1. Mantener el fallback reactivo actual.
2. Quitar soporte a schemas legacy y exigir migracion completa.
3. Leer filas completas y normalizar solo los campos realmente expuestos por el entorno.

## Decision tomada

Se adopta la opcion 3.

- Las lecturas de layout usan `select("*")` y normalizan localmente metadata opcional.
- El runtime solo escribe `layout_canvas_*` si la fila del organizer expone esas columnas.
- Las mesas del diseñador se reconstruyen desde columnas `layout_*` o `pos_*` segun el schema disponible.

## Rationale

Esto elimina warnings por probing de columnas opcionales sin romper compatibilidad con entornos que todavia no tengan el contrato nuevo completo.

## Impacto

- Codigo: `landing`, backoffice layout y helper compartido
- Datos: sin migracion adicional
- Seguridad: sin impacto
- Operacion: menos ruido de schema y comportamiento mas predecible

## Promocion a ADR

- [x] No aplica
- [ ] Crear o actualizar ADR
