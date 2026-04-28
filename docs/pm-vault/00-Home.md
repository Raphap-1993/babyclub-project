---
type: vault-home
project: babyclub-monorepo
updated: 2026-04-25
---

# BabyClub PM Vault

Esta carpeta ya no es la memoria operativa principal. La operacion diaria vive en `/Users/rapha/Documents/Obsidian Vault/20_Projects/babyclub-monorepo`.

Usa este mirror para dejar referencias tecnicas junto al repo cuando sea util.

## Navegacion

- Vault real: `/Users/rapha/Documents/Obsidian Vault/20_Projects/babyclub-monorepo`
- Dashboard real: `/Users/rapha/Documents/Obsidian Vault/20_Projects/01 Operating Dashboard.md`
- Backlog real: `/Users/rapha/Documents/Obsidian Vault/20_Projects/02 Requirements Backlog.md`
- Estado actual: [status.md](./status.md)
- Decisiones de trabajo: [decisions.md](./decisions.md)
- Matriz de trazabilidad: [traceability.md](./traceability.md)
- Requerimientos: [01-Requirements/README.md](./01-Requirements/README.md)
- Primer lote de trabajo: [01-Requirements/REQ-0003-primer-lote-requerimientos-y-correcciones.md](./01-Requirements/REQ-0003-primer-lote-requerimientos-y-correcciones.md)
- Ultimo P0 cerrado: [01-Requirements/REQ-0007-normalizar-reportes-promotor-noshow-ventas.md](./01-Requirements/REQ-0007-normalizar-reportes-promotor-noshow-ventas.md)
- Canon de arquitectura: [05-Architecture/architecture-canon.md](./05-Architecture/architecture-canon.md)
- Templates: [99-Templates/](./99-Templates/)

## Roles

- Patroclo: aterriza problema, alcance, stakeholders, criterios de aceptacion y clasifica `feature` vs `bugfix`.
- Raphael: valida impacto de arquitectura, contratos, datos, seguridad y necesidad de ADR.
- Implementacion: empieza cuando el requerimiento esta `ready` en la vault operativa o exista una excepcion explicita.

## Regla de paso a implementacion

Un requerimiento no pasa a `ready` si falta alguno de estos puntos:

- problema y objetivo claros
- alcance dentro/fuera
- criterios de aceptacion verificables
- areas impactadas del repo
- ADR relacionado o `adr_not_required: true`

## Canon actual a respetar

- Un deployment = un organizer. Ver [ADR-007](../adr/2026-03-17-007-single-tenant-architecture-decision.md).
- La arquitectura V2 sigue siendo target, no implementacion cerrada. Ver [ARCHITECTURE_V2.md](../ARCHITECTURE_V2.md).
- Multi-evento no implica multi-tenant. Ver [MULTI-EVENT-SYSTEM.md](../MULTI-EVENT-SYSTEM.md).
