---
id: DEC-0004
type: decision
project: babyclub-monorepo
title: Topologia local oficial
status: accepted
owner: Raphael
created: 2026-04-24
updated: 2026-04-24
related_req: REQ-0002
adr_ref: ""
tags:
  - decision
  - local-dev
---

# DEC-0004 - Topologia local oficial

## Contexto

El repo tenia comandos y referencias locales ambiguas. Eso rompia el flujo de arranque y hacia que `landing`, `backoffice` y el `api` legacy no quedaran alineados entre scripts, smoke y URLs cruzadas.

## Opciones

1. Mantener puertos implicitos de Next y resolver manualmente por sesion.
2. Fijar puertos oficiales por servicio y alinear scripts, docs y smoke.

## Decision tomada

Se fija la topologia local oficial del repo:

- `backoffice` -> `http://localhost:3000`
- `landing` -> `http://localhost:3001`
- `api` legacy -> `http://localhost:4000`

## Rationale

Esta topologia ya estaba asumida por partes del codigo y la documentacion. Formalizarla reduce friccion operativa y evita falsos negativos en smoke tests o enlaces cruzados.

## Impacto

- Codigo: scripts de dev y smoke locales
- Datos: sin impacto
- Seguridad: sin impacto
- Operacion: mejora el arranque local y la trazabilidad de soporte

## Promocion a ADR

- [x] No aplica
- [ ] Crear o actualizar ADR
