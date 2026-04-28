# Requirements

Usa esta carpeta para requerimientos nuevos y solo para eso.

Convencion:

- Archivo: `REQ-XXXX-slug.md`
- `work_type`: `feature`, `bugfix`, `operational` o `documentation`
- Estado permitido: `draft`, `refining`, `ready`, `in_progress`, `blocked`, `done`, `cancelled`
- Un requerimiento es implementable cuando ya tiene alcance, aceptacion, areas impactadas y gate de ADR resuelto
- No mezclar varias correcciones o features no relacionadas en un mismo REQ listo para implementar; se separan antes de pasar a `ready`

Proceso:

1. Copiar [tpl-requirement.md](../99-Templates/tpl-requirement.md)
2. Asignar el siguiente ID disponible
3. Completar links a docs y areas del repo
4. Enlazar el REQ en [traceability.md](../traceability.md)
5. Actualizar [status.md](../status.md) si cambia prioridad, bloqueo o ventana de entrega
6. Si es `bugfix`, documentar reproduccion actual y resultado esperado antes de moverlo a `ready`

Ejemplo actual:

- [REQ-0001-obsidian-intake-foundation.md](./REQ-0001-obsidian-intake-foundation.md)
- [REQ-0002-local-dev-topology-and-alignment.md](./REQ-0002-local-dev-topology-and-alignment.md)
- [REQ-0003-primer-lote-requerimientos-y-correcciones.md](./REQ-0003-primer-lote-requerimientos-y-correcciones.md)
- [REQ-0004-restaurar-gate-global-check-types.md](./REQ-0004-restaurar-gate-global-check-types.md)
- [REQ-0005-normalizar-runtime-layout-contra-schema-real.md](./REQ-0005-normalizar-runtime-layout-contra-schema-real.md)
- [REQ-0006-controlar-exposicion-tarjeta-culqi.md](./REQ-0006-controlar-exposicion-tarjeta-culqi.md)
- [REQ-0007-normalizar-reportes-promotor-noshow-ventas.md](./REQ-0007-normalizar-reportes-promotor-noshow-ventas.md)
