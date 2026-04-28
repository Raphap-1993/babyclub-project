---
type: decisions
project: babyclub-monorepo
status: active
owner: Raphael
updated: 2026-04-25
last_reviewed: 2026-04-25
---

# Decisions

## Decisiones vigentes de trabajo

### DEC-0001 - La capa de aterrizaje vive en `docs/pm-vault/`

- Obsidian se usa para aterrizar requerimientos, status y trazabilidad.
- Las decisiones arquitectonicas aprobadas se formalizan en [docs/adr/](../adr/README.md).

### DEC-0002 - Ningun requerimiento pasa a `ready` sin trazabilidad minima

- Todo `REQ` debe declarar areas impactadas, criterios de aceptacion y evidencia esperada.
- Todo `REQ` debe enlazar ADRs relacionados o marcar `adr_not_required: true`.

### DEC-0003 - Los requerimientos enlazan canon vigente, no historia suelta

- Para arquitectura base usar primero [ADR-007](../adr/2026-03-17-007-single-tenant-architecture-decision.md), [ARCHITECTURE_V2.md](../ARCHITECTURE_V2.md) y [MULTI-EVENT-SYSTEM.md](../MULTI-EVENT-SYSTEM.md).
- Los documentos historicos sirven como contexto, no como decision vigente.

### DEC-0004 - La topologia local oficial es `3000/3001/4000`

- `backoffice` corre en `3000`.
- `landing` corre en `3001`.
- `api` legacy corre en `4000`.
- Los scripts y el smoke local deben respetar esta topologia.

### DEC-0005 - Todo item nuevo entra clasificado como `feature` o `bugfix`

- Patroclo clasifica el tipo de trabajo en el intake.
- Los `bugfix` deben documentar reproduccion actual y resultado esperado.
- Los `feature` deben documentar alcance, reglas de negocio e impacto en arquitectura.

### DEC-0006 - El gate de `check-types` debe ser ejecutable de verdad

- El comando raiz no puede depender de una task inexistente en Turbo.
- Los tests incluidos por typecheck deben usar el runner y las dependencias realmente configuradas en el repo.
- Si aparece un falso negativo por tooling, se corrige antes de volver a declarar el gate como valido.

### DEC-0007 - El runtime de layout opera contra el schema real

- Las lecturas de layout no deben consultar columnas opcionales por nombre fijo y recien despues caer a fallback.
- `landing` y backoffice normalizan metadata de organizer/layout desde `select("*")`.
- El guardado de organizer solo escribe `layout_canvas_*` si la fila expone esas columnas.

### DEC-0008 - Tarjeta solo se expone cuando Culqi esta habilitado en runtime

- `NEXT_PUBLIC_CULQI_ENABLED` no basta para mostrar tarjeta en la landing.
- El backend debe reportar Culqi habilitado solo si `ENABLE_CULQI_PAYMENTS=true` y existe `CULQI_SECRET_KEY`.
- La UI publica debe ocultar "Tarjeta" si `/api/payments/status` no confirma proveedor y public key disponibles.

### DEC-0009 - Reportes operativos conservan contrato canónico exportable

- `reports/export` debe mantener columnas canónicas para asistencia, promotores, no-show QR free y ventas.
- `event_sales` usa `payments` como fuente principal y reservas confirmadas solo como fallback legacy.
- `free_qr_no_show` no mezcla tickets pagados con QR free/cortesía.

### DEC-0010 - Tipos de entrada viven como catálogo persistente por evento

- `event_ticket_types` es la fuente persistente de opciones vendibles por evento.
- `table_reservations` guarda snapshot de tipo, etiqueta y monto para compras ticket-only.
- Culqi usa el monto snapshot de la reserva; el monto enviado por cliente queda como compatibilidad, no como autoridad.
- Ver [ADR-008](../adr/2026-04-25-008-event-ticket-types-per-event.md).

## Cuando una decision debe subir a ADR

Promocionar a ADR cuando el cambio afecte alguno de estos puntos:

- limites de dominio o tenancy
- contratos API
- auth, permisos o seguridad
- modelo de datos o migraciones
- integraciones externas
- observabilidad o reglas operativas de alto impacto

## Convencion nueva para ADRs

- Los ADRs nuevos deben nacer desde [ADR-template.md](../adr/ADR-template.md).
- Convencion de archivo recomendada: `ADR-XXX-slug.md`.
