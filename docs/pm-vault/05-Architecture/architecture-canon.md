---
type: architecture-canon
project: babyclub-monorepo
status: active
owner: Raphael
updated: 2026-04-24
---

# Architecture Canon

Antes de discutir una solucion nueva, revisar estos documentos en este orden:

1. [docs/adr/README.md](../../adr/README.md)
2. [ADR-007 - Single-tenant por deployment](../../adr/2026-03-17-007-single-tenant-architecture-decision.md)
3. [ARCHITECTURE_V2.md](../../ARCHITECTURE_V2.md)
4. [MULTI-EVENT-SYSTEM.md](../../MULTI-EVENT-SYSTEM.md)
5. [COMPONENT_ARCHITECTURE.md](../../COMPONENT_ARCHITECTURE.md)
6. [VISUAL_ARCHITECTURE.md](../../VISUAL_ARCHITECTURE.md)

## Notas de interpretacion

- El estado vigente del sistema es single-tenant por deployment.
- Multi-evento significa multiples eventos para un mismo organizer dentro del deployment actual.
- `ARCHITECTURE_V2.md` describe target architecture, no una refactorizacion ya cerrada.

## Documentos historicos a tratar con cuidado

Estos documentos pueden seguir siendo utiles como contexto, pero no deben imponerse sobre el canon vigente:

- `docs/MULTI-ORGANIZER-LAYOUT-2026-02-08.md`
- `docs/adr/2026-02-08-006-multi-organizer-layout.md`
- `docs/adr/2026-02-07-004-multi-organizer-close-reports.md`
- otros documentos de febrero 2026 que hablen de multi-organizer como aspiracion

## Gate de ADR

Abrir ADR nuevo si el requerimiento cambia:

- tenancy o aislamiento
- contratos entre apps y APIs
- auth o permisos
- modelo de datos o migraciones
- pasarelas de pago o integraciones externas
- trazabilidad operativa u observabilidad transversal
