# PM Vault

Esta carpeta es un mirror operativo dentro del repo. La vault activa de Obsidian para el trabajo diario vive en `/Users/rapha/Documents/Obsidian Vault/20_Projects/babyclub-monorepo`.

Reglas:

- Usar la vault real de Obsidian para captura diaria, backlog, handoffs y trazabilidad operativa.
- Usar `docs/pm-vault/` solo como referencia repo-side o espejo tecnico cuando haga falta dejar contexto cerca del codigo.
- Mantener `docs/adr/` como fuente formal de decisiones arquitectonicas aprobadas.
- Mantener codigo, tests, changelogs y README como artefactos canonicos de implementacion.

Vault activa:

- Proyecto: `/Users/rapha/Documents/Obsidian Vault/20_Projects/babyclub-monorepo`
- Dashboard: `/Users/rapha/Documents/Obsidian Vault/20_Projects/01 Operating Dashboard.md`
- Backlog: `/Users/rapha/Documents/Obsidian Vault/20_Projects/02 Requirements Backlog.md`
- Daily actual: `/Users/rapha/Documents/Obsidian Vault/10_Daily/2026-04-24.md`
- Mirror visible dentro del vault: `/Users/rapha/Documents/Obsidian Vault/20_Projects/babyclub-monorepo/90 Repo Mirror`

Inicio rapido:

- Home: [00-Home.md](./00-Home.md)
- Status: [status.md](./status.md)
- Decisions: [decisions.md](./decisions.md)
- Traceability: [traceability.md](./traceability.md)
- Primer lote: [REQ-0003-primer-lote-requerimientos-y-correcciones.md](./01-Requirements/REQ-0003-primer-lote-requerimientos-y-correcciones.md)
- Requirement template: [99-Templates/tpl-requirement.md](./99-Templates/tpl-requirement.md)
- ADR template: [../adr/ADR-template.md](../adr/ADR-template.md)

Flujo:

1. Capturar el item nuevo en la vault real, en `10 Operating Intake`.
2. Convertirlo en requerimiento ejecutable desde el backlog del vault.
3. Si hay decision de arquitectura, Raphael decide si basta con decision operativa o si debe promocionarse a `docs/adr/`.
4. Reflejar en el repo solo la parte tecnica estable que conviene dejar cerca del codigo.
5. Cerrar el requerimiento cuando haya evidencia de codigo/docs/tests y trazabilidad en Obsidian.
