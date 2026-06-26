# PROJECT_MAP

> Mapa de navegacion del monorepo `babyclub-monorepo`. Su objetivo es evitar
> que un agente o colaborador explore a ciegas.

## Arbol de carpetas

| Ruta | Proposito |
|---|---|
| `apps/landing/` | web publica, compra, registro, ticket, nominacion y APIs publicas |
| `apps/backoffice/` | panel administrativo, eventos, codigos, scan, reservas, reportes y liquidaciones |
| `apps/api/` | servicio legacy auxiliar para assets y soporte heredado |
| `packages/shared/` | helpers compartidos de dominio y utilidades transversales |
| `packages/api-logic/` | logica reusable para reportes agregados y resumenes |
| `packages/ui/` | primitives o componentes compartidos cuando existan |
| `supabase/migrations/` | migraciones versionadas aplicables al esquema vigente |
| `supabase/manual/` | hotfixes o pasos manuales con rollback explicito |
| `scripts/` | scripts operativos, auditorias y checks |
| `scripts/local/` | bootstrap local, clon de data y apoyo al runtime aislado |
| `config/local/` | plantillas y base env del stack local |
| `docs/` | auditorias, changelogs, runbooks, ADRs y arquitectura |
| `docs/pm-vault/` | mirror repo-side de memoria operativa historica |
| `tests/` | utilidades y pruebas E2E complementarias |
| `.tmp/` | artefactos temporales locales; no es fuente de verdad |

## Rutas canonicas por tipo de artefacto

| Necesito... | Esta en... |
|---|---|
| Arranque local y puertos | `README.md`, `docs/LOCAL-SETUP-2026-02.md`, `scripts/local/`, `config/local/` |
| Flujo publico de compra y nominacion | `apps/landing/app/compra/`, `apps/landing/app/ticket/`, `apps/landing/app/api/ticket-reservations/` |
| Bandeja, detalle y export de tickets | `apps/backoffice/app/admin/tickets/`, `apps/backoffice/app/api/admin/tickets/export/`, `apps/backoffice/app/api/tickets/` |
| Registro por codigo y mesas | `apps/landing/app/registro/`, `apps/landing/app/api/reservations/`, `apps/landing/app/api/tables/` |
| Backoffice de eventos y entradas | `apps/backoffice/app/admin/events/`, `apps/backoffice/app/api/events/` |
| Codigos, lotes y reglas de QR | `apps/backoffice/app/admin/codes/`, `apps/backoffice/app/api/codes/`, `packages/shared/` |
| Scanner de puerta | `apps/backoffice/app/admin/scan/`, `apps/backoffice/app/api/scan/` |
| Reportes y dashboard | `apps/backoffice/app/admin/reportes/`, `apps/backoffice/app/admin/dashboardModel.ts`, `packages/api-logic/` |
| Reservas y liquidaciones | `apps/backoffice/app/admin/reservations/`, `apps/backoffice/app/admin/liquidaciones/` |
| Migraciones y contratos DB | `supabase/migrations/`, `supabase/manual/`, `supabase/seed.sql` |
| ADRs y decisiones reales | `docs/adr/` |
| Arquitectura objetivo | `docs/ARCHITECTURE_V2.md`, `docs/COMPONENT_ARCHITECTURE.md`, `docs/VISUAL_ARCHITECTURE.md` |

## Entrada recomendada para un agente IA

1. `AI_CONTEXT.md` - estado actual y alertas operativas
2. `AGENTS.md` - roster oficial y reglas del repo
3. `PROJECT_MAP.md` - donde buscar sin perder tiempo
4. `README.md` - comandos, scripts y topologia local
5. `docs/ARCHITECTURE_V2.md` - bounded contexts y direccion tecnica
6. `docs/adr/` - decisiones aprobadas antes de asumir arquitectura

## Memoria externa curada

- Obsidian del proyecto:
  `/Users/rapha/Documents/Obsidian Vault/20_Projects/babyclub-monorepo`

Uso esperado:

- contexto humano, handoffs, status, requirements y traceability
- no reemplaza al codigo, tests, migraciones ni ADRs del repo
